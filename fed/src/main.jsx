
// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast'; // 1. Import the Toaster

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <GoogleOAuthProvider clientId="873170778893-7q5rgqj5fnpg6ph696e40q0mb4n1af7m.apps.googleusercontent.com">
        <AuthProvider>
          <App />
          {/* 2. Add the Toaster component here */}
          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: '#1F2937', // dark-surface
                color: '#F9FAFB', // dark-text
                border: '1px solid rgba(255, 255, 255, 0.1)' // dark-border
              },
            }}
          />
        </AuthProvider>
      </GoogleOAuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);