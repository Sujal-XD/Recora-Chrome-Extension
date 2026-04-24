import React, { useState } from 'react';
import Modal from 'react-modal';
import { useAuth } from '../context/AuthContext';
import { FiX } from 'react-icons/fi';

// --- Modal Styling ---
const customStyles = {
    content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
        border: 'none',
        padding: '0',
        borderRadius: '16px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
        maxWidth: '500px',
        width: '90%',
    },
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
    }
};

// --- Main Component ---
const RedemptionModal = ({ isOpen, onRequestClose, option }) => {
    const { currentUser, userData } = useAuth();
    const [pointsToRedeem, setPointsToRedeem] = useState(option.min);
    const [upiId, setUpiId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const points = userData?.points || 0;
    const conversionRate = 20 / 100; // 20 INR per 100 points
    const cashValue = (pointsToRedeem * conversionRate).toFixed(2);

    const handleRedeem = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        const pointsValue = parseInt(pointsToRedeem, 10);

        if (!upiId) return setError("Please enter your UPI ID.");
        if (pointsValue < option.min) return setError(`Minimum redemption is ${option.min} points.`);
        if (pointsValue > points) return setError("You don't have enough points.");

        setLoading(true);
        // const userDocRef = doc(db, 'users', currentUser.uid);

        try {
            // await runTransaction(db, async (transaction) => {
            //     const userDoc = await transaction.get(userDocRef);
            //     if (!userDoc.exists()) throw new Error("User document does not exist!");
            //     const currentPoints = userDoc.data().points;
            //     if (currentPoints < pointsValue) throw new Error("Insufficient points!");

            //     transaction.update(userDocRef, { points: currentPoints - pointsValue });

            //     const redemptionRecord = {
            //         userId: currentUser.uid,
            //         pointsRedeemed: pointsValue,
            //         amountInr: parseFloat(cashValue),
            //         method: option.name,
            //         payoutDetails: { upiId },
            //         status: 'Pending',
            //         createdAt: serverTimestamp(),
            //     };
            //     // transaction.set(doc(collection(db, 'redemptions')), redemptionRecord);
            // });
            setSuccess(`Redemption request for ₹${cashValue} submitted!`);
            setTimeout(onRequestClose, 2000);
        } catch (err) {
            setError(err.message || "An error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={customStyles} appElement={document.getElementById('root')}>
            <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-brand-text dark:text-dark-text">Redeem via {option.name}</h2>
                    <button onClick={onRequestClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><FiX /></button>
                </div>

                {success ? (
                    <div className="text-center py-8">
                        <p className="text-green-500 font-semibold">{success}</p>
                        <p className="text-sm text-brand-subtle dark:text-dark-subtle mt-2">Payout will be processed within 3-5 business days.</p>
                    </div>
                ) : (
                    <form onSubmit={handleRedeem} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle dark:text-dark-subtle">Points to Redeem</label>
                            <input type="number" value={pointsToRedeem} onChange={(e) => setPointsToRedeem(e.target.value)}
                                min={option.min} max={points}
                                className="w-full mt-1 p-2 bg-white/50 dark:bg-gray-700/50 border border-brand-border dark:border-dark-border rounded-md focus:ring-2 focus:ring-brand-primary dark:focus:ring-dark-primary focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-brand-subtle dark:text-dark-subtle">UPI ID</label>
                            <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                                placeholder="yourname@bank"
                                className="w-full mt-1 p-2 bg-white/50 dark:bg-gray-700/50 border border-brand-border dark:border-dark-border rounded-md focus:ring-2 focus:ring-brand-primary dark:focus:ring-dark-primary focus:outline-none" required />
                        </div>
                        <div className="text-center font-semibold text-brand-text dark:text-dark-text">
                            You will receive: <span className="text-brand-primary dark:text-dark-primary">₹{cashValue}</span>
                        </div>
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full py-2.5 px-4 bg-brand-primary text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50">
                            {loading ? 'Processing...' : 'Confirm Redemption'}
                        </button>
                    </form>
                )}
            </div>
        </Modal>
    );
};

export default RedemptionModal;