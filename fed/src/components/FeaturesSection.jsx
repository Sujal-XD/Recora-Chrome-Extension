import React from 'react';
import FeatureCard from './FeatureCard';
import { FiMic, FiAward, FiGift } from 'react-icons/fi';

const FeaturesSection = () => {
  const features = [
    {
      icon: <FiMic size={24} />,
      title: 'Record',
      description: 'Connect with our Chrome extension and start recording your voice instantly.'
    },
    {
      icon: <FiAward size={24} />,
      title: 'Earn',
      description: 'Get points for every minute of voice recording you make.'
    },
    {
      icon: <FiGift size={24} />,
      title: 'Redeem',
      description: 'Convert your points into real money through secure payment methods.'
    },
  ];

  return (
    <section className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {features.map(feature => <FeatureCard key={feature.title} {...feature} />)}
    </section>
  );
};

export default FeaturesSection;