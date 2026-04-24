import { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';

// FIX: Added the 'export' keyword here
export const useLenis = () => {
    useEffect(() => {
        // Initialize Lenis with recommended settings
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothTouch: true,
        });

        // This function will be called on each animation frame
        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        // Start the animation loop
        requestAnimationFrame(raf);

        // Cleanup function to destroy the Lenis instance when the component unmounts
        return () => {
            lenis.destroy();
        };
    }, []); // The empty dependency array ensures this effect runs only once
};