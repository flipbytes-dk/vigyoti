import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp,
  increment,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { FirebaseUser, Project, Content, Tweet } from '../types/firebase';
import { PLAN_POST_LIMITS } from '../types/subscription';
import { getAuth, onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';

export interface ContentGenerationRequest {
  url?: string;
  content_type: 'short' | 'long' | 'thread' | 'quote' | 'poll';
  num_tweets: number;
  additional_context?: string;
  generate_image: boolean;
  is_premium: boolean;
  project_id: string;
  workspace_id: string;
  user_id: string;
  file?: File;  // For audio, image, document uploads
}

// Credit costs configuration
const CREDIT_COSTS = {
  base: {
    youtube: 15,    // Higher cost due to video processing
    blog: 10,       // Base cost for blog/article
    audio: 20,      // Higher cost due to audio transcription
    image: 12,      // Base cost for image analysis
    document: 15,   // Base cost for document processing
    custom: 8       // Lower cost for custom text
  },
  features: {
    image_generation: 20,
    premium: 15,
    thread_per_tweet: 5
  }
} as const;

export class FirebaseService {
  // User Operations
  static async createUser(userId: string, email: string, name: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const trialPeriodDays = 14; // 14-day trial
    
    const userData: FirebaseUser = {
      id: userId,
      email,
      name,
      subscription: {
        plan: 'free',
        status: 'trial',
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000)),
        trialEnd: Timestamp.fromDate(new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000))
      },
      usage: {
        postsThisMonth: 0,
        creditsThisMonth: 0,
        storageUsed: 0
      },
      credits: {
        available: 100,
        used: 0,
        total: 100,
        lastRefill: Timestamp.now(),
        nextRefill: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      },
      workspaces: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(userRef, userData);

    // Create usage tracking document
    const usageRef = doc(db, 'usage', userId);
    await setDoc(usageRef, {
      userId,
      monthlyPosts: 0,
      monthlyCredits: 0,
      storageUsed: 0,
      lastResetDate: Timestamp.now(),
    });

    // Create default workspace and project
    const workspaceRef = doc(collection(db, 'workspaces'));
    const projectRef = doc(collection(db, 'projects'));
    
    const workspaceData = {
      id: workspaceRef.id,
      ownerId: userId,
      name: 'My Workspace',
      description: 'Default workspace',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const projectData = {
      id: projectRef.id,
      workspaceId: workspaceRef.id,
      userId,
      name: 'My First Project',
      description: 'Default project created with your account',
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await Promise.all([
      setDoc(workspaceRef, workspaceData),
      setDoc(projectRef, projectData),
      updateDoc(userRef, {
        currentWorkspaceId: workspaceRef.id,
        workspaces: [workspaceRef.id],
        updatedAt: serverTimestamp(),
      })
    ]);
  }

  static async getUser(userId: string): Promise<FirebaseUser | null> {
    try {
      console.log('📥 Getting user from Firestore:', { userId });
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      console.log('✅ User document snapshot:', { exists: userSnap.exists() });
      return userSnap.exists() ? userSnap.data() as FirebaseUser : null;
    } catch (error) {
      console.error('🚨 Error getting user:', { userId, error });
      throw error;
    }
  }

  static async getUserByEmail(email: string): Promise<FirebaseUser | null> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as FirebaseUser;
  }

  static async getUserByStripeCustomerId(stripeCustomerId: string): Promise<FirebaseUser | null> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('stripeCustomerId', '==', stripeCustomerId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    return querySnapshot.docs[0].data() as FirebaseUser;
  }

  static async updateUser(userId: string, data: Partial<FirebaseUser>): Promise<void> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  // Project Operations
  static async waitForAuth(): Promise<FirebaseAuthUser> {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    // If already authenticated, return current user
    if (currentUser) {
      console.log('User already authenticated:', currentUser.uid);
      return currentUser;
    }

    // Wait for auth state to be ready
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | null = null;
      let timeoutId: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (unsubscribe) unsubscribe();
        if (timeoutId) clearTimeout(timeoutId);
      };

      // Set a timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Auth timeout - please sign in again'));
      }, 5000);

      // Listen for auth state changes
      unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', { 
          userId: user?.uid,
          email: user?.email
        });

        cleanup();
        
        if (user) {
          resolve(user);
        } else {
          reject(new Error('No authenticated user'));
        }
      }, (error) => {
        console.error('Auth state change error:', error);
        cleanup();
        reject(error);
      });
    });
  }

  static async createProject(userId: string, workspaceId: string, data: { name: string; description?: string; sourceType?: string; sourceUrl?: string }) {
    try {
      console.log('🚀 Starting project creation:', { userId, workspaceId, data });

      // Initialize auth
      const auth = getAuth();
      console.log('🔐 Initial auth state:', {
        currentUser: auth.currentUser?.uid,
        requestedUserId: userId,
        isInitialized: auth.currentUser !== undefined
      });

      // Wait for auth to be ready
      const user = await FirebaseService.waitForAuth();
      console.log('👤 Auth state ready:', { 
        isAuthenticated: !!user,
        currentUserId: user.uid,
        requestedUserId: userId,
        match: user.uid === userId
      });

      // Verify workspace exists
      const workspaceRef = doc(db, 'workspaces', workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      
      if (!workspaceSnap.exists()) {
        console.error('🚨 Workspace not found:', workspaceId);
        throw new Error('Workspace not found');
      }

      console.log('✅ Workspace verified:', { 
        workspaceId,
        exists: workspaceSnap.exists()
      });

      // Create project document
      const projectRef = doc(collection(db, 'projects'));
      const projectData = {
        id: projectRef.id,
        workspaceId,
        userId: user.uid, // Use the authenticated user's ID
        name: data.name,
        description: data.description || '',
        sourceType: data.sourceType || 'custom',
        sourceUrl: data.sourceUrl || '',
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('📝 Project data to write:', projectData);

      await setDoc(projectRef, projectData);
      console.log('✅ Project created successfully:', projectRef.id);
      
      return projectRef.id;
    } catch (error) {
      console.error('🚨 Error creating project:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }

  static async getProject(projectId: string): Promise<Project | null> {
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    return projectSnap.exists() ? projectSnap.data() as Project : null;
  }

  static async getUserProjects(userId: string): Promise<Project[]> {
    const projectsQuery = query(
      collection(db, 'projects'),
      where('userId', '==', userId)
    );
    const projectsSnap = await getDocs(projectsQuery);
    return projectsSnap.docs.map(doc => doc.data() as Project);
  }

  // Content Operations
  static async createContent(projectId: string, userId: string, data: Partial<Content>): Promise<string> {
    const contentRef = doc(collection(db, 'projects', projectId, 'content'));
    const contentData: Content = {
      id: contentRef.id,
      projectId,
      userId,
      type: data.type || 'text',
      originalContent: data.originalContent || {},
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(contentRef, contentData);
    return contentRef.id;
  }

  // Tweet Operations
  static async createTweet(projectId: string, userId: string, data: Partial<Tweet>): Promise<string> {
    const tweetRef = doc(collection(db, 'projects', projectId, 'tweets'));
    const tweetData: Tweet = {
      id: tweetRef.id,
      projectId,
      userId,
      contentId: data.contentId || '',
      text: data.text || '',
      isThread: data.isThread || false,
      threadPosition: data.threadPosition,
      status: 'draft',
      imageUrl: data.imageUrl,
      imageMetadata: data.imageMetadata,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(tweetRef, tweetData);
    return tweetRef.id;
  }

  static async uploadImage(projectId: string, tweetId: string, imageBlob: Blob): Promise<string> {
    const timestamp = Date.now();
    const imagePath = `projects/${projectId}/tweets/${tweetId}/images/${timestamp}.png`;
    const imageRef = ref(storage, imagePath);
    
    await uploadBytes(imageRef, imageBlob);
    const imageUrl = await getDownloadURL(imageRef);
    
    return imageUrl;
  }

  // Add usage tracking methods
  static async checkUserCredits(userId: string): Promise<boolean> {
    try {
      console.log('🔍 Checking user credits:', { userId });
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error('❌ User not found:', userId);
        return false;
      }

      const userData = userDoc.data() as FirebaseUser;
      const availableCredits = userData.credits?.available || 0;
      const postsThisMonth = userData.usage?.postsThisMonth || 0;
      const plan = userData.subscription?.plan || 'free';
      const postLimit = PLAN_POST_LIMITS[plan] || 0;

      console.log('💳 User credit status:', {
        availableCredits,
        postsThisMonth,
        postLimit,
        plan,
        hasCredits: availableCredits > 0,
        withinLimit: postsThisMonth < postLimit,
        canProceed: availableCredits > 0 && postsThisMonth < postLimit
      });

      // Check both credits and monthly post limit
      return availableCredits > 0 && postsThisMonth < postLimit;
    } catch (error) {
      console.error('❌ Error checking user credits:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  static async deductCredits(userId: string, amount: number): Promise<boolean> {
    try {
      console.log('💸 Deducting credits:', { userId, amount });
      
      const userRef = doc(db, 'users', userId);
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        const userData = userDoc.data() as FirebaseUser;
        const currentCredits = userData.credits?.available || 0;
        
        console.log('Current credit status:', {
          currentCredits,
          deductingAmount: amount,
          remainingAfterDeduction: currentCredits - amount
        });

        if (currentCredits < amount) {
          throw new Error('Insufficient credits');
        }

        transaction.update(userRef, {
          'credits.available': increment(-amount),
          'credits.used': increment(amount),
          'usage.postsThisMonth': increment(1),
          updatedAt: serverTimestamp()
        });
      });

      console.log('✅ Credits deducted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error deducting credits:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  static getEndpointForContentType(sourceType: string): string {
    switch (sourceType) {
      case 'youtube':
        return 'youtube-to-twitter';
      case 'blog':
        return 'url-to-twitter';
      case 'audio':
        return 'audio-to-twitter';
      case 'image':
        return 'image-to-twitter';
      case 'document':
        return 'document-to-twitter';
      case 'custom':
        return 'text-to-twitter';
      default:
        throw new Error(`Unsupported content type: ${sourceType}`);
    }
  }

  static calculateCreditCost(sourceType: string, request: ContentGenerationRequest): number {
    try {
      // Get base cost for the content type
      const baseCostPerTweet = CREDIT_COSTS.base[sourceType as keyof typeof CREDIT_COSTS.base] || 10;
      let totalCost = baseCostPerTweet * request.num_tweets;

      // Add feature costs
      if (request.generate_image) {
        totalCost += CREDIT_COSTS.features.image_generation;
      }
      if (request.is_premium) {
        totalCost += CREDIT_COSTS.features.premium;
      }
      if (request.content_type === 'thread') {
        totalCost += request.num_tweets * CREDIT_COSTS.features.thread_per_tweet;
      }

      console.log('💳 Credit cost breakdown:', {
        sourceType,
        baseCostPerTweet,
        totalTweets: request.num_tweets,
        baseCost: baseCostPerTweet * request.num_tweets,
        imageGeneration: request.generate_image ? CREDIT_COSTS.features.image_generation : 0,
        premium: request.is_premium ? CREDIT_COSTS.features.premium : 0,
        threadCost: request.content_type === 'thread' ? request.num_tweets * CREDIT_COSTS.features.thread_per_tweet : 0,
        totalCost
      });

      return totalCost;
    } catch (error) {
      console.error('❌ Error calculating credit cost:', error);
      // Return a default high cost to prevent free usage in case of errors
      return 50;
    }
  }

  static async trackUsage(
    userId: string, 
    sourceType: string,
    contentRequest: ContentGenerationRequest,
    token: string
  ): Promise<boolean> {
    try {
      console.log('📊 Tracking usage:', { userId, sourceType, contentRequest });
      
      // First check if user has sufficient credits
      const hasCredits = await FirebaseService.checkUserCredits(userId);
      if (!hasCredits) {
        console.log('❌ Insufficient credits or reached post limit');
        return false;
      }

      // Calculate credit cost before making the API call
      const creditCost = FirebaseService.calculateCreditCost(sourceType, contentRequest);
      console.log('💰 Estimated credit cost:', creditCost);

      // Get the appropriate endpoint
      const endpoint = FirebaseService.getEndpointForContentType(sourceType);
      console.log('🎯 Using endpoint:', endpoint);

      // Prepare form data if we have a file
      let requestBody: any;
      let headers: HeadersInit = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // For file uploads (audio, image, document)
      if (contentRequest.file) {
        const formData = new FormData();
        formData.append('file', contentRequest.file);
        formData.append('content_type', contentRequest.content_type);
        formData.append('num_tweets', contentRequest.num_tweets.toString());
        if (contentRequest.additional_context) {
          formData.append('additional_context', contentRequest.additional_context);
        }
        formData.append('generate_image', contentRequest.generate_image.toString());
        formData.append('is_premium', contentRequest.is_premium.toString());
        requestBody = formData;
        // Remove Content-Type header for FormData
        delete headers['Content-Type'];
      } else {
        // For URL-based content (YouTube, blog)
        requestBody = JSON.stringify({
          url: contentRequest.url,
          content_type: contentRequest.content_type,
          num_tweets: contentRequest.num_tweets,
          additional_context: contentRequest.additional_context,
          generate_image: contentRequest.generate_image,
          is_premium: contentRequest.is_premium,
          project_id: contentRequest.project_id,
          workspace_id: contentRequest.workspace_id,
          user_id: contentRequest.user_id
        });
      }

      console.log('🚀 Making API request:', {
        endpoint,
        method: 'POST',
        headers,
        bodyPreview: contentRequest.file ? 'FormData with file' : requestBody
      });

      // Make API call to generate content
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/v1/content-sources/${endpoint}`,
        {
          method: 'POST',
          headers,
          body: requestBody
        }
      );

      console.log('📡 API Response:', { 
        status: response.status, 
        statusText: response.statusText,
        endpoint
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ API call failed:', {
          status: response.status,
          statusText: response.statusText,
          endpoint,
          error: errorData
        });
        return false;
      }

      const responseData = await response.json();
      console.log('✅ API call successful:', responseData);

      // If content generation was successful, deduct credits
      const deducted = await FirebaseService.deductCredits(userId, creditCost);
      if (!deducted) {
        console.error('❌ Failed to deduct credits');
        return false;
      }

      console.log('✅ Usage tracked and credits deducted successfully');
      return true;
    } catch (error) {
      console.error('❌ Error in trackUsage:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      return false;
    }
  }

  // Add subscription check function
  static async checkUserSubscription(userId: string): Promise<boolean> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData?.subscription?.status === 'active'; // Assuming subscription data structure
    }
    return false;
  }

  // Add auth state listener with subscription check
  static monitorAuthWithSubscription(callback: (user: FirebaseAuthUser | null, isSubscribed: boolean) => void) {
    return onAuthStateChanged(getAuth(), async (user) => {
      if (user) {
        const isSubscribed = await FirebaseService.checkUserSubscription(user.uid);
        callback(user, isSubscribed);
      } else {
        callback(null, false);
      }
    });
  }
}

export default FirebaseService; 