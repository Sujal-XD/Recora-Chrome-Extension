import React from 'react';
import { FiStar } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PrimaryButton from './PrimaryButton'; // Import our new button

const WelcomeBanner = () => {
    const { currentUser, streakData, allRecordings } = useAuth();
    const { currentStreak, longestStreak } = streakData;

    // --- FIX: Capitalize the first letter of the user's first name ---
    const getFirstName = () => {
        if (!currentUser?.name) return 'there';
        const name = currentUser.name.split(' ')[0];
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    };

    const firstName = getFirstName();

    // The logic to determine the correct message
    const getStreakMessage = () => {
        if (!allRecordings || allRecordings.length === 0) {
            return "Start recording to build your first streak!";
        }
        if (currentStreak > 0) {
            return `You're on a ${currentStreak}-day streak. Keep pushing, your streak is growing! 💪`;
        }
        return "You broke your streak, but today’s a fresh start!";
    };

    const motivationalMessage = getStreakMessage();

    return (
        // The main container with theme-aware background, border, and shadow
        <div className="bg-brand-surface dark:bg-dark-surface p-6 sm:p-8 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                
                {/* Left Side: Welcome Text and Streak Info */}
                <div className="flex-grow">
                    <h2 className="text-3xl font-bold text-brand-text dark:text-dark-text">
                        Welcome Back, {firstName}!
                    </h2>
                    
                    <p className="mt-2 text-brand-subtle dark:text-dark-subtle">
                        {motivationalMessage}
                    </p>

                    <div className="flex items-center gap-2 text-sm font-semibold text-yellow-600 dark:text-yellow-400 mt-4">
                        <FiStar />
                        <span>Longest Streak: {longestStreak} days</span>
                    </div>
                </div>

                {/* Right Side: Call-to-Action Button */}
                <div className="flex-shrink-0">
                    <PrimaryButton />
                </div>
            </div>
        </div>
    );
};

export default WelcomeBanner;