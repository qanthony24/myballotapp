import React from 'react';

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-20 w-20',
  };

  return (
    <div className="flex justify-center items-center py-4">
      <div
        className={`animate-spin rounded-full ${sizeClasses[size]} border-t-4 border-b-4 border-civic-blue`}
      ></div>
    </div>
  );
};

export default LoadingSpinner;