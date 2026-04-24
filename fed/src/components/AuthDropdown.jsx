import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { useAuth } from '../context/AuthContext';

const AuthDropdown = ({ onClose }) => {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose(); // This will close the dropdown upon successful login
    } catch (error) {
      console.error('Google login error', error);
      setError('Could not sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full right-0 mt-2 w-80 bg-brand-surface/90 dark:bg-dark-surface/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-brand-border dark:border-dark-border p-6 z-50 overflow-hidden"
    >
      <h3 className="font-bold text-lg text-brand-text dark:text-dark-text text-center">
        Sign In with Google
      </h3>
      <p className="text-sm text-brand-subtle dark:text-dark-subtle mt-1 mb-6 text-center">
        to continue to your dashboard
      </p>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="text-red-500 text-xs text-center mb-4"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full bg-brand-primary hover:bg-opacity-90 dark:bg-dark-primary dark:hover:bg-opacity-90 text-white font-bold py-2.5 px-4 rounded-lg transition-opacity shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center h-10"
      >
        {loading ? (
          'Processing...'
        ) : (
          <>
            <FcGoogle size={20} />
            <span className="ml-2">Sign in with Google</span>
          </>
        )}
      </button>
    </motion.div>
  );
};

export default AuthDropdown;