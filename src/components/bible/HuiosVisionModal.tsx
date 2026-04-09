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

                        <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
                                    <Sparkles size={24} className="animate-pulse" />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-black tracking-tighter text-white uppercase leading-none">Miroir de Grâce</h2>
                                    <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-amber-400/60 mt-1">Éclairage sur ta Grâce et ton Identité</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/20 p-8">
                            <div className="max-w-prose mx-auto">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-8">
                                        <div className="relative">
                                            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-2xl animate-pulse" />
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                                className="relative w-24 h-24 border-2 border-dashed border-amber-400/30 rounded-full flex items-center justify-center"
                                            >
                                                <Sparkles className="text-amber-400" size={32} />
                                            </motion.div>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <p className="text-amber-400 font-black uppercase tracking-[0.2em] text-sm animate-pulse">Recherche d'un éclairage...</p>
                                            <p className="text-white/40 text-xs italic">Recevez la Parole à la lumière de la Grâce</p>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                                        <div className="text-sm font-medium text-rose-400">Éclairage indisponible</div>
                                        <div className="max-w-md text-xs text-white/40 font-mono whitespace-pre-wrap">
                                            {error}
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="prose prose-invert prose-slate max-w-none 
                                            prose-headings:text-amber-400 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter
                                            prose-p:text-slate-100 prose-p:leading-relaxed prose-p:text-lg
                                            prose-strong:text-amber-400
                                            prose-li:text-slate-200
                                            prose-hr:border-white/10"
                                    >
                                        <ReactMarkdown>{content}</ReactMarkdown>
                                    </motion.div>
                                )}
                            </div>
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
