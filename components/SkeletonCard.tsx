import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="animate-pulse border border-midnight-navy/10 shadow-lg rounded-lg p-4 space-y-4">
      <div className="h-48 bg-slate-200 rounded w-full" />
      <div className="space-y-2">
        <div className="h-5 bg-slate-200 rounded w-3/4" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
      </div>
    </div>
  );
};

export default SkeletonCard;
