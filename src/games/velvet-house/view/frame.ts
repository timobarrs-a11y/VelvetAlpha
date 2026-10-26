import { poseOf, isWalking, SITTING_POSES, type Agent, type AgentId } from '../state/agents';
import { type PersonFrame } from '../art/houseArt.js';
import { expressionFor } from '../art/poseAnim.js';
import type { Game } from '../kernel/game';
import { SOCIAL_ACTS } from './social';

export function createFrame(g: Game): Partial<Game> {
  const { people } = g;
  const seeds: Record<AgentId, number> = { jordan: 0.3, maya: 2.1 };
  function lookTargetOf(p: Agent): [number, number] | null {
    const other = people.find(o => o.id !== p.id);
    if (!other || other.level !== p.level || !p.task || !SOCIAL_ACTS.has(p.task.act)) return null;
    return [other.x, other.y];
  }

  function toFrame(p: Agent): PersonFrame {
    const pose = poseOf(p);
    return {
      level: p.level, x: p.x, y: p.y, z: p.z, face: p.face, pose,
      walking: isWalking(p), sit: SITTING_POSES.has(pose) && p.z > 0.05, hidden: p.onStairs,
      seed: seeds[p.id], look: p.look,
      act: p.task && p.task.phase === 'do' ? p.task.act : null,
      actMin: p.task && p.task.phase === 'do' ? p.task.time : 0,
      slot: p.task && p.task.phase === 'do' ? p.task.slot?.id ?? null : null,
      expr: expressionFor(p.needs),
      lookAt: lookTargetOf(p),
    };
  }
  return { toFrame };
}
