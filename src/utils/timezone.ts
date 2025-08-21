import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// Korean Standard Time timezone
export const KST_TIMEZONE = 'Asia/Seoul';

// Get current date in KST
export const getCurrentKSTDate = (): Date => {
  return toZonedTime(new Date(), KST_TIMEZONE);
};

// Get start of day in KST (00:00:00 KST)
export const getKSTDayStart = (date?: Date): Date => {
  const kstDate = date ? toZonedTime(date, KST_TIMEZONE) : getCurrentKSTDate();
  const startOfDay = new Date(kstDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Convert back to UTC for storage
  return fromZonedTime(startOfDay, KST_TIMEZONE);
};

// Get end of day in KST (23:59:59.999 KST)
export const getKSTDayEnd = (date?: Date): Date => {
  const kstDate = date ? toZonedTime(date, KST_TIMEZONE) : getCurrentKSTDate();
  const endOfDay = new Date(kstDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  // Convert back to UTC for storage
  return fromZonedTime(endOfDay, KST_TIMEZONE);
};

// Check if a date is today in KST
export const isToday = (date: Date): boolean => {
  const today = getCurrentKSTDate();
  const targetDate = toZonedTime(date, KST_TIMEZONE);
  
  return (
    today.getFullYear() === targetDate.getFullYear() &&
    today.getMonth() === targetDate.getMonth() &&
    today.getDate() === targetDate.getDate()
  );
};

// Format date in KST
export const formatKSTDate = (date: Date, formatString: string = 'yyyy-MM-dd HH:mm:ss'): string => {
  return format(toZonedTime(date, KST_TIMEZONE), formatString, { timeZone: KST_TIMEZONE });
};

// Get the next reset time (tomorrow at 00:00 KST)
export const getNextResetTime = (): Date => {
  const tomorrow = new Date(getCurrentKSTDate());
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return getKSTDayStart(tomorrow);
};

// Get time until next reset in milliseconds
export const getTimeUntilReset = (): number => {
  const nextReset = getNextResetTime();
  const now = new Date();
  
  return nextReset.getTime() - now.getTime();
};

// Format time until reset as human readable string
export const formatTimeUntilReset = (): string => {
  const ms = getTimeUntilReset();
  
  if (ms <= 0) {
    return 'Resetting...';
  }
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

// Check if user's daily data needs to be reset
export const shouldResetDailyData = (lastResetDate?: Date): boolean => {
  if (!lastResetDate) {
    return true; // First time, needs reset
  }
  
  return !isToday(lastResetDate);
};