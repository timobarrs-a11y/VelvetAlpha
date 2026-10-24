import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGameChannel } from './friendGameChannel';

type Pick = 'rock' | 'paper' | 'scissors';
const ICON: Record<Pick, string> = { rock: '✊', paper: '✋', scissors: '✌️' };
const BEATS: Record<Pick, Pick> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

/**
 * Rock Paper Scissors with a friend. Each side only announces that it locked
 * in; picks are revealed once both have locked, so nobody sees yours early.
 */
export function FriendRps({ conversationId, peerName }: { conversationId: string; peerName: string }) {
  const [round, setRound] = useState(0);
  const [mine, setMine] = useState<Pick | null>(null);
  const [peerLocked, setPeerLocked] = useState(false);
  const [theirs, setTheirs] = useState<Pick | null>(null);
  const [score, setScore] = useState({ me: 0, them: 0 });

  const startRound = (r: number) => {
    setRound(r);
    setMine(null);
    setTheirs(null);
    setPeerLocked(false);
  };

  const send = useGameChannel(`rps-${conversationId}`, {
    lock: (p: { round: number }) => {
      if (p.round !== round) return;
      setPeerLocked(true);
      if (mine) send('reveal', { round, pick: mine });
    },
    reveal: (p: { round: number; pick: Pick }) => {
      if (p.round !== round || theirs) return;
      setTheirs(p.pick);
      if (mine) tally(mine, p.pick);
    },
    next: (p: { round: number }) => { if (p.round > round) startRound(p.round); },
    hello: () => send('sync', { round }),
    sync: (p: { round: number }) => { if (p.round > round) startRound(p.round); },
  }, (s) => s('hello', {}));

  const tally = (me: Pick, them: Pick) => {
    if (me === them) return;
    setScore(sc => (BEATS[me] === them ? { ...sc, me: sc.me + 1 } : { ...sc, them: sc.them + 1 }));
  };

  const pick = (p: Pick) => {
    if (mine) return;
    setMine(p);
    send('lock', { round });
    if (peerLocked) send('reveal', { round, pick: p });
  };

  const result = mine && theirs
    ? mine === theirs ? "It's a tie!" : BEATS[mine] === theirs ? 'You win! 🎉' : `${peerName} wins`
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-4 text-center">
      <p className="text-xs text-white/60">You <span className="font-bold text-amber-300">{score.me}</span> · <span className="font-bold text-amber-300">{score.them}</span> {peerName}</p>

      <div className="flex w-full items-center justify-around">
        <div>
          <p className="mb-1 text-[11px] text-white/50">You</p>
          <motion.div key={`me-${mine}`} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="text-5xl">{mine ? ICON[mine] : '❔'}</motion.div>
        </div>
        <span className="text-sm font-bold text-white/40">vs</span>
        <div>
          <p className="mb-1 text-[11px] text-white/50">{peerName}</p>
          <motion.div
            key={`them-${theirs}-${peerLocked}`}
            initial={{ scale: 0.6 }}
            animate={theirs ? { scale: 1 } : peerLocked ? { rotate: [0, -12, 12, 0] } : { scale: 1 }}
            transition={peerLocked && !theirs ? { repeat: Infinity, duration: 0.6 } : undefined}
            className="text-5xl"
          >
            {theirs ? ICON[theirs] : peerLocked ? '🔒' : '🤔'}
          </motion.div>
        </div>
      </div>

      <p className="h-5 text-sm font-semibold text-amber-200">
        {result ?? (mine ? (peerLocked ? 'Revealing…' : `Waiting for ${peerName}…`) : peerLocked ? `${peerName} is locked in. Your pick!` : 'Pick one')}
      </p>

      {!result ? (
        <div className="flex gap-3">
          {(Object.keys(ICON) as Pick[]).map(p => (
            <button
              key={p}
              type="button"
              disabled={!!mine}
              onClick={() => pick(p)}
              className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-3xl transition ${
                mine === p ? 'border-amber-300 bg-amber-300/20' : 'border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-40'
              }`}
              aria-label={p}
              title={p}
            >
              {ICON[p]}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { const r = round + 1; startRound(r); send('next', { round: r }); }}
          className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-[#1d1a10]"
        >
          Play again
        </button>
      )}
    </div>
  );
}
