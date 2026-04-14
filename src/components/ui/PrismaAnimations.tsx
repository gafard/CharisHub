'use client';

import React, { useRef } from 'react';
import { motion, useInView, useScroll, useTransform, useSpring, Variants } from 'framer-motion';

// ============================================================
// WordsPullUp
// Splits text by spaces and animates each word sliding up.
// ============================================================
export function WordsPullUp({ 
  text, 
  className = '', 
  showAsterisk = false 
}: { 
  text: string; 
  className?: string; 
  showAsterisk?: boolean;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });
  const words = text.split(/\s+/);

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: (i = 1) => ({
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 * i },
    }),
  };

  const child: Variants = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 200,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      className={`flex flex-wrap justify-center overflow-hidden ${className}`}
      variants={container}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {words.map((word, index) => (
        <motion.span
          key={index}
          className="relative mr-[0.25em] inline-block"
          variants={child}
        >
          {word}
          {showAsterisk && index === words.length - 1 && word.toLowerCase().endsWith('a') && (
             <span className="absolute -right-[0.3em] top-[0.1em] text-[0.4em]">*</span>
          )}
        </motion.span>
      ))}
    </motion.div>
  );
}

// ============================================================
// WordsPullUpMultiStyle
// Handles multiple text segments with different styles.
// ============================================================
export interface TextSegment {
  text: string;
  className?: string;
}

export function WordsPullUpMultiStyle({ 
  segments, 
  className = '' 
}: { 
  segments: TextSegment[]; 
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  // Flatten segments into a single array of words with their respective classNames
  const allWords = segments.flatMap(segment => 
    segment.text.split(/(\s+)/).map(part => ({
      text: part,
      className: segment.className || ''
    }))
  ).filter(w => w.text.length > 0);

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const child: Variants = {
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 250,
      },
    },
    hidden: {
      opacity: 0,
      y: 20,
    },
  };

  return (
    <motion.div
      ref={ref}
      className={`flex flex-wrap justify-center overflow-hidden ${className}`}
      variants={container}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {allWords.map((wordObj, index) => (
        <motion.span
          key={index}
          className={`inline-block ${wordObj.className}`}
          variants={child}
        >
          {wordObj.text === ' ' ? '\u00A0' : wordObj.text}
        </motion.span>
      ))}
    </motion.div>
  );
}

// ============================================================
// AnimatedLetter (Scroll-Linked Reveal)
// Reveals text character by character as you scroll.
// ============================================================
export function ScrollRevealText({ 
  text, 
  className = '' 
}: { 
  text: string; 
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.2"]
  });

  const characters = text.split("");
  const totalChars = characters.length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {characters.map((char, i) => {
        const start = i / totalChars;
        const end = Math.min(1, start + 0.1); // duration of reveal per char
        
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useTransform(scrollYProgress, [start, end], [0.2, 1]);
        
        return (
          <motion.span key={i} style={{ opacity }}>
            {char}
          </motion.span>
        );
      })}
    </div>
  );
}

// ============================================================
// AnimatedLetter (Advanced staggering reveal)
// ============================================================
export function AnimatedLetter({ text, className = "" }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.9", "end 0.4"],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const characters = text.split("");
  const total = characters.length;

  return (
    <div ref={containerRef} className={`inline ${className}`}>
      {characters.map((char, i) => {
        const charStart = i / total;
        const charEnd = Math.min(1, charStart + 0.05);

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useTransform(smoothProgress, [charStart, charEnd], [0.15, 1]);

        return (
          <motion.span key={i} style={{ opacity }} className="inline">
            {char}
          </motion.span>
        );
      })}
    </div>
  );
}
