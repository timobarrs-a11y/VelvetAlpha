import { UNSEEN_ACTS } from '../content/office';
import { poseOf, isWalking, SITTING_POSES, type Agent, type AgentId } from '../state/agents';
import { type PersonFrame } from '../art/houseArt.js';
import { expressionFor } from '../art/poseAnim.js';
import type { Game } from '../kernel/game';
import { SOCIAL_ACTS } from './social';
import { OFFICE_LEVEL, workLook } from '../state/workwear';

export function createFrame(g: Game): Partial<Game> {
  const { people } = g;
  const seeds: Record<AgentId, number> = { jordan: 0.3, maya: 2.1 };
  /** A steady number for anyone who is not one of the two who live here, so a visitor always moves the same way. */
  const seedOf = (id: string): number => seeds[id] ?? ([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) / 9973) * 6;
  function lookTargetOf(p: Agent): [number, number] | null {
    const other = people.find(o => o.id !== p.id);
    if (!other || other.level !== p.level || !p.task || !SOCIAL_ACTS.has(p.task.act)) return null;
    return [other.x, other.y];
  }

  function toFrame(p: Agent): PersonFrame {
    const pose = poseOf(p);
    const leg = p.onStairs && p.task?.route[0]?.type === 'stair' ? p.task.route[0] : null;
    const st = leg?.st;
    return {
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face, pose,
      walking: isWalking(p) || !!leg, sit: SITTING_POSES.has(pose) && p.z > 0.05, hidden: (p.onStairs && !(leg && st?.bottom && st.top)) || !!p.away || (p.task?.phase === 'do' && UNSEEN_ACTS.has(p.task.act)),
      ...(leg && st?.bottom && st.top ? { stair: { s: Math.max(0, Math.min(1, leg.up ? leg.t : 1 - leg.t)), up: leg.up, bx: st.bottom[0], by: st.bottom[1], tx: st.top[0], ty: st.top[1], low: st.lower, high: st.upper } } : {}),
      seed: seedOf(p.id), look: p.level === OFFICE_LEVEL && p.kind !== 'npc' ? workLook(p.look) : p.look,
      ...(p.kind === 'npc' ? { npc: true, name: p.name } : {}),
      ...(p.carrying ? { carrying: p.carrying } : {}),
      ...(p.bubble ? { bubble: p.bubble } : {}),
      act: p.task && p.task.phase === 'do' ? p.task.act : null,
      actMin: p.task && p.task.phase === 'do' ? p.task.time : 0,
      slot: p.task && p.task.phase === 'do' ? p.task.slot?.id ?? null : null,
      expr: expressionFor(p.needs),
      lookAt: lookTargetOf(p),
    };
  }
  return { toFrame };
}
