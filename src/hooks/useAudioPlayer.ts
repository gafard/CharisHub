import { useState, useEffect, useRef, useCallback } from 'react';

interface AudioState {
  playing: boolean;
  position: number;
  duration: number;
  ended: boolean;
  error: string | null;
}

export function useAudioPlayer(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const [state, setState] = useState<AudioState>({
    playing: false,
    position: 0,
    duration: 0,
    ended: false,
    error: null,
  });

  const onTimeUpdateRef = useRef<(() => void) | null>(null);
  const onEndedRef = useRef<(() => void) | null>(null);
  const onPlayRef = useRef<(() => void) | null>(null);
  const onPauseRef = useRef<(() => void) | null>(null);

  // Setters for external handlers
  const setHandlers = useCallback((handlers: {
    onTimeUpdate?: () => void;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
  }) => {
    if (handlers.onTimeUpdate) onTimeUpdateRef.current = handlers.onTimeUpdate;
    if (handlers.onEnded) onEndedRef.current = handlers.onEnded;
    if (handlers.onPlay) onPlayRef.current = handlers.onPlay;
    if (handlers.onPause) onPauseRef.current = handlers.onPause;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setState(s => ({ ...s, position: audio.currentTime }));
      onTimeUpdateRef.current?.();
    };

    const handleLoadedMetadata = () => {
      setState(s => ({ ...s, duration: audio.duration }));
    };

    const handlePlay = () => {
      setState(s => ({ ...s, playing: true, ended: false }));
      onPlayRef.current?.();
    };

    const handlePause = () => {
      setState(s => ({ ...s, playing: false }));
      onPauseRef.current?.();
    };

    const handleEnded = () => {
      setState(s => ({ ...s, playing: false, ended: true }));
      onEndedRef.current?.();
    };

    const handleError = () => {
      setState(s => ({ ...s, playing: false, error: 'Audio error' }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioRef]); // Ref is stable, so this effect runs only once

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error('[AudioPlayer] Play failed:', err);
        throw err;
      }
    }
  }, [audioRef]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [audioRef]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, [audioRef]);

  return {
    ...state,
    play,
    pause,
    seek,
    setHandlers,
  };
}
