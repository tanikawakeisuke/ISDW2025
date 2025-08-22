'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db, isFirebaseAvailable } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CanvasPixel, CanvasDay, CANVAS_CONFIG } from '@/types';
import { getCurrentDayId, getPixelKey, parsePixelKey, isValidCoordinate } from '@/utils/canvasUtils';

interface UsePlaceCanvasResult {
  pixels: CanvasPixel[];
  loading: boolean;
  currentDayId: string;
  placePixel: (x: number, y: number, color: string, pigmentId: string) => Promise<boolean>;
  getPixelAt: (x: number, y: number) => CanvasPixel | null;
  totalPixels: number;
}

export const usePlaceCanvas = (): UsePlaceCanvasResult => {
  const { user } = useAuth();
  const [pixels, setPixels] = useState<Map<string, CanvasPixel>>(new Map());
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentDayId, setCurrentDayId] = useState('--------');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize canvas for current day
  const initializeCanvas = useCallback(async () => {
    // Check if Firebase is available
    if (!isFirebaseAvailable() || !db) {
      console.log('Canvas initialized in offline mode');
      setLoading(false);
      return;
    }

    try {
      const dayRef = doc(db, 'canvas', currentDayId);
      const dayDoc = await getDoc(dayRef);

      if (!dayDoc.exists()) {
        // Create new day document
        const newDay: CanvasDay = {
          dayId: currentDayId,
          createdAt: new Date(),
          totalPixels: 0,
          lastActivity: new Date()
        };

        await setDoc(dayRef, newDay);
        console.log(`Initialized new canvas day: ${currentDayId}`);
      }
    } catch (error) {
      console.error('Error initializing canvas:', error);
    }
  }, [currentDayId]);

  // Prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
    setCurrentDayId(getCurrentDayId());
  }, []);

  // Load and listen to pixels for current day
  useEffect(() => {
    if (!mounted || !user?.uid) {
      if (mounted) setLoading(false);
      return;
    }

    initializeCanvas();

    // Check if Firebase is available
    if (!isFirebaseAvailable() || !db) {
      // Use local storage for testing
      const savedPixels = localStorage.getItem(`canvas-${currentDayId}`);
      const pixelMap = new Map<string, CanvasPixel>();
      
      if (savedPixels) {
        const pixelData = JSON.parse(savedPixels);
        Object.entries(pixelData).forEach(([key, pixel]) => {
          const p = pixel as any;
          pixelMap.set(key, {
            ...p,
            timestamp: new Date(p.timestamp)
          });
        });
      } else {
        // Add some demo pixels for testing visibility
        const demoPixels = [
          { x: 50, y: 50, color: '#FF0000' },
          { x: 100, y: 80, color: '#00FF00' },
          { x: 150, y: 120, color: '#0000FF' },
          { x: 250, y: 180, color: '#FFFF00' },
          { x: 400, y: 200, color: '#FF00FF' }
        ];
        
        demoPixels.forEach(({ x, y, color }) => {
          const key = `${x}_${y}`;
          pixelMap.set(key, {
            x,
            y,
            color,
            placedBy: 'demo',
            timestamp: new Date()
          });
        });
      }
      
      setPixels(pixelMap);
      setLoading(false);
      return;
    }

    const pixelsRef = collection(db, 'canvas', currentDayId, 'pixels');

    const unsubscribe = onSnapshot(pixelsRef, (snapshot) => {
      const pixelMap = new Map<string, CanvasPixel>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const pixelKey = doc.id;
        const { x, y } = parsePixelKey(pixelKey);

        pixelMap.set(pixelKey, {
          x,
          y,
          color: data.color,
          placedBy: data.placedBy,
          timestamp: data.timestamp.toDate()
        });
      });

      setPixels(pixelMap);
      setLoading(false);
    }, (error) => {
      console.error('Error loading canvas pixels:', error);
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [mounted, user?.uid, currentDayId, initializeCanvas]);

  // Place a pixel on the canvas
  const placePixel = useCallback(async (
    x: number, 
    y: number, 
    color: string, 
    pigmentId: string
  ): Promise<boolean> => {
    if (!user?.uid) return false;
    if (!isValidCoordinate(x, y)) return false;

    const pixelKey = getPixelKey(x, y);

    // Check if Firebase is available
    if (!isFirebaseAvailable() || !db) {
      // Update local state and localStorage for testing
      const newPixel: CanvasPixel = {
        x,
        y,
        color,
        placedBy: user.uid,
        timestamp: new Date()
      };

      setPixels(prev => {
        const newMap = new Map(prev);
        newMap.set(pixelKey, newPixel);
        
        // Save to localStorage
        const pixelData: Record<string, any> = {};
        newMap.forEach((pixel, key) => {
          pixelData[key] = {
            ...pixel,
            timestamp: pixel.timestamp.toISOString()
          };
        });
        localStorage.setItem(`canvas-${currentDayId}`, JSON.stringify(pixelData));
        
        return newMap;
      });

      return true;
    }

    try {
      const pixelRef = doc(db, 'canvas', currentDayId, 'pixels', pixelKey);
      const dayRef = doc(db, 'canvas', currentDayId);

      const newPixel = {
        color,
        placedBy: user.uid,
        timestamp: new Date(),
        pigmentId
      };

      // Place the pixel
      await setDoc(pixelRef, newPixel);

      // Update day statistics
      await updateDoc(dayRef, {
        totalPixels: pixels.size + 1,
        lastActivity: new Date()
      });

      console.log(`Placed pixel at (${x}, ${y}) with color ${color}`);
      return true;
    } catch (error) {
      console.error('Error placing pixel:', error);
      return false;
    }
  }, [user?.uid, currentDayId, pixels.size]);

  // Get pixel at specific coordinates
  const getPixelAt = useCallback((x: number, y: number): CanvasPixel | null => {
    if (!isValidCoordinate(x, y)) return null;
    const pixelKey = getPixelKey(x, y);
    return pixels.get(pixelKey) || null;
  }, [pixels]);

  return {
    pixels: Array.from(pixels.values()),
    loading,
    currentDayId,
    placePixel,
    getPixelAt,
    totalPixels: pixels.size
  };
};