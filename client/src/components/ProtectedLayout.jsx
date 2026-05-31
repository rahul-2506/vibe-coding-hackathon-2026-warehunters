import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import CustomCursor from './CustomCursor';

// Layout that protects routes requiring authentication
const ProtectedLayout = () => {
  const { user } = useAuth();

  // If no user, redirect to auth page
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="app-container">
      <CustomCursor />
      <Sidebar theme={"light"} toggleTheme={() => {}} user={user} onLogout={() => {}} />
      <main className="content-wrapper">
        <Outlet />
      </main>
    </div>
  );
};

export default ProtectedLayout;
