'use client';

import { useState, useEffect, useCallback } from 'react';
import { Location } from '@/types';
import { getCurrentPosition, watchPosition, clearWatch, isWithinSeongsuDong } from '@/utils/geolocation';

interface UseLocationResult {
  location: Location | null;
  error: string | null;
  loading: boolean;
  isInSeongsuDong: boolean;
  refetch: () => void;
}

// 一般公開時のデフォルト位置（聖水洞エリア内）
const DEFAULT_PUBLIC_LOCATION: Location = {
  lat: 37.546,
  lng: 127.045590,
  accuracy: 100
};

export const useLocation = (watchMode: boolean = false): UseLocationResult => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInSeongsuDong, setIsInSeongsuDong] = useState(false);

  const handleLocationUpdate = useCallback((newLocation: Location) => {
    setLocation(newLocation);
    setIsInSeongsuDong(isWithinSeongsuDong(newLocation));
    setError(null);
    setLoading(false);
  }, []);

  const handleLocationError = useCallback((err: GeolocationPositionError) => {
    // ローカル環境でもデフォルト位置を使用
    console.log('Using default location for demo');
    handleLocationUpdate(DEFAULT_PUBLIC_LOCATION);
  }, [handleLocationUpdate]);

  const fetchCurrentLocation = useCallback(async () => {
    setLoading(true);
    try {
      const currentLocation = await getCurrentPosition();
      handleLocationUpdate(currentLocation);
    } catch (err) {
      const error = err as GeolocationPositionError;
      handleLocationError(error);
    }
  }, [handleLocationUpdate, handleLocationError]);

  const refetch = useCallback(() => {
    fetchCurrentLocation();
  }, [fetchCurrentLocation]);

  useEffect(() => {
    let watchId: number | null = null;

    if (watchMode) {
      // Start watching position
      try {
        watchId = watchPosition(handleLocationUpdate, handleLocationError);
      } catch (err) {
        // ローカル環境でもデフォルト位置を使用
        console.log('Using default location for demo');
        handleLocationUpdate(DEFAULT_PUBLIC_LOCATION);
      }
    } else {
      // Get current position once
      fetchCurrentLocation();
    }

    return () => {
      if (watchId !== null) {
        clearWatch(watchId);
      }
    };
  }, [watchMode, handleLocationUpdate, handleLocationError, fetchCurrentLocation]);

  return {
    location,
    error,
    loading,
    isInSeongsuDong,
    refetch,
  };
};