import { CANVAS_CONFIG } from '@/types';

/**
 * Get current KST date in YYYYMMDD format
 */
export function getCurrentDayId(): string {
  const now = new Date();
  // Convert to KST (UTC+9)
  const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  
  const year = kstTime.getUTCFullYear();
  const month = String(kstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstTime.getUTCDate()).padStart(2, '0');
  
  return `${year}${month}${day}`;
}

/**
 * Get next reset time (KST midnight)
 */
export function getNextResetTime(): Date {
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  
  // Get next midnight KST
  const nextMidnight = new Date(kstNow);
  nextMidnight.setUTCHours(15, 0, 0, 0); // 15:00 UTC = 00:00 KST next day
  
  if (nextMidnight <= now) {
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  }
  
  return nextMidnight;
}

/**
 * Get time until next reset in milliseconds
 */
export function getTimeUntilReset(): number {
  return getNextResetTime().getTime() - Date.now();
}

/**
 * Format time until reset for display
 */
export function formatTimeUntilReset(): string {
  const ms = getTimeUntilReset();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Convert canvas coordinates to pixel key
 */
export function getPixelKey(x: number, y: number): string {
  return `${x}_${y}`;
}

/**
 * Parse pixel key to coordinates
 */
export function parsePixelKey(key: string): { x: number; y: number } {
  const [x, y] = key.split('_').map(Number);
  return { x, y };
}

/**
 * Validate canvas coordinates against actual canvas dimensions
 */
export function isValidCoordinate(x: number, y: number, canvas?: HTMLCanvasElement): boolean {
  if (canvas) {
    return x >= 0 && x < canvas.width && y >= 0 && y < canvas.height;
  }
  // Fallback to config if no canvas provided
  return x >= 0 && x < CANVAS_CONFIG.WIDTH && y >= 0 && y < CANVAS_CONFIG.HEIGHT;
}

/**
 * Validate coordinate transformation setup
 */
export function validateCanvasSetup(canvas: HTMLCanvasElement): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const rect = canvas.getBoundingClientRect();
  const ctx = canvas.getContext('2d');
  
  // Check internal vs display size
  if (canvas.width !== CANVAS_CONFIG.WIDTH || canvas.height !== CANVAS_CONFIG.HEIGHT) {
    issues.push(`Canvas internal size (${canvas.width}x${canvas.height}) doesn't match config (${CANVAS_CONFIG.WIDTH}x${CANVAS_CONFIG.HEIGHT})`);
  }
  
  // Check if CSS scaling is applied
  const displayWidth = Math.round(rect.width);
  const displayHeight = Math.round(rect.height);
  if (displayWidth !== canvas.width || displayHeight !== canvas.height) {
    issues.push(`Canvas is being scaled: internal(${canvas.width}x${canvas.height}) vs display(${displayWidth}x${displayHeight})`);
    recommendations.push('Ensure CSS width/height matches canvas.width/height exactly');
  }
  
  // Check for transforms
  if (ctx) {
    const transform = ctx.getTransform();
    if (transform.a !== 1 || transform.b !== 0 || transform.c !== 0 || transform.d !== 1 || transform.e !== 0 || transform.f !== 0) {
      issues.push(`Canvas has active transformation matrix: [${transform.a}, ${transform.b}, ${transform.c}, ${transform.d}, ${transform.e}, ${transform.f}]`);
      recommendations.push('Reset canvas transformation with ctx.setTransform(1,0,0,1,0,0)');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Get canvas position from mouse/touch event with precise coordinate calculation
 * Fixed for coordinate transformation misalignment issues
 */
export function getCanvasPosition(
  event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  // Get precise bounding rect
  const rect = canvas.getBoundingClientRect();
  
  let clientX: number, clientY: number;
  
  if ('touches' in event) {
    const touch = event.touches[0] || event.changedTouches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }
  
  // Calculate offset within the canvas element in CSS pixels
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;
  
  // Calculate the ratio between internal canvas size and displayed CSS size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  // Convert CSS pixel coordinates to canvas internal coordinates
  const x = Math.floor(offsetX * scaleX);
  const y = Math.floor(offsetY * scaleY);
  
  // Clamp to canvas bounds (ensure we don't go outside the canvas)
  const clampedX = Math.max(0, Math.min(canvas.width - 1, x));
  const clampedY = Math.max(0, Math.min(canvas.height - 1, y));
  
  // Debug logging for coordinate transformation validation
  if (process.env.NODE_ENV === 'development') {
    console.log(`Coordinate calc: client(${clientX.toFixed(1)}, ${clientY.toFixed(1)}) -> offset(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)}) -> canvas(${clampedX}, ${clampedY}) | scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}) | rect(${rect.width.toFixed(1)}x${rect.height.toFixed(1)}) | canvas(${canvas.width}x${canvas.height})`);
  }
  
  return { x: clampedX, y: clampedY };
}