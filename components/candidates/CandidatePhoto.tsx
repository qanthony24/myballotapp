import React, { useState } from 'react';
import { PhotoFocalPoint } from '../../types';

const DEFAULT_FOCAL: PhotoFocalPoint = { x: 50, y: 25 };

interface CandidatePhotoProps {
  src: string;
  alt: string;
  focalPoint?: PhotoFocalPoint;
  className?: string;
  fallbackSrc?: string;
}

const CandidatePhoto: React.FC<CandidatePhotoProps> = ({
  src,
  alt,
  focalPoint,
  className = '',
  fallbackSrc = 'https://ui-avatars.com/api/?name=N+A&size=200&background=e2e8f0&color=64748b',
}) => {
  const [errored, setErrored] = useState(false);
  const fp = focalPoint ?? DEFAULT_FOCAL;

  return (
    <img
      src={errored ? fallbackSrc : src}
      alt={alt}
      className={`object-cover ${className}`}
      style={{ objectPosition: `${fp.x}% ${fp.y}%` }}
      onError={() => {
        if (!errored) setErrored(true);
      }}
    />
  );
};

export default CandidatePhoto;
export { DEFAULT_FOCAL };
