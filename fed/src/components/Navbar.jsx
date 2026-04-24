import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom'; 
import { useAuth } from '../context/AuthContext';
import { HiOutlineUserCircle } from 'react-icons/hi';
import { FiBell, FiCheck } from 'react-icons/fi';
import AuthDropdown from './AuthDropdown';
import ThemeToggle from './ThemeToggle';
import { formatDistanceToNow } from 'date-fns';

// --- NEW: A clickable button component for a single notification item ---
// This is no longer a <Link>, allowing for more control.
const NotificationItem = ({ recording, onNotificationClick }) => (
    <button 
        onClick={() => onNotificationClick(recording)}
        className="block w-full text-left p-3 hover:bg-dark-surface rounded-lg transition-colors"
    >
        <p className="font-semibold text-dark-text">New Recording Added</p>
        <p className="text-sm text-dark-subtle truncate">{recording.title}</p>
        <p className="text-xs text-dark-subtle mt-1">
            {formatDistanceToNow(new Date(recording.createdAt), { addSuffix: true })}
        </p>
    </button>
);

const Navbar = () => {
    const { 
        isLoggedIn, logout, currentUser, totalPoints, 
        showLogin, setShowLogin, newRecordings, markNotificationsAsSeen 
    } = useAuth();
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const notifRef = useRef(null);
    const navigate = useNavigate(); // Hook for programmatic navigation

    const navLinks = { 'Home': '/', 'History': '/history', 'Rewards': '/rewards' };
    const visibleLinks = isLoggedIn ? Object.keys(navLinks) : ['Home'];
    const points = totalPoints ?? 0;

    const handleBellClick = () => {
        const willOpen = !isNotifDropdownOpen;
        setIsNotifDropdownOpen(willOpen);
        
        // When the user opens the dropdown, we mark the notifications as seen.
        if (willOpen && newRecordings.length > 0) {
            // We use a small delay to allow the dropdown to open before the red dot disappears.
            setTimeout(() => {
                markNotificationsAsSeen();
            }, 500);
        }
    };

    // This function handles clicking a specific notification 
    const handleNotificationClick = () => {
        navigate('/history'); // Redirect to the history page
        setIsNotifDropdownOpen(false); // Close the dropdown
    };
    
    useEffect(() => {
        if (showLogin) {
            setIsDropdownOpen(true);
        }
    }, [showLogin]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
                setShowLogin(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setIsNotifDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setShowLogin]);

    return (
        <header className="bg-brand-surface/80 dark:bg-dark-surface sticky top-0 z-40 border-b border-brand-border dark:border-dark-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/"><img src="/recora-logo.png" alt="Recora Logo" className="h-8 w-auto" /></Link>
                    
                    <nav className="hidden md:flex items-center space-x-2">
                        {visibleLinks.map(linkText => (
                            <Link key={linkText} to={navLinks[linkText]} className="text-brand-subtle dark:text-dark-subtle hover:text-brand-primary dark:hover:text-dark-primary font-medium px-4 py-2 rounded-lg transition-all duration-300 hover:bg-brand-primary/10 dark:hover:bg-dark-primary/10">
                                {linkText}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex items-center">
                        {isLoggedIn ? (
                            <div className="flex items-center space-x-4">
                                <div className="bg-dark-primary/20 text-dark-primary font-bold text-sm px-4 py-2 rounded-full">
                                    {points.toLocaleString()} pts
                                </div>
                                <div className="relative" ref={notifRef}>
                                    <button onClick={handleBellClick} className="relative text-dark-subtle hover:text-dark-primary transition-colors focus:outline-none">
                                        <FiBell size={24} />
                                        {newRecordings.length > 0 && (
                                            <span className="absolute top-0.5 right-0.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-dark-surface" />
                                        )}
                                    </button>
                                    <AnimatePresence>
                                        {isNotifDropdownOpen && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: -10 }} 
                                                animate={{ opacity: 1, y: 0 }} 
                                                exit={{ opacity: 0, y: -10 }} 
                                                className="absolute top-full right-0 mt-2 w-80 bg-dark-surface rounded-2xl shadow-2xl z-50 border border-dark-border"
                                            >
                                                <div className="p-3 flex justify-between items-center border-b border-dark-border">
                                                    <h3 className="font-bold text-dark-text">New Recordings</h3>
                                                    {/* This button is now optional, as opening the bell clears the state */}
                                                </div>
                                                <div className="p-2 max-h-80 overflow-y-auto">
                                                    {/*  THIS IS THE CORE LOGIC CHANGE  */}
                                                    {/* We now map over newRecordings, not allRecordings */}
                                                    {newRecordings.length > 0 ? (
                                                        newRecordings.map(rec => 
                                                            <NotificationItem 
                                                                key={rec.fullName} 
                                                                recording={rec} 
                                                                onNotificationClick={handleNotificationClick} 
                                                            />
                                                        )
                                                    ) : (
                                                        // And show this message if there's nothing new
                                                        <p className="text-center text-sm text-dark-subtle p-4">Nothing to show for now.</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="relative" ref={dropdownRef}>
                                    <button onClick={() => setIsDropdownOpen(p => !p)} className="text-dark-subtle hover:text-dark-primary transition-colors">{currentUser.photoURL ? (<img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full" />) : (<HiOutlineUserCircle size={32} />)}</button>
                                    <AnimatePresence>{isDropdownOpen && (<motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full right-0 mt-2 w-56 bg-dark-surface rounded-lg shadow-xl z-50"><div className="px-4 py-3 border-b border-dark-border"><p className="text-sm font-semibold text-dark-text truncate">{currentUser.name || 'User'}</p><p className="text-xs text-dark-subtle truncate">{currentUser.email}</p></div><div className="py-1"><ThemeToggle /></div><div className="border-t border-dark-border"></div><div className="p-1"><button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 dark:hover:text-red-400 rounded-md">Sign Out</button></div></motion.div>)}</AnimatePresence>
                                </div>
                            </div>
                        ) : (
                            <div className="relative" ref={dropdownRef}>
                                <button onClick={() => setIsDropdownOpen(true)} className="bg-brand-primary dark:bg-dark-primary text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-opacity-90 transition-all shadow-md">Login</button>
                                <AnimatePresence>{isDropdownOpen && <AuthDropdown onClose={() => { setIsDropdownOpen(false); setShowLogin(false); }} />}</AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;