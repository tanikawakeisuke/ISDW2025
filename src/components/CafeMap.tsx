'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useKakaoMap } from '@/hooks/useKakaoMap';
import { useLocation } from '@/hooks/useLocation';
import { useCafeCollection } from '@/hooks/useCafeCollection';
import { Location, Cafe, UserPigment } from '@/types';
import { calculateDistance } from '@/utils/geolocation';
import { COLLECTION_RADIUS } from '@/utils/cafeUtils';
import { isWithinSeongsuDong, getSeongsuPolygon } from '@/utils/geolocation';

// Highly optimized cafe detail panel
const CafeDetailPanel = React.memo<{
  cafe: Cafe;
  cafeData: any;
  canCollect: boolean;
  collecting: boolean;
  onClose: () => void;
  onCollect: (cafe: Cafe) => void;
}>(({ cafe, cafeData, canCollect, collecting, onClose, onCollect }) => (
  <div className="absolute bottom-4 left-4 right-4 bg-white border rounded-lg shadow-lg p-4 z-50">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h3 className="font-medium text-lg">{cafe.name}</h3>
        <p className="text-sm text-gray-600">
          {cafe.type === 'bus' ? '🚌 Cafe Bus' : '☕ Cafe'}
        </p>
        {cafe.address && (
          <p className="text-xs text-gray-500 mt-1">{cafe.address}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>

    <div className="mb-3 text-sm text-gray-600">
      Distance: {cafeData.distance}m
    </div>

    {cafeData.isCollected ? (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 text-center">
        <p className="text-gray-600 font-medium">Already collected today</p>
        <p className="text-xs text-gray-500 mt-1">Come back tomorrow!</p>
      </div>
    ) : canCollect ? (
      <button
        onClick={() => onCollect(cafe)}
        disabled={collecting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
      >
        {collecting ? (
          <span className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Collecting...
          </span>
        ) : (
          'Collect Pigment 🎨'
        )}
      </button>
    ) : !cafeData.isInRange ? (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
        <p className="text-orange-800 font-medium">Too far to collect</p>
        <p className="text-xs text-orange-600 mt-1">Get within {COLLECTION_RADIUS}m to collect</p>
      </div>
    ) : (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
        <p className="text-red-800 font-medium">Outside Seongsu-dong area</p>
        <p className="text-xs text-red-600 mt-1">Must be in Seongsu-dong to collect</p>
      </div>
    )}
  </div>
));

CafeDetailPanel.displayName = 'CafeDetailPanel';

interface CafeMapProps {
  center?: Location;
  onPigmentCollected?: (pigment: UserPigment) => void;
  className?: string;
}

export const CafeMap: React.FC<CafeMapProps> = ({
  center,
  onPigmentCollected,
  className = 'w-full h-96'
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collectionMessage, setCollectionMessage] = useState('');

  const { isLoaded, error } = useKakaoMap();
  const { location: userLocation } = useLocation(true);
  const {
    nearbyCafes,
    collectibleCafes,
    collectedCafes,
    dailyStatus,
    collectFromCafe,
    loading: cafeLoading
  } = useCafeCollection(userLocation);
  
  const [mapReady, setMapReady] = useState(false);

  // Pre-compute cafe data with Map for O(1) lookup
  const { cafeDataArray, cafeDataMap } = useMemo(() => {
    if (!userLocation || !nearbyCafes.length) {
      return { cafeDataArray: [], cafeDataMap: new Map() };
    }

    const dataArray: any[] = [];
    const dataMap = new Map();

    nearbyCafes.forEach(cafe => {
      const distance = calculateDistance(userLocation, { lat: cafe.lat, lng: cafe.lng });
      const isCollected = collectedCafes.includes(cafe.id);
      const isInRange = distance <= COLLECTION_RADIUS;
      const isCollectible = collectibleCafes.some(c => c.id === cafe.id);
      
      const cafeData = {
        ...cafe,
        distance: Math.round(distance),
        isCollected,
        isInRange,
        isCollectible
      };

      dataArray.push(cafeData);
      dataMap.set(cafe.id, cafeData); // O(1) lookup by ID
    });

    return { cafeDataArray: dataArray, cafeDataMap: dataMap };
  }, [nearbyCafes, collectedCafes, collectibleCafes, userLocation]);

  // Use array for rendering
  const cafeData = cafeDataArray;

  // Instant cafe selection with pre-computed data
  const [selectedCafeData, setSelectedCafeData] = useState<any>(null);
  
  const handleCafeSelect = useCallback((cafe: Cafe) => {
    setSelectedCafe(cafe);
    // Instant lookup from pre-computed map
    const data = cafeDataMap.get(cafe.id);
    setSelectedCafeData(data || null);
  }, [cafeDataMap]);

  const canCollectFromSelected = selectedCafeData && 
    !selectedCafeData.isCollected && 
    selectedCafeData.isCollectible;

  // Fast close handler
  const handleCloseDetail = useCallback(() => {
    setSelectedCafe(null);
    setSelectedCafeData(null);
  }, []);

  // Initialize map with robust error handling
  useEffect(() => {
    if (!isLoaded || !mapRef.current || map) return;

    // Double check API availability
    if (!window.kakao || !window.kakao.maps) {
      console.warn('Kakao Maps API not available');
      return;
    }

    const kakao = window.kakao;
    const defaultCenter = center || userLocation || { lat: 37.5464, lng: 127.0567 };

    const mapOptions = {
      center: new kakao.maps.LatLng(defaultCenter.lat, defaultCenter.lng),
      level: 4,
    };

    try {
      const newMap = new kakao.maps.Map(mapRef.current, mapOptions);
      
      // Ensure map is properly initialized
      kakao.maps.event.addListener(newMap, 'idle', () => {
        setMapReady(true);
      });
      
      // Force redraw after initialization
      setTimeout(() => {
        if (newMap) {
          newMap.relayout();
        }
      }, 100);
      
      setMap(newMap);
      console.log('Kakao map initialized successfully');
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }, [isLoaded, center, userLocation, map]);

  // Add Seongsu-dong polygon overlay
  useEffect(() => {
    if (!map) return;

    const kakao = window.kakao;
    const polygonCoords = getSeongsuPolygon();
    
    // Convert coordinates to Kakao LatLng objects
    const path = polygonCoords.map(coord => 
      new kakao.maps.LatLng(coord[1], coord[0]) // lat, lng order
    );

    // Create polygon
    const polygon = new kakao.maps.Polygon({
      path: path,
      strokeWeight: 2,
      strokeColor: '#00A8FF',
      strokeOpacity: 0.8,
      fillColor: '#00A8FF',
      fillOpacity: 0.1
    });

    polygon.setMap(map);

    return () => {
      polygon.setMap(null);
    };
  }, [map]);

  // Add cafe markers with smooth updates
  useEffect(() => {
    if (!map) return;
    
    // If no cafes, clear existing markers
    if (!cafeData.length) {
      markers.forEach(marker => marker.setMap(null));
      setMarkers([]);
      return;
    }

    const kakao = window.kakao;

    // Create a smooth transition for markers
    const existingMarkerMap = new Map();
    markers.forEach((marker, index) => {
      if (marker.getPosition) {
        const pos = marker.getPosition();
        const key = `${pos.getLat()}_${pos.getLng()}`;
        existingMarkerMap.set(key, marker);
      }
    });

    // Remove old markers that are no longer needed
    const newMarkers: any[] = [];
    const usedMarkers = new Set();

    cafeData.forEach(cafe => {
      const { isCollected, isInRange, isCollectible } = cafe;
      
      // Check if we can reuse existing marker
      const markerKey = `${cafe.lat}_${cafe.lng}`;
      const existingMarker = existingMarkerMap.get(markerKey);
      
      if (existingMarker) {
        // Reuse existing marker
        newMarkers.push(existingMarker);
        usedMarkers.add(markerKey);
        return;
      }
      
      // Create new marker element with SVG icon
      const markerElement = document.createElement('div');
      markerElement.style.cursor = 'pointer';
      markerElement.style.width = '32px';
      markerElement.style.height = '32px';
      markerElement.style.display = 'flex';
      markerElement.style.alignItems = 'center';
      markerElement.style.justifyContent = 'center';
      
      // Create SVG image element
      const iconElement = document.createElement('img');
      iconElement.style.width = '100%';
      iconElement.style.height = '100%';
      iconElement.src = cafe.type === 'bus' ? '/icons/car-icon.svg' : '/icons/coffee-icon.svg';
      iconElement.alt = cafe.type === 'bus' ? 'Cafe Bus' : 'Cafe';
      
      if (isCollected) {
        iconElement.style.filter = 'grayscale(100%)';
        iconElement.style.opacity = '0.6';
      } else if (isCollectible) {
        // Show as collectible if in collectibleCafes list (handles location permission)
        markerElement.style.animation = 'pulse 2s infinite';
        iconElement.style.filter = 'brightness(1.2) saturate(1.2)';
      } else if (isInRange) {
        // Fallback for direct range check
        markerElement.style.animation = 'pulse 2s infinite';
        iconElement.style.filter = 'brightness(1.2) saturate(1.2)';
      }
      
      markerElement.appendChild(iconElement);

      const customOverlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(cafe.lat, cafe.lng),
        content: markerElement,
        yAnchor: 1
      });

      // Add click event with pre-computed data
      markerElement.addEventListener('click', () => {
        handleCafeSelect(cafe);
      });

      // Show info on hover
      const infoWindow = new kakao.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-size: 12px; max-width: 200px;">
            <strong>${cafe.name}</strong><br/>
            <span style="color: ${cafe.type === 'bus' ? '#FF6B35' : '#8B4513'};">
              ${cafe.type === 'bus' ? 'Cafe Bus' : 'Cafe'}
            </span>
            ${isCollected ? '<br/><span style="color: #888;">Already collected</span>' : ''}
            ${isInRange && !isCollected ? '<br/><span style="color: #22C55E;">Ready to collect!</span>' : ''}
          </div>
        `
      });

      markerElement.addEventListener('mouseenter', () => {
        infoWindow.open(map, customOverlay);
      });

      markerElement.addEventListener('mouseleave', () => {
        infoWindow.close();
      });

      customOverlay.setMap(map);
      newMarkers.push(customOverlay);
    });

    // Remove unused existing markers
    existingMarkerMap.forEach((marker, key) => {
      if (!usedMarkers.has(key)) {
        marker.setMap(null);
      }
    });

    // Add user location marker
    if (userLocation) {
      const userMarker = new kakao.maps.Marker({
        position: new kakao.maps.LatLng(userLocation.lat, userLocation.lng),
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

      userMarker.setMap(map);
      newMarkers.push(userMarker);
    }

    setMarkers(newMarkers);
  }, [map, cafeData]);

  // Handle cafe collection with instant UI response
  const handleCollectFromCafe = (cafe: Cafe) => {
    if (!cafe || collecting) return;

    setCollecting(true);
    setCollectionMessage('');

    try {
      // Instant synchronous collection
      const result = collectFromCafe(cafe);
      
      if (result.success && result.pigment) {
        setCollectionMessage(`Collected ${result.pigment.name}! 🎨`);
        if (onPigmentCollected) {
          onPigmentCollected(result.pigment);
        }
        handleCloseDetail(); // Use fast close handler
        
        // Clear message after 3 seconds
        setTimeout(() => setCollectionMessage(''), 3000);
      } else {
        setCollectionMessage(result.error || 'Collection failed');
        setTimeout(() => setCollectionMessage(''), 3000);
      }
    } catch (error) {
      console.error('Collection error:', error);
      setCollectionMessage('Collection failed');
      setTimeout(() => setCollectionMessage(''), 3000);
    }

    // Short button feedback delay
    setTimeout(() => setCollecting(false), 100);
  };

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 text-gray-600`}>
        <div className="text-center">
          <p>Failed to load map</p>
          <p className="text-sm">{error}</p>
          {!process.env.NEXT_PUBLIC_KAKAO_APP_KEY && (
            <p className="text-xs text-red-500 mt-2">Kakao API key missing</p>
          )}
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading Kakao Maps API...</p>
        </div>
      </div>
    );
  }

  // Show fallback if no cafes are found
  if (!cafeLoading && nearbyCafes.length === 0) {
    return (
      <div className="relative">
        <div ref={mapRef} className={className} />
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <p className="text-gray-600 mb-2">No cafes found nearby</p>
            <p className="text-sm text-gray-500">Try moving to a different location</p>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        className={className}
        style={{ 
          position: 'relative',
          zIndex: 1,
          backgroundColor: '#f0f0f0' // Fallback background
        }}
      />

      {/* Loading Indicator */}
      {cafeLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white border rounded-lg shadow-lg p-2 flex items-center space-x-2 z-40">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Updating cafes...</span>
        </div>
      )}

      {/* Collection Status */}
      {collectionMessage && (
        <div className="absolute top-4 left-4 bg-white border rounded-lg shadow-lg p-3 max-w-xs z-40">
          <p className="text-sm font-medium">{collectionMessage}</p>
        </div>
      )}

      {/* Location Status */}
      {!userLocation ? (
        <div className="absolute top-4 right-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-3 z-40">
          <div className="text-sm">
            <div className="font-medium text-yellow-800">Location Required</div>
            <div className="text-yellow-600">Enable location to collect pigments</div>
          </div>
        </div>
      ) : !isWithinSeongsuDong(userLocation) ? (
        <div className="absolute top-4 right-4 bg-red-50 border border-red-200 rounded-lg shadow-lg p-3 z-40">
          <div className="text-sm">
            <div className="font-medium text-red-800">Outside Collection Area</div>
            <div className="text-red-600">Move to blue area to collect</div>
          </div>
        </div>
      ) : dailyStatus && (
        <div className="absolute top-4 right-4 bg-white border rounded-lg shadow-lg p-3 z-40">
          <div className="text-sm">
            <div className="font-medium">Today's Collections</div>
            <div className="text-gray-600">{dailyStatus.totalCollections} cafes visited</div>
          </div>
        </div>
      )}

      {/* Selected Cafe Panel */}
      {selectedCafe && selectedCafeData && (
        <CafeDetailPanel
          cafe={selectedCafe}
          cafeData={selectedCafeData}
          canCollect={canCollectFromSelected}
          collecting={collecting}
          onClose={handleCloseDetail}
          onCollect={handleCollectFromCafe}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white border rounded-lg shadow-lg p-3 z-30">
        <div className="text-sm">
          <div className="font-medium mb-2">Legend</div>
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="w-4 h-3 bg-blue-200 border border-blue-400 mr-2"></div>
              <span>Collection Area</span>
            </div>
            <div className="flex items-center">
              <img src="/icons/coffee-icon.svg" alt="Cafe" className="w-4 h-4 mr-2" />
              <span>Cafe</span>
            </div>
            <div className="flex items-center">
              <img src="/icons/car-icon.svg" alt="Cafe Bus" className="w-4 h-4 mr-2" />
              <span>Cafe Bus</span>
            </div>
            {userLocation && (
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span>You</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};