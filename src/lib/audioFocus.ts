import logger from '@/lib/logger';

export type AudioFocusKind = 'radio' | 'audio' | 'video' | 'bible-audio' | 'call';
export type AudioFocusTarget = 'mobile' | 'desktop' | 'page' | 'any';

export type AudioFocusEntry = {
  id: string;
  kind: AudioFocusKind;
  label: string;
  target?: AudioFocusTarget;
};

export type AudioFocusState = {
  requested: AudioFocusEntry | null;
  active: AudioFocusEntry | null;
  requestId: number;
  error: string | null;
};

type AudioFocusMatch = {
  id?: string;
  kind?: AudioFocusKind;
};

type Listener = (state: AudioFocusState) => void;

const listeners = new Set<Listener>();

let state: AudioFocusState = {
  requested: null,
  active: null,
  requestId: 0,
  error: null,
};

function emit(nextState: AudioFocusState) {
  state = nextState;
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      logger.error('[audioFocus] Erreur dans un listener:', error);
    }
  }
}

function matchesEntry(match: AudioFocusMatch | undefined, entry: AudioFocusEntry | null) {
  if (!match || !entry) return false;
  if (match.id && entry.id !== match.id) return false;
  if (match.kind && entry.kind !== match.kind) return false;
  return true;
}

export function isSameAudioFocusEntry(
  left: AudioFocusEntry | null | undefined,
  right: AudioFocusEntry | null | undefined
) {
  if (!left || !right) return false;
  return left.id === right.id && left.kind === right.kind;
}

export function getAudioFocusClaim(focusState: AudioFocusState = state) {
  return focusState.requested ?? focusState.active;
}

export function isAudioFocusOwnedBy(
  entry: AudioFocusEntry | null | undefined,
  focusState: AudioFocusState = state
) {
  if (!entry) return false;
  return (
    isSameAudioFocusEntry(focusState.requested, entry) ||
    isSameAudioFocusEntry(focusState.active, entry)
  );
}

export function hasConflictingAudioFocus(
  entry: AudioFocusEntry | null | undefined,
  focusState: AudioFocusState = state
) {
  const claim = getAudioFocusClaim(focusState);
  if (!claim || !entry) return false;
  return !isSameAudioFocusEntry(claim, entry);
}

export function getAudioFocusState() {
  return state;
}

export function requestAudioFocus(entry: AudioFocusEntry) {
  const requestId = state.requestId + 1;
  emit({
    ...state,
    requested: entry,
    requestId,
    error: null,
  });
  return requestId;
}

export function confirmAudioFocus(entry: AudioFocusEntry, requestId: number) {
  if (state.requestId !== requestId) return false;
  if (!state.requested) return false;
  if (state.requested.id !== entry.id || state.requested.kind !== entry.kind) return false;

  emit({
    ...state,
    requested: entry,
    active: entry,
    error: null,
  });
  return true;
}

export function failAudioFocus(requestId: number, error: string) {
  if (state.requestId !== requestId) return false;

  const shouldClearActive =
    !!state.active &&
    !!state.requested &&
    state.active.id === state.requested.id &&
    state.active.kind === state.requested.kind;

  emit({
    ...state,
    requested: null,
    active: shouldClearActive ? null : state.active,
    error,
  });
  return true;
}

export function releaseAudioFocus(match?: AudioFocusMatch) {
  const clearRequested = match ? matchesEntry(match, state.requested) : true;
  const clearActive = match ? matchesEntry(match, state.active) : true;

  if (!clearRequested && !clearActive) {
    return state.requestId;
  }

  const requestId = state.requestId + 1;
  emit({
    ...state,
    requested: clearRequested ? null : state.requested,
    active: clearActive ? null : state.active,
    requestId,
    error: null,
  });
  return requestId;
}

export function subscribeAudioFocus(listener: Listener) {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}
