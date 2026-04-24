import React from 'react';
import { Link } from 'react-router-dom';
import { FiPlusCircle } from 'react-icons/fi';

const PrimaryButton = () => {
  return (
    <Link 
      to="/record"
      className="inline-flex items-center justify-center gap-2 px-5 py-3 text-base font-semibold text-white bg-brand-primary dark:bg-dark-primary rounded-lg shadow-lg hover:opacity-90 transition-all hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <FiPlusCircle />
      Start New Recording
    </Link>
  );
};

export default PrimaryButton;