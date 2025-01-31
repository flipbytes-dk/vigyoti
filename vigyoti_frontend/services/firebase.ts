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
  runTransaction
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import type { FirebaseUser, Project, Content, Tweet } from '../types/firebase';
import { PLAN_CREDITS, PLAN_POST_LIMITS } from '../types/subscription';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { User } from 'firebase/auth';

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
        trialEnd: Timestamp.fromDate(new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000)),
        usageThisMonth: {
          posts: 0,
          credits: 0,
          storage: 0,
        }
      },
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
      userId,
      name: 'My Workspace',
      isDefault: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const projectData = {
      id: projectRef.id,
      workspaceId: workspaceRef.id,
      userId,
      name: 'My First Project',
      description: 'Default project created with your account',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await Promise.all([
      setDoc(workspaceRef, workspaceData),
      setDoc(projectRef, projectData),
      updateDoc(userRef, {
        currentWorkspaceId: workspaceRef.id,
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
  static async createProject(userId: string, workspaceId: string, data: Partial<Project>): Promise<string> {
    const projectRef = doc(collection(db, 'projects'));
    const projectData: Project = {
      id: projectRef.id,
      userId,
      workspaceId,
      name: data.name || 'Untitled Project',
      description: data.description,
      sourceType: data.sourceType || 'custom',
      sourceUrl: data.sourceUrl,
      status: 'draft',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(projectRef, projectData);
    return projectRef.id;
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
  static async trackUsage(userId: string, type: 'post' | 'credit' | 'storage', amount: number): Promise<boolean> {
    const usageRef = doc(db, 'usage', userId);
    const userRef = doc(db, 'users', userId);

    try {
      const result = await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const usageDoc = await transaction.get(usageRef);
        
        if (!userDoc.exists() || !usageDoc.exists()) {
          throw new Error('User or usage document not found');
        }

        const userData = userDoc.data();
        const usageData = usageDoc.data();
        const plan = userData.subscription.plan;

        // Check limits based on plan
        switch (type) {
          case 'post':
            if (plan === 'free' && usageData.monthlyPosts + amount > PLAN_POST_LIMITS.free) {
              return false;
            }
            transaction.update(usageRef, {
              monthlyPosts: increment(amount)
            });
            break;

          case 'credit':
            if (usageData.monthlyCredits + amount > PLAN_CREDITS[plan]) {
              return false;
            }
            transaction.update(usageRef, {
              monthlyCredits: increment(amount)
            });
            break;

          case 'storage':
            // Implement storage limits if needed
            break;
        }

        return true;
      });

      return result;
    } catch (error) {
      console.error('Error tracking usage:', error);
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
  static monitorAuthWithSubscription(callback: (user: User | null, isSubscribed: boolean) => void) {
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