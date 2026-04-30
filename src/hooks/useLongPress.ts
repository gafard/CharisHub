import { useCallback, useRef } from 'react';

interface Options {
  delay?: number;
  moveThreshold?: number;
}

export function useLongPress<T extends HTMLElement>(
  onLongPress: (event: React.PointerEvent<T>) => void,
  onClick: (event: React.PointerEvent<T>) => void,
  options: Options = {}
) {
  const { delay = 520, moveThreshold = 12 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggered = useRef(false);
  const isPressed = useRef(false);

  const start = useCallback((event: React.PointerEvent<T>) => {
    // Only handle primary button (left click)
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    // Safety: Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    isPressed.current = true;
    isLongPressTriggered.current = false;
    startPosRef.current = { x: event.clientX, y: event.clientY };
    
    // Persist the event or capture necessary data for the callback
    const persistedEvent = { ...event };

    timerRef.current = setTimeout(() => {
      if (isPressed.current) {
        isLongPressTriggered.current = true;
        onLongPress(persistedEvent as unknown as React.PointerEvent<T>);
      }
    }, delay);
  }, [onLongPress, delay]);

  const move = useCallback((event: React.PointerEvent<T>) => {
    if (!isPressed.current) return;

    const dx = Math.abs(event.clientX - startPosRef.current.x);
    const dy = Math.abs(event.clientY - startPosRef.current.y);
    
    if (dx > moveThreshold || dy > moveThreshold) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    }
  }, [moveThreshold]);

  const end = useCallback((event: React.PointerEvent<T>) => {
    if (!isPressed.current) return;
    
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    
    const wasLongPress = isLongPressTriggered.current;
    isPressed.current = false;
    isLongPressTriggered.current = false;

    if (!wasLongPress) {
      onClick(event);
    }
  }, [onClick]);

  const leave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    isPressed.current = false;
    isLongPressTriggered.current = false;
  }, []);

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerLeave: leave,
    style: { userSelect: 'none' as const, WebkitUserSelect: 'none' as const, WebkitTouchCallout: 'none' as const }
  };
}
