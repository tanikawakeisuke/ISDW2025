import { Cafe, Location } from '@/types';
import { calculateDistance, isWithinSeongsuDong } from '@/utils/geolocation';

// Cafe Bus data (from cafe_buses.json)
export const CAFE_BUSES: Cafe[] = [
  {
    id: 'bus1',
    name: 'Cafe Bus A - 성수역 앞',
    lat: 37.542374,
    lng: 127.042089,
    type: 'bus'
  },
  {
    id: 'bus2',
    name: 'Cafe Bus B - 성수동 중심가',
    lat: 37.544775,
    lng: 127.043197,
    type: 'bus'
  },
  {
    id: 'bus3',
    name: 'Cafe Bus C - 서울숲 입구',
    lat: 37.549510,
    lng: 127.051671,
    type: 'bus'
  }
];

// Collection radius in meters
export const COLLECTION_RADIUS = 30;


/**
 * Wait for Kakao Maps API to be loaded
 */
function waitForKakaoMapsAPI(timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Not running in browser'));
      return;
    }

    if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Kakao Maps API load timeout'));
      }
    }, 100);
  });
}

/**
 * Get search size based on radius for progressive display
 */
function getSearchSize(radius: number): number {
  if (radius <= 200) return 15; // 詳細表示
  if (radius <= 500) return 8;  // 中程度
  if (radius <= 1000) return 5; // 遠距離は少なく
  return 3; // 最遠距離
}

/**
 * Search for cafes using Kakao Maps API with progressive display
 */
export async function searchNearbyCafes(location: Location, radius: number = 1000): Promise<Cafe[]> {
  try {
    // Wait for API to be loaded
    await waitForKakaoMapsAPI();
  } catch (error) {
    console.warn('Kakao Maps API not available:', error);
    return [];
  }

  // Progressive search: multiple ranges with different densities
  const searches = [
    { radius: 200, size: 30 },  // 近距離: 詳細表示
    { radius: 500, size: 16 },  // 中距離: 中程度
    { radius: 1000, size: 10 }, // 遠距離: 少なく
    { radius: 2000, size: 6 }   // 最遠距離: 最小
  ];

  const allCafes: Cafe[] = [];
  const processedIds = new Set<string>();

  for (const search of searches) {
    if (search.radius > radius) continue;

    try {
      // カフェ カテゴリ検索
      const cafes = await searchCafesInRange(location, search.radius, search.size);
      
      // ベーカリー カテゴリも検索 (コーヒー関連店舗含む)
      const bakeries = await searchBakeriesInRange(location, search.radius, Math.floor(search.size / 2));
      
      // 重複除去して追加
      [...cafes, ...bakeries].forEach(cafe => {
        if (!processedIds.has(cafe.id)) {
          processedIds.add(cafe.id);
          allCafes.push(cafe);
        }
      });
    } catch (error) {
      console.warn(`Search failed for radius ${search.radius}:`, error);
    }
  }

  return allCafes;
}

/**
 * Search cafes in specific range with pagination
 */
async function searchCafesInRange(location: Location, radius: number, size: number): Promise<Cafe[]> {
  const allCafes: Cafe[] = [];
  const maxPages = 3; // 최대 3페이지까지 검색 (45건 * 3 = 135건)
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const cafes = await searchCafesPage(location, radius, size, page);
      allCafes.push(...cafes);
      
      // 반환된 결과가 요청한 size보다 적으면 더 이상 페이지가 없음
      if (cafes.length < size) break;
    } catch (error) {
      console.warn(`Page ${page} search failed:`, error);
      break;
    }
  }
  
  return allCafes;
}

/**
 * Search bakeries in specific range with pagination
 */
async function searchBakeriesInRange(location: Location, radius: number, size: number): Promise<Cafe[]> {
  const allBakeries: Cafe[] = [];
  const maxPages = 3; // 최대 3페이지까지 검색 (45건 * 3 = 135건)
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const bakeries = await searchBakeryPage(location, radius, size, page);
      // 커피 관련 키워드가 있는 베이커리만 필터링
      const coffeeRelatedBakeries = bakeries.filter(bakery => 
        /coffee|카페|커피|브런치|브루/i.test(bakery.name)
      );
      allBakeries.push(...coffeeRelatedBakeries);
      
      // 반환된 결과가 요청한 size보다 적으면 더 이상 페이지가 없음
      if (bakeries.length < size) break;
    } catch (error) {
      console.warn(`Bakery page ${page} search failed:`, error);
      break;
    }
  }
  
  return allBakeries;
}

/**
 * Search single page of bakeries
 */
async function searchBakeryPage(location: Location, radius: number, size: number, page: number): Promise<Cafe[]> {
  return new Promise((resolve, reject) => {
    const places = new window.kakao.maps.services.Places();
    
    places.categorySearch('FD6', (data: any, status: any, pagination: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const bakeries: Cafe[] = data
          .map((place: any) => ({
            id: `bakery_${place.id}`,
            name: place.place_name,
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            type: 'fixed' as const,
            address: place.road_address_name || place.address_name,
            phone: place.phone
          }))
          .filter((bakery: Cafe) => {
            const distance = calculateDistance(location, { lat: bakery.lat, lng: bakery.lng });
            return distance <= radius;
          });

        resolve(bakeries);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error(`Failed to search bakeries page ${page}`));
      }
    }, {
      location: new window.kakao.maps.LatLng(location.lat, location.lng),
      radius: radius,
      size: Math.min(size, 15), // Kakao API 최대 15건
      page: page
    });
  });
}

/**
 * Search single page of cafes
 */
async function searchCafesPage(location: Location, radius: number, size: number, page: number): Promise<Cafe[]> {
  return new Promise((resolve, reject) => {
    const places = new window.kakao.maps.services.Places();
    
    places.categorySearch('CE7', (data: any, status: any, pagination: any) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const cafes: Cafe[] = data
          .map((place: any) => ({
            id: `fixed_${place.id}`,
            name: place.place_name,
            lat: parseFloat(place.y),
            lng: parseFloat(place.x),
            type: 'fixed' as const,
            address: place.road_address_name || place.address_name,
            phone: place.phone
          }))
          .filter((cafe: Cafe) => {
            const distance = calculateDistance(location, { lat: cafe.lat, lng: cafe.lng });
            return distance <= radius;
          });

        resolve(cafes);
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
      } else {
        reject(new Error(`Failed to search cafes page ${page}`));
      }
    }, {
      location: new window.kakao.maps.LatLng(location.lat, location.lng),
      radius: radius,
      size: Math.min(size, 15), // Kakao API 최대 15건
      page: page
    });
  });
}

/**
 * Get all cafes (fixed + bus) near user location
 */
export async function getAllNearbyCafes(location: Location, radius: number = 1000): Promise<Cafe[]> {
  try {
    // Get fixed cafes from Kakao Maps API
    const fixedCafes = await searchNearbyCafes(location, radius);
    
    // Filter cafe buses by distance
    const nearbyCafeBuses = CAFE_BUSES.filter(bus => {
      const distance = calculateDistance(location, { lat: bus.lat, lng: bus.lng });
      return distance <= radius;
    });

    return [...fixedCafes, ...nearbyCafeBuses];
  } catch (error) {
    console.error('Error getting nearby cafes:', error);
    // Return only cafe buses if API fails
    const nearbyCafeBuses = CAFE_BUSES.filter(bus => {
      const distance = calculateDistance(location, { lat: bus.lat, lng: bus.lng });
      return distance <= radius;
    });
    return nearbyCafeBuses;
  }
}

/**
 * Check if user is within collection range of any cafe and inside Seongsu-dong
 */
export function getCafesInCollectionRange(userLocation: Location, cafes: Cafe[]): Cafe[] {
  // First check if user is in Seongsu-dong area
  if (!isWithinSeongsuDong(userLocation)) {
    return [];
  }

  return cafes.filter(cafe => {
    const distance = calculateDistance(userLocation, { lat: cafe.lat, lng: cafe.lng });
    return distance <= COLLECTION_RADIUS;
  });
}

/**
 * Get distance to nearest cafe
 */
export function getDistanceToNearestCafe(userLocation: Location, cafes: Cafe[]): number {
  if (cafes.length === 0) return Infinity;

  return Math.min(...cafes.map(cafe => 
    calculateDistance(userLocation, { lat: cafe.lat, lng: cafe.lng })
  ));
}

/**
 * Calculate rarity based on distance, density, and time
 */
export function calculateRarity(userLocation: Location, cafe: Cafe, cafes: Cafe[]): {
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  factors: { distance: number; density: number; timeBonus: number };
} {
  const distance = calculateDistance(userLocation, { lat: cafe.lat, lng: cafe.lng });
  
  // Distance factor (closer = higher rarity)
  const distanceFactor = Math.max(0, 1 - (distance / COLLECTION_RADIUS));
  
  // Density factor (fewer nearby cafes = higher rarity)
  const nearbyCafes = cafes.filter(c => 
    c.id !== cafe.id && 
    calculateDistance({ lat: cafe.lat, lng: cafe.lng }, { lat: c.lat, lng: c.lng }) <= 200
  );
  const densityFactor = Math.max(0, 1 - (nearbyCafes.length / 10));
  
  // Time bonus (evening and morning peak hours)
  const hour = new Date().getHours();
  let timeBonus = 0;
  if (hour >= 18 && hour <= 21) {
    timeBonus = 0.3; // Evening bonus
  } else if (hour >= 7 && hour <= 9) {
    timeBonus = 0.25; // Morning bonus
  } else if (hour >= 14 && hour <= 16) {
    timeBonus = 0.15; // Afternoon bonus
  }
  
  // Special bonus for cafe buses
  const busBonus = cafe.type === 'bus' ? 0.2 : 0;
  
  // Calculate final rarity score
  const rarityScore = (distanceFactor * 0.3) + (densityFactor * 0.4) + timeBonus + busBonus;
  
  let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  if (rarityScore >= 0.8) {
    rarity = 'legendary';
  } else if (rarityScore >= 0.6) {
    rarity = 'epic';
  } else if (rarityScore >= 0.4) {
    rarity = 'rare';
  } else if (rarityScore >= 0.2) {
    rarity = 'uncommon';
  } else {
    rarity = 'common';
  }

  return {
    rarity,
    factors: {
      distance: distanceFactor,
      density: densityFactor,
      timeBonus: timeBonus + busBonus
    }
  };
}

/**
 * Generate pigment based on cafe and rarity
 */
export function generateCafePigment(cafe: Cafe, rarity: string, rarityFactors: any): {
  id: string;
  name: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
} {
  // Base colors for different rarities
  const baseColors = {
    common: ['#8B4513', '#CD853F', '#D2B48C', '#F4A460'],      // Browns and tans
    uncommon: ['#4682B4', '#5F9EA0', '#6495ED', '#7B68EE'],    // Blues
    rare: ['#32CD32', '#228B22', '#9ACD32', '#7CFC00'],        // Greens
    epic: ['#9370DB', '#8A2BE2', '#9932CC', '#BA55D3'],       // Purples
    legendary: ['#FFD700', '#FFA500', '#FF6347', '#DC143C']    // Gold/Red
  };

  const colors = baseColors[rarity as keyof typeof baseColors] || baseColors.common;
  const color = colors[Math.floor(Math.random() * colors.length)];

  // Generate name based on cafe and rarity
  const rarityPrefixes = {
    common: '',
    uncommon: 'Rich ',
    rare: 'Vibrant ',
    epic: 'Brilliant ',
    legendary: 'Mystic '
  };

  const cafeBaseName = cafe.name.split(' ')[0] || 'Seoul';
  const colorSuffixes = ['Brew', 'Blend', 'Roast', 'Bean', 'Cream', 'Foam', 'Steam'];
  const suffix = colorSuffixes[Math.floor(Math.random() * colorSuffixes.length)];

  const prefix = rarityPrefixes[rarity as keyof typeof rarityPrefixes];
  const name = `${prefix}${cafeBaseName} ${suffix}`;

  return {
    id: `pigment_${cafe.id}_${Date.now()}`,
    name,
    color,
    rarity: rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  };
}

/**
 * Get current day ID in KST
 */
export function getCurrentDayIdKST(): string {
  const now = new Date();
  // Convert to KST (UTC+9)
  const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  
  const year = kstTime.getUTCFullYear();
  const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getUTCDate()).padStart(2, '0');
  
  return `${year}${month}${day}`;
}