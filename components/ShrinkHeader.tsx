import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.tsx';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { motion } from 'framer-motion';
import MyBallotLogo from '../assets/M Logo.png';

const ShrinkHeader: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [shrink, setShrink] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShrink(window.scrollY > 50);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  return (
    <motion.header
      animate={{ height: shrink ? '3rem' : '4rem' }}
      className="backdrop-blur bg-slate-100/80 shadow-md fixed top-0 left-0 w-full z-50 print:hidden flex items-center border-b border-midnight-navy/10"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-full">
        <Link to="/" className="flex items-center">
          <img src={MyBallotLogo} alt="MyBallot Logo" className="h-10 w-auto" />
        </Link>
        <nav className="flex items-center space-x-4">
          {currentUser ? (
            <>
              <Link to="/profile" className="text-midnight-navy hover:text-civic-blue transition-colors flex items-center" title={currentUser.displayName || currentUser.email || 'User Profile'}>
                <UserCircleIcon className="h-8 w-8 text-midnight-navy hover:text-civic-blue" />
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
    </motion.header>
  );
};

export default ShrinkHeader;
