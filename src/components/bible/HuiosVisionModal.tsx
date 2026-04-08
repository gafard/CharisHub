'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Heart, Shield, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface HuiosVisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    loading: boolean;
    reference: string;
}

export default function HuiosVisionModal({ isOpen, onClose, content, loading, reference }: HuiosVisionModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[15000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-amber-400/20 bg-slate-900 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8),0_0_20px_rgba(251,191,36,0.1)]"
                    >
                        {/* Background effects */}
                        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-[80px]" />
                        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[80px]" />

                        <div className="relative flex flex-col max-h-[85vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/5 px-8 py-6 bg-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                        <Sparkles size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight text-white uppercase">Vision Charis</h2>
                                        <p className="max-w-[280px] text-[10px] font-bold leading-snug text-amber-400/70 uppercase mt-1">Reçois un éclairage sur la Parole à la lumière de la grâce et de ton identité en Christ.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="rounded-full bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all shadow-inner"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center gap-6 py-12">
                                        <div className="relative">
                                            <div className="h-20 w-20 rounded-full border-4 border-amber-400/20" />
                                            <div className="absolute inset-0 h-20 w-20 animate-spin rounded-full border-t-4 border-amber-400" />
                                            <Sparkles className="absolute inset-0 m-auto animate-pulse text-amber-400" size={32} />
                                        </div>
                                        <div className="text-center space-y-2">
                                            <p className="text-lg font-bold text-white">Révélation en cours...</p>
                                            <p className="text-sm text-slate-400">Le Saint-Esprit illumine ton intelligence.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-amber-200 prose-strong:text-white prose-li:text-slate-300">
                                        <ReactMarkdown>{content}</ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            {/* Footer stats / CTA */}
                            {!loading && (
                                <div className="border-t border-white/5 bg-slate-900/50 px-8 py-6">
                                    <div className="flex items-center justify-center gap-8 text-slate-400/60">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                            <Heart size={14} className="text-rose-500/60" />
                                            Amour Pur
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                            <Shield size={14} className="text-sky-500/60" />
                                            Position Scellée
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                            <Zap size={14} className="text-amber-500/60" />
                                            Pleine Puissance
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
