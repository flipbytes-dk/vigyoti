import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FirebaseService } from '../services/firebase';
import { doc, collection, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Workspace {
  id: string;
  name: string;
  userId: string;
  isDefault: boolean;
}

export function useWorkspace() {
  const { data: session } = useSession();
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspace() {
      if (!session?.user?.id) return;

      try {
        // Get user data to check for current workspace
        const user = await FirebaseService.getUser(session.user.id);
        if (!user?.currentWorkspaceId) {
          // Create default workspace if none exists
          const workspaceRef = doc(collection(db, 'workspaces'));
          const workspaceData = {
            id: workspaceRef.id,
            userId: session.user.id,
            name: 'My Workspace',
            isDefault: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          await setDoc(workspaceRef, workspaceData);
          await FirebaseService.updateUser(session.user.id, {
            currentWorkspaceId: workspaceRef.id,
          });
          setSelectedWorkspace(workspaceData);
        } else {
          // Load existing workspace
          const workspaceRef = doc(db, 'workspaces', user.currentWorkspaceId);
          const workspaceSnap = await getDoc(workspaceRef);
          if (workspaceSnap.exists()) {
            setSelectedWorkspace(workspaceSnap.data() as Workspace);
          }
        }
      } catch (error) {
        console.error('Error loading workspace:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [session?.user?.id]);

  return { selectedWorkspace, isLoading };
} 