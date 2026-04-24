import React from 'react';
import { motion } from 'framer-motion';
// THIS IS THE FIX: Update the import to point to the .jsx file
import RecordingItem from '../components/RecordingItem.jsx';
import { useAuth } from '../context/AuthContext';


const HistoryPage = () => {
    const { currentUser, allRecordings} = useAuth();

    // The rest of the file remains exactly the same
    const recordings = allRecordings;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto px-4 py-8">
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-brand-text dark:text-dark-text mb-3">Recording History</h1>
                <p className="text-lg text-brand-subtle dark:text-dark-subtle">Review your past recordings and earnings.</p>
            </div>

            {recordings.length > 0 ? (
                <div className="space-y-4">
                    {recordings.map(rec => {
                        return <RecordingItem key={rec.id} recording={rec} />
                    })}
                </div>
            ) : (
                <div className="text-center p-10 bg-brand-surface dark:bg-dark-surface rounded-lg shadow-md">
                    <h3 className="text-xl font-semibold text-brand-text dark:text-dark-text">No Recordings Found</h3>
                    <p className="text-brand-subtle dark:text-dark-subtle mt-2">Use the Recora Chrome extension to start recording your meetings!</p>
                </div>
            )}
        </motion.div>
    );
};

export default HistoryPage;