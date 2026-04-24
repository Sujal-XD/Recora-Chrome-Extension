import React from 'react';
import { motion } from 'framer-motion';

// This is an animation setting we can reuse
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
};

export const DataRichCard = ({ children, title, action }) => {
  return (
    <motion.div 
      variants={itemVariants} 
      className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-white/20"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-brand-text">{title}</h3>
        {action && (
          <a href="#" className="text-sm font-medium text-brand-primary hover:underline cursor-pointer">
            {action}
          </a>
        )}
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </motion.div>
  );
};