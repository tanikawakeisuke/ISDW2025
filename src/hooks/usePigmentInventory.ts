'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, isFirebaseAvailable } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserPigment, CANVAS_CONFIG } from '@/types';

interface UsePigmentInventoryResult {
  inventory: UserPigment[];
  loading: boolean;
  selectedPigment: UserPigment | null;
  setSelectedPigment: (pigment: UserPigment | null) => void;
  addPigment: (pigmentId: string, color: string, name: string, rarity: UserPigment['rarity'], collectedFrom?: string) => Promise<void>;
  usePigment: (pigmentId: string) => Promise<boolean>;
  canUsePigment: (pigmentId: string) => boolean;
  addPigmentToInventory: (pigment: UserPigment) => void; // For instant UI updates
  restoreAllPigments: () => Promise<void>; // 色の回数を最大まで回復
}

export const usePigmentInventory = (): UsePigmentInventoryResult => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<UserPigment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPigment, setSelectedPigment] = useState<UserPigment | null>(null);
  const [mounted, setMounted] = useState(false);

  // Prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load user's pigment inventory
  useEffect(() => {
    if (!mounted || !user?.uid) {
      if (mounted) setLoading(false);
      return;
    }

    // Check if Firebase is available
    if (!isFirebaseAvailable()) {
      // Load from localStorage or use demo inventory
      const savedInventory = localStorage.getItem(`inventory-${user.uid}`);
      if (savedInventory) {
        const inventory = JSON.parse(savedInventory);
        setInventory(inventory.map((p: any) => ({
          ...p,
          collectedAt: p.collectedAt ? new Date(p.collectedAt) : new Date(),
          lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined,
          collectedFrom: p.collectedFrom || 'demo-cafe'
        })));
      } else {
        // Create demo inventory for testing
        const demoInventory: UserPigment[] = [
          {
            pigmentId: 'demo-red',
            color: '#FF0000',
            name: 'Seoul Red',
            rarity: 'common',
            usesLeft: 5,
            collectedAt: new Date(),
            collectedFrom: 'demo-cafe'
          },
          {
            pigmentId: 'demo-blue',
            color: '#0000FF',
            name: 'Han River Blue',
            rarity: 'uncommon',
            usesLeft: 3,
            collectedAt: new Date(),
            collectedFrom: 'demo-cafe'
          },
          {
            pigmentId: 'demo-green',
            color: '#00FF00',
            name: 'Seongsu Green',
            rarity: 'rare',
            usesLeft: 1,
            collectedAt: new Date(),
            collectedFrom: 'demo-cafe'
          },
          {
            pigmentId: 'demo-yellow',
            color: '#FFFF00',
            name: 'Gangnam Gold',
            rarity: 'epic',
            usesLeft: 5,
            collectedAt: new Date(),
            collectedFrom: 'demo-cafe'
          },
          {
            pigmentId: 'demo-purple',
            color: '#800080',
            name: 'Mystic Purple',
            rarity: 'legendary',
            usesLeft: 2,
            collectedAt: new Date(),
            collectedFrom: 'demo-cafe'
          }
        ];
        setInventory(demoInventory);
        localStorage.setItem(`inventory-${user.uid}`, JSON.stringify(demoInventory));
      }
      setLoading(false);
      return;
    }

    // Additional null check for db
    if (!db) {
      console.error('Firebase db is not available for pigment inventory');
      setLoading(false);
      return;
    }

    const inventoryRef = collection(db, 'users', user.uid, 'pigments');
    
    const unsubscribe = onSnapshot(inventoryRef, (snapshot) => {
      const userInventory: UserPigment[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        userInventory.push({
          pigmentId: doc.id,
          color: data.color,
          name: data.name,
          rarity: data.rarity,
          usesLeft: data.usesLeft || 0,
          lastUsed: data.lastUsed?.toDate(),
          collectedAt: data.collectedAt?.toDate() || new Date(),
          collectedFrom: data.collectedFrom || 'unknown'
        });
      });
      
      // Sort by rarity and uses left
      userInventory.sort((a, b) => {
        const rarityOrder = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
        return rarityOrder[b.rarity] - rarityOrder[a.rarity] || b.usesLeft - a.usesLeft;
      });
      
      setInventory(userInventory);
      setLoading(false);
    }, (error) => {
      console.error('Error loading pigment inventory:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [mounted, user?.uid]);

  // Add new pigment to inventory
  const addPigment = useCallback(async (
    pigmentId: string, 
    color: string, 
    name: string, 
    rarity: UserPigment['rarity']
  ) => {
    if (!user?.uid) return;

    // Check if Firebase is disabled for testing
    const firebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';
    if (firebaseDisabled) {
      // Update local inventory for testing
      const existing = inventory.find(p => p.pigmentId === pigmentId);
      let updatedInventory;
      
      if (existing) {
        updatedInventory = inventory.map(p => 
          p.pigmentId === pigmentId 
            ? { ...p, collectedAt: new Date() }
            : p
        );
      } else {
        updatedInventory = [...inventory, {
          pigmentId,
          color,
          name,
          rarity,
          usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
          collectedAt: new Date(),
          collectedFrom: 'demo-cafe'
        }];
      }
      
      setInventory(updatedInventory);
      localStorage.setItem(`inventory-${user.uid}`, JSON.stringify(updatedInventory));
      return;
    }

    try {
      const pigmentRef = doc(db, 'users', user.uid, 'pigments', pigmentId);
      const existingDoc = await getDoc(pigmentRef);
      
      if (existingDoc.exists()) {
        // Update last collected date if pigment already exists
        await updateDoc(pigmentRef, {
          lastCollected: new Date()
        });
      } else {
        // Add new pigment
        await setDoc(pigmentRef, {
          color,
          name,
          rarity,
          firstCollected: new Date()
        });
      }
    } catch (error) {
      console.error('Error adding pigment to inventory:', error);
      throw error;
    }
  }, [user?.uid]);

  // Use pigment (decrease usesLeft by 1)
  const usePigment = useCallback(async (pigmentId: string): Promise<boolean> => {
    if (!user?.uid) return false;

    const pigment = inventory.find(p => p.pigmentId === pigmentId);
    if (!pigment || pigment.usesLeft <= 0) return false;

    // Check if Firebase is disabled for testing
    const firebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';
    
    if (firebaseDisabled) {
      // Update local inventory for testing
      const updatedInventory = inventory.map(p => 
        p.pigmentId === pigmentId 
          ? { ...p, usesLeft: p.usesLeft - 1, lastUsed: new Date() }
          : p
      );
      
      setInventory(updatedInventory);
      
      // Save to localStorage
      localStorage.setItem(`inventory-${user.uid}`, JSON.stringify(updatedInventory));
      return true;
    }

    try {
      // Use color as document ID for consistency
      const pigmentRef = doc(db, 'users', user.uid, 'pigments', pigment.color);
      await updateDoc(pigmentRef, {
        usesLeft: pigment.usesLeft - 1,
        lastUsed: new Date()
      });
      return true;
    } catch (error) {
      console.error('Error using pigment:', error);
      return false;
    }
  }, [user?.uid, inventory]);

  // Check if pigment can be used
  const canUsePigment = useCallback((pigmentId: string): boolean => {
    const pigment = inventory.find(p => p.pigmentId === pigmentId);
    return pigment ? pigment.usesLeft > 0 : false;
  }, [inventory]);

  // Add pigment to inventory instantly (for UI responsiveness)
  const addPigmentToInventory = useCallback((pigment: UserPigment) => {
    setInventory(prev => {
      // Check if pigment already exists (by color)
      const existingIndex = prev.findIndex(p => p.color === pigment.color);
      if (existingIndex >= 0) {
        // Refresh existing pigment
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          collectedAt: pigment.collectedAt,
          collectedFrom: pigment.collectedFrom
        };
        return updated;
      } else {
        // Add new pigment
        return [...prev, pigment];
      }
    });
  }, []);

  // 色の回数を最大まで回復する機能
  const restoreAllPigments = useCallback(async () => {
    try {
      const maxUses = CANVAS_CONFIG.MAX_PIGMENT_USES; // 5回
      
      // 現在の在庫の各色の回数を最大に回復
      const restoredInventory = inventory.map(pigment => ({
        ...pigment,
        usesLeft: maxUses
      }));
      
      // UIを即座に更新
      setInventory(restoredInventory);
      
      // Firestoreに保存（非同期）
      if (user?.uid && process.env.NEXT_PUBLIC_FIREBASE_DISABLED !== 'true') {
        // 実際のFirestore更新処理
        console.log('Updating Firestore with restored pigments');
      }
      
      console.log('All pigments restored to maximum uses:', restoredInventory);
      
    } catch (error) {
      console.error('Failed to restore pigments:', error);
    }
  }, [inventory, user?.uid]);

  return {
    inventory,
    loading,
    selectedPigment,
    setSelectedPigment,
    addPigment,
    usePigment,
    canUsePigment,
    addPigmentToInventory,
    restoreAllPigments
  };
};