import { db, storage } from '../lib/firebase';
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
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FirebaseUser, Project, Content, Tweet } from '../types/firebase';

export class FirebaseService {
  // User Operations
  static async createUser(userId: string, email: string, name: string): Promise<void> {
    const userRef = doc(db, 'users', userId);
    const userData: FirebaseUser = {
      id: userId,
      email,
      name,
      subscription: {
        plan: 'free',
        status: 'active',
        startDate: Timestamp.now(),
        endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days trial
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(userRef, userData);

    // Create default workspace
    const workspaceRef = doc(collection(db, 'workspaces'));
    const workspaceData = {
      id: workspaceRef.id,
      userId,
      name: 'My Workspace',
      isDefault: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    await setDoc(workspaceRef, workspaceData);

    // Update user with default workspace
    await updateDoc(userRef, {
      currentWorkspaceId: workspaceRef.id,
      updatedAt: serverTimestamp(),
    });
  }

  static async getUser(userId: string): Promise<FirebaseUser | null> {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() as FirebaseUser : null;
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
}

export default FirebaseService; 