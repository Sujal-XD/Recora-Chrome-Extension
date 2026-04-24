import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
// import { db } from '../firebase'; // REMOVED: Firebase import
// import { doc, runTransaction, collection, addDoc, serverTimestamp } from 'firebase/firestore'; // REMOVED: Firebase imports
import { motion, AnimatePresence } from 'framer-motion';

const RewardsPage = () => {
    const { currentUser, totalPoints } = useAuth();
    const [pointsToRedeem, setPointsToRedeem] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const points = totalPoints || 0;
    const conversionRate = 20 / 100; // 20 INR for every 100 points

    const cashValue = useMemo(() => {
        const numericPoints = parseInt(pointsToRedeem, 10);
        if (isNaN(numericPoints) || numericPoints <= 0) return 0;
        return (numericPoints * conversionRate).toFixed(2);
    }, [pointsToRedeem, conversionRate]);

    const handleRedeem = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        const pointsValue = parseInt(pointsToRedeem, 10);

        if (!currentUser) { return setError("You must be logged in."); }
        if (isNaN(pointsValue) || pointsValue <= 0) { return setError("Please enter a valid number of points."); }
        if (pointsValue < 300) { return setError("Minimum redemption is 300 points."); }
        if (pointsValue > points) { return setError("You don't have enough points."); }

        setLoading(true);
        // const userDocRef = doc(db, 'users', currentUser.uid); // COMMENTED OUT: Firebase related

        try {
            // await runTransaction(db, async (transaction) => { // COMMENTED OUT: Firebase related
                // const userDoc = await transaction.get(userDocRef); // COMMENTED OUT: Firebase related
                // if (!userDoc.exists()) throw new Error("User document does not exist!"); // COMMENTED OUT: Firebase related

                // const currentPoints = userDoc.data().points; // COMMENTED OUT: Firebase related
            //     if (currentPoints < pointsValue) throw new Error("Insufficient points!"); // COMMENTED OUT: Firebase related

            //     const newPoints = currentPoints - pointsValue; // COMMENTED OUT: Firebase related
            //     // transaction.update(userDocRef, { points: newPoints }); // COMMENTED OUT: Firebase related

            //     const redemptionRecord = { // COMMENTED OUT: Firebase related
            //         userId: currentUser.uid, // COMMENTED OUT: Firebase related
            //         pointsRedeemed: pointsValue, // COMMENTED OUT: Firebase related
            //         amountInr: parseFloat(cashValue), // COMMENTED OUT: Firebase related
            //         status: 'Pending', // COMMENTED OUT: Firebase related
            //         createdAt: serverTimestamp(), // COMMENTED OUT: Firebase related
            //     }; // COMMENTED OUT: Firebase related
            //     // const redemptionsColRef = collection(db, 'payout_requests'); // Using payout_requests collection // COMMENTED OUT: Firebase related
            //     // transaction.set(doc(redemptionsColRef), redemptionRecord); // COMMENTED OUT: Firebase related
            // }); // COMMENTED OUT: Firebase related

            // Simulate success for now as Firebase is removed
            await new Promise(resolve => setTimeout(resolve, 1000)); 

            setSuccess(`Successfully requested redemption for ₹${cashValue}!`);
            setPointsToRedeem('');
        } catch (error) {
            console.error("Redemption failed: ", error);
            setError(error.message || "An error occurred during redemption.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto px-4 py-12">
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-brand-text dark:text-dark-text mb-3">Redeem Your Points</h1>
                <p className="text-lg text-brand-subtle dark:text-dark-subtle">Turn your hard-earned points into real rewards.</p>
            </div>

            <div className="bg-brand-surface dark:bg-dark-surface p-8 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
                <div className="text-center mb-6 p-4 bg-brand-primary/10 dark:bg-dark-primary/20 rounded-lg">
                    <p className="text-sm font-medium text-brand-subtle dark:text-dark-subtle">Your current balance</p>
                    <p className="text-4xl font-bold text-brand-primary dark:text-dark-primary">{points}</p>
                    {console.log(points, totalPoints)}
                    <p className="text-sm font-medium text-brand-subtle dark:text-dark-subtle">Points</p>
                </div>

                <form onSubmit={handleRedeem} className="space-y-6">
                    <div>
                        <label htmlFor="points" className="block text-sm font-medium text-brand-subtle dark:text-dark-subtle mb-1">Points to Redeem</label>
                        <input
                            type="number"
                            id="points"
                            value={pointsToRedeem}
                            onChange={(e) => setPointsToRedeem(e.target.value)}
                            placeholder="e.g., 500 (min 300)"
                            className="w-full p-3 bg-white/50 dark:bg-gray-700/50 border border-brand-border dark:border-dark-border rounded-md focus:ring-2 focus:ring-brand-primary dark:focus:ring-dark-primary focus:outline-none"
                        />
                    </div>

                    <div className="text-center">
                        <p className="text-brand-subtle dark:text-dark-subtle">is worth</p>
                        <p className="text-3xl font-bold text-brand-text dark:text-dark-text">₹{cashValue}</p>
                    </div>

                    <div className="h-5">
                        <AnimatePresence>
                            {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-red-500 text-sm text-center">{error}</motion.p>}
                            {success && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-green-500 text-sm text-center">{success}</motion.p>}
                        </AnimatePresence>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !currentUser}
                        className="w-full py-3 px-4 bg-brand-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : `Redeem ${pointsToRedeem || 0} Points`}
                    </button>
                </form>
            </div>
        </motion.div>
    );
};

export default RewardsPage;