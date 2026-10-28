import { describe, it, expect } from 'vitest';
import { startRun, choose, availableChoices, debrief, validateScene, type RunState } from '../engine';
import { JAKE } from '../jake';

function allRuns(): RunState[] {
  const done: RunState[] = [];
  const walk = (s: RunState, depth: number) => {
    if (depth > 20) throw new Error(`path too long at ${s.nodeId}`);
    if (s.ending) { done.push(s); return; }
    const options = availableChoices(JAKE, s);
    expect(options.length, `no choices at ${s.nodeId}`).toBeGreaterThan(0);
    for (const c of options) walk(choose(JAKE, s, c.id), depth + 1);
  };
  walk(startRun(JAKE), 0);
  return done;
}

const play = (...ids: string[]) => ids.reduce((s, id) => choose(JAKE, s, id), startRun(JAKE));

describe('Jake conversation', () => {
  it('is structurally sound', () => {
    expect(validateScene(JAKE)).toEqual([]);
  });

  it('every path ends, and every ending is reachable', () => {
    const runs = allRuns();
    const endings = new Set(runs.map(r => r.ending!.id));
    expect([...endings].sort()).toEqual(JAKE.endings.map(e => e.id).sort());
  });

  it('the reveal is earned, not timed', () => {
    const cold = play('open_callout', 'def_grade');
    expect(cold.steps.some(s => s.nodeId === 'reveal')).toBe(false);
    const warm = play('open_ask', 'deflect_stay');
    expect(warm.nodeId).toBe('reveal');
  });

  it('pushing too hard makes him log off', () => {
    const r = play('open_callout', 'def_grade');
    expect(r.nodeId).toBe('logoff');
    expect(r.ending!.id).toBe('logged_off');
  });

  it('he remembers the offer to cover for him', () => {
    const r = play('open_cover', 'task_check');
    expect(r.nodeId).toBe('reveal');
    expect(r.memory).toContain('promised_cover');
  });

  it('getting the work done without asking leaves him one question away', () => {
    const r = play('open_cover', 'task_deadline', 'half_thanks');
    expect(r.ending!.id).toBe('almost');
  });

  it('debrief names the turning point and the line that would have reached him', () => {
    const r = play('open_task', 'task_deadline', 'half_push');
    const d = debrief(JAKE, r);
    expect(d.turningPoint).not.toBeNull();
    expect(d.missed?.better.tactic).toBe('empathy');
    expect(d.subtext).toMatch(/hospital/);
  });
});
