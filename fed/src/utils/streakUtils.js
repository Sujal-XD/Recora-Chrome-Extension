import { differenceInCalendarDays, startOfDay } from 'date-fns';

/**
 * Calculates the current and longest streaks from a list of recordings.
 * @param {Array<Object>} recordings - An array of recording objects, each with a `createdAt` property.
 * @returns {{currentStreak: number, longestStreak: number}}
 */
export const calculateStreak = (recordings) => {
  if (!recordings || recordings.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // 1. Get unique dates at the start of the day to avoid timezone issues and multiple entries on the same day.
  const uniqueDates = [
    ...new Set(
      recordings.map(r => startOfDay(new Date(r.createdAt)).getTime())
    ),
  ].sort((a, b) => a - b); // Sort dates chronologically

  if (uniqueDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // 2. Calculate the longest streak and the last streak in the series.
  let longestStreak = 0;
  let currentStreak = 0;
  let lastTimestamp = 0;

  for (const timestamp of uniqueDates) {
    const currentDate = new Date(timestamp);
    const lastDate = new Date(lastTimestamp);

    if (lastTimestamp === 0 || differenceInCalendarDays(currentDate, lastDate) === 1) {
      currentStreak++;
    } else {
      // Streak was broken, reset it for the current date.
      currentStreak = 1;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    lastTimestamp = timestamp;
  }

  // 3. Check if the final streak is still active (i.e., occurred today or yesterday).
  const mostRecentDate = new Date(uniqueDates[uniqueDates.length - 1]);
  const daysSinceLastRecording = differenceInCalendarDays(new Date(), mostRecentDate);

  if (daysSinceLastRecording > 1) {
    currentStreak = 0; // The streak is broken if the last recording was more than a day ago.
  }

  return { currentStreak, longestStreak };
};