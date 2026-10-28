import { useEffect, useRef, useState } from 'react';
import {
  availableChoices, choose, currentNode, debrief, lineFor, startRun,
  type Scene, type RunState, type Tactic,
} from '../../game/social-combat/conversation/engine';

const TACTIC: Record<Tactic, { label: string; color: string }> = {
  empathy:      { label: 'Empathy',      color: '#60A5FA' },
  logic:        { label: 'Logic',        color: '#34D399' },
  manipulation: { label: 'Manipulation', color: '#A78BFA' },
  aggression:   { label: 'Aggression',   color: '#F87171' },
  cunning:      { label: 'Cunning',      color: '#FBBF24' },
};

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.55)', fontWeight: 700, marginBottom: 4 }}>
        <span>{label.toUpperCase()}</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export function ConversationScene({ scene, onExit }: { scene: Scene; onExit: () => void }) {
  const [run, setRun] = useState<RunState>(() => startRun(scene));
  const [showTags, setShowTags] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);
  const node = currentNode(scene, run);

  useEffect(() => { logEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [run.steps.length]);

  const shell: React.CSSProperties = {
    minHeight: '100vh', background: 'linear-gradient(180deg,#0f0c29,#1a1440 60%,#24243e)',
    color: 'white', fontFamily: 'system-ui, sans-serif', padding: '20px 16px 32px',
  };
  const col: React.CSSProperties = { maxWidth: 640, margin: '0 auto' };

  if (run.ending) {
    const d = debrief(scene, run);
    return (
      <div style={shell}>
        <div style={col}>
          {node.narration && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{node.narration}</p>}
          <p style={{ textAlign: 'center', fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{lineFor(node.speaker, run.meters, run.memory)}</p>
          <h1 style={{ textAlign: 'center', fontSize: 28, fontWeight: 900, margin: '28px 0 8px' }}>{run.ending.title}</h1>
          <p style={{ textAlign: 'center', lineHeight: 1.6, color: 'rgba(255,255,255,0.85)' }}>{run.ending.body}</p>

          <div style={{ marginTop: 28, padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>WHAT HAPPENED</div>
            {d.turningPoint && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#FBBF24', fontWeight: 700, marginBottom: 4 }}>The turning point</div>
                <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.8)' }}>“{d.turningPoint.step.youSaid}”</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{d.turningPoint.insight}</div>
              </div>
            )}
            {d.missed && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#60A5FA', fontWeight: 700, marginBottom: 4 }}>The line that would have reached {scene.them.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>When {scene.them.name} said “{d.missed.step.theySaid}”, you could have said:</div>
                <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>“{d.missed.better.text}”</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 12, color: '#F9A8D4', fontWeight: 700, marginBottom: 4 }}>What {scene.them.name} was really feeling</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)' }}>{d.subtext}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={() => setRun(startRun(scene))} style={btn('#6366F1')}>Try again</button>
            <button onClick={onExit} style={btn('rgba(255,255,255,0.12)')}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  const choices = availableChoices(scene, run);
  return (
    <div style={shell}>
      <div style={col}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={onExit} style={{ ...btn('transparent'), border: '1px solid rgba(255,255,255,0.15)', flex: 'none', padding: '6px 12px', fontSize: 12 }}>← Back</button>
          <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={showTags} onChange={e => setShowTags(e.target.checked)} /> Show tactics
          </label>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
          <Meter label={scene.them.name} value={run.meters.trust} color="linear-gradient(90deg,#F472B6,#A78BFA)" />
          <Meter label="The project" value={run.meters.outcome} color="linear-gradient(90deg,#34D399,#06B6D4)" />
        </div>

        <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, fontSize: 14 }}>{scene.setup}</p>

        {run.steps.map((s, i) => (
          <div key={i} style={{ opacity: 0.6 }}>
            <Bubble who={scene.them.name} text={s.theySaid} />
            <Bubble who="You" text={s.youSaid} mine />
          </div>
        ))}

        <div key={run.steps.length} style={{ animation: 'convFade 0.5s ease' }}>
          {node.narration && <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{node.narration}</p>}
          <Bubble who={`${scene.them.icon} ${scene.them.name} · ${node.mood}`} text={lineFor(node.speaker, run.meters, run.memory)} />
        </div>
        <div ref={logEnd} />

        <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
          {choices.map(c => (
            <button key={c.id} onClick={() => setRun(choose(scene, run, c.id))} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'white', fontSize: 14, lineHeight: 1.5,
            }}>
              {showTags && (
                <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, letterSpacing: 1, color: TACTIC[c.tactic].color, marginRight: 8 }}>
                  {TACTIC[c.tactic].label.toUpperCase()}
                </span>
              )}
              “{c.text}”
            </button>
          ))}
        </div>
      </div>
      <style>{'@keyframes convFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}'}</style>
    </div>
  );
}

function Bubble({ who, text, mine = false }: { who: string; text: string; mine?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', margin: '10px 0' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, marginBottom: 3 }}>{who}</div>
      <div style={{
        maxWidth: '85%', padding: '10px 13px', borderRadius: 12, lineHeight: 1.5, fontSize: 14,
        background: mine ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.08)',
      }}>{text}</div>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: bg, color: 'white', fontWeight: 700, cursor: 'pointer' };
}
