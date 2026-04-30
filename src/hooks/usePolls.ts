import { useState, useCallback } from 'react';

export type Poll = {
  id: string;
  question: string;
  options: string[];
  votes: Map<number, string[]>;
  closed: boolean;
};

export function usePolls(deviceId: string, sendBroadcast: (event: string, payload: any) => Promise<void>) {
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollDraftQuestion, setPollDraftQuestion] = useState('');
  const [pollDraftOptions, setPollDraftOptions] = useState(['', '']);

  const createPoll = useCallback(() => {
    const question = pollDraftQuestion.trim();
    const options = pollDraftOptions.filter(o => o.trim());
    
    if (!question || options.length < 2) return;

    const poll: Poll = {
      id: `poll_${Math.random().toString(36).slice(2, 11)}`,
      question,
      options,
      votes: new Map<number, string[]>(),
      closed: false,
    };

    setActivePoll(poll);
    setShowPollCreator(false);
    setPollDraftQuestion('');
    setPollDraftOptions(['', '']);

    void sendBroadcast('poll.created', { poll });
  }, [pollDraftQuestion, pollDraftOptions, sendBroadcast]);

  const votePoll = useCallback((optionIndex: number) => {
    if (!activePoll || activePoll.closed) return;

    setActivePoll((prev) => {
      if (!prev) return null;
      const newVotes = new Map(prev.votes);
      
      // Remove old vote if exists across all options
      newVotes.forEach((voters, idx) => {
        const filtered = voters.filter(v => v !== deviceId);
        if (filtered.length > 0) newVotes.set(idx, filtered);
        else newVotes.delete(idx);
      });
      
      const existingVoters = newVotes.get(optionIndex) || [];
      newVotes.set(optionIndex, [...existingVoters, deviceId]);
      
      return { ...prev, votes: newVotes };
    });

    void sendBroadcast('poll.voted', { pollId: activePoll.id, optionIndex, voterId: deviceId });
  }, [activePoll, deviceId, sendBroadcast]);

  const closePoll = useCallback(() => {
    if (!activePoll) return;
    setActivePoll((prev) => prev ? { ...prev, closed: true } : null);
    void sendBroadcast('poll.closed', { pollId: activePoll.id });
  }, [activePoll, sendBroadcast]);

  return {
    activePoll,
    setActivePoll,
    showPollCreator,
    setShowPollCreator,
    pollDraftQuestion,
    setPollDraftQuestion,
    pollDraftOptions,
    setPollDraftOptions,
    createPoll,
    votePoll,
    closePoll
  };
}
