import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.tsx';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import MyBallotLogo from '../../assets/M Logo.png'; // Import the M Logo.png logo

const Header: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth'); // Redirect to auth page after logout
    } catch (error) {
      console.error("Failed to logout:", error);
      // Handle logout error (e.g., display a message to the user)
    }
  };

  return (
    <header className="bg-slate-100 shadow-md fixed top-0 left-0 w-full z-50 print:hidden h-16 flex items-center border-b border-midnight-navy/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-full">
        {/* Logo */}
        <Link to="/" className="flex items-center">
          <img src={MyBallotLogo} alt="MyBallot Logo" className="h-10 w-auto" /> {/* Use img tag for logo */}
        </Link>

        {/* Navigation / User Auth Section */}
        <nav className="flex items-center space-x-4">
          {currentUser ? (
            <>
              <Link to="/profile" className="text-midnight-navy hover:text-civic-blue transition-colors flex items-center" title={currentUser.displayName || currentUser.email || 'User Profile'}>
                <UserCircleIcon className="h-8 w-8 text-midnight-navy hover:text-civic-blue" />
                {/* Optional: display name next to icon if design allows */}
                {/* <span className=\"ml-2 hidden sm:inline\">{currentUser.displayName || 'Profile'}</span> */}
              </Link>
              <button
                onClick={handleLogout}
                className="bg-civic-blue text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-opacity-80 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="text-midnight-navy hover:text-civic-blue transition-colors px-3 py-2 rounded-md text-sm font-medium"
            >
              Login / Sign Up
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
