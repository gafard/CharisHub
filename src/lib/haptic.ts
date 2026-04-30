/**
 * Haptic Feedback — Provides tactile feedback for mobile interactions.
 *
 * Uses navigator.vibrate() for PWA and Capacitor Haptics when available.
 * Fails silently on unsupported platforms.
 */

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/** Light tap — for small button presses, toggles */
export function hapticLight(): void {
  if (canVibrate()) navigator.vibrate(10);
}

/** Medium impact — for confirmations, selections */
export function hapticMedium(): void {
  if (canVibrate()) navigator.vibrate(25);
}

/** Heavy impact — for long press, destructive actions */
export function hapticHeavy(): void {
  if (canVibrate()) navigator.vibrate(50);
}

/** Success pattern — double pulse for positive feedback */
export function hapticSuccess(): void {
  if (canVibrate()) navigator.vibrate([15, 50, 15]);
}

/** Warning pattern — longer buzz for attention */
export function hapticWarning(): void {
  if (canVibrate()) navigator.vibrate([30, 30, 60]);
}

/** Selection changed — subtle tick */
export function hapticSelection(): void {
  if (canVibrate()) navigator.vibrate(5);
}
