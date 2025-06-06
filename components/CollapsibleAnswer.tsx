import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface CollapsibleAnswerProps {
  children: ReactNode;
}

const CollapsibleAnswer: React.FC<CollapsibleAnswerProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left text-midnight-navy/90 font-sans focus:outline-none"
        aria-expanded={isOpen}
      >
        <span>{isOpen ? 'Hide Answer' : 'Show Answer'}</span>
        <ChevronDownIcon
          className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="open"
            exit="collapsed"
            variants={{
              open: { height: 'auto', opacity: 1 },
              collapsed: { height: 0, opacity: 0 }
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2 whitespace-pre-line">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CollapsibleAnswer;
