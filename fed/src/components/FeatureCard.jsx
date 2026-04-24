import React from 'react';

const FeatureCard = ({ icon, title, description }) => {
  return (
    <div className="bg-brand-surface dark:bg-dark-surface p-8 rounded-xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 ease-in-out border border-gray-200/80 dark:border-dark-border">
      <div className="flex justify-center items-center mb-5 bg-gradient-to-br from-brand-primary/10 to-brand-primary/20 dark:from-dark-primary/10 dark:to-dark-primary/20 rounded-lg w-16 h-16 mx-auto">
        {React.cloneElement(icon, { className: "text-brand-primary dark:text-dark-primary" })}
      </div>
      <h3 className="text-xl font-bold text-brand-text dark:text-dark-text mb-3 text-center">{title}</h3>
      <p className="text-brand-subtle dark:text-dark-subtle text-center leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;