import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, increment, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { ref, getMetadata, listAll } from 'firebase/storage';
import { STORAGE_LIMITS, PLAN_STORAGE_LIMITS } from '@/config/storage';

// Set to 1GB
const MAX_STORAGE_LIMIT = 1 * 1024 * 1024 * 1024; // 1GB in bytes

export class StorageUsageService {
  static async trackFileUpload(userId: string, fileSize: number): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const currentUsage = userData?.usage?.storageUsed || 0;
      const userPlan = userData?.subscription?.plan || 'free';
      const planStorageLimit = PLAN_STORAGE_LIMITS[userPlan];

      // Check if upload would exceed storage limit
      if (currentUsage + fileSize > planStorageLimit) {
        throw new Error(`Storage limit exceeded for ${userPlan} plan. Please upgrade your plan or delete some files.`);
      }

      // Update storage usage
      await updateDoc(userRef, {
        'usage.storageUsed': increment(fileSize)
      });

      return true;
    } catch (error) {
      console.error('Error tracking file upload:', error);
      throw error;
    }
  }

  static async trackFileDeletion(userId: string, fileSize: number): Promise<boolean> {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Update storage usage (decrement)
      await updateDoc(userRef, {
        'usage.storageUsed': increment(-fileSize)
      });

      return true;
    } catch (error) {
      console.error('Error tracking file deletion:', error);
      throw error;
    }
  }

  static async calculateTotalStorageUsage(userId: string): Promise<number> {
    try {
      console.log('🔍 Starting storage calculation for user:', userId);
      let totalSize = 0;

      // 1. Get user's projects
      console.log('📁 Fetching user projects...');
      const projectsRef = collection(db, 'projects');
      const projectsQuery = query(projectsRef, where('userId', '==', userId));
      const projectsSnap = await getDocs(projectsQuery);
      
      console.log(`📊 Found ${projectsSnap.size} projects for user`);

      // 2. For each project, calculate storage usage
      for (const projectDoc of projectsSnap.docs) {
        const projectId = projectDoc.id;
        console.log(`\n📂 Calculating storage for project: ${projectId}`);

        // Get all tweets in the project
        const tweetsRef = collection(db, 'projects', projectId, 'tweets');
        const tweetsSnap = await getDocs(tweetsRef);
        console.log(`Found ${tweetsSnap.size} tweets in project`);

        // Process each tweet's images
        for (const tweetDoc of tweetsSnap.docs) {
          const tweet = tweetDoc.data();
          if (tweet.imageUrl) {
            try {
              // Extract storage path from imageUrl
              const imagePath = tweet.imageMetadata?.storageRef;
              if (imagePath) {
                const imageRef = ref(storage, imagePath);
                const metadata = await getMetadata(imageRef);
                totalSize += metadata.size;
                console.log(`📄 Tweet image: ${imagePath}, Size: ${this.formatStorageSize(metadata.size)}`);
              }
            } catch (error) {
              console.log(`Error getting metadata for tweet ${tweetDoc.id} image:`, error);
            }
          }
        }

        // Also check project root for any other files
        try {
          const projectStorageRef = ref(storage, `projects/${projectId}`);
          const allFiles = await listAll(projectStorageRef);
          
          for (const item of allFiles.items) {
            const metadata = await getMetadata(item);
            totalSize += metadata.size;
            console.log(`📄 Project file: ${item.name}, Size: ${this.formatStorageSize(metadata.size)}`);
          }
        } catch (error) {
          console.log(`No additional files found in project ${projectId}`);
        }
      }

      // 3. Update the user's storage usage in Firestore
      console.log('\n💾 Final storage calculation:');
      console.log(`Total storage used: ${this.formatStorageSize(totalSize)}`);
      
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        'usage.storageUsed': totalSize,
        updatedAt: new Date()
      });

      return totalSize;
    } catch (error) {
      console.error('❌ Error calculating total storage:', error);
      throw error;
    }
  }

  static async getStorageUsage(userId: string): Promise<{
    used: number;
    total: number;
    percentage: number;
  }> {
    try {
      // Get user's plan
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      const userPlan = userDoc.data()?.subscription?.plan || 'free';
      const planStorageLimit = PLAN_STORAGE_LIMITS[userPlan];

      // Calculate total storage usage
      const totalUsed = await this.calculateTotalStorageUsage(userId);

      return {
        used: totalUsed,
        total: planStorageLimit,
        percentage: (totalUsed / planStorageLimit) * 100
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      throw error;
    }
  }

  static async calculateFileSize(storageRef: string): Promise<number> {
    try {
      const fileRef = ref(storage, storageRef);
      const metadata = await getMetadata(fileRef);
      return metadata.size;
    } catch (error) {
      console.error('Error calculating file size:', error);
      throw error;
    }
  }

  static formatStorageSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
} 