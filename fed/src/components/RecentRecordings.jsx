import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import clsx from 'clsx';
import { FiPlay } from 'react-icons/fi';

const Tag = ({ text }) => {
  const colorClasses = {
    Work: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    Important: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    Creative: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  };
  return (
    <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', colorClasses[text] || 'bg-gray-100 text-gray-800')}>
      {text}
    </span>
  );
};

const RecordingListItem = ({ recording }) => {
  const navigate = useNavigate();
  const handleClick = () => navigate('/history');

  return (
    <button onClick={handleClick} className="w-full text-left p-3 rounded-lg group hover:bg-brand-primary/5 dark:hover:bg-dark-primary/5 transition-colors duration-200">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg bg-brand-primary/10 group-hover:bg-brand-primary dark:bg-dark-primary/20 dark:group-hover:bg-dark-primary transition-all duration-300">
          <FiPlay size={20} className="text-brand-primary group-hover:text-white dark:text-dark-primary dark:group-hover:text-white transition-colors" />
        </div>
        <div>
          <div className="flex items-center gap-x-2">
            <p className="font-semibold text-brand-text dark:text-dark-text truncate">{recording.fileName}</p>
            <Tag text={recording.tag || 'Work'} />
          </div>
          <p className="text-sm text-brand-subtle dark:text-dark-subtle">
            {recording.createdAt ? format(new Date(recording.createdAt), 'MMM d, yyyy') : 'N/A'}{' '}
            • {recording.duration.minutes}m: {recording.duration.seconds}s
          </p>
        </div>
      </div>
    </button>
  );
};

const RecentRecordings = () => {
  // All data now comes directly from the context. No more fetching here.
  const { allRecordings, loading } = useAuth();
  
  return (
    <div className="bg-brand-surface dark:bg-dark-surface backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-brand-border dark:border-dark-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-brand-text dark:text-dark-text">Recent Recordings</h3>
        <Link to="/history" className="text-sm font-medium text-brand-primary dark:text-dark-primary hover:underline">View All</Link>
      </div>
      <div className="space-y-2">
        {loading && (<p className="text-center text-sm text-brand-subtle dark:text-dark-subtle">Loading recordings...</p>)}
        {!loading && allRecordings.length === 0 && (<p className="text-center text-sm text-brand-subtle dark:text-dark-subtle">No recordings yet.</p>)}
        {!loading && allRecordings.slice(0, 3).map((rec) => ( // Show only the 3 most recent
            <RecordingListItem key={rec.fullName} recording={rec} />
        ))}
      </div>
    </div>
  );
};

export default RecentRecordings;