import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Check } from 'lucide-react';
import {
  fetchPoll,
  fetchPollResults,
  fetchUserPollVote,
  votePoll,
} from '../../services/communityService';
import type { CommunityPoll, PollVoteResult } from '../../types/community';

interface PollDisplayProps {
  postId: string;
  canVote: boolean;
}

export function PollDisplay({ postId, canVote }: PollDisplayProps) {
  const [poll, setPoll] = useState<CommunityPoll | null>(null);
  const [results, setResults] = useState<PollVoteResult[]>([]);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  const load = useCallback(async () => {
    const p = await fetchPoll(postId);
    if (!p) return;
    setPoll(p);
    const [res, vote] = await Promise.all([
      fetchPollResults(p.id),
      canVote ? fetchUserPollVote(p.id) : Promise.resolve(null),
    ]);
    setResults(res);
    setUserVote(vote);
  }, [postId, canVote]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (optionIndex: number) => {
    if (!poll || userVote !== null || voting || !canVote) return;
    setVoting(true);
    setUserVote(optionIndex);
    const ok = await votePoll(poll.id, optionIndex);
    if (ok) {
      const res = await fetchPollResults(poll.id);
      setResults(res);
    } else {
      setUserVote(null);
    }
    setVoting(false);
  };

  if (!poll) return null;

  const totalVotes = results.reduce((sum, r) => sum + r.vote_count, 0);
  const hasVoted = userVote !== null;
  const expired = poll.expires_at ? new Date(poll.expires_at) < new Date() : false;
  const showResults = hasVoted || expired || !canVote;

  const getCount = (idx: number) =>
    results.find((r) => r.option_index === idx)?.vote_count ?? 0;

  const getPercent = (idx: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((getCount(idx) / totalVotes) * 100);
  };

  return (
    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
        <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
        <span className="text-xs font-bold text-white/60">{poll.question}</span>
        <span className="text-[10px] text-white/30 ml-auto">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {expired && ' · closed'}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {poll.options.map((opt, idx) => {
          const count = getCount(idx);
          const percent = getPercent(idx);
          const isMyVote = userVote === idx;

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={hasVoted || expired || !canVote || voting}
              className={`relative text-left rounded-lg border transition-all overflow-hidden ${
                isMyVote
                  ? 'border-sky-500/30 bg-sky-500/[0.06]'
                  : showResults
                    ? 'border-white/6 bg-white/[0.01]'
                    : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] cursor-pointer'
              } ${(!showResults && canVote && !hasVoted) ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {showResults && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-y-0 left-0 bg-sky-500/[0.08]"
                />
              )}
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  {isMyVote && (
                    <Check className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  )}
                  {opt}
                </span>
                {showResults && (
                  <span className="text-xs tabular-nums text-white/40 font-medium flex-shrink-0 ml-2">
                    {percent}%
                    <span className="text-white/20 ml-1">({count})</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {!showResults && canVote && (
        <div className="px-4 pb-3 text-[10px] text-white/25">
          Click an option to vote. You can change your vote anytime.
        </div>
      )}
    </div>
  );
}
