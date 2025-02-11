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
  deleteDoc,
  arrayUnion,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { FirebaseUser, Project, Content, Tweet, Workspace } from '../types/firebase';
import { PLAN_POST_LIMITS, PLAN_FEATURES, CREDIT_COSTS } from '../types/subscription';
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

  static async createWorkspace(userId: string, name: string, description?: string): Promise<string> {
    try {
      // Check if workspace name already exists for this user
      const workspacesRef = collection(db, 'workspaces');
      const existingWorkspacesQuery = query(
        workspacesRef,
        where('ownerId', '==', userId)
      );
      const existingWorkspaces = await getDocs(existingWorkspacesQuery);

      // Check name uniqueness
      const nameExists = existingWorkspaces.docs.some((doc: QueryDocumentSnapshot<DocumentData>) => 
        doc.data().name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        throw new Error('A workspace with this name already exists');
      }

      // Get user's subscription plan
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data() as FirebaseUser;
      const plan = userData.subscription?.plan || 'free';

      // Check workspace limit
      if (existingWorkspaces.size >= PLAN_FEATURES[plan].maxWorkspaces) {
        throw new Error(`You have reached the maximum number of workspaces allowed in your ${plan} plan`);
      }

      // Create workspace with unique name
      const workspaceRef = doc(workspacesRef);
      const workspaceData: Workspace = {
        id: workspaceRef.id,
        ownerId: userId,
        name: name,
        description: description || `Workspace created on ${new Date().toLocaleDateString()}`,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(workspaceRef, workspaceData);

      // Update user's workspaces array
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        workspaces: arrayUnion(workspaceRef.id),
        currentWorkspaceId: workspaceRef.id,
        updatedAt: serverTimestamp(),
      });

      return workspaceRef.id;
    } catch (error) {
      console.error('Error creating workspace:', error);
      throw error;
    }
  }

  static async createProject(userId: string, workspaceId: string, data: { 
    name: string; 
    description?: string; 
    sourceType?: string; 
    sourceUrl?: string 
  }): Promise<string> {
    try {
      // Check if project name already exists in this workspace
      const projectsRef = collection(db, 'projects');
      const existingProjectsQuery = query(
        projectsRef,
        where('workspaceId', '==', workspaceId),
        where('userId', '==', userId)
      );
      const existingProjects = await getDocs(existingProjectsQuery);

      // Check name uniqueness
      const nameExists = existingProjects.docs.some((doc: QueryDocumentSnapshot<DocumentData>) => 
        doc.data().name.toLowerCase() === data.name.toLowerCase()
      );
      if (nameExists) {
        throw new Error('A project with this name already exists in this workspace');
      }

      // Create project with unique name
      const projectRef = doc(projectsRef);
      const projectData: Project = {
        id: projectRef.id,
        workspaceId,
        userId,
        name: data.name,
        description: data.description || `Project created on ${new Date().toLocaleDateString()}`,
        sourceType: data.sourceType || 'custom',
        sourceUrl: data.sourceUrl,
        status: 'draft',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      // Initialize storage structure with a placeholder file
      const placeholderPath = `projects/${projectRef.id}/.placeholder`;
      const placeholderRef = ref(storage, placeholderPath);
      const placeholderContent = new Blob([''], { type: 'text/plain' });
      
      // Create project document and storage structure in parallel
      await Promise.all([
        setDoc(projectRef, projectData),
        uploadBytes(placeholderRef, placeholderContent, {
          contentType: 'text/plain',
          customMetadata: {
            projectId: projectRef.id,
            userId,
            createdAt: Timestamp.now().toMillis().toString()
          }
        })
      ]);

      console.log('✅ Created project with storage structure:', {
        projectId: projectRef.id,
        storagePath: `projects/${projectRef.id}`
      });

      return projectRef.id;
    } catch (error) {
      console.error('Error creating project:', error);
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
      isPremiumContent: data.isPremiumContent || false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(tweetRef, tweetData);
    return tweetRef.id;
  }

  static async uploadImage(projectId: string, tweetId: string, imageBlob: Blob): Promise<string> {
    try {
      console.log('📤 Starting image upload process:', { projectId, tweetId });
      
      // Ensure we have valid data
      if (!projectId || !tweetId || !imageBlob) {
        throw new Error('Missing required parameters for image upload');
      }

      // Verify that the image blob is actually an image
      if (!imageBlob.type.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
      }

      // Create the full path including all necessary folders
      const timestamp = Date.now();
      const imagePath = `projects/${projectId}/tweets/${tweetId}/images/generated_${timestamp}.png`;
      console.log('🔄 Generated image path:', imagePath);

      // Create a reference to the image location
      const imageRef = ref(storage, imagePath);
      
      // Set proper metadata for the upload
      const metadata = {
        contentType: 'image/png',
        customMetadata: {
          projectId,
          tweetId,
          uploadedAt: timestamp.toString(),
          uploadType: 'generated'
        }
      };

      // Attempt to upload the image
      console.log('🔄 Uploading image with metadata:', metadata);
      await uploadBytes(imageRef, imageBlob, metadata);
      
      // Get the download URL
      console.log('✅ Upload successful, retrieving download URL');
      const imageUrl = await getDownloadURL(imageRef);
      console.log('🔗 Image URL generated:', imageUrl);
      
      return imageUrl;
    } catch (error) {
      console.error('❌ Error in uploadImage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during image upload';
      throw new Error(`Failed to upload image: ${errorMessage}`);
    }
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

  static async deductCredits(userId: string, amount: number, usageType: 'tweets' | 'threads' | 'videos' | 'images' | 'rewrites' | 'storage' = 'tweets'): Promise<boolean> {
    try {
      console.log('💸 Deducting credits:', { userId, amount, usageType });
      
      const userRef = doc(db, 'users', userId);
      const creditsRef = doc(db, 'credits', userId);
      
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const creditsDoc = await transaction.get(creditsRef);
        
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

        const newAvailable = currentCredits - amount;
        const newUsed = (userData.credits?.used || 0) + amount;

        // Update user document
        transaction.update(userRef, {
          'credits.available': newAvailable,
          'credits.used': newUsed,
          'usage.postsThisMonth': increment(1),
          updatedAt: serverTimestamp()
        });

        // Update credits collection
        if (creditsDoc.exists()) {
          const creditsData = creditsDoc.data();
          transaction.update(creditsRef, {
            available: newAvailable,
            used: newUsed,
            updatedAt: serverTimestamp(),
            [`usageBreakdown.${usageType}`]: increment(amount)
          });
        } else {
          // Create new credits document if it doesn't exist
          transaction.set(creditsRef, {
            userId,
            available: newAvailable,
            total: userData.credits.total,
            used: newUsed,
            lastRefillDate: userData.credits.lastRefill,
            nextRefillDate: userData.credits.nextRefill,
            canPurchaseCredits: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            usageBreakdown: {
              tweets: usageType === 'tweets' ? amount : 0,
              threads: usageType === 'threads' ? amount : 0,
              videos: usageType === 'videos' ? amount : 0,
              images: usageType === 'images' ? amount : 0,
              rewrites: usageType === 'rewrites' ? amount : 0,
              storage: usageType === 'storage' ? amount : 0
            }
          });
        }
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
      // Base cost is 1 credit per tweet
      let totalCost = CREDIT_COSTS.generateTweet * request.num_tweets;

      // Add image generation cost if enabled
      if (request.generate_image) {
        totalCost += CREDIT_COSTS.generateImage;
      }

      console.log('💳 Credit cost breakdown:', {
        sourceType,
        numTweets: request.num_tweets,
        baseCost: CREDIT_COSTS.generateTweet * request.num_tweets,
        imageGeneration: request.generate_image ? CREDIT_COSTS.generateImage : 0,
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

      // Calculate credit cost
      const creditCost = FirebaseService.calculateCreditCost(sourceType, contentRequest);
      console.log('💰 Estimated credit cost:', creditCost);

      // Deduct credits
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

  static async storeGeneratedTweets(projectId: string, userId: string, tweets: Tweet[]): Promise<string[]> {
    try {
      console.log('📝 Storing generated tweets:', { projectId, userId, numTweets: tweets.length });
      
      const tweetRefs = tweets.map(tweet => {
        const tweetRef = doc(collection(db, 'projects', projectId, 'tweets'));
        
        // Create base tweet data with required fields
        const tweetData: any = {
          id: tweetRef.id,
          projectId,
          userId,
          text: tweet.text || '',  // Ensure text is never undefined
          isThread: Boolean(tweet.isThread),  // Convert to boolean
          status: tweet.status || 'draft',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        // Only add optional fields if they exist and are not undefined/null
        if (tweet.threadPosition !== undefined && tweet.threadPosition !== null) {
          tweetData.threadPosition = tweet.threadPosition;
        }

        if (tweet.imageUrl && typeof tweet.imageUrl === 'string') {
          tweetData.imageUrl = tweet.imageUrl;
        }

        if (tweet.imageMetadata && Object.keys(tweet.imageMetadata).length > 0) {
          tweetData.imageMetadata = tweet.imageMetadata;
        }

        if (tweet.isPremiumContent !== undefined && tweet.isPremiumContent !== null) {
          tweetData.isPremiumContent = Boolean(tweet.isPremiumContent);
        }

        if (tweet.contentId && typeof tweet.contentId === 'string') {
          tweetData.contentId = tweet.contentId;
        }

        // Log the final tweet data for debugging
        console.log('Tweet data to be stored:', JSON.stringify(tweetData, null, 2));

        return {
          ref: tweetRef,
          data: tweetData
        };
      });

      // Store all tweets in parallel
      await Promise.all(
        tweetRefs.map(({ ref, data }) => setDoc(ref, data))
      );

      console.log('✅ Successfully stored tweets');
      return tweetRefs.map(({ ref }) => ref.id);
    } catch (error) {
      console.error('❌ Error storing tweets:', error);
      throw error;
    }
  }

  static async getProjectTweets(projectId: string): Promise<Tweet[]> {
    try {
      console.log('🔍 Getting tweets for project:', projectId);
      
      const tweetsRef = collection(db, 'projects', projectId, 'tweets');
      const tweetsSnapshot = await getDocs(tweetsRef);
      
      const tweets = tweetsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
      })) as Tweet[];

      console.log('✅ Retrieved tweets:', tweets.length);
      return tweets;
    } catch (error) {
      console.error('❌ Error getting tweets:', error);
      throw error;
    }
  }

  static async updateTweet(projectId: string, tweetId: string, data: Partial<Tweet>): Promise<void> {
    try {
      console.log('📝 Updating tweet:', { projectId, tweetId, data });
      
      const tweetRef = doc(db, 'projects', projectId, 'tweets', tweetId);
      await updateDoc(tweetRef, {
        ...data,
        updatedAt: Timestamp.now(),
      });

      console.log('✅ Tweet updated successfully');
    } catch (error) {
      console.error('❌ Error updating tweet:', error);
      throw error;
    }
  }
}

export default FirebaseService; 