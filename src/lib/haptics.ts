/**
 * Utility for mobile haptic feedback (vibrations).
 */
export const Haptics = {
  /** Light pulse for subtle interactions (click, select) */
  light: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /** Medium pulse for success or section change */
  medium: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
  },

  /** Heavy pulse for errors or critical warnings */
  heavy: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(60);
    }
  },

  /** Complex pattern for notifications or finishes */
  success: () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  },

  /** Custom pattern */
  vibrate: (pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }
};
