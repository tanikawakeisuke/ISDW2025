import { Location } from '@/types';

// Seongsu-dong polygon boundaries (precise coordinates)
export function getSeongsuPolygon(): number[][] {
  return [
    [127.027886, 37.541507],
    [127.039700, 37.551006], 
    [127.050916, 37.551538],
    [127.066994, 37.547490],
    [127.059606, 37.533853]
  ];
}

// Cafe Bus locations
export function getCafeBusLocations() {
  return [
    {
      id: "bus1",
      lat: 37.542374,
      lng: 127.042089,
      name: "Cafe Bus A - 성수역 앞"
    },
    {
      id: "bus2", 
      lat: 37.544775,
      lng: 127.043197,
      name: "Cafe Bus B - 성수동 중심가"
    },
    {
      id: "bus3",
      lat: 37.549510,
      lng: 127.051671,
      name: "Cafe Bus C - 서울숲 입구"
    }
  ];
}

// Check if bypass is enabled
const BYPASS_LOCATION = process.env.NEXT_PUBLIC_BYPASS_LOCATION === 'true';

// Point-in-polygon algorithm
function isPointInPolygon(point: Location, polygon: number[][]): boolean {
  const x = point.lng;
  const y = point.lat;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

export const getCurrentPosition = (): Promise<Location> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    // If bypass is enabled, return a mock location within Seongsu-dong polygon
    if (BYPASS_LOCATION) {
      // Return location near Seongsu Station (within polygon)
      resolve({
        lat: 37.5444,
        lng: 127.0445,
        accuracy: 10, // Mock high accuracy
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 120000, // Use cached position for 2 minutes
      }
    );
  });
};

export const watchPosition = (
  onSuccess: (location: Location) => void,
  onError: (error: GeolocationPositionError) => void
): number => {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser.');
  }

  // If bypass is enabled, simulate position updates
  if (BYPASS_LOCATION) {
    const interval = setInterval(() => {
      // Simulate movement within Seongsu-dong
      onSuccess({
        lat: 37.5444 + (Math.random() - 0.5) * 0.002, // Small variation
        lng: 127.0445 + (Math.random() - 0.5) * 0.002,
        accuracy: 10,
      });
    }, 30000); // 30 seconds interval instead of 5 seconds
    
    return interval;
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    onError,
    {
      enableHighAccuracy: false, // Reduce accuracy for less frequent updates
      timeout: 15000,
      maximumAge: 300000, // Use cached position for 5 minutes
    }
  );
};

export const clearWatch = (watchId: number) => {
  if (BYPASS_LOCATION) {
    clearInterval(watchId);
  } else {
    navigator.geolocation.clearWatch(watchId);
  }
};

export const isWithinSeongsuDong = (location: Location): boolean => {
  if (BYPASS_LOCATION) {
    return true; // Always return true when bypassing
  }

  const polygon = getSeongsuPolygon();
  return isPointInPolygon(location, polygon);
};

// Check if location is near any cafe bus (within 30 meters)
export const isNearCafeBus = (location: Location): boolean => {
  if (BYPASS_LOCATION) {
    return true; // Always return true when bypassing
  }

  const cafeBuses = getCafeBusLocations();
  return cafeBuses.some(bus => {
    const distance = calculateDistance(location, { lat: bus.lat, lng: bus.lng });
    return distance <= 30; // Within 30 meters
  });
};

// Get distance to nearest cafe bus
export const getDistanceToNearestCafeBus = (location: Location): number => {
  const cafeBuses = getCafeBusLocations();
  let minDistance = Infinity;

  cafeBuses.forEach(bus => {
    const distance = calculateDistance(location, { lat: bus.lat, lng: bus.lng });
    if (distance < minDistance) {
      minDistance = distance;
    }
  });

  return minDistance;
};

export const calculateDistance = (loc1: Location, loc2: Location): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (loc1.lat * Math.PI) / 180;
  const φ2 = (loc2.lat * Math.PI) / 180;
  const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
  const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Get Seongsu-dong center for map initialization
export const getSeongsuCenter = (): Location => {
  return {
    lat: 37.5464,
    lng: 127.0567
  };
};