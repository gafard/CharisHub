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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const startPosRef = useRef({ x: 0, y: 0 });
  const isLongPressTriggered = useRef(false);

  const start = useCallback((event: React.PointerEvent<T>) => {
    // Prevent default context menu on some devices if needed
    // event.preventDefault(); 
    
    isLongPressTriggered.current = false;
    startPosRef.current = { x: event.clientX, y: event.clientY };
    
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      onLongPress(event);
    }, delay);
  }, [onLongPress, delay]);

  const move = useCallback((event: React.PointerEvent<T>) => {
    const dx = Math.abs(event.clientX - startPosRef.current.x);
    const dy = Math.abs(event.clientY - startPosRef.current.y);
    
    if (dx > moveThreshold || dy > moveThreshold) {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [moveThreshold]);

  const end = useCallback((event: React.PointerEvent<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    if (!isLongPressTriggered.current) {
      onClick(event);
    }
  }, [onClick]);

  return {
    onPointerDown: start,
    onPointerMove: move,
    onPointerUp: end,
    onPointerLeave: end,
    // Add touch-specific handling if necessary, but Pointer events usually cover it
  };
}
