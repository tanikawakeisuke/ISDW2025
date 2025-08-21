'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

    // Check if Firebase is disabled for testing
    const firebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';
    if (firebaseDisabled) {
      // Load from localStorage or use demo inventory
      const savedInventory = localStorage.getItem(`inventory-${user.uid}`);
      if (savedInventory) {
        const inventory = JSON.parse(savedInventory);
        setInventory(inventory.map((p: any) => ({
          ...p,
          collectedAt: p.collectedAt ? new Date(p.collectedAt) : undefined,
          lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined
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
            collectedAt: new Date()
          },
          {
            pigmentId: 'demo-blue',
            color: '#0000FF',
            name: 'Han River Blue',
            rarity: 'uncommon',
            usesLeft: 3,
            collectedAt: new Date()
          },
          {
            pigmentId: 'demo-green',
            color: '#00FF00',
            name: 'Seongsu Green',
            rarity: 'rare',
            usesLeft: 1,
            collectedAt: new Date()
          },
          {
            pigmentId: 'demo-yellow',
            color: '#FFFF00',
            name: 'Gangnam Gold',
            rarity: 'epic',
            usesLeft: 5,
            collectedAt: new Date()
          },
          {
            pigmentId: 'demo-purple',
            color: '#800080',
            name: 'Mystic Purple',
            rarity: 'legendary',
            usesLeft: 2,
            collectedAt: new Date()
          }
        ];
        setInventory(demoInventory);
        localStorage.setItem(`inventory-${user.uid}`, JSON.stringify(demoInventory));
      }
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
          lastUsed: data.lastUsed?.toDate()
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
            ? { ...p, usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES, collectedAt: new Date() }
            : p
        );
      } else {
        updatedInventory = [...inventory, {
          pigmentId,
          color,
          name,
          rarity,
          usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
          collectedAt: new Date()
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
        // Reset uses if pigment already exists
        await updateDoc(pigmentRef, {
          usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
          lastCollected: new Date()
        });
      } else {
        // Add new pigment
        await setDoc(pigmentRef, {
          color,
          name,
          rarity,
          usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
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
          usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
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

  return {
    inventory,
    loading,
    selectedPigment,
    setSelectedPigment,
    addPigment,
    usePigment,
    canUsePigment,
    addPigmentToInventory
  };
};