'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { CANVAS_CONFIG, UserPigment } from '@/types';
import { getCanvasPosition, getTimeUntilReset, validateCanvasSetup } from '@/utils/canvasUtils';
import { formatTimeUntilResetSafe } from '@/utils/clientOnly';
import { usePlaceCanvas } from '@/hooks/usePlaceCanvas';
import { usePigmentInventory } from '@/hooks/usePigmentInventory';

interface PlaceCanvasProps {
  className?: string;
  selectedPigment?: UserPigment | null;
  usePigment?: (pigmentId: string) => Promise<boolean>;
  canUsePigment?: (pigmentId: string) => boolean;
}

export const PlaceCanvas: React.FC<PlaceCanvasProps> = ({
  className = 'border border-gray-300 rounded-lg',
  selectedPigment: propSelectedPigment,
  usePigment: propUsePigment,
  canUsePigment: propCanUsePigment
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [timeUntilReset, setTimeUntilReset] = useState('');
  const [placementCooldown, setPlacementCooldown] = useState(0);
  const [mounted, setMounted] = useState(false);

  const { pixels, loading, currentDayId, placePixel, getPixelAt, totalPixels } = usePlaceCanvas();
  
  // Use props if provided, otherwise fallback to hook
  const { 
    inventory, 
    selectedPigment: hookSelectedPigment, 
    setSelectedPigment, 
    usePigment: hookUsePigment, 
    canUsePigment: hookCanUsePigment 
  } = usePigmentInventory();
  
  const selectedPigment = propSelectedPigment !== undefined ? propSelectedPigment : hookSelectedPigment;
  const usePigment = propUsePigment || hookUsePigment;
  const canUsePigment = propCanUsePigment || hookCanUsePigment;


  // Prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!mounted) return;
    
    const updateTimer = () => {
      setTimeUntilReset(formatTimeUntilResetSafe());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Update cooldown timer
  useEffect(() => {
    if (placementCooldown > 0) {
      const interval = setInterval(() => {
        setPlacementCooldown(prev => Math.max(0, prev - 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [placementCooldown]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure no transformations are applied that could affect coordinate mapping
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all pixels
    pixels.forEach((pixel) => {
      ctx.fillStyle = pixel.color;
      ctx.fillRect(pixel.x, pixel.y, 1, 1);
    });
    
    // Draw debug grid in development mode
    if (process.env.NODE_ENV === 'development' && canvas.width <= 512) {
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.lineWidth = 1;
      
      // Draw vertical grid lines every 50 pixels
      for (let x = 50; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
      }
      
      // Draw horizontal grid lines every 50 pixels
      for (let y = 50; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
        ctx.stroke();
      }
      
      // Draw coordinate labels
      ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
      ctx.font = '10px monospace';
      ctx.fillText('0,0', 2, 12);
      ctx.fillText(`${canvas.width-1},${canvas.height-1}`, canvas.width-40, canvas.height-5);
    }

    // Draw hover preview (5x5 brush)
    if (hoverPosition && selectedPigment && canUsePigment(selectedPigment.pigmentId) && placementCooldown === 0) {
      const brushSize = 5;
      const halfBrush = Math.floor(brushSize / 2);
      
      ctx.fillStyle = selectedPigment.color;
      ctx.globalAlpha = 0.5;
      
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
          const pixelX = hoverPosition.x + dx;
          const pixelY = hoverPosition.y + dy;
          
          // Check if pixel is within canvas bounds and not already occupied
          if (pixelX >= 0 && pixelX < canvas.width && pixelY >= 0 && pixelY < canvas.height) {
            const existingPixelAtPos = getPixelAt(pixelX, pixelY);
            if (!existingPixelAtPos) {
              ctx.fillRect(pixelX, pixelY, 1, 1);
            }
          }
        }
      }
      
      ctx.globalAlpha = 1;
    }
  }, [pixels, hoverPosition, selectedPigment, canUsePigment, getPixelAt, placementCooldown]);

  // Initialize canvas with precise size setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set internal canvas size to exact dimensions
    canvas.width = CANVAS_CONFIG.WIDTH;
    canvas.height = CANVAS_CONFIG.HEIGHT;

    // Ensure CSS display size matches internal size exactly - NO SCALING
    canvas.style.width = `${CANVAS_CONFIG.WIDTH}px`;
    canvas.style.height = `${CANVAS_CONFIG.HEIGHT}px`;

    // Disable image smoothing for pixel-perfect rendering
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      
      // Reset any transformations that might cause coordinate offset
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    console.log(`Canvas setup: internal=${canvas.width}x${canvas.height}, display=${canvas.style.width}x${canvas.style.height}, devicePixelRatio=${window.devicePixelRatio}`);
    
    // Validate canvas setup for coordinate transformation issues
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        const validation = validateCanvasSetup(canvas);
        if (!validation.isValid) {
          console.warn('Canvas setup issues detected:', validation.issues);
          console.log('Recommendations:', validation.recommendations);
        } else {
          console.log('✅ Canvas coordinate transformation setup is valid');
        }
      }, 100);
    }
  }, []);

  // Redraw when pixels change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle canvas click/touch
  const handleCanvasClick = useCallback(async (
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    event.preventDefault();
    
    if (isPlacing || !selectedPigment || placementCooldown > 0) return;
    if (!canUsePigment(selectedPigment.pigmentId)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasPosition(event, canvas);
    
    // Visual debug feedback in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Click at canvas coordinates: (${x}, ${y})`);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Save current drawing state
        const currentFillStyle = ctx.fillStyle;
        // Draw a small red dot at click position for debugging
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(x, y, 3, 3);
        // Restore drawing state
        ctx.fillStyle = currentFillStyle;
        // Clear the debug dot after 500ms
        setTimeout(() => drawCanvas(), 500);
      }
    }

    // Check if pixel already exists
    const existingPixel = getPixelAt(x, y);
    if (existingPixel) return;

    setIsPlacing(true);

    try {
      // Try to use the pigment
      const pigmentUsed = await usePigment(selectedPigment.pigmentId);
      if (!pigmentUsed) {
        console.error('Failed to use pigment');
        return;
      }

      // Place 5x5 pixels centered on click position
      const brushSize = 5;
      const halfBrush = Math.floor(brushSize / 2);
      let successCount = 0;
      
      for (let dx = -halfBrush; dx <= halfBrush; dx++) {
        for (let dy = -halfBrush; dy <= halfBrush; dy++) {
          const pixelX = x + dx;
          const pixelY = y + dy;
          
          // Check if pixel is within canvas bounds
          if (pixelX >= 0 && pixelX < canvas.width && pixelY >= 0 && pixelY < canvas.height) {
            const existingPixelAtPos = getPixelAt(pixelX, pixelY);
            if (!existingPixelAtPos) {
              const success = await placePixel(pixelX, pixelY, selectedPigment.color, selectedPigment.pigmentId);
              if (success) successCount++;
            }
          }
        }
      }
      
      const success = successCount > 0;
      
      if (success) {
        // Set cooldown (5 seconds)
        setPlacementCooldown(5000);
        
        // Show placement animation
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Brief flash effect
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(x, y, 1, 1);
            setTimeout(() => drawCanvas(), 100);
          }
        }
      }
    } catch (error) {
      console.error('Error placing pixel:', error);
    } finally {
      setIsPlacing(false);
    }
  }, [isPlacing, selectedPigment, canUsePigment, usePigment, placePixel, getPixelAt, drawCanvas, placementCooldown]);

  // Handle mouse/touch move for hover preview
  const handleCanvasMove = useCallback((
    event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getCanvasPosition(event, canvas);
    setHoverPosition({ x, y });
  }, []);

  // Handle mouse leave
  const handleCanvasLeave = useCallback(() => {
    setHoverPosition(null);
  }, []);

  if (loading) {
    return (
      <div className={`w-full h-96 flex items-center justify-center bg-gray-100 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading canvas...</p>
        </div>
      </div>
    );
  }

  const canPlace = selectedPigment && canUsePigment(selectedPigment.pigmentId) && placementCooldown === 0;

  return (
    <div className="space-y-4">
      {/* Canvas Info */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">r/Place Canvas</h2>
          <div className="text-sm text-gray-600">
            Day: {currentDayId}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Pixels placed:</span>
            <div className="font-mono text-lg">{totalPixels.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-600">Next reset:</span>
            <div className="font-mono text-lg">{mounted ? timeUntilReset : '--:--:--'}</div>
          </div>
          <div>
            <span className="text-gray-600">Canvas size:</span>
            <div className="font-mono text-lg">{CANVAS_CONFIG.WIDTH} × {CANVAS_CONFIG.HEIGHT}</div>
          </div>
        </div>

        {placementCooldown > 0 && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-orange-700 text-sm">
            Cooldown: {Math.ceil(placementCooldown / 1000)}s
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative bg-white rounded-lg shadow-sm border overflow-auto">
        <canvas
          ref={canvasRef}
          className={`${canPlace ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
          onClick={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onTouchMove={handleCanvasMove}
          onMouseLeave={handleCanvasLeave}
          style={{ 
            imageRendering: 'pixelated',
            imageRendering: '-moz-crisp-edges' as any,
            imageRendering: 'crisp-edges' as any,
            display: 'block',
            width: `${CANVAS_CONFIG.WIDTH}px`,
            height: `${CANVAS_CONFIG.HEIGHT}px`,
            touchAction: 'none' // Prevent scrolling on touch
          }}
        />

        {isPlacing && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Placing pixel...</span>
              </div>
            </div>
          </div>
        )}

        {/* Hover info */}
        {hoverPosition && (
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded pointer-events-none">
            ({hoverPosition.x}, {hoverPosition.y})
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="text-sm text-gray-600 space-y-1">
        <p>• Select a pigment from your inventory below</p>
        <p>• Click on an empty pixel to place your color</p>
        <p>• Each pigment has unlimited uses</p>
        <p>• Canvas resets daily at midnight KST</p>
      </div>
    </div>
  );
};