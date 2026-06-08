import React, { useState, useEffect } from 'react';
import { X, Camera, Upload, Trash2, Palette } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { MAX_UPLOAD_SIZE, MAX_UPLOAD_SIZE_MB } from '../../constants';
import { useModalStore } from '../../store/useModalStore';
import { getSetting, setSetting, removeSetting } from '../../utils/settings';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NODE_BG_PRESETS = [
  { color: '#12121a', name: 'Pitch' },
  { color: '#1a2744', name: 'Navy' },
  { color: '#1f3d3d', name: 'Teal' },
  { color: '#2d1f3d', name: 'Plum' },
  { color: '#3d1f1f', name: 'Maroon' },
  { color: '#3d2d1a', name: 'Espresso' },
  { color: '#ffd6d6', name: 'Rose' },
  { color: '#ffd9b3', name: 'Peach' },
  { color: '#fff5cc', name: 'Lemon' },
  { color: '#c8f7c5', name: 'Mint' },
  { color: '#b3e6ff', name: 'Sky' },
  { color: '#d9b3ff', name: 'Lilac' },
];

const ACCENT_PRESETS = [
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#f43f5e', name: 'Rose' },
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#22c55e', name: 'Green' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#06b6d4', name: 'Cyan' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#a855f7', name: 'Purple' },
];

const SECONDARY_PRESETS = [
  { color: '#8b5cf6', name: 'Purple' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#f472b6', name: 'Pink' },
  { color: '#fb7185', name: 'Rose' },
  { color: '#f87171', name: 'Red' },
  { color: '#fb923c', name: 'Orange' },
  { color: '#facc15', name: 'Yellow' },
  { color: '#4ade80', name: 'Green' },
  { color: '#2dd4bf', name: 'Teal' },
  { color: '#22d3ee', name: 'Cyan' },
  { color: '#60a5fa', name: 'Blue' },
  { color: '#c084fc', name: 'Purple' },
];

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customBg: string | null;
  customBgLoading: boolean;
  setCustomBg: (bg: File | string | null) => Promise<void>;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen, onClose, customBg, customBgLoading, setCustomBg
}) => {
  const { openModal } = useModalStore();

  // -- Custom Background --
  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      openModal({
        title: 'Background too large',
        description: `Please use an image or GIF under ${MAX_UPLOAD_SIZE_MB}MB.`,
        type: 'alert',
        confirmText: 'Okay'
      });
      return;
    }
    setCustomBg(file);
    e.target.value = '';
  };

  const handleBgReset = async () => {
    const activeSpaceId = useStore.getState().activeSpaceId;
    if (!activeSpaceId) return;
    const { db } = await import('../../db');
    const currentSpace = await db.spaces.get(activeSpaceId);
    const currentBg = currentSpace?.customBg;
    if (currentBg && currentBg.startsWith('blob:')) {
      URL.revokeObjectURL(currentBg);
    }
    try {
      await db.spaceBackgrounds.delete(activeSpaceId);
    } catch (e) {
      console.warn('[BG] Failed to delete local background:', e);
    }
    setCustomBg(null);
  };

  // -- Node Background Color --
  const [nodeBgKey, setNodeBgKey] = useState(0);

  const getNodeBgColor = (): string => {
    void nodeBgKey;
    return getSetting('node-bg') || '#12121af5';
  };

  const handleNodeBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    const alphaColor = color + 'f5';
    setSetting('node-bg', alphaColor);
    document.documentElement.style.setProperty('--node-bg', alphaColor, 'important');
    setNodeBgKey(prev => prev + 1);
  };

  const handleNodeBgPreset = (color: string) => {
    const alphaColor = color + 'f5';
    setSetting('node-bg', alphaColor);
    document.documentElement.style.setProperty('--node-bg', alphaColor, 'important');
    setNodeBgKey(prev => prev + 1);
  };

  const handleNodeBgReset = () => {
    removeSetting('node-bg');
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const defaultColor = isDark ? '#12121af5' : '#f8fafc';
    document.documentElement.style.setProperty('--node-bg', defaultColor, 'important');
    setNodeBgKey(prev => prev + 1);
  };

  useEffect(() => {
    const stored = getSetting('node-bg');
    if (stored) {
      document.documentElement.style.setProperty('--node-bg', stored, 'important');
    }
  }, []);

  // -- Primary / Accent Color --
  const [primaryKey, setPrimaryKey] = useState(0);

  const getPrimaryColor = (): string => {
    void primaryKey;
    return getSetting('accent') || '#6366f1';
  };

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setSetting('accent', color);
    document.documentElement.style.setProperty('--accent', color, 'important');
    document.documentElement.style.setProperty('--accent-secondary', color + '99', 'important');
    setPrimaryKey(prev => prev + 1);
  };

  const handlePrimaryPreset = (color: string) => {
    setSetting('accent', color);
    document.documentElement.style.setProperty('--accent', color, 'important');
    document.documentElement.style.setProperty('--accent-secondary', color + '99', 'important');
    setPrimaryKey(prev => prev + 1);
  };

  const handlePrimaryReset = () => {
    removeSetting('accent');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-secondary');
    setPrimaryKey(prev => prev + 1);
  };

  useEffect(() => {
    const stored = getSetting('accent');
    if (stored) {
      document.documentElement.style.setProperty('--accent', stored, 'important');
      document.documentElement.style.setProperty('--accent-secondary', stored + '99', 'important');
    }
  }, []);

  // -- Secondary Color --
  const [secondaryKey, setSecondaryKey] = useState(0);

  const getSecondaryColor = (): string => {
    void secondaryKey;
    return getSetting('secondary') || '#8b5cf6';
  };

  const handleSecondaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setSetting('secondary', color);
    document.documentElement.style.setProperty('--secondary', color, 'important');
    setSecondaryKey(prev => prev + 1);
  };

  const handleSecondaryPreset = (color: string) => {
    setSetting('secondary', color);
    document.documentElement.style.setProperty('--secondary', color, 'important');
    setSecondaryKey(prev => prev + 1);
  };

  const handleSecondaryReset = () => {
    removeSetting('secondary');
    document.documentElement.style.removeProperty('--secondary');
    setSecondaryKey(prev => prev + 1);
  };

  useEffect(() => {
    const stored = getSetting('secondary');
    if (stored) {
      document.documentElement.style.setProperty('--secondary', stored, 'important');
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] bg-[var(--bg-page)]/60 backdrop-blur-md flex items-center justify-center p-6 md:p-10 pointer-events-auto" onClick={onClose}>
      <div className="glass max-w-2xl w-full rounded-3xl border border-[var(--glass-border)] flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-[var(--glass-border)] shrink-0">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--accent-secondary)]">Customization</h3>
          <button onClick={onClose} aria-label="Close modal" className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scroll px-8 py-6 space-y-8" onWheel={(e) => e.stopPropagation()}>

          {/* Custom Background */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                <Camera className="w-3.5 h-3.5" /> Workspace Background
              </p>
              {customBg && !customBgLoading && (
                <button
                  onClick={handleBgReset}
                  className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {customBgLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-[var(--glass-bg)] border-2 border-dashed border-[var(--accent)]/50">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-page)] flex items-center justify-center animate-pulse">
                  <Upload className="w-6 h-6 text-[var(--accent)]" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">Uploading...</p>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-1.5">Please wait</p>
                </div>
              </div>
            ) : (
              <label className="relative flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-[var(--glass-bg)] border-2 border-dashed border-[var(--glass-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-page)] transition-all cursor-pointer group">
                <div className="w-12 h-12 rounded-2xl bg-[var(--bg-page)] flex items-center justify-center group-hover:scale-110 group-hover:bg-[var(--glass-bg)] transition-all">
                  <Upload className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-semibold tracking-wide text-[var(--text-dimmed)] group-hover:text-[var(--text-primary)] transition-colors">
                    {customBg ? 'Update Background' : 'Upload Custom Background'}
                  </p>
                  <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wide mt-1.5">Supports JPG, PNG, GIF &bull; Max {MAX_UPLOAD_SIZE_MB}MB</p>
                </div>
                <input type="file" className="hidden" accept="image/*,.gif" onChange={handleBgUpload} />
              </label>
            )}
          </section>

          {/* Node Background Color */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" /> Node Colors
              </p>
              <button
                onClick={handleNodeBgReset}
                className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" /> Reset
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div
                    className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                    style={{ backgroundColor: getNodeBgColor() }}
                  />
                  <input
                    type="color"
                    value={getNodeBgColor().slice(0, 7)}
                    onChange={handleNodeBgChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">Thought Nodes</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]">
                  {getNodeBgColor().slice(0, 7)}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {NODE_BG_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => handleNodeBgPreset(preset.color)}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                      getNodeBgColor().slice(0, 7) === preset.color
                        ? "border-[var(--text-primary)] shadow-lg"
                        : "border-[var(--glass-border)] hover:border-[var(--accent)]/50"
                    )}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Primary / Accent Color */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" /> Primary Color
              </p>
              {getPrimaryColor() !== '#6366f1' && (
                <button
                  onClick={handlePrimaryReset}
                  className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div
                    className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                    style={{ backgroundColor: getPrimaryColor() }}
                  />
                  <input
                    type="color"
                    value={getPrimaryColor()}
                    onChange={handlePrimaryChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">Brand Primary</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]">
                  {getPrimaryColor()}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => handlePrimaryPreset(preset.color)}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                      getPrimaryColor() === preset.color
                        ? "border-[var(--text-primary)] shadow-lg"
                        : "border-[var(--glass-border)] hover:border-[var(--text-primary)]/50"
                    )}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Secondary Color */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" /> Secondary Color
              </p>
              <button
                onClick={handleSecondaryReset}
                className="text-[9px] font-semibold tracking-wide text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" /> Reset
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div
                    className="w-12 h-12 rounded-xl border-2 border-[var(--glass-border)] overflow-hidden shadow-lg"
                    style={{ backgroundColor: getSecondaryColor() }}
                  />
                  <input
                    type="color"
                    value={getSecondaryColor()}
                    onChange={handleSecondaryChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-[var(--text-primary)]">Brand Secondary</p>
                  <p className="text-[9px] text-[var(--text-muted)] mt-1">Click the swatch to customize</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-[var(--bg-page)] border border-[var(--glass-border)] text-[10px] font-mono text-[var(--text-muted)]">
                  {getSecondaryColor()}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {SECONDARY_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => handleSecondaryPreset(preset.color)}
                    className={cn(
                      "w-8 h-8 rounded-lg border-2 transition-all hover:scale-110",
                      getSecondaryColor() === preset.color
                        ? "border-[var(--text-primary)] shadow-lg"
                        : "border-[var(--glass-border)] hover:border-[var(--text-primary)]/50"
                    )}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-auto pt-6 pb-8 border-t border-[var(--glass-border)] flex flex-col items-center gap-4 shrink-0 px-8">
          <span className="text-[10px] text-[var(--text-muted)] font-medium">All settings stored locally across sessions</span>
        </div>
      </div>
    </div>
  );
};
