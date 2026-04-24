import React from 'react';
import { motion, useScroll } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Tooltip } from 'react-tooltip';
import { FiDownloadCloud, FiLogIn, FiMic, FiCheckCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import ShimmerButton from '../components/ShimmerButton'; // UNCOMMENTED: ShimmerButton import

// Data for each step in our pipeline (no changes)
const steps = [
    { icon: <FiDownloadCloud size={32} />, title: "Install the Extension", description: "Your journey begins by adding our secure extension to your browser. This is the key to all your future rewards.", actionText: "Get the Extension", href: "https://chrome.google.com/webstore/category/extensions", tooltip: "Add Recora to your Chrome browser." },
    { icon: <FiLogIn size={32} />, title: "Sign In & Connect", description: "Open the extension and sign in with your Google account. This securely links your recordings to this dashboard.", tooltip: "Links the extension to your account." },
    { icon: <FiMic size={32} />, title: "Record Seamlessly", description: "In any browser tab with audio, open the extension and hit the record button to start.", tooltip: "Capture audio from any browser tab." },
    { icon: <FiCheckCircle size={32} />, title: "Earn Automatically", description: "When you stop, your recording and points appear on your dashboard. Your work is done!", actionText: "Go to Dashboard", href: "/", tooltip: "View your progress and rewards." }
];

// Pipeline Station Component (no changes)
const PipelineStation = ({ icon, title, description, actionText, href, tooltip }) => (
    <motion.div 
        className="flex flex-col items-center justify-center text-center p-8 h-full"
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ amount: 0.7, once: true }}
        transition={{ duration: 0.5, ease: "easeOut" }}
    >
        <div data-tooltip-id="station-tooltip" data-tooltip-content={tooltip} className="w-20 h-20 mb-6 flex items-center justify-center rounded-full bg-brand-surface dark:bg-dark-surface border-2 border-brand-primary dark:border-dark-primary shadow-[0_0_20px_rgba(139,92,246,0.5)]"><span className="text-brand-primary dark:text-dark-primary">{icon}</span></div>
        <h3 className="text-3xl font-bold text-brand-text dark:text-dark-text">{title}</h3>
        <p className="mt-2 text-brand-subtle dark:text-dark-subtle max-w-xs leading-relaxed">{description}</p>
        {actionText && (<div className="mt-8">{href.startsWith("http") ? <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => toast.success('Redirecting to the Chrome Web Store...')}><ShimmerButton>{actionText}</ShimmerButton></a> : <Link to={href}><ShimmerButton>{actionText}</ShimmerButton></Link>}</div>)}
    </motion.div>
);

// Custom animated icon for the intro slide
const AnimatedSwipeIcon = () => {
    const iconVariants = { animate: { transition: { staggerChildren: 0.2, repeat: Infinity, repeatDelay: 1 } } };
    const chevronVariants = { animate: { x: [0, 10, 0], opacity: [0, 1, 0], transition: { duration: 1.2, ease: "easeInOut" } } };
    return (
        <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" variants={iconVariants} initial="animate" animate="animate">
            <motion.path d="M9 18l6-6-6-6" variants={chevronVariants} />
            <motion.path d="M13 18l6-6-6-6" variants={chevronVariants} />
        </motion.svg>
    );
};

const RecordingGuidePage = () => {
    const scrollRef = React.useRef(null);
    const { scrollXProgress } = useScroll({ container: scrollRef });

    // Staggered title animation
    const title = "Your Path to Rewards".split("");
    const titleContainer = { hidden: { opacity: 0 }, visible: (i = 1) => ({ opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.2 * i }, }), };
    const titleChar = { visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 12, stiffness: 200 } }, hidden: { opacity: 0, y: 20 }, };

    return (
        // The main container now has a defined height to contain the horizontal scroll area
        <div className="w-full h-[75vh] relative flex flex-col">
            <div ref={scrollRef} className="flex-grow flex w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar z-10">
                <div className="flex-shrink-0 w-full h-full flex flex-col items-center justify-center text-center p-8 snap-center">
                    <motion.h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-brand-text to-gray-600 dark:from-dark-text dark:to-gray-400 text-transparent bg-clip-text mb-4" variants={titleContainer} initial="hidden" animate="visible">
                        {title.map((char, index) => (<motion.span key={index} variants={titleChar} style={{display: 'inline-block'}}>{char === " " ? "\u00A0" : char}</motion.span>))}
                    </motion.h1>
                    
                    {/* --- FIX: SEQUENCED ANIMATION --- */}
                    {/* This subtitle now animates in AFTER the main title */}
                    <motion.p 
                        className="text-lg text-brand-subtle dark:text-dark-subtle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.8 }} // Timed to start after the title finishes
                    >
                        Follow the path to see how it works.
                    </motion.p>
                    
                    <motion.div 
                        className="mt-8 text-brand-subtle dark:text-dark-subtle cursor-pointer select-none flex flex-col items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.2 }} // Timed to appear last
                    >
                        <AnimatedSwipeIcon />
                        <span className="text-sm font-semibold">Swipe to explore</span>
                    </motion.div>
                </div>

                {steps.map((step, index) => (
                    <div key={index} className="flex-shrink-0 w-full h-full flex items-center justify-center snap-center">
                        <PipelineStation {...step} />
                    </div>
                ))}
            </div>

            <div className="w-full px-8 pb-4 z-10">
                <div className="w-full max-w-lg mx-auto h-1.5 rounded-full bg-brand-surface/50 dark:bg-dark-surface/50 border border-brand-border dark:border-dark-border">
                    <motion.div className="h-full rounded-full bg-brand-primary dark:bg-dark-primary" style={{ scaleX: scrollXProgress, originX: 0, willChange: 'transform' }}/>
                </div>
            </div>

            <Tooltip id="station-tooltip" style={{ backgroundColor: 'var(--dark-surface)', color: 'var(--dark-text)', borderRadius: '8px', border: '1px solid var(--dark-border)', zIndex: 50 }} />
            <style>{`.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none;}.hide-scrollbar::-webkit-scrollbar{display:none;}`}</style>
        </div>
    );
};

export default RecordingGuidePage;