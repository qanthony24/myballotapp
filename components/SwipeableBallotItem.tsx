import React, { useState, useRef } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface SwipeableBallotItemProps {
  onRemove: () => void;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 100; // pixels

const SwipeableBallotItem: React.FC<SwipeableBallotItemProps> = ({ onRemove, children }) => {
  const startX = useRef<number | null>(null);
  const [translateX, setTranslateX] = useState(0);

  const handleStart = (clientX: number) => {
    startX.current = clientX;
  };

  const handleMove = (clientX: number) => {
    if (startX.current !== null) {
      setTranslateX(clientX - startX.current);
    }
  };

  const handleEnd = () => {
    if (Math.abs(translateX) > SWIPE_THRESHOLD) {
      onRemove();
    }
    setTranslateX(0);
    startX.current = null;
  };

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    handleStart(e.clientX);
    const onMove = (ev: MouseEvent) => handleMove(ev.clientX);
    const onUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => handleMove(e.touches[0].clientX);
  const onTouchEnd = () => handleEnd();

  return (
    <div
      className="relative overflow-hidden"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      <div className="absolute inset-0 flex items-center justify-end pr-4 pointer-events-none">
        <TrashIcon className="h-6 w-6 text-red-600" />
      </div>
      <div
        className="transition-transform"
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableBallotItem;
