'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Tweet } from '../types/tweet';

interface EditContextType {
  editingTweet: Tweet | null;
  videoSummary: string;
}

export const EditContext = createContext<EditContextType>({
  editingTweet: null,
  videoSummary: ''
});

interface EditProviderProps {
  children: ReactNode;
  editingTweet: Tweet | null;
  videoSummary: string;
}

export const EditProvider = ({ children, editingTweet, videoSummary }: EditProviderProps) => {
  return (
    <EditContext.Provider value={{ editingTweet, videoSummary }}>
      {children}
    </EditContext.Provider>
  );
};

export const useEdit = () => useContext(EditContext); 