import React, { useState } from 'react';
import { FaUniversity } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import RedemptionModal from './RedemptionModal';

const RedeemOption = ({ option, onSelect, disabled }) => (
    <button
        onClick={() => onSelect(option)}
        disabled={disabled}
        className={clsx(
            "w-full flex items-center justify-between p-4 rounded-lg border text-left transition-all duration-300",
            !disabled
                ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                : 'border-gray-200 dark:border-gray-800 bg-gray-100/50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed'
        )}>
        <div className="flex items-center space-x-4">
            {option.icon}
            <div>
                <p className="font-semibold text-brand-text dark:text-dark-text">{option.name}</p>
                <p className="text-sm text-brand-subtle dark:text-dark-subtle">{option.desc}</p>
            </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">Min. {option.min.toLocaleString()} pts</p>
    </button>
);

const RedeemPoints = () => {
    const { userData } = useAuth();
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const currentPoints = userData?.points || 0;

    // Simplified to just one option for now, as requested.
    const redeemOptions = [
        { name: 'UPI / Bank Transfer', desc: 'Get paid directly via UPI', min: 300, icon: <FaUniversity size={24} className="text-gray-500 dark:text-gray-400" /> },
    ];

    const handleSelectOption = (option) => {
        setSelectedOption(option);
        setModalIsOpen(true);
    };

    const closeModal = () => {
        setModalIsOpen(false);
        setSelectedOption(null);
    }

    return (
        <>
            <div className="bg-brand-surface dark:bg-dark-surface p-6 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
                <h3 className="text-xl font-bold text-brand-text dark:text-dark-text mb-4">Redeem Points</h3>
                <div className="space-y-3">
                    {redeemOptions.map((opt) => (
                        <RedeemOption
                            key={opt.name}
                            option={opt}
                            onSelect={handleSelectOption}
                            disabled={currentPoints < opt.min}
                        />
                    ))}
                </div>
            </div>

            {selectedOption && (
                <RedemptionModal
                    isOpen={modalIsOpen}
                    onRequestClose={closeModal}
                    option={selectedOption}
                />
            )}
        </>
    );
};

export default RedeemPoints;