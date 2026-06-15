import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FocusOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const FocusOverlay: React.FC<FocusOverlayProps> = ({
  isVisible,
  onClose,
  children
}) => {
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[var(--z-overlay)] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-4 md:px-10 md:py-8 lg:px-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-full max-w-[1400px] max-h-[90vh] flex flex-col"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
