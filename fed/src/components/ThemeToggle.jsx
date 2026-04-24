import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

const spring = {
    type: 'spring',
    stiffness: 700,
    damping: 30,
};

const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex items-center justify-between w-full px-4 py-2">
            <span className="text-sm font-medium text-brand-subtle dark:text-dark-subtle">Theme</span>
            <div
                className={`flex items-center w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${theme === 'light' ? 'bg-blue-500 justify-start' : 'bg-gray-700 justify-end'
                    }`}
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            >
                <motion.div
                    className="flex items-center justify-center w-6 h-6 bg-white rounded-full"
                    layout
                    transition={spring}
                >
                    {theme === 'light' ? <FiSun className="text-yellow-500" /> : <FiMoon className="text-gray-900" />}
                </motion.div>
            </div>
        </div>
    );
};

export default ThemeToggle;