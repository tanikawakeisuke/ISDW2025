// Pigment types
export interface Pigment {
  id: string;
  name: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  location: {
    lat: number;
    lng: number;
  };
  discoveredAt: Date;
  discoveredBy: string; // user ID
}

// User Pigment Inventory
export interface UserPigment {
  pigmentId: string;
  color: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  lastUsed?: Date;
  collectedAt: Date;
  collectedFrom: string; // cafe ID
}

// User types
export interface User {
  id: string;
  isAnonymous: boolean;
  pigmentsCollected: string[]; // pigment IDs
  lastCollectionDate?: Date;
  dailyCollectionCount: number;
}

// r/Place style Canvas Pixel
export interface CanvasPixel {
  x: number;
  y: number;
  color: string;
  placedBy: string; // user ID
  timestamp: Date;
}

// Canvas Day Management
export interface CanvasDay {
  dayId: string; // YYYYMMDD format
  createdAt: Date;
  totalPixels: number;
  lastActivity: Date;
}

// Canvas Configuration
export const CANVAS_CONFIG = {
  WIDTH: 512,
  HEIGHT: 288
} as const;

// Location types
export interface Location {
  lat: number;
  lng: number;
  accuracy?: number;
}

// Geofence types
export interface GeofencePolygon {
  id: string;
  name: string;
  coordinates: Location[];
}

// Collection types
export interface CollectionEvent {
  id: string;
  userId: string;
  pigmentId: string;
  location: Location;
  timestamp: Date;
  isValid: boolean;
}

// Canvas Placement Event
export interface PixelPlacementEvent {
  x: number;
  y: number;
  color: string;
  userId: string;
  pigmentId: string;
  timestamp: Date;
}

// Cafe types
export interface Cafe {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'fixed' | 'bus';
  address?: string;
  phone?: string;
}

// Collection History (per cafe per day)
export interface CafeCollection {
  cafeId: string;
  cafeName: string;
  cafeType: 'fixed' | 'bus';
  pigmentCollected: {
    id: string;
    name: string;
    color: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  };
  timestamp: Date;
  location: Location;
  rarityFactors: {
    distance: number;
    density: number;
    timeBonus: number;
  };
}

// Daily collection status
export interface DailyCollectionStatus {
  dayId: string; // YYYYMMDD
  collectedCafes: string[]; // cafe IDs
  totalCollections: number;
}