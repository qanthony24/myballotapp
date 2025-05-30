import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-midnight-navy text-slate-100 py-8 mt-auto print:hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm">&copy; {currentYear} East Baton Rouge Parish Voter Education. All rights reserved.</p>
        <p className="text-xs text-slate-100/70 mt-1">
          This is a fictional application for demonstration purposes.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
