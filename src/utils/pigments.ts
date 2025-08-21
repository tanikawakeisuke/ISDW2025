import { Pigment, Location } from '@/types';

// Predefined pigment colors and names
const PIGMENT_DEFINITIONS = [
  // Common pigments (70% probability)
  { name: 'Seoul Gray', color: '#6B7280', rarity: 'common' as const },
  { name: 'Concrete Beige', color: '#D1D5DB', rarity: 'common' as const },
  { name: 'Urban Brown', color: '#92400E', rarity: 'common' as const },
  { name: 'Pavement Gray', color: '#4B5563', rarity: 'common' as const },
  { name: 'Building White', color: '#F3F4F6', rarity: 'common' as const },
  
  // Uncommon pigments (20% probability)
  { name: 'Neon Pink', color: '#EC4899', rarity: 'uncommon' as const },
  { name: 'Cafe Amber', color: '#F59E0B', rarity: 'uncommon' as const },
  { name: 'Han River Blue', color: '#3B82F6', rarity: 'uncommon' as const },
  { name: 'Garden Green', color: '#10B981', rarity: 'uncommon' as const },
  
  // Rare pigments (7% probability)
  { name: 'Sunset Orange', color: '#F97316', rarity: 'rare' as const },
  { name: 'Night Purple', color: '#8B5CF6', rarity: 'rare' as const },
  { name: 'Cherry Blossom', color: '#FBB6CE', rarity: 'rare' as const },
  
  // Epic pigments (2.5% probability)
  { name: 'Seoul Gold', color: '#F59E0B', rarity: 'epic' as const },
  { name: 'Hanbok Red', color: '#DC2626', rarity: 'epic' as const },
  
  // Legendary pigments (0.5% probability)
  { name: 'Dragon Jade', color: '#059669', rarity: 'legendary' as const },
  { name: 'Palace Royal', color: '#7C3AED', rarity: 'legendary' as const },
];

// Rarity weights for random selection
const RARITY_WEIGHTS = {
  common: 0.70,
  uncommon: 0.20,
  rare: 0.07,
  epic: 0.025,
  legendary: 0.005,
};

// Daily collection limits by rarity (can be bypassed)
export const DAILY_LIMITS = {
  common: 10,
  uncommon: 5,
  rare: 2,
  epic: 1,
  legendary: 1,
};

// Check if daily limit bypass is enabled
const BYPASS_DAILY_LIMIT = process.env.NEXT_PUBLIC_BYPASS_DAILY_LIMIT === 'true';

export const generateRandomPigment = (location: Location, userId: string): Pigment => {
  // Generate random number for rarity selection
  const random = Math.random();
  let selectedRarity: Pigment['rarity'] = 'common';
  
  // Determine rarity based on random value and weights
  let cumulativeWeight = 0;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    cumulativeWeight += weight;
    if (random <= cumulativeWeight) {
      selectedRarity = rarity as Pigment['rarity'];
      break;
    }
  }
  
  // Get pigments of the selected rarity
  const pigmentsOfRarity = PIGMENT_DEFINITIONS.filter(p => p.rarity === selectedRarity);
  const selectedPigment = pigmentsOfRarity[Math.floor(Math.random() * pigmentsOfRarity.length)];
  
  return {
    id: `pigment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: selectedPigment.name,
    color: selectedPigment.color,
    rarity: selectedPigment.rarity,
    location,
    discoveredAt: new Date(),
    discoveredBy: userId,
  };
};

export const canCollectPigment = (
  rarity: Pigment['rarity'],
  dailyCollectionCounts: Record<string, number>
): boolean => {
  if (BYPASS_DAILY_LIMIT) {
    return true; // Allow unlimited collections when bypassing
  }
  
  const limit = DAILY_LIMITS[rarity];
  const collected = dailyCollectionCounts[rarity] || 0;
  
  return collected < limit;
};

export const getRarityColor = (rarity: Pigment['rarity']): string => {
  switch (rarity) {
    case 'legendary': return '#FFD700';
    case 'epic': return '#9D4EDD';
    case 'rare': return '#06D6A0';
    case 'uncommon': return '#118AB2';
    case 'common': return '#6C757D';
    default: return '#6C757D';
  }
};

export const getRarityEmoji = (rarity: Pigment['rarity']): string => {
  switch (rarity) {
    case 'legendary': return '🌟';
    case 'epic': return '💜';
    case 'rare': return '💎';
    case 'uncommon': return '🔵';
    case 'common': return '⚪';
    default: return '⚪';
  }
};

export const calculateCollectionChance = (location: Location): number => {
  // Base chance is 30%
  let chance = 0.3;
  
  // In bypass mode, increase chance to 80%
  if (process.env.NEXT_PUBLIC_BYPASS_LOCATION === 'true') {
    chance = 0.8;
  }
  
  // Add some randomness based on location
  const locationFactor = (Math.sin(location.lat * 1000) + Math.cos(location.lng * 1000)) * 0.1;
  chance += locationFactor;
  
  return Math.max(0.1, Math.min(0.9, chance)); // Clamp between 10% and 90%
};

// Create a pool of discoverable pigments for the current session
export const createPigmentPool = (centerLocation: Location, count: number = 50): Pigment[] => {
  const pigments: Pigment[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate random location within ~500m radius of center
    const radiusInDegrees = 0.0045; // approximately 500m
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * radiusInDegrees;
    
    const lat = centerLocation.lat + (distance * Math.cos(angle));
    const lng = centerLocation.lng + (distance * Math.sin(angle));
    
    const pigment = generateRandomPigment({ lat, lng }, 'system');
    pigments.push(pigment);
  }
  
  return pigments;
};