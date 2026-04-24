import React from 'react';
import { Link } from 'react-router-dom';
import { FaTwitter, FaGithub, FaLinkedin } from 'react-icons/fa';
import { FiSend } from 'react-icons/fi';

// A clean data structure for footer links makes the component easier to manage.
const footerSections = [
    {
        title: 'Product',
        links: [
            { label: 'Home', to: '/' },
            { label: 'History', to: '/history' },
            { label: 'Rewards', to: '/rewards' },
            { label: 'How to Record', to: '/record' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About Us', to: '/about' },
            { label: 'Blog', to: '/blog' },
            { label: 'Careers', to: '/careers' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Support Hub', to: '/support' },
            { label: 'Contact Us', to: '/contact' },
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Privacy Policy', to: '/privacy' },
        ],
    },
];

const Footer = () => {
    const handleNewsletterSubmit = (e) => {
        e.preventDefault();
        alert('Thank you for subscribing!');
        e.target.reset();
    };

    return (
        // --- THEME & LAYOUT CHANGE ---
        // 1. The background is now 'dark-surface', a lighter slate that contrasts with the main page.
        // 2. A subtle top border creates a crisp separation line.
        // 3. All animations have been removed.
        <footer className="w-full mt-24 bg-dark-surface border-t border-dark-border">
            <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">

                {/* --- LAYOUT CHANGE: Two-part grid --- */}
                {/* A new layout with the brand/newsletter on the left and a grid of links on the right. */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

                    {/* Left Column: Brand and Newsletter */}
                    <div className="lg:col-span-1 space-y-6">
                        <Link to="/" className="inline-block">
                            <img src="/recora-logo.png" alt="Recora Logo" className="h-9 w-auto" />
                        </Link>
                        <p className="text-dark-subtle text-base max-w-xs">
                            Record your meetings, earn rewards, and stay productive.
                        </p>
                        <form onSubmit={handleNewsletterSubmit} className="space-y-3">
                            <label htmlFor="newsletter-email" className="text-sm font-semibold text-dark-text">Subscribe to our newsletter</label>
                            <div className="flex">
                                <input id="newsletter-email" type="email" placeholder="Your email" required
                                    className="w-full px-4 py-2.5 bg-dark-bg/50 border border-r-0 border-dark-border rounded-l-md focus:ring-2 focus:ring-dark-primary focus:outline-none placeholder:text-dark-subtle"
                                />
                                <button type="submit" aria-label="Subscribe to newsletter"
                                    className="p-3 bg-dark-primary text-white rounded-r-md hover:opacity-80 transition-opacity">
                                    <FiSend size={20} />
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Column: Grid of Link Sections */}
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-8">
                        {footerSections.map((section) => (
                            <div key={section.title}>
                                <h3 className="text-sm font-semibold text-dark-text tracking-wider uppercase">{section.title}</h3>
                                <ul className="mt-4 space-y-3">
                                    {section.links.map((link) => (
                                        <li key={link.label}>
                                            <Link to={link.to} className="text-dark-subtle hover:text-dark-primary transition-colors">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Bar: Copyright and Social Media Links */}
                <div className="mt-16 pt-8 border-t border-dark-border flex flex-col md:flex-row justify-between items-center">
                    <p className="text-sm text-dark-subtle">© {new Date().getFullYear()} Recora Inc. All rights reserved.</p>
                    <div className="flex space-x-6 mt-4 md:mt-0">
                        <a href="#" className="text-dark-subtle hover:text-dark-primary transition-colors"><FaTwitter size={20} /></a>
                        <a href="#" className="text-dark-subtle hover:text-dark-primary transition-colors"><FaGithub size={20} /></a>
                        <a href="#" className="text-dark-subtle hover:text-dark-primary transition-colors"><FaLinkedin size={20} /></a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;