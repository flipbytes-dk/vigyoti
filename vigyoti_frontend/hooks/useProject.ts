import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  description?: string;
  sourceType: 'custom' | 'url' | 'rss';
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function useProject() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const loadProject = async () => {
      if (session?.user?.id) {
        const storedProjectId = localStorage.getItem('selectedProjectId');
        if (storedProjectId) {
          try {
            const projectDoc = await getDoc(doc(db, 'projects', storedProjectId));
            if (projectDoc.exists()) {
              const projectData = projectDoc.data();
              setSelectedProject({
                id: projectDoc.id,
                name: projectData.name,
                description: projectData.description,
                sourceType: projectData.sourceType,
                sourceUrl: projectData.sourceUrl,
                createdAt: projectData.createdAt.toDate(),
                updatedAt: projectData.updatedAt.toDate()
              });
            } else {
              // If project doesn't exist, remove it from localStorage
              localStorage.removeItem('selectedProjectId');
              setSelectedProject(null);
            }
          } catch (error) {
            console.error('Error loading project:', error);
            setSelectedProject(null);
          }
        }
      }
    };

    loadProject();
  }, [session?.user?.id]);

  const selectProject = (project: Project) => {
    setSelectedProject(project);
    localStorage.setItem('selectedProjectId', project.id);
  };

  return {
    selectedProject,
    selectProject
  };
} 