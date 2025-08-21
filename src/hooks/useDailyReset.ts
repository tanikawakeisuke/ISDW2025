'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { shouldResetDailyData, getTimeUntilReset, formatTimeUntilReset } from '@/utils/timezone';

interface UseDailyResetResult {
  timeUntilReset: string;
  needsReset: boolean;
  resetDailyData: () => Promise<void>;
}

export const useDailyReset = (): UseDailyResetResult => {
  const [timeUntilReset, setTimeUntilReset] = useState('');
  const [needsReset, setNeedsReset] = useState(false);
  const { userData, updateUserData } = useAuth();

  // Check if daily data needs reset
  useEffect(() => {
    if (userData) {
      const shouldReset = shouldResetDailyData(userData.lastCollectionDate);
      setNeedsReset(shouldReset);
    }
  }, [userData]);

  // Update countdown timer every second
  useEffect(() => {
    const updateTimer = () => {
      setTimeUntilReset(formatTimeUntilReset());
    };

    updateTimer(); // Initial update
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, []);

  // Auto-reset when time reaches zero
  useEffect(() => {
    const checkAndReset = async () => {
      if (userData && shouldResetDailyData(userData.lastCollectionDate)) {
        await resetDailyData();
      }
    };

    // Check every minute for auto-reset
    const interval = setInterval(checkAndReset, 60000);

    return () => clearInterval(interval);
  }, [userData]);

  const resetDailyData = async () => {
    if (!userData) return;

    try {
      await updateUserData({
        dailyCollectionCount: 0,
        lastCollectionDate: new Date(),
      });

      setNeedsReset(false);
    } catch (error) {
      console.error('Error resetting daily data:', error);
    }
  };

  return {
    timeUntilReset,
    needsReset,
    resetDailyData,
  };
};