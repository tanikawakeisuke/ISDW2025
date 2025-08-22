'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useRef, useState } from 'react';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { useLocation } from '@/hooks/useLocation';
import { Location, Pigment } from '@/types';
import { getSeongsuPolygon, getCafeBusLocations, getSeongsuCenter } from '@/utils/geolocation';

interface KakaoMapProps {
  center?: Location;
  pigments?: Pigment[];
  onMapClick?: (location: Location) => void;
  onPigmentClick?: (pigment: Pigment) => void;
  className?: string;
}

export const KakaoMap: React.FC<KakaoMapProps> = ({
  center,
  pigments = [],
  onMapClick,
  onPigmentClick,
  className = 'w-full h-96'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [polygon, setPolygon] = useState<any>(null);
  const [cafeBusMarkers, setCafeBusMarkers] = useState<any[]>([]);
  const { isLoaded, error } = useKakaoMap();
  const { location: userLocation } = useLocation(true);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    const kakao = window.kakao;
    const seongsuCenter = getSeongsuCenter();
    const defaultCenter = center || userLocation || seongsuCenter;

    const mapOptions = {
      center: new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
      level: 5, // Zoom level
    };

    const newMap = new kakao.maps.Map(mapRef.current, mapOptions);
    setMap(newMap);

    // Add Seongsu-dong polygon
    const polygonPath = getSeongsuPolygon().map(([lng, lat]) => 
      new kakao.maps.LatLng(lat, lng)
    );
    
    const polygonOverlay = new kakao.maps.Polygon({
      path: polygonPath,
      strokeWeight: 3,
      strokeColor: '#007AFF',
      strokeOpacity: 0.8,
      fillColor: '#007AFF',
      fillOpacity: 0.1
    });
    
    polygonOverlay.setMap(newMap);
    setPolygon(polygonOverlay);

    // Add cafe bus markers
    const cafeBuses = getCafeBusLocations();
    const busMarkers: any[] = [];
    
    cafeBuses.forEach(bus => {
      const busMarkerPosition = new kakao.maps.LatLng(bus.lat, bus.lng);
      const busMarker = new kakao.maps.Marker({
        position: busMarkerPosition,
        image: new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="8" width="24" height="16" rx="2" fill="#FF6B35" stroke="#FFF" stroke-width="1"/>
              <rect x="6" y="10" width="6" height="4" fill="#FFF" rx="1"/>
              <rect x="14" y="10" width="6" height="4" fill="#FFF" rx="1"/>
              <rect x="22" y="10" width="6" height="4" fill="#FFF" rx="1"/>
              <circle cx="10" cy="26" r="2" fill="#333"/>
              <circle cx="22" cy="26" r="2" fill="#333"/>
              <text x="16" y="18" font-size="8" text-anchor="middle" fill="#FFF">BUS</text>
            </svg>
          `),
          new kakao.maps.Size(32, 32),
          { offset: new kakao.maps.Point(16, 16) }
        )
      });

      // Add info window for cafe bus
      const busInfoWindow = new kakao.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-size: 12px; max-width: 200px;">
            <strong style="color: #FF6B35;">${bus.name}</strong>
          </div>
        `
      });

      // Show info window on hover
      kakao.maps.event.addListener(busMarker, 'mouseover', () => {
        busInfoWindow.open(newMap, busMarker);
      });

      kakao.maps.event.addListener(busMarker, 'mouseout', () => {
        busInfoWindow.close();
      });

      busMarker.setMap(newMap);
      busMarkers.push(busMarker);
    });
    
    setCafeBusMarkers(busMarkers);

    // Add click event listener
    if (onMapClick) {
      kakao.maps.event.addListener(newMap, 'click', (mouseEvent: any) => {
        const latlng = mouseEvent.latLng;
        onMapClick({
          lat: latlng.getLat(),
          lng: latlng.getLng(),
        });
      });
    }
  }, [isLoaded, center, userLocation, onMapClick, map]);

  // Cleanup function
  useEffect(() => {
    return () => {
      // Cleanup markers
      markers.forEach(marker => marker.setMap(null));
      cafeBusMarkers.forEach(marker => marker.setMap(null));
      if (polygon) {
        polygon.setMap(null);
      }
    };
  }, []);

  // Update map center when center prop changes
  useEffect(() => {
    if (!map || !center) return;

    const kakao = window.kakao;
    const newCenter = new kakao.maps.LatLng(center.lat, center.lng);
    map.setCenter(newCenter);
  }, [map, center]);

  // Add user location marker
  useEffect(() => {
    if (!map || !userLocation) return;

    const kakao = window.kakao;
    
    // Remove existing user marker
    const existingUserMarker = markers.find(m => m.isUserMarker);
    if (existingUserMarker) {
      existingUserMarker.setMap(null);
      setMarkers(prev => prev.filter(m => !m.isUserMarker));
    }

    // Create user position marker
    const userMarkerPosition = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
    const userMarker = new kakao.maps.Marker({
      position: userMarkerPosition,
      image: new kakao.maps.MarkerImage(
        'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="8" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" fill="#FFFFFF"/>
          </svg>
        `),
        new kakao.maps.Size(24, 24),
        { offset: new kakao.maps.Point(12, 12) }
      )
    });

    userMarker.isUserMarker = true;
    userMarker.setMap(map);
    setMarkers(prev => [...prev, userMarker]);
  }, [map, userLocation]);

  // Add pigment markers
  useEffect(() => {
    if (!map || !pigments.length) return;

    const kakao = window.kakao;

    // Remove existing pigment markers
    const pigmentMarkers = markers.filter(m => !m.isUserMarker);
    pigmentMarkers.forEach(marker => marker.setMap(null));
    setMarkers(prev => prev.filter(m => m.isUserMarker));

    // Add new pigment markers
    const newMarkers: any[] = [];

    pigments.forEach(pigment => {
      const markerPosition = new kakao.maps.LatLng(pigment.location.lat, pigment.location.lng);
      
      // Create custom marker based on rarity
      const getRarityColor = (rarity: string) => {
        switch (rarity) {
          case 'legendary': return '#FFD700';
          case 'epic': return '#9D4EDD';
          case 'rare': return '#06D6A0';
          case 'uncommon': return '#118AB2';
          case 'common': return '#6C757D';
          default: return '#6C757D';
        }
      };

      const marker = new kakao.maps.Marker({
        position: markerPosition,
        image: new kakao.maps.MarkerImage(
          'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" fill="${pigment.color}" stroke="${getRarityColor(pigment.rarity)}" stroke-width="2"/>
              <circle cx="10" cy="10" r="4" fill="${getRarityColor(pigment.rarity)}"/>
            </svg>
          `),
          new kakao.maps.Size(20, 20),
          { offset: new kakao.maps.Point(10, 10) }
        )
      });

      // Add click event
      if (onPigmentClick) {
        kakao.maps.event.addListener(marker, 'click', () => {
          onPigmentClick(pigment);
        });
      }

      // Add info window
      const infoWindow = new kakao.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-size: 12px; max-width: 150px;">
            <strong>${pigment.name}</strong><br/>
            <span style="color: ${getRarityColor(pigment.rarity)}; text-transform: capitalize;">
              ${pigment.rarity}
            </span>
          </div>
        `
      });

      // Show info window on hover
      kakao.maps.event.addListener(marker, 'mouseover', () => {
        infoWindow.open(map, marker);
      });

      kakao.maps.event.addListener(marker, 'mouseout', () => {
        infoWindow.close();
      });

      marker.setMap(map);
      newMarkers.push(marker);
    });

    setMarkers(prev => [...prev.filter(m => m.isUserMarker), ...newMarkers]);
  }, [map, pigments, onPigmentClick]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 text-gray-600`}>
        <div className="text-center">
          <p>Failed to load map</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return <div ref={mapRef} className={className} />;
};