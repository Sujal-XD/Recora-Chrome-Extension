import React from 'react';

export const ShimmerCard = ({ children, className }) => (
    <div className={`relative p-8 rounded-2xl bg-brand-surface dark:bg-dark-surface backdrop-blur-xl border border-brand-border dark:border-dark-border shadow-2xl overflow-hidden ${className}`}>
        <div className="absolute inset-[-100%] animate-shimmer"
             style={{ background: `linear-gradient(110deg, transparent 20%, rgba(167, 139, 250, 0.2) 50%, transparent 80%)`}}
        />
        <div className="relative z-10">{children}</div>
    </div>
);