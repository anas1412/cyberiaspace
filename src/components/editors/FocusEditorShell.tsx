import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FocusEditorShellProps {
  isVisible: boolean;
  onClose: () => void;
  icon: React.ElementType;
  title: string;
  onTitleChange: (val: string) => void;
  description?: string;
  isReadOnly?: boolean;
  maxWidth?: string;
  stack?: { name: string; color: string } | null;
  
  // Custom slots for flexibility
  headerSubContent?: React.ReactNode; // e.g., Progress bar in Tasks
  headerActions?: React.ReactNode;    // e.g., View/Edit toggle
  footerActions?: React.ReactNode;    // e.g., Export buttons
  footerStatus?: React.ReactNode;     // e.g., "Markdown supported" text
  
  children: React.ReactNode;          // The actual editor content
}

export const FocusEditorShell: React.FC<FocusEditorShellProps> = ({
  isVisible,
  onClose,
  icon: Icon,
  title,
  onTitleChange,
  description,
  isReadOnly = false,
  maxWidth = "1000px",
  stack,
  headerSubContent,
  headerActions,
  footerActions,
  footerStatus,
  children
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:p-10"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="focus-box glass rounded-[2rem] md:rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl w-full h-full max-h-[95vh] md:max-h-[85vh] flex flex-col"
            style={{ maxWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 bg-black/20 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto flex-1 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--accent)]/10 rounded-xl md:rounded-2xl flex items-center justify-center text-[var(--accent-secondary)] flex-shrink-0">
                  <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Untitled Thought"
                    readOnly={isReadOnly}
                    className="bg-transparent border-none outline-none text-white font-bold text-lg md:text-xl placeholder:text-white/20"
                  />
                  {description && description !== 'No description available.' && (
                    <p className="text-[10px] md:text-[11px] text-slate-500 italic leading-relaxed mt-1 line-clamp-2 md:line-clamp-none">
                      {description}
                    </p>
                  )}
                  {headerSubContent}
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto ml-0 md:ml-4">
                {headerActions}
                <button
                  onClick={onClose}
                  className="p-3 md:p-4 hover:bg-red-500/10 rounded-xl md:rounded-2xl text-slate-400 hover:text-red-400 transition-all"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">
              {children}
            </div>

            {/* Footer Area */}
            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex flex-wrap justify-center md:justify-start gap-2">
                {stack && (
                  <span
                    className="tag-pill text-[8px] md:text-[9px] font-700 px-2 md:px-2.5 py-1 rounded-lg border border-white/10"
                    style={{
                      backgroundColor: stack.color.replace('1)', '0.15)'),
                      color: stack.color,
                      borderColor: stack.color.replace('1)', '0.3)')
                    }}
                  >
                    {stack.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                {footerStatus}
                {footerActions}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
