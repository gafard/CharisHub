'use client';

import { useCallback, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import logger from '@/lib/logger';

interface ShareableVerseCardProps {
    reference: string;   // e.g. "Jean 3:16"
    text: string;        // The verse text
    translation?: string; // e.g. "LSG"
    onClose: () => void;
}

const GRADIENT_THEMES = [
    { name: 'Nuit', stops: ['#0b1220', '#102347', '#1e3a8a'], textColor: '#f8fafc', refColor: '#93c5fd' },
    { name: 'Aurore', stops: ['#1a0533', '#4c1d95', '#7c3aed'], textColor: '#f5f3ff', refColor: '#c4b5fd' },
    { name: 'Forêt', stops: ['#052e16', '#14532d', '#166534'], textColor: '#ecfdf5', refColor: '#86efac' },
    { name: 'Flamme', stops: ['#1c0a00', '#7c2d12', '#c2410c'], textColor: '#fff7ed', refColor: '#fdba74' },
    { name: 'Océan', stops: ['#0c1326', '#0e7490', '#06b6d4'], textColor: '#ecfeff', refColor: '#67e8f9' },
    { name: 'Rose', stops: ['#1a0012', '#831843', '#db2777'], textColor: '#fdf2f8', refColor: '#f9a8d4' },
];

function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxCharsPerLine) {
            if (line) lines.push(line);
            line = word;
            if (lines.length >= 10) break;
            continue;
        }
        line = next;
    }
    if (line && lines.length < 11) lines.push(line);
    return lines.slice(0, 11);
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateSVG(reference: string, text: string, translation: string, theme: typeof GRADIENT_THEMES[0]): string {
    const lines = wrapText(text, 36);
    const fontSize = lines.length > 7 ? 38 : 46;
    const lineHeight = fontSize + 10;

    const textNodes = lines
        .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : lineHeight}">${esc(l)}</tspan>`)
        .join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.stops[0]}"/>
      <stop offset="50%" stop-color="${theme.stops[1]}"/>
      <stop offset="100%" stop-color="${theme.stops[2]}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)" rx="40"/>
  <rect x="40" y="40" width="1000" height="1270" rx="32" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"/>
  
  <!-- Quote mark -->
  <text x="70" y="140" fill="${theme.refColor}" font-family="Georgia,serif" font-size="120" opacity="0.25">❝</text>
  
  <!-- Reference -->
  <text x="80" y="200" fill="${theme.refColor}" font-family="system-ui,-apple-system,sans-serif" font-size="36" font-weight="700" letter-spacing="1">${esc(reference)}</text>
  
  <!-- Verse text -->
  <text x="80" y="300" fill="${theme.textColor}" font-family="Georgia,serif" font-size="${fontSize}" font-weight="400" line-height="1.5">${textNodes}</text>
  
  <!-- Translation tag -->
  <rect x="80" y="1230" width="${translation.length * 18 + 32}" height="40" rx="12" fill="rgba(255,255,255,0.1)"/>
  <text x="96" y="1257" fill="rgba(255,255,255,0.6)" font-family="system-ui,-apple-system,sans-serif" font-size="20" font-weight="600">${esc(translation)}</text>
  
  <!-- App name -->
  <text x="945" y="1257" fill="rgba(255,255,255,0.35)" font-family="system-ui,-apple-system,sans-serif" font-size="18" text-anchor="end">Miroir · Identité & Grâce</text>
</svg>`;
}

async function svgToPng(svgString: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 1350;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Canvas context unavailable'));
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
                'image/png',
                0.95
            );
        };
        img.onerror = () => reject(new Error('Failed to load SVG'));
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        img.src = URL.createObjectURL(blob);
    });
}

import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export default function ShareableVerseCard({ reference, text, translation = 'LSG', onClose }: ShareableVerseCardProps) {
    const [themeIndex, setThemeIndex] = useState(0);
    const [generating, setGenerating] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const theme = GRADIENT_THEMES[themeIndex];

    const svgString = generateSVG(reference, text, translation, theme);
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

    const handleDownload = useCallback(async () => {
        setGenerating(true);
        try {
            const blob = await svgToPng(svgString);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${reference.replace(/\s+/g, '_')}.png`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            logger.error('[ShareableVerseCard] Download failed:', err);
        } finally {
            setGenerating(false);
        }
    }, [svgString, reference]);

    const handleShare = useCallback(async () => {
        setGenerating(true);
        try {
            const blob = await svgToPng(svgString);
            
            if (Capacitor.isNativePlatform()) {
                const base64Url = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                
                await Share.share({
                    title: reference,
                    text: `"${text}" - ${reference} (${translation})`,
                    url: base64Url,
                    dialogTitle: 'Partager la Parole'
                });
            } else {
                const file = new File([blob], `${reference.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
                if (navigator.share && navigator.canShare?.({ files: [file] })) {
                    await navigator.share({
                        title: reference,
                        text: text.substring(0, 100),
                        files: [file],
                    });
                } else {
                    handleDownload();
                }
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                logger.error('[ShareableVerseCard] Share failed:', err);
                handleDownload();
            }
        } finally {
            setGenerating(false);
        }
    }, [svgString, reference, text, translation, handleDownload]);

    return (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-3xl bg-surface-strong border border-border-soft p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 p-2 rounded-xl hover:bg-surface text-[color:var(--text-muted)]"
                >
                    <X size={18} />
                </button>

                <h3 className="text-lg font-bold mb-1">Partager ce verset</h3>
                <p className="text-xs text-[color:var(--text-muted)] mb-4">Choisissez un thème et téléchargez ou partagez l'image.</p>

                {/* Preview */}
                <div ref={previewRef} className="rounded-2xl overflow-hidden shadow-lg mb-4">
                    <img src={svgDataUrl} alt={`${reference} card`} className="w-full h-auto" />
                </div>

                {/* Theme selector */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {GRADIENT_THEMES.map((t, i) => (
                        <button
                            key={t.name}
                            onClick={() => setThemeIndex(i)}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${themeIndex === i
                                    ? 'ring-2 ring-[color:var(--accent)] bg-surface'
                                    : 'bg-surface hover:bg-surface-strong'
                                }`}
                        >
                            <span
                                className="w-4 h-4 rounded-full"
                                style={{ background: `linear-gradient(135deg, ${t.stops[0]}, ${t.stops[2]})` }}
                            />
                            {t.name}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--foreground)] text-[color:var(--background)] px-4 py-3 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        <Download size={16} />
                        {generating ? '...' : 'Télécharger'}
                    </button>
                    <button
                        onClick={handleShare}
                        disabled={generating}
                        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 text-sm font-bold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                    >
                        <Share2 size={16} />
                        {generating ? '...' : 'Partager'}
                    </button>
                </div>
            </div>
        </div>
    );
}
