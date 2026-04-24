import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

// --- VISUAL UPGRADE: Custom Tooltip Component ---
// This creates a tooltip that perfectly matches your site's aesthetic.
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-brand-surface/80 dark:bg-dark-surface/80 backdrop-blur-md p-3 rounded-lg shadow-xl border border-brand-border dark:border-dark-border">
          <p className="font-bold text-brand-text dark:text-dark-text">{`${label}`}</p>
          <p className="text-sm text-brand-primary dark:text-dark-primary">{`Activity: ${payload[0].value} min`}</p>
        </div>
      );
    }
    return null;
  };

const ActivityGraph = () => {
    const { theme } = useTheme();
    const { weeklyActivity } = useAuth();

    const colors = {
        light: {
            gradient: '#6D28D9',
            axis: '#4B5563',
            // VISUAL UPGRADE: Made the light mode grid lines more subtle
            grid: '#e5e7eb80', 
        },
        dark: {
            gradient: '#8B5CF6',
            axis: '#9CA3AF',
            grid: 'rgba(255, 255, 255, 0.1)',
        }
    };

    const currentColors = theme === 'dark' ? colors.dark : colors.light;
    const hasActivity = weeklyActivity.some(day => day.minutes > 0);

    return (
        <div className="bg-brand-surface dark:bg-dark-surface backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
            <h3 className="text-xl font-bold text-brand-text dark:text-dark-text mb-4">Recording Activity</h3>
            <div className="h-60 w-full">
                {hasActivity ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weeklyActivity} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                            <defs>
                                {/* VISUAL UPGRADE: Adjusted gradient to be more impactful */}
                                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={currentColors.gradient} stopOpacity={0.7} />
                                    <stop offset="95%" stopColor={currentColors.gradient} stopOpacity={0.05} />
                                </linearGradient>
                                {/* VISUAL UPGRADE: Added a drop-shadow filter for the glow effect */}
                                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor={currentColors.gradient} floodOpacity="0.3"/>
                                </filter>
                            </defs>
                            <XAxis dataKey="name" stroke={currentColors.axis} fontSize={12} tickLine={false} axisLine={false} />
                            {/* VISUAL UPGRADE: Set a dynamic domain for the Y-axis to prevent squashing */}
                            <YAxis 
                                stroke={currentColors.axis} 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                domain={[0, dataMax => Math.max(100, Math.round(dataMax * 1.2))]}
                            />
                            <CartesianGrid strokeDasharray="3 3" stroke={currentColors.grid} vertical={false} />
                            {/* VISUAL UPGRADE: Using the new custom tooltip */}
                            <Tooltip content={<CustomTooltip />} />
                            <Area 
                                type="monotone" 
                                dataKey="minutes" 
                                stroke={currentColors.gradient} 
                                strokeWidth={2.5} 
                                fillOpacity={1} 
                                fill="url(#colorMinutes)" 
                                // VISUAL UPGRADE: Applied the shadow filter
                                filter="url(#shadow)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-brand-subtle dark:text-dark-subtle">No recording activity this week. Start recording to see your progress!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityGraph;