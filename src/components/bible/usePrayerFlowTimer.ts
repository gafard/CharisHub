'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type UsePrayerFlowTimerParams = {
  isOpen: boolean;
  finished: boolean;
  autoStart?: boolean;
};

export function usePrayerFlowTimer({
  isOpen,
  finished,
  autoStart = true,
}: UsePrayerFlowTimerParams) {
  const [isRunning, setIsRunning] = useState(autoStart);
  const [elapsed, setElapsed] = useState(0);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartedAtRef = useRef<number>(0);
  const stepStartedAtRef = useRef<number>(0);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    const now = Date.now();
    sessionStartedAtRef.current = now;
    stepStartedAtRef.current = now;
    setElapsed(0);
    setSessionElapsed(0);
    setIsRunning(autoStart);
  }, [autoStart]);

  const resetStep = useCallback(() => {
    stepStartedAtRef.current = Date.now();
    setElapsed(0);
  }, []);

  const pause = useCallback(() => {
    stopTimer();
    setIsRunning(false);
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (!isOpen || finished) return;

    const now = Date.now();
    stepStartedAtRef.current = now - elapsed * 1000;
    sessionStartedAtRef.current = now - sessionElapsed * 1000;
    setIsRunning(true);
  }, [elapsed, finished, isOpen, sessionElapsed]);

  const toggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const getSessionDuration = useCallback(() => {
    return Math.round((Date.now() - sessionStartedAtRef.current) / 1000);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    resetSession();
  }, [isOpen, resetSession]);

  useEffect(() => {
    stopTimer();

    if (!isOpen || !isRunning || finished) return;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.floor((now - stepStartedAtRef.current) / 1000));
      setSessionElapsed(Math.floor((now - sessionStartedAtRef.current) / 1000));
    }, 250);

    return stopTimer;
  }, [finished, isOpen, isRunning, stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  return {
    isRunning,
    setIsRunning,
    elapsed,
    sessionElapsed,
    resetSession,
    resetStep,
    pause,
    resume,
    toggle,
    stopTimer,
    getSessionDuration,
  };
}
