import React from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const Hero = () => {
  const { isLoggedIn, setShowLogin } = useAuth();

  const handleStartClick = () => {
    // If the user is not logged in, trigger the login dropdown in the Navbar
    if (!isLoggedIn) {
      setShowLogin(true);
    }
    // Note: If the user were logged in, this component wouldn't be visible,
    // but you could add a navigate('/record') here as a fallback.
  };

  return (
    <section className="text-center py-20 px-4">
      {/* Updated styling to match the target design */}
      <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-brand-text dark:text-dark-text">
        Transform Your Voice into Rewards
      </h1>
      <p className="mt-6 text-lg text-brand-subtle dark:text-dark-subtle max-w-3xl mx-auto leading-8">
        Record your voice, earn points, and redeem them for real rewards. Our platform makes it seamless to turn your words into value. Start your journey today!
      </p>
      <div className="mt-10 flex items-center justify-center gap-x-6">
        {/* This button now opens the login modal via the context */}
        <button
          onClick={handleStartClick}
          className="rounded-lg bg-brand-primary dark:bg-dark-primary px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all hover:scale-105"
        >
          Start Recording
        </button>
        <a href="#" className="flex items-center gap-x-2 text-base font-semibold leading-6 text-brand-text dark:text-dark-text hover:text-brand-primary dark:hover:text-dark-primary transition-colors">
          <FiPlayCircle /> Learn more <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
};

export default Hero;