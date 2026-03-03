// pages/auth/PendingApprovalPage.tsx
// A simple holding screen shown after a new user registers.
//
// After registration, new accounts have "pending" status and cannot log in yet.
// This page just tells the user to wait for an admin to approve their account.
// It has a "Back to Login" link in case they want to try a different account.
// There is no backend call here — it's a purely informational static page.

import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, HardHat } from 'lucide-react';

const PendingApprovalPage: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-primary-50 p-8" data-testid="pending-page">
    <div className="text-center max-w-md animate-fade-in">
      <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <Clock size={32} className="text-accent" />
      </div>
      <h2 className="font-heading font-bold text-2xl text-primary-900 mb-3">Account Pending Approval</h2>
      <p className="text-primary-500 mb-8 leading-relaxed">
        Your registration has been submitted successfully. An administrator will review and approve your account shortly. You'll be able to log in once approved.
      </p>
      <Link
        to="/login"
        data-testid="back-to-login"
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-900 text-white rounded-md font-medium hover:bg-primary-800 transition-colors"
      >
        <HardHat size={18} />
        Back to Login
      </Link>
    </div>
  </div>
);

export default PendingApprovalPage;
