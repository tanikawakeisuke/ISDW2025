'use client';

import { useState, useCallback } from 'react';
import { Pigment, Location } from '@/types';
import { generateRandomPigment, canCollectPigment } from '@/utils/pigments';
import { calculateDistance, isWithinSeongsuDong, isNearCafeBus } from '@/utils/geolocation';

interface UsePigmentCollectionResult {
  collectPigment: (location: Location) => Promise<{ success: boolean; pigment?: Pigment; error?: string }>;
  loading: boolean;
  availablePigments: Pigment[];
  setAvailablePigments: (pigments: Pigment[]) => void;
}

export const usePigmentCollection = (): UsePigmentCollectionResult => {
  const [loading, setLoading] = useState(false);
  const [availablePigments, setAvailablePigments] = useState<Pigment[]>([]);
  const [userPigments, setUserPigments] = useState<Pigment[]>([]);
  const [dailyCollections, setDailyCollections] = useState<Record<string, number>>({});

  const collectPigment = useCallback(async (location: Location) => {
    setLoading(true);

    try {
      // Check location restriction bypass
      const bypassLocation = process.env.NEXT_PUBLIC_BYPASS_LOCATION === 'true';
      const bypassDaily = process.env.NEXT_PUBLIC_BYPASS_DAILY_LIMIT === 'true';
      
      // Check location restrictions (can be bypassed)
      if (!bypassLocation) {
        if (!isWithinSeongsuDong(location)) {
          return { success: false, error: 'You must be within Seongsu-dong to collect pigments' };
        }
        
        if (!isNearCafeBus(location)) {
          return { success: false, error: 'You must be within 30 meters of a cafe bus to collect pigments' };
        }
      }

      // Generate a new pigment
      const newPigment = generateRandomPigment(location, 'test-user');

      // Check daily collection limits (can be bypassed)
      if (!bypassDaily) {
        const currentCount = dailyCollections[newPigment.rarity] || 0;
        if (!canCollectPigment(newPigment.rarity, dailyCollections)) {
          return { 
            success: false, 
            error: `Daily limit reached for ${newPigment.rarity} pigments. Try again tomorrow!` 
          };
        }
        
        // Update daily collection count locally
        setDailyCollections(prev => ({
          ...prev,
          [newPigment.rarity]: currentCount + 1
        }));
      }

      // Check if already collected at this location
      const nearbyPigment = userPigments.find(pigment => {
        const distance = calculateDistance(location, pigment.location);
        return distance <= 5; // Within 5 meters
      });

      if (nearbyPigment) {
        return { success: false, error: 'You already collected a pigment near this location!' };
      }

      // Add to user's collection (local storage)
      setUserPigments(prev => [...prev, newPigment]);
      setAvailablePigments(prev => [...prev, newPigment]);

      return { success: true, pigment: newPigment };
    } catch (error) {
      console.error('Error collecting pigment:', error);
      return { success: false, error: 'Failed to collect pigment. Please try again.' };
    } finally {
      setLoading(false);
    }
  }, [availablePigments, userPigments, dailyCollections]);

  return {
    collectPigment,
    loading,
    availablePigments,
    setAvailablePigments,
  };
};