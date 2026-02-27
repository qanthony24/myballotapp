import React from 'react';

const Shimmer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
);

export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
        <Shimmer className="h-48 w-full rounded-none" />
        <div className="p-4 space-y-3">
          <Shimmer className="h-5 w-3/4" />
          <Shimmer className="h-4 w-1/2" />
          <Shimmer className="h-4 w-2/3" />
          <div className="pt-3 space-y-2">
            <Shimmer className="h-9 w-full rounded-md" />
            <Shimmer className="h-9 w-full rounded-md" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-100 p-6">
    <div className="flex items-start gap-4 mb-6">
      <Shimmer className="w-24 h-24 rounded-full flex-shrink-0" />
      <div className="space-y-2 flex-1">
        <Shimmer className="h-7 w-48" />
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-4 w-56" />
      </div>
    </div>
    <div className="space-y-2">
      <Shimmer className="h-10 w-full rounded-md" />
      <Shimmer className="h-10 w-full rounded-md" />
    </div>
    <div className="mt-8 space-y-4">
      <Shimmer className="h-5 w-32" />
      <Shimmer className="h-20 w-full" />
      <Shimmer className="h-5 w-40" />
      <Shimmer className="h-16 w-full" />
      <Shimmer className="h-16 w-full" />
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="bg-white rounded-lg border border-gray-100 p-4 flex items-center gap-4">
        <Shimmer className="h-5 w-5 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-5 w-3/4" />
          <Shimmer className="h-4 w-1/3" />
        </div>
        <Shimmer className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export default { CardGridSkeleton, ProfileSkeleton, ListSkeleton };
