'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface TypewriterTextProps {
  /** The text to display progressively */
  text: string;
  /** Speed in milliseconds between each word (default: 60ms) */
  speed?: number;
  /** CSS class for the paragraph */
  className?: string;
  /** If true, show text instantly (e.g. when revisiting a step) */
  instant?: boolean;
  /** Callback when animation completes */
  onComplete?: () => void;
}

export default function TypewriterText({
  text,
  speed = 60,
  className = '',
  instant = false,
  onComplete,
}: TypewriterTextProps) {
  const words = text.split(/(\s+)/); // preserve whitespace
  const [visibleCount, setVisibleCount] = useState(instant ? words.length : 0);
  const containerRef = useRef<HTMLParagraphElement>(null);
  const isComplete = visibleCount >= words.length;

  // Reset when text changes
  useEffect(() => {
    setVisibleCount(instant ? words.length : 0);
  }, [text, instant, words.length]);

  // Word-by-word reveal with variable speed
  useEffect(() => {
    if (instant || isComplete) return;

    const currentWord = words[visibleCount] || '';
    // Variable speed: punctuation gets a pause, short words are faster
    let delay = speed;
    if (/[.!?…]$/.test(currentWord)) {
      delay = speed * 4; // dramatic pause on punctuation
    } else if (/[,;:]$/.test(currentWord)) {
      delay = speed * 2; // smaller pause on commas
    } else if (currentWord.length <= 2) {
      delay = speed * 0.6; // faster for tiny words
    }

    const timeout = setTimeout(() => {
      setVisibleCount((prev) => {
        const next = prev + 1;
        if (next >= words.length) {
          onComplete?.();
        }
        return next;
      });
    }, delay);

    return () => clearTimeout(timeout);
  }, [visibleCount, words, speed, instant, isComplete, onComplete]);

  // Click to skip animation
  const handleClick = useCallback(() => {
    if (!isComplete) {
      setVisibleCount(words.length);
      onComplete?.();
    }
  }, [isComplete, words.length, onComplete]);

  const displayedText = words.slice(0, visibleCount).join('');

  return (
    <p
      ref={containerRef}
      className={className}
      onClick={handleClick}
      style={{ cursor: isComplete ? 'default' : 'pointer' }}
      role="status"
      aria-label={text} // Full text always accessible to screen readers
    >
      {displayedText}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ repeat: Infinity, duration: 0.7 }}
          className="inline-block w-[3px] h-[1em] ml-0.5 bg-amber-400/80 align-middle rounded-full"
        />
      )}
    </p>
  );
}
