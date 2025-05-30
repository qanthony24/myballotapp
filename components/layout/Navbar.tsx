import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DocumentTextIcon, ScaleIcon, InformationCircleIcon, HomeIcon, DocumentCheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../hooks/useAuth.tsx'; // Adjusted path

const Navbar: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-40 bg-civic-blue text-slate-100 shadow-t-lg border-t border-sunlight-gold/30 h-16 print:hidden">
      <div className="container mx-auto flex justify-around items-center h-full">
        <NavLink to="/" icon={<HomeIcon className="h-5 w-5 mb-0.5" />}>Candidates</NavLink>
        <NavLink to="/ballot-measures" icon={<DocumentCheckIcon className="h-5 w-5 mb-0.5" />}>Measures</NavLink>
        
        <Link
          to="/my-ballot"
          className="relative bottom-1 flex flex-col items-center justify-center px-4 py-2 h-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-civic-blue focus:ring-sunlight-gold transition-colors duration-150 ease-in-out bg-sunlight-gold text-midnight-navy rounded-t-md hover:bg-opacity-80"
        >
          <DocumentTextIcon className="h-6 w-6 mb-0.5 text-midnight-navy" />
          <span>My Ballot</span>
        </Link>
        
        <NavLink to="/compare" icon={<ScaleIcon className="h-5 w-5 mb-0.5" />}>Compare</NavLink>
        
         <NavLink to="/election-info" icon={<InformationCircleIcon className="h-5 w-5 mb-0.5" />}>Info</NavLink>
      </div>
    </nav>
  );
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, children, icon }) => {
  const location = useLocation();
  const { currentUser } = useAuth(); // Access currentUser to adjust active states if needed

  // Define paths that should activate the "Candidates" link (Home)
  const candidateRelatedPaths = ['/', '/candidate']; 
  // Define paths that should activate the "Measures" link
  const measureRelatedPaths = ['/ballot-measures', '/ballot-measure'];

  let isActive = location.pathname === to;

  if (to === "/") {
    isActive = candidateRelatedPaths.some(p => location.pathname.startsWith(p) && location.pathname !== '/auth' && location.pathname !== '/onboarding' && location.pathname !== '/profile');
    // Special case: if on /candidate/:id, root / should be active.
    if (location.pathname.startsWith('/candidate/')) isActive = true;
    else if (location.pathname !== '/') isActive = false; // Ensure only exact / or /candidate/* activates it
  } else if (to === "/ballot-measures") {
    isActive = measureRelatedPaths.some(p => location.pathname.startsWith(p));
  } else if (to === "/my-ballot") { // Prevent My Ballot from using default active styling
    isActive = false;
  } else if (to === "/auth" && currentUser) {
    // If logged in, the "Login" link should not appear active, even if on /auth somehow
    isActive = false; 
  }


  return (
    <Link 
      to={to} 
      className={`flex flex-col items-center justify-center flex-1 px-1 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sunlight-gold focus:ring-offset-1 focus:ring-offset-civic-blue h-full
                  ${isActive ? 'bg-midnight-navy text-slate-100' : 'text-slate-100/70 hover:bg-sunlight-gold/20 hover:text-sunlight-gold'}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {icon}
      {children}
    </Link>
  );
}

export default Navbar;
