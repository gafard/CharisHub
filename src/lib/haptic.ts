/**
 * Haptic Feedback — Provides tactile feedback for mobile interactions.
 *
 * Uses Capacitor Haptics for native apps, falls back to navigator.vibrate() for PWA.
 * Fails silently on unsupported platforms.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

function canVibrateWeb(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

const isNative = Capacitor.isNativePlatform();

/** Light tap — for small button presses, toggles */
export async function hapticLight(): Promise<void> {
  if (isNative) {
    await Haptics.impact({ style: ImpactStyle.Light });
  } else if (canVibrateWeb()) {
    navigator.vibrate(10);
  }
}

/** Medium impact — for confirmations, selections */
export async function hapticMedium(): Promise<void> {
  if (isNative) {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } else if (canVibrateWeb()) {
    navigator.vibrate(25);
  }
}

/** Heavy impact — for long press, destructive actions */
export async function hapticHeavy(): Promise<void> {
  if (isNative) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } else if (canVibrateWeb()) {
    navigator.vibrate(50);
  }
}

/** Success pattern — double pulse for positive feedback */
export async function hapticSuccess(): Promise<void> {
  if (isNative) {
    await Haptics.notification({ type: NotificationType.Success });
  } else if (canVibrateWeb()) {
    navigator.vibrate([15, 50, 15]);
  }
}

/** Warning pattern — longer buzz for attention */
export async function hapticWarning(): Promise<void> {
  if (isNative) {
    await Haptics.notification({ type: NotificationType.Warning });
  } else if (canVibrateWeb()) {
    navigator.vibrate([30, 30, 60]);
  }
}

/** Selection changed — subtle tick */
export async function hapticSelection(): Promise<void> {
  if (isNative) {
    await Haptics.selectionStart();
  } else if (canVibrateWeb()) {
    navigator.vibrate(5);
  }
}
