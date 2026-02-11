import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useModalStore } from '../store/useModalStore';
import { Share2, Copy, Trash2, CheckCircle2, QrCode, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareDialogProps {
    spaceId: string;
}

const ShareDialog: React.FC<ShareDialogProps> = ({ spaceId }) => {
    const [isPublishing, setIsPublishing] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [showQR, setShowQR] = useState(false);

    const publishSpace = useStore(state => state.publishSpace);
    const unpublishSpace = useStore(state => state.unpublishSpace);
    const space = useStore(state => state.spaces.find(s => s.id === spaceId));
    const closeModal = useStore(state => (state as any).closeModal || useModalStore.getState().closeModal);

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            await publishSpace(spaceId);
        } catch (err) {
            console.error(err);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleUnpublish = async () => {
        useModalStore.getState().openModal({
            title: 'Stop Sharing?',
            description: 'This will invalidate the public link immediately. Are you sure?',
            type: 'confirm_cancel',
            confirmText: 'Stop Sharing',
            onConfirm: async () => {
                await unpublishSpace(spaceId);
                closeModal();
            }
        });
    };

    const shareUrl = space?.publishedId ? `${window.location.origin}/s/${space.publishedId}` : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6 p-2">
            <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex flex-col">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-indigo-400" />
                        Share Space
                    </h3>
                </div>
                <button
                    onClick={closeModal}
                    className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all flex-shrink-0"
                    title="Close"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {!space?.publishedId ? (
                <button
                    onClick={handlePublish}
                    disabled={isPublishing}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                    {isPublishing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Share2 className="w-5 h-5" />
                    )}
                    {isPublishing ? 'Publishing...' : 'Create Share Link'}
                </button>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono uppercase tracking-wider">
                            <span>Public Link</span>
                            {space.lastPublished && (
                                <span>Updated: {new Date(space.lastPublished).toLocaleDateString()}</span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-sm text-indigo-300 truncate font-mono">
                                {shareUrl}
                            </div>
                            <button
                                onClick={handleCopy}
                                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors shrink-0"
                            >
                                {copySuccess ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handlePublish}
                            disabled={isPublishing}
                            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
                        >
                            {isPublishing ? 'Syncing...' : 'Update Snapshot'}
                        </button>
                        <button
                            onClick={() => setShowQR(!showQR)}
                            className={`p-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${showQR ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <QrCode className="w-5 h-5" />
                        </button>
                    </div>

                    <AnimatePresence>
                        {showQR && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden flex flex-col items-center gap-2 bg-white rounded-xl p-4"
                            >
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`}
                                    alt="QR Code"
                                    className="w-40 h-40"
                                />
                                <span className="text-black text-xs font-bold font-mono">PUBLISHED SPACE QR</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleUnpublish}
                        className="w-full py-2.5 border border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Stop Sharing
                    </button>
                </div>
            )}
        </div>
    );
};

export default ShareDialog;
