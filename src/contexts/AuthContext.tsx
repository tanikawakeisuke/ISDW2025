'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';

interface AuthContextType {
  user: { uid: string; isAnonymous: boolean } | null;
  userData: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  updateUserData: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<{ uid: string; isAnonymous: boolean } | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const loadUserData = async (testUser: { uid: string; isAnonymous: boolean }) => {
    // Create offline test user data
    const newUserData: User = {
      id: testUser.uid,
      isAnonymous: testUser.isAnonymous,
      pigmentsCollected: [],
      dailyCollectionCount: 0,
    };
    
    setUserData(newUserData);
    console.log('Using offline test user data to save Firebase quota');
  };

  const signIn = async () => {
    try {
      const testUser = { uid: 'test-user', isAnonymous: true };
      setUser(testUser);
      await loadUserData(testUser);
    } catch (error) {
      console.error('Sign in failed:', error);
    }
  };

  const updateUserData = async (data: Partial<User>) => {
    if (!user || !userData) return;
    
    // Update locally (offline mode)
    const updatedData = { ...userData, ...data };
    setUserData(updatedData);
  };

  useEffect(() => {
    // Auto-sign in with test user to save Firebase quota
    signIn();
  }, []);

  const value: AuthContextType = {
    user,
    userData,
    loading,
    signIn,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};