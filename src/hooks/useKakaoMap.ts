'use client';

import { useEffect, useState } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao: {
      maps: {
        Map: any;
        LatLng: any;
        Marker: any;
        MarkerImage: any;
        Size: any;
        Point: any;
        CustomOverlay: any;
        InfoWindow: any;
        Polygon: any;
        event: {
          addListener: (target: any, type: string, handler: (...args: any[]) => void) => void;
        };
        services: {
          Places: any;
          Geocoder: any;
        };
        load: (callback: () => void) => void;
      };
    };
  }
}

export const useKakaoMap = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Kakao Maps is already loaded with services
    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      setIsLoaded(true);
      return;
    }

    // Load Kakao Maps API with services library
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          // Wait a bit more to ensure services are loaded
          setTimeout(() => {
            if (window.kakao.maps.services) {
              setIsLoaded(true);
            } else {
              setError('Kakao Maps services not available');
            }
          }, 100);
        });
      } else {
        setError('Failed to load Kakao Maps API');
      }
    };

    script.onerror = () => {
      setError('Failed to load Kakao Maps script');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup script if component unmounts
      const existingScript = document.querySelector(`script[src*="dapi.kakao.com"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  return { isLoaded, error };
};