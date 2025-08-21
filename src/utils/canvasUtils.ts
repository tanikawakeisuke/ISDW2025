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
 * Validate canvas coordinates
 */
export function isValidCoordinate(x: number, y: number): boolean {
  return x >= 0 && x < CANVAS_CONFIG.WIDTH && y >= 0 && y < CANVAS_CONFIG.HEIGHT;
}

/**
 * Get canvas position from mouse/touch event
 */
export function getCanvasPosition(
  event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
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
  
  const scaleX = CANVAS_CONFIG.WIDTH / rect.width;
  const scaleY = CANVAS_CONFIG.HEIGHT / rect.height;
  
  const x = Math.floor((clientX - rect.left) * scaleX);
  const y = Math.floor((clientY - rect.top) * scaleY);
  
  return { x, y };
}