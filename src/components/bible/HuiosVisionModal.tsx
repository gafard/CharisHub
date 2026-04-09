'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Sparkles, X, Heart, Shield, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface HuiosVisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
    loading: boolean;
    error: string | null;
    reference: string;
}

export default function HuiosVisionModal({ isOpen, onClose, content, loading, error, reference }: HuiosVisionModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[15000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/85 backdrop-blur-xl"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="relative w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-amber-400/30 bg-slate-900/95 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),0_0_30px_rgba(251,191,36,0.15)] ring-1 ring-white/10"
                    >
                        {/* Aurora Background effects */}
                        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-500/15 blur-[100px] animate-pulse" />
                        <div className="absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/15 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />

                        <div className="relative flex flex-col max-h-[85vh]">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/10 px-8 py-6 bg-white/5 backdrop-blur-md">
                                <div className="flex items-center gap-5">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                                        <Sparkles size={28} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tighter text-white uppercase leading-none">Vision Charis</h2>
                                        <p className="max-w-[280px] text-[10px] font-bold leading-snug text-amber-400 tracking-widest uppercase mt-1.5 opacity-90">La Parole à la Lumière de la Grâce</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="group rounded-full bg-white/5 p-3 text-white/50 hover:bg-white/10 hover:text-white transition-all shadow-inner"
                                >
                                    <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar scroll-smooth">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center gap-8 py-20">
                                        <div className="relative">
                                            <div className="h-24 w-24 rounded-full border-4 border-amber-400/10" />
                                            <div className="absolute inset-0 h-24 w-24 animate-spin rounded-full border-t-4 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]" />
                                            <Sparkles className="absolute inset-0 m-auto animate-pulse text-amber-400" size={40} />
                                        </div>
                                        <div className="text-center space-y-3">
                                            <p className="text-xl font-black text-white tracking-tight">Révélation en cours...</p>
                                            <p className="text-sm font-medium text-slate-400 max-w-[240px] leading-relaxed mx-auto">Prépare ton cœur à recevoir une parole qui libère.</p>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center gap-6 py-16">
                                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                                            <AlertCircle size={40} />
                                        </div>
                                        <div className="text-center space-y-3 max-w-sm px-4">
                                            <p className="text-xl font-black text-white uppercase tracking-tight">Analyse indisponible</p>
                                            <p className="text-sm font-medium text-red-400/80 leading-relaxed">{error}</p>
                                            <button 
                                                onClick={onClose}
                                                className="mt-4 px-6 py-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 transition-colors text-xs font-bold uppercase tracking-widest"
                                            >
                                                Réessayer
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="prose prose-invert prose-amber max-w-none 
                                            prose-p:text-slate-100 prose-p:leading-[1.8] prose-p:text-lg
                                            prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight
                                            prose-strong:text-amber-400 prose-strong:font-black
                                            prose-li:text-slate-100 prose-li:text-lg
                                            prose-code:text-amber-300 prose-code:bg-amber-400/10 prose-code:px-1.5 prose-code:rounded
                                            space-y-6"
                                    >
                                        <ReactMarkdown>{content}</ReactMarkdown>
                                    </motion.div>
                                )}
                            </div>

                            {/* Footer stats / Identity Declaration */}
                            {!loading && !error && (
                                <div className="border-t border-white/10 bg-slate-950/40 px-6 py-5 backdrop-blur-sm">
                                    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
                                        <div className="flex items-center gap-2 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em] text-rose-400/90 bg-rose-500/5 px-3 py-1.5 rounded-full border border-rose-500/10">
                                            <Heart size={12} className="fill-current" />
                                            Amour Inconditionnel
                                        </div>
                                        <div className="flex items-center gap-2 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em] text-sky-400/90 bg-sky-500/5 px-3 py-1.5 rounded-full border border-sky-500/10">
                                            <Shield size={12} className="fill-current" />
                                            Position Scellée
                                        </div>
                                        <div className="flex items-center gap-2 whitespace-nowrap text-[9px] font-black uppercase tracking-[0.1em] text-amber-400 bg-amber-500/5 px-3 py-1.5 rounded-full border border-amber-500/10">
                                            <Zap size={12} className="fill-current" />
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
