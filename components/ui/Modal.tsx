import React, { ReactNode, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const prev = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prev?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex justify-center items-center p-4 z-50"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`bg-white rounded-lg shadow-xl p-6 m-4 ${sizeClasses[size]} w-full transform transition-all duration-300 ease-in-out scale-95 opacity-0 animate-modalShow border border-midnight-navy/20`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="modal-title" className="text-xl font-semibold text-midnight-navy">{title}</h2>
          <button
            onClick={onClose}
            className="text-midnight-navy/70 hover:text-midnight-navy transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div>{children}</div>
      </div>
      <style>{`
        @keyframes modalShow {
          to { opacity: 1; transform: scale(1); }
        }
        .animate-modalShow { animation: modalShow 0.3s forwards; }
      `}</style>
    </div>
  );
};

export default Modal;
