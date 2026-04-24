// src/components/ProtectedRoute.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const { isLoggedIn } = useAuth();

    if (!isLoggedIn) {
        // If the user is not logged in, redirect them to the home page.
        // The Navbar will still be visible, allowing them to log in.
        return <Navigate to="/" replace />;
    }

    // If they are logged in, render the child component (the protected page).
    return children;
};

export default ProtectedRoute;