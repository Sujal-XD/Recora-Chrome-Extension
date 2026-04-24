import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Hero from '../components/Hero';
import FeaturesSection from '../components/FeaturesSection';
import WelcomeBanner from '../components/WelcomeBanner';
import ActivityGraph from '../components/ActivityGraph';
import RecentRecordings from '../components/RecentRecordings';
import RecentTransactions from '../components/RecentTransactions';
import RedeemPoints from '../components/RedeemPoints';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const HomePage = () => {
    const { isLoggedIn } = useAuth();

    return (
        <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-20">
            <AnimatePresence mode="wait">
                {isLoggedIn ? (
                    <motion.div key="dashboard" variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-8">
                        <motion.div variants={itemVariants}><WelcomeBanner /></motion.div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <motion.div variants={itemVariants} className="lg:col-span-2"><ActivityGraph /></motion.div>
                            <motion.div variants={itemVariants}><RecentTransactions /></motion.div>
                            <motion.div variants={itemVariants} className="lg:col-span-2"><RecentRecordings /></motion.div>
                            <motion.div variants={itemVariants}><RedeemPoints /></motion.div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="logged-out" variants={containerVariants} initial="hidden" animate="visible" exit={{ opacity: 0 }} className="space-y-20">
                        <motion.div variants={itemVariants}><Hero /></motion.div>
                        <motion.div variants={itemVariants}><FeaturesSection /></motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HomePage;