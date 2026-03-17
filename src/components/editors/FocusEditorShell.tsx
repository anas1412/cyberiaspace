import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { type Stack } from '../../db';

interface FocusEditorShellProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  onTitleChange: (val: string) => void;
  description?: string;
  isReadOnly?: boolean;
  maxWidth?: string;
  stack?: Stack;
  
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
  title,
  onTitleChange,
  description,
  isReadOnly = false,
  maxWidth = "1400px",
  headerSubContent,
  headerActions,
  footerActions,
  footerStatus,
  children
}) => {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10001] bg-[var(--bg-main)]/70 backdrop-blur-[40px] flex items-center justify-center p-4 md:px-10 md:py-8 lg:px-20"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="focus-box glass rounded-2xl overflow-hidden border border-white/10 shadow-2xl w-full h-full max-h-[95vh] md:max-h-[85vh] flex flex-col"
            style={{ maxWidth }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 md:p-8 border-b border-white/5 gap-4 md:gap-0">
              <div className="flex items-center w-full md:w-auto flex-1 min-w-0">
                <div className="flex flex-col flex-1 min-w-0">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    placeholder="Untitled Thought"
                    readOnly={isReadOnly}
                    className="bg-transparent border-none outline-none text-[var(--text-primary)] font-bold text-lg md:text-xl placeholder:text-[var(--text-muted)]/20"
                  />
                  {description && description !== 'No description available.' && (
                    <p className="text-[10px] md:text-[11px] text-[var(--text-muted)] italic leading-relaxed mt-1 line-clamp-2 md:line-clamp-none">
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
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-white/5 transition-all"
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
            <div className="p-4 md:p-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex items-center gap-6">
                {footerStatus}
              </div>
              <div className="flex items-center gap-6">
                {footerActions}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
