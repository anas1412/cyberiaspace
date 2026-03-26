/**
 * SuggestionDropdown - Autocomplete dropdown for @thought and #stack references
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type SuggestionItem } from '../utils/referenceParser';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SuggestionDropdownProps {
  position?: { top: number; left: number };
  query: string;
  type: 'thought' | 'stack';
  items: SuggestionItem[];
  selectedIndex: number;
  onSelect: (item: SuggestionItem) => void;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
  position,
  query,
  type,
  items,
  selectedIndex,
  onSelect,
  onClose,
  onKeyDown,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Determine if we should use fixed positioning (when position prop provided) or CSS positioning
  const isFixed = !!position;

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Small delay to avoid immediate close on trigger click
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Calculate adjusted position for fixed positioning (when position prop provided)
  const adjustedPosition = position ? {
    top: position.top,
    left: position.left,
  } : null;

  // Handle fixed positioning with viewport bounds check
  if (position) {
    const DROPDOWN_WIDTH = 280;
    if (position.left + DROPDOWN_WIDTH > window.innerWidth - 20) {
      adjustedPosition!.left = window.innerWidth - DROPDOWN_WIDTH - 20;
    }
    if (position.top + 280 > window.innerHeight - 100) {
      adjustedPosition!.top = position.top - 280 - 40;
    }
  }

  return (
    <div
      ref={dropdownRef}
      className={isFixed ? "fixed z-[150]" : "absolute z-[150] bottom-full left-0 mb-2"}
      style={adjustedPosition ? { top: adjustedPosition.top, left: adjustedPosition.left } : undefined}
      onKeyDown={onKeyDown}
    >
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.1 }}
          className="w-[280px] glass border border-[var(--glass-border)] rounded-xl shadow-2xl overflow-hidden bg-[var(--bg-page)]/95 backdrop-blur-md"
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-[var(--glass-border)] flex items-center gap-2">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
              type === 'thought' 
                ? "bg-white/10 text-[var(--text-primary)]" 
                : "bg-[var(--accent)]/20 text-[var(--accent)]"
            )}>
              {type === 'thought' ? '@' : '#'}
            </span>
            <span className="text-[9px] text-[var(--text-muted)]">
              {type === 'thought' ? 'Thought' : 'Stack'}
            </span>
            {query && (
              <span className="text-[8px] text-[var(--text-muted)] ml-auto">
                "{query}"
              </span>
            )}
          </div>

          {/* Items List */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto custom-scroll py-1">
            {items.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <span className="text-[10px] text-[var(--text-muted)]">
                  No matches found
                </span>
              </div>
            ) : (
              items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left transition-all",
                    "hover:bg-white/5",
                    index === selectedIndex && "bg-[var(--accent)]/15"
                  )}
                >
                  {/* Icon / Color dot */}
                  {type === 'stack' && item.color && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  
                  {type === 'thought' && (
                    <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">@</span>
                  )}

                  {/* Name */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className={cn(
                      "text-[11px] font-medium truncate",
                      index === selectedIndex ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"
                    )}>
                      {item.name}
                    </span>
                    
                    {/* Preview */}
                    {item.preview && (
                      <span className="text-[9px] text-[var(--text-muted)] truncate">
                        {item.preview}
                      </span>
                    )}
                  </div>

                  {/* Stack indicator for thoughts */}
                  {type === 'thought' && item.color && (
                    <div 
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: item.color }}
                      title="In stack"
                    />
                  )}

                  {/* Selection indicator */}
                  {index === selectedIndex && (
                    <span className="text-[9px] text-[var(--accent)] flex-shrink-0">
                      ↵
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 border-t border-[var(--glass-border)] flex items-center gap-3">
            <span className="text-[8px] text-[var(--text-muted)]">
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-[8px]">↑↓</kbd> navigate
            </span>
            <span className="text-[8px] text-[var(--text-muted)]">
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-[8px]">↵</kbd> select
            </span>
            <span className="text-[8px] text-[var(--text-muted)]">
              <kbd className="px-1 py-0.5 bg-white/5 rounded text-[8px]">esc</kbd> close
            </span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default SuggestionDropdown;
