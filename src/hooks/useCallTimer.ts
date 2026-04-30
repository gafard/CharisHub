import { useState, useEffect, useRef } from 'react';

/**
 * Hook to manage a stable call duration timer.
 * Uses a ref for the start time to prevent resets on re-renders.
 */
export function useCallTimer(joined: boolean) {
    const [durationSec, setDurationSec] = useState(0);
    const startTimeRef = useRef<number | null>(null);
    
    useEffect(() => {
        if (!joined) {
            setDurationSec(0);
            startTimeRef.current = null;
            return;
        }

        // Set start time only once when joined becomes true
        if (startTimeRef.current === null) {
            startTimeRef.current = Date.now();
        }

        const id = setInterval(() => {
            if (startTimeRef.current) {
                setDurationSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);

        return () => clearInterval(id);
    }, [joined]);
    
    return durationSec;
}
