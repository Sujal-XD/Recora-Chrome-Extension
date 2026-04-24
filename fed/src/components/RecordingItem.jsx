import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import clsx from 'clsx';
import { FiPlayCircle, FiHelpCircle } from 'react-icons/fi';

const StatusPill = ({ status }) => {
    const styles = {
        Processed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        Processing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
        Failed: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    return (
        <span className={clsx('px-2 py-1 text-xs font-medium rounded-full', styles[status] || 'bg-gray-100')}>
            {status}
        </span>
    );
};

const RecordingItem = ({ recording }) => {
    const [isPlayerVisible, setPlayerVisible] = useState(false);
    const navigate = useNavigate();

    const { id, title, createdAt, duration, status, points, audioUrl } = recording;

    // THE FIX: Create a proper Date object from the ISO string to ensure format() works correctly.
    const createdDate = new Date(createdAt);

    const date = format(createdDate, 'MMM d, yyyy');
    const time = format(createdDate, 'p');

    const handleHelpClick = () => {
        navigate('/support', {
            state: {
                subject: `Issue with recording: "${title}"`,
                description: `I'm having an issue with the recording (ID: ${id}) from ${date} at ${time}.\n\nPlease describe the problem here:`,
            },
        });
    };

    return (
        <div className="bg-brand-surface dark:bg-dark-surface p-4 sm:p-5 rounded-lg shadow-md border border-brand-border dark:border-dark-border">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                <div className="md:col-span-1 text-center">
                    <p className="font-bold text-lg text-brand-text dark:text-dark-text">{format(createdDate, 'd')}</p>
                    <p className="text-sm text-brand-subtle dark:text-dark-subtle">{format(createdDate, 'MMM yyyy')}</p>
                </div>

                <div className="md:col-span-3">
                    <h3 className="font-bold text-brand-text dark:text-dark-text">{title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-subtle dark:text-dark-subtle mt-1">
                        <span>Time: {time}</span>
                        <span>Duration: {duration.minutes}m:{duration.seconds}s</span>
                        <span>Points: <span className="font-semibold text-green-600 dark:text-green-400">+{points}</span></span>
                    </div>
                </div>

                <div className="md:col-span-1 flex justify-center mt-2 md:mt-0">
                    <StatusPill status={status} />
                </div>

                <div className="md:col-span-1 flex justify-center md:justify-end space-x-2 mt-2 md:mt-0">
                    <button onClick={() => setPlayerVisible(!isPlayerVisible)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Listen">
                        <FiPlayCircle className="text-brand-primary dark:text-dark-primary" size={22} />
                    </button>
                    <button onClick={handleHelpClick} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Get Help">
                        <FiHelpCircle className="text-brand-subtle dark:text-dark-subtle" size={22} />
                    </button>
                </div>
            </div>

            {isPlayerVisible && (
                <div className="mt-4 pt-4 border-t border-brand-border dark:border-dark-border">
                    <audio src={audioUrl} className="w-full" controls preload="metadata">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            )}
        </div>
    );
};

export default RecordingItem;