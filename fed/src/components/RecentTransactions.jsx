import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiTrendingUp } from 'react-icons/fi';
import { FaPaypal, FaUniversity } from 'react-icons/fa';
import { format } from 'date-fns';
import clsx from 'clsx';

const TransactionItem = ({ transaction }) => (
  <div className="flex items-center justify-between py-3">
    <div className="flex items-center space-x-4">
      <div
        className={clsx(
          'p-3 rounded-full',
          transaction.pointsRedeemed ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'
        )}
      >
        {transaction.method?.includes('PayPal') ? (
          <FaPaypal className="text-blue-500" />
        ) : (
          <FaUniversity className="text-gray-500" />
        )}
      </div>
      <div>
        <p className="font-semibold text-brand-text dark:text-dark-text">
          {transaction.method || 'Points Earned'}
        </p>
        <p className="text-sm text-brand-subtle dark:text-dark-subtle">
          {transaction.createdAt ? format(new Date(transaction.createdAt), 'MMM d, yyyy') : 'Jan 1, 1970'}
        </p>
      </div>
    </div>
    <p className="font-bold text-red-500 dark:text-red-400">
      -{transaction.pointsRedeemed?.toLocaleString() || '0'} pts
    </p>
  </div>
);

const RecentTransactions = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    // Dummy static transactions data to simulate recent transactions
    const dummyTransactions = [
      {
        id: '1',
        method: 'PayPal',
        createdAt: Date.now() - 86400000 * 3, // 3 days ago
        pointsRedeemed: 1500,
      },
      {
        id: '2',
        method: 'Bank Transfer',
        createdAt: Date.now() - 86400000 * 7, // 7 days ago
        pointsRedeemed: 2500,
      },
      {
        id: '3',
        method: 'PayPal',
        createdAt: Date.now() - 86400000 * 10,
        pointsRedeemed: 1000,
      },
    ];

    setTransactions(dummyTransactions);
    setLoading(false);
  }, [currentUser]);

  return (
    <div className="bg-brand-surface dark:bg-dark-surface backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
      <h3 className="text-xl font-bold text-brand-text dark:text-dark-text mb-2">Recent Transactions</h3>
      <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
        {loading && (
          <p className="text-sm text-center py-4 text-brand-subtle dark:text-dark-subtle">Loading...</p>
        )}
        {!loading && transactions.length === 0 && (
          <p className="text-sm text-center py-4 text-brand-subtle dark:text-dark-subtle">No recent transactions.</p>
        )}
        {!loading &&
          transactions.map((item) => <TransactionItem key={item.id} transaction={item} />)}
      </div>
    </div>
  );
};

export default RecentTransactions;





// import React, { useState, useEffect } from 'react';
// import { useAuth } from '../context/AuthContext';
// import { db } from '../firebase';
// import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
// import { FiTrendingUp } from 'react-icons/fi';
// import { FaPaypal, FaUniversity } from 'react-icons/fa';
// import { format } from 'date-fns';
// import clsx from 'clsx';

// const TransactionItem = ({ transaction }) => (
//     <div className="flex items-center justify-between py-3">
//         <div className="flex items-center space-x-4">
//             <div className={clsx("p-3 rounded-full",
//                 // A simple check to see if it's a redemption or an earning
//                 transaction.pointsRedeemed ? 'bg-red-100 dark:bg-red-900/50' : 'bg-green-100 dark:bg-green-900/50'
//             )}>
//                 {/* Dynamically choose icon based on transaction type */}
//                 {transaction.method?.includes('PayPal') ? <FaPaypal className="text-blue-500" /> : <FaUniversity className="text-gray-500" />}
//             </div>
//             <div>
//                 {/* THIS IS THE FIX: Corrected the className and logic */}
//                 <p className="font-semibold text-brand-text dark:text-dark-text">
//                     {transaction.method || 'Points Earned'}
//                 </p>
//                 <p className="text-sm text-brand-subtle dark:text-dark-subtle">
//                     {format(transaction.createdAt.toDate(), 'MMM d, yyyy')}
//                 </p>
//             </div>
//         </div>
//         <p className="font-bold text-red-500 dark:text-red-400">
//             -{transaction.pointsRedeemed.toLocaleString()} pts
//         </p>
//     </div>
// );

// const RecentTransactions = () => {
//     const { currentUser } = useAuth();
//     const [transactions, setTransactions] = useState([]);
//     const [loading, setLoading] = useState(true);

//     useEffect(() => {
//         if (!currentUser) { setLoading(false); return; }

//         // This query fetches the 5 most recent redemption requests
//         const q = query(
//             collection(db, 'payout_requests'),
//             where('userId', '==', currentUser.uid),
//             orderBy('createdAt', 'desc'),
//             limit(5)
//         );

//         const unsubscribe = onSnapshot(q, (snapshot) => {
//             const userTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
//             setTransactions(userTransactions);
//             setLoading(false);
//         });

//         return () => unsubscribe();
//     }, [currentUser]);

//     return (
//         <div className="bg-brand-surface dark:bg-dark-surface backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
//             <h3 className="text-xl font-bold text-brand-text dark:text-dark-text mb-2">Recent Transactions</h3>
//             <div className="divide-y divide-gray-200 dark:divide-gray-700/50">
//                 {loading && <p className="text-sm text-center py-4 text-brand-subtle dark:text-dark-subtle">Loading...</p>}
//                 {!loading && transactions.length === 0 && <p className="text-sm text-center py-4 text-brand-subtle dark:text-dark-subtle">No recent transactions.</p>}
//                 {!loading && transactions.map((item) => <TransactionItem key={item.id} transaction={item} />)}
//             </div>
//         </div>
//     );
// };

// export default RecentTransactions;