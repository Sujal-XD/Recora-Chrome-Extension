import React, { createContext, useContext, useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { calculateStreak } from '../utils/streakUtils';
import { processWeeklyActivity } from '../utils/graphUtils';
import { ContainerClient } from '@azure/storage-blob';

// Create the context
const AuthContext = createContext();

// Custom hook for easy access
export const useAuth = () => useContext(AuthContext);

// Azure constants
const accountName = "recorderextension";
const containerName = "meeting-audio";

// The main provider component
export const AuthProvider = ({ children }) => {
  // --- STATE MANAGEMENT ---
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const storedUser = sessionStorage.getItem('recora-user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Failed to parse user from sessionStorage", error);
      return null;
    }
  });

  const [allRecordings, setAllRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0 });
  const [weeklyActivity, setWeeklyActivity] = useState(processWeeklyActivity([]));
  const [showLogin, setShowLogin] = useState(false);
  const [newRecordings, setNewRecordings] = useState([]);

  // --- EFFECTS ---

  // Effect to sync user state with sessionStorage for persistent login
  useEffect(() => {
    try {
      if (currentUser) {
        sessionStorage.setItem('recora-user', JSON.stringify(currentUser));
      } else {
        sessionStorage.removeItem('recora-user');
      }
    } catch (error) {
      console.error("Failed to save user to sessionStorage", error);
    }
  }, [currentUser]);

  // Main data fetching and processing effect
  useEffect(() => {
    if (!currentUser) {
        setLoading(false);
        return;
    }

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Step 1: Get SAS Token from our server via the Vite proxy
            const userId = currentUser.sub || currentUser.id;
            if (!userId) throw new Error("Could not determine User ID.");

            // --- THIS IS THE FIX ---
            // The URL now points to our proxy path '/api', not 'http://localhost:5000'
            const res = await fetch('/api/generate-sas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) throw new Error(`Server error fetching SAS token: ${res.statusText}`);
            const { sasToken } = await res.json();

            // Step 2: Fetch recordings from Azure
            const containerClient = new ContainerClient(
                `https://${accountName}.blob.core.windows.net/${containerName}?${sasToken}`
            );
            const prefix = `${userId}/`;
            const fetchedBlobs = [];
            for await (const blob of containerClient.listBlobsFlat({ prefix })) {
                const blobClient = containerClient.getBlobClient(blob.name);
                const properties = await blobClient.getProperties();
                const metadata = properties.metadata || {};
                fetchedBlobs.push({
                    fullName: blob.name,
                    createdAt: (properties.createdOn || properties.lastModified).toISOString(),
                    title: (blob.name).split("/")[1].split(".")[0],
                    points: Number(Math.round(metadata.audioseconds * 1)),
                    duration: { minutes: metadata.audiominutes || '0', seconds: metadata.audioseconds || '0' },
                    id: metadata.userid,
                    status: "Processed",
                    audioUrl: blobClient.url,
                    tag: 'Work',
                });
            }
            fetchedBlobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Step 3: All data is fetched. Now process it and set all states at once.
            const seenRecordings = JSON.parse(localStorage.getItem(`seenRecordings_${userId}`)) || [];
            const newUnseenRecordings = fetchedBlobs.filter(rec => !seenRecordings.includes(rec.fullName));
            
            setNewRecordings(newUnseenRecordings);
            setAllRecordings(fetchedBlobs);
            setTotalPoints(fetchedBlobs.reduce((acc, rec) => acc + (rec.points || 0), 0));
            setStreakData(calculateStreak(fetchedBlobs));
            setWeeklyActivity(processWeeklyActivity(fetchedBlobs));

        } catch (error) {
            console.error("CRITICAL: Failed to fetch and process data in AuthContext:", error);
            setAllRecordings([]);
            setNewRecordings([]);
        } finally {
            setLoading(false);
        }
    };

    fetchAllData();
  }, [currentUser]);

  // Function to clear notifications
  const markNotificationsAsSeen = () => {
    if (!currentUser) return;
    const allRecordingNames = allRecordings.map(rec => rec.fullName);
    localStorage.setItem(`seenRecordings_${currentUser.sub || currentUser.id}`, JSON.stringify(allRecordingNames));
    setNewRecordings([]);
  };

  // --- AUTH FUNCTIONS ---
  const loginWithGoogle = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const profile = await res.json();
        setCurrentUser(profile);
      } catch (error) {
        console.error('Google login failed', error);
        setCurrentUser(null);
        setLoading(false);
      }
    },
    onError: (error) => {
      console.error('Google login error', error);
      setCurrentUser(null);
      setLoading(false);
    },
  });

  const logout = () => {
    setCurrentUser(null);
    setAllRecordings([]);
  };

  // The value provided to all child components
  const value = {
    currentUser,
    isLoggedIn: !!currentUser,
    loading,
    loginWithGoogle,
    logout,
    allRecordings,
    totalPoints,
    streakData,
    weeklyActivity,
    showLogin,
    setShowLogin,
    newRecordings,
    markNotificationsAsSeen,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};