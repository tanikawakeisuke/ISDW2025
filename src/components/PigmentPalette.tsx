'use client';

import React from 'react';
import { UserPigment } from '@/types';
import { usePigmentInventory } from '@/hooks/usePigmentInventory';

interface PigmentPaletteProps {
  className?: string;
  inventory?: UserPigment[];
  selectedPigment?: UserPigment | null;
  setSelectedPigment?: (pigment: UserPigment | null) => void;
  canUsePigment?: (pigmentId: string) => boolean;
}

export const PigmentPalette: React.FC<PigmentPaletteProps> = ({
  className = '',
  inventory: propInventory,
  selectedPigment: propSelectedPigment,
  setSelectedPigment: propSetSelectedPigment,
  canUsePigment: propCanUsePigment
}) => {
  const { 
    inventory: hookInventory, 
    loading, 
    selectedPigment: hookSelectedPigment, 
    setSelectedPigment: hookSetSelectedPigment, 
    canUsePigment: hookCanUsePigment 
  } = usePigmentInventory();

  // Use props if provided, otherwise fallback to hook
  const inventory = propInventory !== undefined ? propInventory : hookInventory;
  const selectedPigment = propSelectedPigment !== undefined ? propSelectedPigment : hookSelectedPigment;
  const setSelectedPigment = propSetSelectedPigment || hookSetSelectedPigment;
  const canUsePigment = propCanUsePigment || hookCanUsePigment;


  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Pigment Inventory</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🎨</div>
          <p>No pigments collected yet</p>
          <p className="text-sm mt-1">Explore the map to collect pigments!</p>
        </div>
      </div>
    );
  }

  const getRarityColor = (rarity: UserPigment['rarity']): string => {
    switch (rarity) {
      case 'legendary': return '#FFD700';
      case 'epic': return '#9D4EDD';
      case 'rare': return '#06D6A0';
      case 'uncommon': return '#118AB2';
      case 'common': return '#6C757D';
      default: return '#6C757D';
    }
  };

  const getRarityLabel = (rarity: UserPigment['rarity']): string => {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Pigment Inventory</h3>
        <div className="text-sm text-gray-500">
          {inventory.length} collected
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {inventory.map((pigment) => {
          const isSelected = selectedPigment?.pigmentId === pigment.pigmentId;
          const isUsable = canUsePigment(pigment.pigmentId);
          const rarityColor = getRarityColor(pigment.rarity);

          return (
            <button
              key={pigment.pigmentId}
              onClick={() => setSelectedPigment(isSelected ? null : pigment)}
              disabled={!isUsable}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-blue-500 shadow-lg scale-105' 
                  : 'border-gray-200 hover:border-gray-300'
                }
                ${isUsable 
                  ? 'cursor-pointer hover:shadow-md' 
                  : 'cursor-not-allowed opacity-50 grayscale'
                }
              `}
              style={{
                borderColor: isSelected ? '#3B82F6' : (isUsable ? rarityColor : '#E5E7EB')
              }}
            >
              {/* Color preview */}
              <div 
                className="w-full h-8 rounded mb-2 border"
                style={{ backgroundColor: pigment.color }}
              />

              {/* Pigment info */}
              <div className="text-xs text-left">
                <div className="font-medium truncate" title={pigment.name}>
                  {pigment.name}
                </div>
                <div 
                  className="text-xs font-medium capitalize"
                  style={{ color: rarityColor }}
                >
                  {getRarityLabel(pigment.rarity)}
                </div>
              </div>

              {/* Unlimited uses indicator */}
              <div className="flex items-center justify-center mt-2">
                <div className="text-xs text-green-600 font-medium">
                  ∞ Unlimited
                </div>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              )}

            </button>
          );
        })}
      </div>

      {/* Selected pigment info */}
      {selectedPigment && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded border-2 border-white shadow-sm"
              style={{ backgroundColor: selectedPigment.color }}
            />
            <div className="flex-1">
              <div className="font-medium">{selectedPigment.name}</div>
              <div className="text-sm text-gray-600">
                {getRarityLabel(selectedPigment.rarity)} • Unlimited uses
              </div>
            </div>
            <div className="text-green-600 text-sm font-medium">Ready to place</div>
          </div>
        </div>
      )}

      {!selectedPigment && inventory.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600 text-sm">
          Select a pigment to start placing pixels on the canvas
        </div>
      )}
    </div>
  );
};