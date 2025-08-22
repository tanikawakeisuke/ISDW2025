'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Cafe, 
  Location, 
  CafeCollection, 
  DailyCollectionStatus,
  UserPigment,
  CANVAS_CONFIG 
} from '@/types';
import { 
  getAllNearbyCafes, 
  getCafesInCollectionRange, 
  calculateRarity, 
  generateCafePigment,
  getCurrentDayIdKST,
  CAFE_BUSES
} from '@/utils/cafeUtils';
import { calculateDistance } from '@/utils/geolocation';

interface UseCafeCollectionResult {
  nearbyCafes: Cafe[];
  collectibleCafes: Cafe[];
  collectedCafes: string[];
  dailyStatus: DailyCollectionStatus | null;
  loading: boolean;
  collectFromCafe: (cafe: Cafe) => Promise<{ success: boolean; pigment?: UserPigment; error?: string }>;
  refreshCafes: () => Promise<void>;
}

export const useCafeCollection = (userLocation: Location | null): UseCafeCollectionResult => {
  const { user } = useAuth();
  const [nearbyCafes, setNearbyCafes] = useState<Cafe[]>([]);
  const [collectibleCafes, setCollectibleCafes] = useState<Cafe[]>([]);
  const [dailyStatus, setDailyStatus] = useState<DailyCollectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [currentDayId, setCurrentDayId] = useState('--------');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cafesCacheRef = useRef<Map<string, { cafes: Cafe[]; timestamp: number }>>(new Map());

  // Prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
    setCurrentDayId(getCurrentDayIdKST());
  }, []);

  // Load daily collection status
  useEffect(() => {
    if (!mounted || !user?.uid) {
      if (mounted) setDailyStatus(null);
      return;
    }

    // Check if Firebase is disabled for testing
    const firebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';
    if (firebaseDisabled) {
      // Load from localStorage for testing
      const savedStatus = localStorage.getItem(`daily-status-${currentDayId}-${user.uid}`);
      if (savedStatus) {
        setDailyStatus(JSON.parse(savedStatus));
      } else {
        const newStatus: DailyCollectionStatus = {
          dayId: currentDayId,
          collectedCafes: [],
          totalCollections: 0
        };
        setDailyStatus(newStatus);
        localStorage.setItem(`daily-status-${currentDayId}-${user.uid}`, JSON.stringify(newStatus));
      }
      return;
    }

    const statusRef = doc(db, 'users', user.uid, 'daily_status', currentDayId);
    
    const unsubscribe = onSnapshot(statusRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setDailyStatus({
          dayId: currentDayId,
          collectedCafes: data.collectedCafes || [],
          totalCollections: data.totalCollections || 0
        });
      } else {
        // Initialize new day
        const newStatus: DailyCollectionStatus = {
          dayId: currentDayId,
          collectedCafes: [],
          totalCollections: 0
        };
        setDailyStatus(newStatus);
        setDoc(statusRef, newStatus);
      }
    }, (error) => {
      console.error('Error loading daily status:', error);
    });

    return unsubscribe;
  }, [mounted, user?.uid, currentDayId]);

  // Get cache key for location
  const getCacheKey = useCallback((location: Location): string => {
    // Round to ~100m precision to enable cache reuse
    const lat = Math.round(location.lat * 1000) / 1000;
    const lng = Math.round(location.lng * 1000) / 1000;
    return `${lat},${lng}`;
  }, []);

  // Load nearby cafes when location changes with caching and debouncing
  const refreshCafes = useCallback(async (immediate = false) => {
    if (!mounted || !userLocation) {
      setNearbyCafes([]);
      setCollectibleCafes([]);
      return;
    }

    // Clear existing timeout for debouncing
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // If not immediate, debounce the refresh
    if (!immediate) {
      refreshTimeoutRef.current = setTimeout(() => refreshCafes(true), 500);
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(userLocation);
    const cached = cafesCacheRef.current.get(cacheKey);
    const now = Date.now();
    
    // Use cache if less than 2 minutes old
    if (cached && (now - cached.timestamp < 120000)) {
      setNearbyCafes(cached.cafes);
      const inRangeCafes = getCafesInCollectionRange(userLocation, cached.cafes);
      setCollectibleCafes(inRangeCafes);
      return;
    }

    if (isRefreshing) return; // Prevent multiple simultaneous refreshes
    
    setIsRefreshing(true);
    setLoading(true);
    
    try {
      const cafes = await getAllNearbyCafes(userLocation, 2000);
      
      // Cache the result
      cafesCacheRef.current.set(cacheKey, {
        cafes,
        timestamp: now
      });

      // Clean old cache entries (keep only last 10)
      if (cafesCacheRef.current.size > 10) {
        const entries = Array.from(cafesCacheRef.current.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        cafesCacheRef.current.clear();
        entries.slice(0, 10).forEach(([key, value]) => {
          cafesCacheRef.current.set(key, value);
        });
      }

      setNearbyCafes(cafes);

      // Update collectible cafes (within 30m range)
      const inRangeCafes = getCafesInCollectionRange(userLocation, cafes);
      setCollectibleCafes(inRangeCafes);
    } catch (error) {
      console.error('Error loading cafes:', error);
      // Fallback to cafe buses only if API fails
      const nearbyBuses = CAFE_BUSES.filter(bus => {
        const distance = calculateDistance(userLocation, { lat: bus.lat, lng: bus.lng });
        return distance <= 2000;
      });
      setNearbyCafes(nearbyBuses);
      
      const inRangeBuses = getCafesInCollectionRange(userLocation, nearbyBuses);
      setCollectibleCafes(inRangeBuses);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [mounted, userLocation, getCacheKey, isRefreshing]);

  // Refresh cafes when location changes
  useEffect(() => {
    refreshCafes();
  }, [refreshCafes]);

  // Collect pigment from cafe with instant response
  const collectFromCafe = useCallback(async (cafe: Cafe): Promise<{ 
    success: boolean; 
    pigment?: UserPigment; 
    error?: string 
  }> => {
    if (!user?.uid || !userLocation || !dailyStatus) {
      return { success: false, error: 'User not authenticated or location unavailable' };
    }

    // Check if already collected from this cafe today
    if (dailyStatus.collectedCafes.includes(cafe.id)) {
      return { success: false, error: 'Already collected from this cafe today' };
    }

    // Check if cafe is within collection range and user is in Seongsu-dong
    const inRangeCafes = getCafesInCollectionRange(userLocation, [cafe]);
    if (inRangeCafes.length === 0) {
      return { success: false, error: 'Must be within 30m of cafe and inside Seongsu-dong area' };
    }

    // Pre-calculate pigment data
    const rarityResult = calculateRarity(userLocation, cafe, nearbyCafes);
    const generatedPigment = generateCafePigment(cafe, rarityResult.rarity, rarityResult.factors);
    
    const userPigment: UserPigment = {
      pigmentId: generatedPigment.id,
      color: generatedPigment.color,
      name: generatedPigment.name,
      rarity: generatedPigment.rarity,
      usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
      collectedAt: new Date(),
      collectedFrom: cafe.id
    };

    // Optimistically update UI first
    const updatedStatus: DailyCollectionStatus = {
      ...dailyStatus,
      collectedCafes: [...dailyStatus.collectedCafes, cafe.id],
      totalCollections: dailyStatus.totalCollections + 1
    };
    setDailyStatus(updatedStatus);

    // Save to storage
    try {
      const firebaseDisabled = process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true';
      if (firebaseDisabled) {
        // Save to localStorage for testing
        const savedStatus = localStorage.getItem(`daily-status-${currentDayId}-${user.uid}`);
        if (savedStatus) {
          const parsedStatus = JSON.parse(savedStatus);
          const newCollectedCafes = [...parsedStatus.collectedCafes, cafe.id];
          const newTotalCollections = parsedStatus.totalCollections + 1;
          localStorage.setItem(`daily-status-${currentDayId}-${user.uid}`, JSON.stringify({
            ...parsedStatus,
            collectedCafes: newCollectedCafes,
            totalCollections: newTotalCollections
          }));
        } else {
          localStorage.setItem(`daily-status-${currentDayId}-${user.uid}`, JSON.stringify(updatedStatus));
        }

        // Save collection history
        const collectionHistory: CafeCollection = {
          cafeId: cafe.id,
          cafeName: cafe.name,
          cafeType: cafe.type,
          pigmentCollected: {
            id: userPigment.pigmentId,
            name: userPigment.name,
            color: userPigment.color,
            rarity: userPigment.rarity
          },
          timestamp: new Date(),
          location: userLocation,
          rarityFactors: rarityResult.factors
        };
        
        const historyKey = `collection-${currentDayId}-${cafe.id}-${user.uid}`;
        localStorage.setItem(historyKey, JSON.stringify(collectionHistory));

        // Save pigment to inventory
        const inventoryKey = `inventory-${user.uid}`;
        const existingInventory = JSON.parse(localStorage.getItem(inventoryKey) || '[]');
        const updatedInventory = [...existingInventory, userPigment];
        localStorage.setItem(inventoryKey, JSON.stringify(updatedInventory));
      } else {
        // Save to Firestore
        const statusRef = doc(db, 'users', user.uid, 'daily_status', currentDayId);
        const collectionRef = doc(db, 'users', user.uid, 'collections', `${currentDayId}_${cafe.id}`);
        const pigmentRef = doc(db, 'users', user.uid, 'pigments', generatedPigment.color);

        // Parallel batch operations for speed
        const promises = [
          setDoc(statusRef, updatedStatus),
          setDoc(collectionRef, {
            cafeId: cafe.id,
            cafeName: cafe.name,
            cafeType: cafe.type,
            pigmentCollected: {
              id: userPigment.pigmentId,
              name: userPigment.name,
              color: userPigment.color,
              rarity: userPigment.rarity
            },
            timestamp: new Date(),
            location: userLocation,
            rarityFactors: rarityResult.factors
          }),
          setDoc(pigmentRef, {
            pigmentId: userPigment.pigmentId,
            color: userPigment.color,
            name: userPigment.name,
            rarity: userPigment.rarity,
            usesLeft: CANVAS_CONFIG.MAX_PIGMENT_USES,
            collectedAt: new Date(),
            collectedFrom: cafe.id
          })
        ];

        await Promise.all(promises);
      }
      return { success: true, pigment: userPigment };
    } catch (error: unknown) {
      console.error('Collection save error:', error);
      // Revert optimistic UI update if save fails
      setDailyStatus(dailyStatus); // Revert to previous state
      const errorMessage = error instanceof Error ? error.message : 'Failed to save collection';
      return { success: false, error: errorMessage };
    }
  }, [user?.uid, userLocation, dailyStatus, nearbyCafes, currentDayId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    nearbyCafes,
    collectibleCafes,
    collectedCafes: dailyStatus?.collectedCafes || [],
    dailyStatus,
    loading,
    collectFromCafe,
    refreshCafes
  };
};