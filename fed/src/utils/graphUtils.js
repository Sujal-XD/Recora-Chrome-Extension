import { startOfWeek, endOfWeek, eachDayOfInterval, format, max } from 'date-fns';

/**
 * Aggregates recording data for the week of the most recent recording.
 * If no recordings exist, it defaults to the current week.
 * @param {Array<Object>} recordings - An array of recording objects with `createdAt` and `duration`.
 * @returns {Array<{name: string, minutes: number}>} - Data formatted for the activity graph.
 */
export const processWeeklyActivity = (recordings) => {

  const referenceDate =
    recordings && recordings.length > 0
      ? max(recordings.map(r => new Date(r.createdAt)))
      : new Date();

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });

  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const dailyMinutes = new Map();
  weekDays.forEach(day => {
    const dayName = format(day, 'E');
    dailyMinutes.set(dayName, 0);
  });

  if (recordings) {
    recordings.forEach((rec, index) => {
      const recordingDate = new Date(rec.createdAt);
      const isInWeek = recordingDate >= weekStart && recordingDate <= weekEnd;

      // // --- START: DEBUG LOGS ---
      // console.log(`--- Checking Recording #${index + 1} ---`);
      // console.log("Recording Date:", recordingDate.toString());
      // console.log("Is it within the week?", isInWeek ? "Yes" : "No");
      // // --- END: DEBUG LOGS ---
      
      if (isInWeek) {
        const dayName = format(recordingDate, 'E');
        const currentMinutes = dailyMinutes.get(dayName) || 0;
        
        const newMinutes = parseInt(rec.duration.minutes, 10) || 0;
        const newSeconds = parseInt(rec.duration.seconds, 10) || 0;
        
        const totalNewMinutes = newMinutes + newSeconds / 60;

        dailyMinutes.set(dayName, currentMinutes + totalNewMinutes);
      }
    });
  }

  const chartData = Array.from(dailyMinutes.entries()).map(([name, minutes]) => ({
    name,
    minutes: Math.round(minutes),
  }));

  // // --- START: DEBUG LOGS ---
  // console.log("Final processed chart data:", chartData);
  // console.log("--- Activity Graph Processing End ---");
  // // --- END: DEBUG LOGS ---

  return chartData;
};
