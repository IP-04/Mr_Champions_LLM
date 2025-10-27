/**
 * Parse match date and time into a proper Date object
 * Handles formats like:
 * - "2025-11-04" with "17:45 CET"
 * - "2025-11-04" with "8:30 PM CET"
 * - "Today" with "8:00 PM"
 */
export function parseMatchDateTime(date: string, time: string): Date | null {
  try {
    let baseDate: string;
    
    if (date === "Today") {
      baseDate = new Date().toISOString().split('T')[0];
    } else if (date.includes('-')) {
      baseDate = date; // Already in YYYY-MM-DD format
    } else {
      // Handle "Oct 21" format
      const currentYear = new Date().getFullYear();
      const parsedDate = new Date(`${date} ${currentYear}`);
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
      baseDate = parsedDate.toISOString().split('T')[0];
    }
    
    // Parse time with timezone handling
    let hours: number;
    let minutes: number;
    
    // Remove timezone and AM/PM markers
    const cleanTime = time.replace(' CET', '').replace(' CEST', '').trim();
    
    // Check if it's 12-hour format (has AM/PM)
    const isPM = cleanTime.includes('PM');
    const isAM = cleanTime.includes('AM');
    const timeOnly = cleanTime.replace('PM', '').replace('AM', '').trim();
    
    const [hourStr, minStr] = timeOnly.split(':');
    hours = parseInt(hourStr, 10);
    minutes = parseInt(minStr, 10);
    
    // Convert 12-hour to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }
    
    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }
    
    // CET is UTC+1, CEST (Central European Summer Time) is UTC+2
    const isCEST = time.includes('CEST');
    const isCET = time.includes('CET') && !isCEST; // CET but not CEST
    
    if (isCEST) {
      // Convert CEST to UTC by subtracting 2 hours
      hours -= 2;
      
      // Handle day boundary crossing
      if (hours < 0) {
        hours += 24;
        const dateObj = new Date(baseDate);
        dateObj.setDate(dateObj.getDate() - 1);
        baseDate = dateObj.toISOString().split('T')[0];
      }
    } else if (isCET) {
      // Convert CET to UTC by subtracting 1 hour
      hours -= 1;
      
      // Handle day boundary crossing
      if (hours < 0) {
        hours += 24;
        const dateObj = new Date(baseDate);
        dateObj.setDate(dateObj.getDate() - 1);
        baseDate = dateObj.toISOString().split('T')[0];
      }
    }
    
    // Construct ISO datetime string in UTC
    const isoString = `${baseDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`;
    const matchDateTime = new Date(isoString);
    
    if (isNaN(matchDateTime.getTime())) {
      return null;
    }
    
    return matchDateTime;
  } catch (error) {
    console.error('Error parsing match datetime:', error);
    return null;
  }
}

/**
 * Compare two matches by their datetime for sorting
 */
export function compareMatchesByDate(a: { date: string; time: string }, b: { date: string; time: string }): number {
  const dateA = parseMatchDateTime(a.date, a.time);
  const dateB = parseMatchDateTime(b.date, b.time);
  
  if (!dateA || !dateB) {
    return 0;
  }
  
  return dateA.getTime() - dateB.getTime();
}

/**
 * Check if a match is upcoming (in the future)
 */
export function isMatchUpcoming(date: string, time: string): boolean {
  const matchDateTime = parseMatchDateTime(date, time);
  if (!matchDateTime) {
    return false;
  }
  
  const now = new Date();
  return matchDateTime >= now;
}
