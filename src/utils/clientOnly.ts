/**
 * Client-only utilities to prevent SSR hydration mismatches
 */

import { formatTimeUntilReset as _formatTimeUntilReset } from './canvasUtils';
import { getCurrentDayIdKST as _getCurrentDayIdKST } from './cafeUtils';

/**
 * Client-safe wrapper for formatTimeUntilReset
 */
export function formatTimeUntilResetSafe(): string {
  if (typeof window === 'undefined') {
    return '--:--:--';
  }
  return _formatTimeUntilReset();
}

/**
 * Client-safe wrapper for getCurrentDayIdKST  
 */
export function getCurrentDayIdKSTSafe(): string {
  if (typeof window === 'undefined') {
    return '--------';
  }
  return _getCurrentDayIdKST();
}

/**
 * Check if code is running on client
 */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}