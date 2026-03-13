export const extractTimesFromText = (text: string): Array<{ time: string; context: string }> => {
  const timePatterns = [
    // Specific dates and times
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:at\s+)?(\d{1,2}:\d{2}(?:\s*[ap]m)?)/gi,
    /(\d{4}-\d{2}-\d{2})\s+(?:at\s+)?(\d{1,2}:\d{2}(?:\s*[ap]m)?)/gi,
    // Times with context
    /((?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)/gi,
    // Meeting patterns
    /meeting\s+(?:on\s+)?(\w+)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)/gi,
    /call\s+(?:on\s+)?(\w+)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)/gi,
    // Appointment patterns
    /appointment\s+(?:on\s+)?(\w+)\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)/gi,
  ];

  const extractedTimes: Array<{ time: string; context: string }> = [];

  timePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const contextStart = Math.max(0, match.index - 50);
      const contextEnd = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.substring(contextStart, contextEnd).trim();
      
      // Try to parse and create a valid date
      try {
        let timeStr = '';
        if (match[1] && match[2]) {
          // Date + time format
          if (match[1].includes('/') || match[1].includes('-')) {
            timeStr = `${match[1]} ${match[2]}`;
          } else {
            // Day name + time
            const dayName = match[1].toLowerCase();
            const time = match[2];
            const today = new Date();
            const targetDate = getNextWeekday(today, dayName);
            timeStr = `${targetDate.toDateString()} ${time}`;
          }
        }
        
        if (timeStr) {
          const parsedDate = new Date(timeStr);
          if (!isNaN(parsedDate.getTime()) && parsedDate > new Date()) {
            extractedTimes.push({
              time: parsedDate.toISOString(),
              context: context
            });
          }
        }
      } catch (error) {
        console.warn('Could not parse time:', match[0]);
      }
    }
  });

  return extractedTimes;
};

const getNextWeekday = (date: Date, dayName: string): Date => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(dayName.toLowerCase());
  
  if (targetDay === -1) {
    return date; // Invalid day name
  }

  const today = new Date(date);
  const currentDay = today.getDay();
  let daysToAdd = targetDay - currentDay;
  
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next week
  }
  
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  return targetDate;
};