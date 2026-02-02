import React from 'react';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';

const Lightbox: React.FC = () => {
  const isOpen = useStore((state) => state.isLightboxOpen);
  const image = useStore((state) => state.lightboxImage);
  const closeLightbox = useStore((state) => state.closeLightbox);

  if (!isOpen || !image) return null;

  return (
    <div 
      id="lightbox" 
      className="fixed inset-0 z-[10000] bg-[#020408]/70 backdrop-blur-[40px] flex items-center justify-center p-8 cursor-zoom-out animate-in fade-in zoom-in-95 duration-300"
      onClick={closeLightbox}
    >
      <button className="absolute top-8 right-8 text-white opacity-50 hover:opacity-100 transition-opacity">
        <X className="w-8 h-8" />
      </button>
      <img 
        src={image} 
        className="max-w-full max-h-full rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] border border-white/10 ring-1 ring-white/5" 
        alt="Full view" 
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default Lightbox;
