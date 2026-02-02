import React from 'react';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Lightbox: React.FC = () => {
  const isOpen = useStore((state) => state.isLightboxOpen);
  const image = useStore((state) => state.lightboxImage);
  const closeLightbox = useStore((state) => state.closeLightbox);

  return (
    <AnimatePresence>
      {isOpen && image && (
        <motion.div 
          id="lightbox" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] bg-[#020408]/70 backdrop-blur-[40px] flex items-center justify-center p-8 cursor-zoom-out"
          onClick={closeLightbox}
        >
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            whileHover={{ opacity: 1 }}
            className="absolute top-8 right-8 text-white"
          >
            <X className="w-8 h-8" />
          </motion.button>
          <motion.img 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            src={image} 
            className="max-w-full max-h-full rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/5" 
            alt="Full view" 
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Lightbox;
