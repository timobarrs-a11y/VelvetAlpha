import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Eye, FastForward, Trophy } from 'lucide-react';
import { buildCourse, type Level, type Spot } from '../engine';
import { cut, pickField, scoreAt, seeded, simulateRival, tiebreakCourse, TIEBREAK_CLOCK, type Rival, type RivalRun } from '../rivals';
import { RunView, type Hud } from './RunView';

// The contest: you against five AI shooters. Round 1, top three advance; the
// final shoots in reverse order of round-1 scores, so the leader goes last
// knowing the number. Ties on the cut line or for the title go to a
// 30-second shoot-off. Rival runs are simulated up front, so you can watch
// them live in 3D or skip to the result and get the same score.

type Stage = 'round1' | 'cut-tb' | 'final' | 'final-tb';

interface Entrant { id: string; name: string; short: string; you?: boolean; rival?: Rival; color: string; moneyRack: number }
interface Slot { id: string; score: number | null; run?: RivalRun }

export interface ContestResult { won: boolean; place: number; round1: number; final: number | null; level: Level }

const STAGE_TITLE: Record<Stage, string> = {
  round1: 'Round 1 · Top 3 advance',
  'cut-tb': 'Shoot-off · 30 seconds',
  final: 'Championship round',
  'final-tb': 'Title shoot-off · 30 seconds',
};

export function Contest({ level, moneyRack, onExit, onFinish }: {
  level: Level; moneyRack: number; onExit: () => void; onFinish: (r: ContestResult) => void;
}) {
  const seed = useRef(Date.now() >>> 0);
  const field = useMemo<Entrant[]>(() => {
    const rivals = pickField(seeded(seed.current));
    const you: Entrant = { id: 'you', name: 'You', short: 'YOU', you: true, color: '#F5C451', moneyRack };
    const them = rivals.map<Entrant>(r => ({ id: r.id, name: r.name, short: (r.name.match(/"(.+)"/)?.[1] ?? r.name.split(' ').pop()!).toUpperCase(), rival: r, color: r.colors[0], moneyRack: r.number % 5 }));
    // You shoot third in round 1: two scores to chase, three still to come.
    return [them[0], them[1], you, them[2], them[3], them[4]];
  }, [moneyRack]);
  const byId = useMemo(() => Object.fromEntries(field.map(e => [e.id, e])), [field]);

  const [stage, setStage] = useState<Stage>('round1');
  const [stageNo, setStageNo] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [turn, setTurn] = useState(0);
  const [view, setView] = useState<'board' | 'run' | 'watch' | 'done'>('board');
  const [round1, setRound1] = useState<Record<string, number>>({});
  const [finalScores, setFinalScores] = useState<Record<string, number>>({});
  const [revealing, setRevealing] = useState<{ id: string; shown: number } | null>(null);
  const [spots, setSpots] = useState(3);
  const [banner, setBanner] = useState<string | null>(null);
  const [champion, setChampion] = useState<{ winner: string; places: string[] } | null>(null);
  const finalistsRef = useRef<string[]>([]);
  const revealTimer = useRef<ReturnType<typeof setInterval>>();

  const stageCourse = (e: Entrant): Spot[] => (stage === 'cut-tb' || stage === 'final-tb' ? tiebreakCourse(e.moneyRack) : buildCourse(e.moneyRack));
  const stageClock = stage === 'cut-tb' || stage === 'final-tb' ? TIEBREAK_CLOCK : level.clock;

  /** Set up a stage: who shoots, in what order, with every rival's run simulated now. */
  const startStage = (st: Stage, ids: string[], places: number, n: number) => {
    const rand = seeded(seed.current + n * 7919);
    const tb = st === 'cut-tb' || st === 'final-tb';
    setStage(st); setStageNo(n); setTurn(0); setSpots(places); setView('board'); setRevealing(null);
    setSlots(ids.map(id => {
      const e = byId[id];
      if (!e.rival) return { id, score: null };
      const course = tb ? tiebreakCourse(e.moneyRack) : buildCourse(e.moneyRack);
      return { id, score: null, run: simulateRival(e.rival, level, course, tb ? TIEBREAK_CLOCK : level.clock, rand) };
    }));
  };

  // Round 1 on mount.
  useEffect(() => {
    startStage('round1', field.map(e => e.id), 3, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = slots[turn];
  const shooter = current ? byId[current.id] : null;
  const known = slots.filter(s => s.score != null) as Array<Slot & { score: number }>;

  const record = (id: string, score: number) => {
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, score } : s)));
    setTurn(t => t + 1);
    setView('board');
  };

  // Count a simulated rival's score up on the board.
  const sim = (slot: Slot) => {
    if (!slot.run) return;
    const target = slot.run.score;
    setRevealing({ id: slot.id, shown: 0 });
    let shown = 0;
    const step = Math.max(1, Math.round(target / 14));
    revealTimer.current = setInterval(() => {
      shown = Math.min(target, shown + step);
      setRevealing({ id: slot.id, shown });
      if (shown >= target) {
        clearInterval(revealTimer.current);
        revealTimer.current = setTimeout(() => { setRevealing(null); record(slot.id, target); }, 450);
      }
    }, 70);
  };
  // Quitting mid-reveal stops the count.
  useEffect(() => () => { clearInterval(revealTimer.current); clearTimeout(revealTimer.current); }, []);

  // When everyone in a stage has shot, decide what happens next.
  useEffect(() => {
    if (!slots.length || turn < slots.length || view !== 'board') return;
    const rows = slots.map(s => ({ id: s.id, score: s.score ?? 0 }));
    const t = setTimeout(() => {
      if (stage === 'round1' || stage === 'cut-tb') {
        if (stage === 'round1') setRound1(Object.fromEntries(rows.map(r => [r.id, r.score])));
        const { through, tied } = cut(rows, spots);
        const advancing = stage === 'round1' ? through.map(r => r.id) : [...finalistsRef.current, ...through.map(r => r.id)];
        if (tied.length) {
          finalistsRef.current = advancing;
          setBanner(`Tie on the cut line at ${tied[0].score}! ${tied.length} shooters, ${spots - through.length} spot${spots - through.length > 1 ? 's' : ''}.`);
          startStage('cut-tb', tied.map(r => r.id), spots - through.length, stageNo + 1);
          return;
        }
        finalistsRef.current = advancing;
        const r1 = stage === 'round1' ? Object.fromEntries(rows.map(r => [r.id, r.score])) : round1;
        // Final order: lowest round-1 score shoots first, the leader last.
        const order = [...advancing].sort((a, b) => (r1[a] ?? 0) - (r1[b] ?? 0));
        setBanner(advancing.includes('you') ? "You're in the final!" : 'Eliminated in round 1.');
        if (!advancing.includes('you')) {
          // The final still happens without you: simulate it to crown a champion.
          const rand = seeded(seed.current + 99991);
          const finals = Object.fromEntries(advancing.map(id => {
            const e = byId[id];
            return [id, simulateRival(e.rival!, level, buildCourse(e.moneyRack), level.clock, rand).score + rand() * 0.01];
          }));
          const winner = [...advancing].sort((a, b) => finals[b] - finals[a])[0];
          finishContest(false, r1, Object.fromEntries(Object.entries(finals).map(([k, v]) => [k, Math.floor(v)])), winner);
          return;
        }
        startStage('final', order, 1, stageNo + 1);
      } else {
        if (stage === 'final') setFinalScores(Object.fromEntries(rows.map(r => [r.id, r.score])));
        const { tied } = cut(rows, 1);
        if (tied.length) {
          setBanner(`Tied at ${tied[0].score} for the title! Shoot-off.`);
          startStage('final-tb', tied.map(r => r.id), 1, stageNo + 1);
          return;
        }
        const finals = stage === 'final' ? Object.fromEntries(rows.map(r => [r.id, r.score])) : finalScores;
        const winner = [...rows].sort((a, b) => b.score - a.score)[0].id;
        finishContest(winner === 'you', round1, finals, winner);
      }
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, slots, view]);


  const finishContest = (won: boolean, r1: Record<string, number>, finals: Record<string, number>, winner: string) => {
    // Places: the finalists by final score (the shoot-off winner first), then everyone else by round 1.
    const fin = [...finalistsRef.current].sort((a, b) => (a === winner ? -1 : b === winner ? 1 : (finals[b] ?? 0) - (finals[a] ?? 0)));
    const rest = field.map(e => e.id).filter(id => !fin.includes(id)).sort((a, b) => (r1[b] ?? 0) - (r1[a] ?? 0));
    const places = [...fin, ...rest];
    setFinalScores(finals);
    setChampion({ winner, places });
    setView('done');
    onFinish({ won, place: places.indexOf('you') + 1, round1: r1.you ?? 0, final: finals.you ?? null, level });
  };

  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 3200); return () => clearTimeout(t); }, [banner]);

  // ---- The number to beat, and how you're pacing against it --------------
  const leaderOf = (rows: typeof known) => [...rows].sort((a, b) => b.score - a.score)[0];
  const tickerFor = (who: Entrant) => (h: Hud) => {
    const others = known.filter(s => s.id !== who.id);
    if (who.you) {
      // Your run: the score that gets you through (cut line) or wins it.
      const sorted = [...others].sort((a, b) => b.score - a.score);
      const line = sorted[spots - 1];
      if (!sorted.length) return <Ticker title={STAGE_TITLE[stage]} lines={[['YOU', `${h.score}`]]} />;
      if (!line) {
        // Not enough scores in to know the cut: chase the leader.
        const lead = sorted[0], ghost = lead.run ? scoreAt(lead.run, h.elapsed) : null;
        return <Ticker title={`${STAGE_TITLE[stage]}`} lines={[[`${byId[lead.id].short} LEADS`, `${lead.score}`], ['YOU', `${h.score}`]]} pace={ghost != null ? h.score - ghost : null} paceLabel={byId[lead.id].short} />;
      }
      const need = line.score + 1;
      const ghost = line.run ? scoreAt(line.run, h.elapsed) : null;
      const pace = ghost != null ? h.score - ghost : null;
      return (
        <Ticker
          title={spots === 1 ? `To win: beat ${byId[line.id].short}` : `Cut line: ${byId[line.id].short}`}
          lines={[[spots === 1 ? 'TO WIN' : 'TO ADVANCE', `${need}`], ['YOU', `${h.score}`]]}
          pace={pace}
          paceLabel={byId[line.id].short}
        />
      );
    }
    // A rival shooting: what they need to pass the leader (you, if you've shot).
    const you = others.find(s => s.id === 'you');
    const lead = you ?? leaderOf(others);
    if (!lead) return <Ticker title={STAGE_TITLE[stage]} lines={[[who.short, `${h.score}`]]} />;
    const need = lead.score + 1;
    const left = Math.max(0, need - h.score);
    return (
      <Ticker
        title={`${who.short} needs ${need} to pass ${lead.id === 'you' ? 'you' : byId[lead.id].short}`}
        lines={[[who.short, `${h.score}`], [left > 0 ? 'STILL NEEDS' : 'PASSED!', left > 0 ? `${left}` : '✓']]}
        danger={left <= 3}
      />
    );
  };

  // ---- Views ---------------------------------------------------------------
  if ((view === 'run' || view === 'watch') && shooter && current) {
    const tb = stage === 'cut-tb' || stage === 'final-tb';
    return (
      <RunView
        key={`${stageNo}-${turn}`}
        level={level}
        moneyRack={shooter.moneyRack}
        label={shooter.you ? `${level.name}${tb ? ' · SHOOT-OFF' : ''}` : shooter.short}
        rivalName={shooter.you ? undefined : shooter.name}
        opts={{
          course: stageCourse(shooter),
          clock: stageClock,
          auto: shooter.you ? undefined : current.run,
          speed: 1.35,
          scoring: 'contest',
          jersey: shooter.rival ? { colors: shooter.rival.colors, number: shooter.rival.number } : undefined,
        }}
        ticker={tickerFor(shooter)}
        onDone={r => record(current.id, shooter.you ? r.score : current.run!.score)}
      />
    );
  }

  const sorted = [...slots].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const done = view === 'done' && champion;
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1a3e,#05060C_70%)] px-4 py-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <style>{CONTEST_CSS}</style>
      <button type="button" onClick={onExit} className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm" style={{ marginTop: 'env(safe-area-inset-top)' }}><ArrowLeft className="h-4 w-4" />Quit</button>
      <div className="mt-8 text-center sm:mt-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.35em] text-amber-300">{level.name} · Velvet 3PT Contest</div>
        <h2 className="mt-1 text-3xl font-black italic tracking-tight sm:text-4xl">{done ? (champion.winner === 'you' ? 'CHAMPION!' : 'FINAL STANDINGS') : STAGE_TITLE[stage].toUpperCase()}</h2>
      </div>

      {banner && <div className="ct-pop mt-3 skew-x-[-8deg] bg-gradient-to-r from-amber-300 to-orange-500 px-4 py-1 text-sm font-black italic text-[#1d1300]">{banner}</div>}

      {done ? (
        <div className="mt-5 w-full max-w-md">
          {champion.winner === 'you' && <div className="ct-pop mb-4 flex justify-center"><Trophy className="h-20 w-20 text-amber-300 drop-shadow-[0_0_30px_rgba(251,191,36,.6)]" /></div>}
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {champion.places.map((id, i) => {
              const e = byId[id];
              return (
                <div key={id} className={`flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0 ${e.you ? 'bg-amber-300/15' : ''}`}>
                  <span className={`w-6 text-center font-mono text-lg font-black ${i === 0 ? 'text-amber-300' : 'text-white/60'}`}>{i + 1}</span>
                  <span className="h-6 w-1.5 rounded-full" style={{ background: e.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{e.name}</span>
                  <span className="font-mono text-xs text-white/50">R1 {round1[id] ?? '–'}</span>
                  <span className="w-10 text-right font-mono text-lg font-black">{finalScores[id] ?? ''}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={onExit} className="rounded-xl bg-white/10 px-5 py-2.5 font-semibold">Done</button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-5 w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-black/40">
            {sorted.map((s, i) => {
              const e = byId[s.id];
              const up = current?.id === s.id;
              const shown = revealing?.id === s.id ? revealing.shown : s.score;
              return (
                <div key={s.id}>
                  <div className={`ct-row flex items-center gap-3 px-3 py-2.5 ${e.you ? 'bg-amber-300/10' : ''} ${up ? 'ring-1 ring-inset ring-amber-300/70' : ''}`}>
                    <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{e.name}</span>
                      <span className="block truncate text-[11px] text-white/45">{e.you ? (stage === 'final' && round1.you != null ? `Round 1: ${round1.you}` : 'Hold, rise, let go on the green') : `${e.rival!.tag}${stage === 'final' && round1[s.id] != null ? ` · R1 ${round1[s.id]}` : ''}`}</span>
                    </span>
                    {up && shown == null && <span className="ct-blink rounded bg-amber-300 px-1.5 py-0.5 text-[10px] font-black text-black">UP</span>}
                    <span className={`w-10 text-right font-mono text-2xl font-black ${revealing?.id === s.id ? 'text-amber-300' : ''}`}>{shown ?? '–'}</span>
                  </div>
                  {i === spots - 1 && sorted.length > spots && <div className="relative border-t border-dashed border-rose-400/70"><span className="absolute -top-2 right-2 bg-[#120a18] px-1 text-[9px] font-black tracking-widest text-rose-300">{spots === 1 ? 'WINNER' : 'CUT'}</span></div>}
                </div>
              );
            })}
          </div>

          {shooter && !revealing && (
            <div className="mt-5 flex w-full max-w-md flex-col items-center gap-2">
              {shooter.you ? (
                <>
                  <div className="text-sm text-white/70">{yourBrief(known, spots, byId)}</div>
                  <button type="button" onClick={() => setView('run')} className="mt-1 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-10 py-3 text-lg font-black text-[#1d1a10] shadow-[0_10px_40px_rgba(251,191,36,.35)] transition hover:scale-[1.03]">
                    YOU'RE UP · SHOOT
                  </button>
                </>
              ) : (
                <>
                  <div className="text-sm text-white/70"><span className="font-bold text-white">{shooter.name}</span> is up</div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setView('watch')} className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 font-black ${watchMatters(known, stage) ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-white/15'}`}><Eye className="h-4 w-4" />Watch live</button>
                    <button type="button" onClick={() => current && sim(current)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-5 py-2.5 font-semibold"><FastForward className="h-4 w-4" />Result</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Watching matters once you've posted a score they can beat. */
function watchMatters(known: Array<{ id: string }>, stage: Stage): boolean {
  return stage !== 'round1' && known.some(s => s.id === 'you');
}

function yourBrief(known: Array<{ id: string; score: number }>, spots: number, byId: Record<string, { short: string }>): string {
  const sorted = [...known].sort((a, b) => b.score - a.score);
  if (!sorted.length) return 'You shoot first. Set the bar.';
  const line = sorted[spots - 1];
  if (spots === 1) return `${byId[sorted[0].id].short} leads with ${sorted[0].score}. ${sorted[0].score + 1} wins it.`;
  if (!line) return `Top ${spots} go through. ${byId[sorted[0].id].short} leads with ${sorted[0].score}.`;
  return `Top ${spots} go through. Beat ${line.score} to be safe.`;
}

function Ticker({ title, lines, pace, paceLabel, danger }: { title: string; lines: Array<[string, string]>; pace?: number | null; paceLabel?: string; danger?: boolean }) {
  return (
    <div className="w-[min(220px,52vw)] overflow-hidden rounded-md border border-white/10 bg-black/70 shadow-xl backdrop-blur">
      <div className={`px-2.5 py-1 text-[10px] font-black uppercase italic tracking-wider ${danger ? 'bg-rose-600' : 'bg-gradient-to-r from-[#7a1f4f] to-[#3d0d27]'}`}>{title}</div>
      <div className="flex divide-x divide-white/10">
        {lines.map(([k, v]) => (
          <div key={k} className="flex-1 px-2 py-1 text-center">
            <div className="text-[8px] font-bold tracking-widest text-white/50">{k}</div>
            <div className="font-mono text-lg font-black leading-tight">{v}</div>
          </div>
        ))}
      </div>
      {pace != null && (
        <div className={`px-2.5 py-0.5 text-center text-[10px] font-black tracking-wider ${pace > 0 ? 'bg-emerald-500/80' : pace < 0 ? 'bg-rose-600/80' : 'bg-white/15'}`}>
          {pace > 0 ? `+${pace} AHEAD OF ${paceLabel}'S PACE` : pace < 0 ? `${pace} BEHIND ${paceLabel}'S PACE` : `LEVEL WITH ${paceLabel}`}
        </div>
      )}
    </div>
  );
}

const CONTEST_CSS = `
@keyframes ct-pop { 0% { transform: scale(.6) skewX(-8deg); opacity: 0; } 60% { transform: scale(1.06) skewX(-8deg); opacity: 1; } 100% { transform: scale(1) skewX(-8deg); } }
@keyframes ct-row { from { transform: translateX(-12px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ct-blink { 50% { opacity: .35; } }
.ct-pop { animation: ct-pop .45s cubic-bezier(.2,.9,.2,1) both; }
.ct-row { animation: ct-row .35s ease-out both; }
.ct-blink { animation: ct-blink 1s steps(2) infinite; }
`;
