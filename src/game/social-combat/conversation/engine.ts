// Conversation engine: choices are real lines, not tactic buttons.
// Two stakes instead of HP — Trust (the person) and Outcome (the problem) —
// plus a memory of what the player said, which later lines and endings check.

export type Tactic = 'empathy' | 'logic' | 'manipulation' | 'aggression' | 'cunning';

export interface Meters { trust: number; outcome: number }

export interface Condition {
  trustGte?: number;
  trustLt?: number;
  outcomeGte?: number;
  outcomeLt?: number;
  has?: string[];
  lacks?: string[];
}

export interface Route { when?: Condition; to: string }

export interface Choice {
  id: string;
  text: string;
  tactic: Tactic;
  effect: Partial<Meters>;
  remember?: string[];
  requires?: Condition;
  /** First matching route wins; the last route should have no `when`. */
  next: Route[];
  /** What this line did to them — shown in the debrief. */
  insight: string;
}

export interface Line {
  /** Lines may vary by what the player has said or how much trust is left. */
  variants: { when?: Condition; text: string }[];
}

export interface Node {
  id: string;
  narration?: string;
  speaker: Line;
  mood: string;
  /** No choices: the conversation is over and an ending is picked. */
  choices: Choice[];
}

export interface Ending {
  id: string;
  title: string;
  body: string;
  when?: Condition;
}

export interface Scene {
  id: string;
  title: string;
  setup: string;
  them: { name: string; icon: string };
  start: string;
  initial: Meters;
  nodes: Record<string, Node>;
  /** First matching ending wins; the last should have no `when`. */
  endings: Ending[];
  /** What they were really feeling, revealed in the debrief. */
  subtext: string;
}

export interface Step {
  nodeId: string;
  theySaid: string;
  choiceId: string;
  youSaid: string;
  before: Meters;
  after: Meters;
}

export interface RunState {
  sceneId: string;
  nodeId: string;
  meters: Meters;
  memory: string[];
  steps: Step[];
  ending: Ending | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const last = <T>(a: T[]): T | undefined => a[a.length - 1];

export function matches(c: Condition | undefined, meters: Meters, memory: string[]): boolean {
  if (!c) return true;
  if (c.trustGte !== undefined && meters.trust < c.trustGte) return false;
  if (c.trustLt !== undefined && meters.trust >= c.trustLt) return false;
  if (c.outcomeGte !== undefined && meters.outcome < c.outcomeGte) return false;
  if (c.outcomeLt !== undefined && meters.outcome >= c.outcomeLt) return false;
  if (c.has && !c.has.every(m => memory.includes(m))) return false;
  if (c.lacks && c.lacks.some(m => memory.includes(m))) return false;
  return true;
}

export function lineFor(line: Line, meters: Meters, memory: string[]): string {
  return line.variants.find(v => matches(v.when, meters, memory))?.text ?? '...';
}

function settle(scene: Scene, state: RunState): RunState {
  const node = scene.nodes[state.nodeId];
  if (node.choices.length > 0) return state;
  const ending = scene.endings.find(e => matches(e.when, state.meters, state.memory)) ?? null;
  return { ...state, ending };
}

export function startRun(scene: Scene): RunState {
  return settle(scene, {
    sceneId: scene.id,
    nodeId: scene.start,
    meters: { ...scene.initial },
    memory: [],
    steps: [],
    ending: null,
  });
}

export function currentNode(scene: Scene, state: RunState): Node {
  return scene.nodes[state.nodeId];
}

export function availableChoices(scene: Scene, state: RunState): Choice[] {
  return currentNode(scene, state).choices.filter(c => matches(c.requires, state.meters, state.memory));
}

export function choose(scene: Scene, state: RunState, choiceId: string): RunState {
  if (state.ending) return state;
  const node = currentNode(scene, state);
  const choice = availableChoices(scene, state).find(c => c.id === choiceId);
  if (!choice) throw new Error(`choice ${choiceId} not available at ${node.id}`);
  const meters = {
    trust: clamp(state.meters.trust + (choice.effect.trust ?? 0)),
    outcome: clamp(state.meters.outcome + (choice.effect.outcome ?? 0)),
  };
  const memory = [...state.memory, ...(choice.remember ?? []).filter(m => !state.memory.includes(m))];
  const route = choice.next.find(r => matches(r.when, meters, memory));
  if (!route) throw new Error(`no route from ${choice.id}`);
  const step: Step = {
    nodeId: node.id,
    theySaid: lineFor(node.speaker, state.meters, state.memory),
    choiceId: choice.id,
    youSaid: choice.text,
    before: state.meters,
    after: meters,
  };
  return settle(scene, { ...state, nodeId: route.to, meters, memory, steps: [...state.steps, step] });
}

export interface Debrief {
  /** The step where trust moved most, either way. */
  turningPoint: { step: Step; insight: string } | null;
  /** The step where a different line would have reached them most. */
  missed: { step: Step; better: Choice; gap: number } | null;
  subtext: string;
}

export function debrief(scene: Scene, state: RunState): Debrief {
  let turning: Debrief['turningPoint'] = null;
  let swing = 0;
  let missed: Debrief['missed'] = null;
  // Replay to know which choices were available at each step.
  let replay = startRun(scene);
  for (const step of state.steps) {
    const options = availableChoices(scene, replay);
    const picked = options.find(c => c.id === step.choiceId)!;
    const delta = Math.abs(step.after.trust - step.before.trust);
    if (delta > swing) { swing = delta; turning = { step, insight: picked.insight }; }
    const best = options.reduce((a, b) => ((b.effect.trust ?? 0) > (a.effect.trust ?? 0) ? b : a));
    const gap = (best.effect.trust ?? 0) - (picked.effect.trust ?? 0);
    if (best.id !== picked.id && gap > (missed?.gap ?? 0)) missed = { step, better: best, gap };
    replay = choose(scene, replay, step.choiceId);
  }
  return { turningPoint: turning, missed, subtext: scene.subtext };
}

/** Structural problems with a scene; empty means it is sound. */
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  if (!scene.nodes[scene.start]) errors.push(`start node ${scene.start} missing`);
  for (const node of Object.values(scene.nodes)) {
    if (last(node.speaker.variants)?.when) errors.push(`${node.id}: last line variant must have no condition`);
    if (node.choices.length > 0 && node.choices.every(c => c.requires)) {
      errors.push(`${node.id}: every choice is conditional, the player can be left with none`);
    }
    for (const c of node.choices) {
      if (last(c.next)?.when) errors.push(`${node.id}/${c.id}: last route must have no condition`);
      for (const r of c.next) if (!scene.nodes[r.to]) errors.push(`${node.id}/${c.id}: unknown node ${r.to}`);
    }
  }
  if (last(scene.endings)?.when) errors.push('last ending must have no condition');
  const seen = new Set<string>();
  const queue = [scene.start];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id) || !scene.nodes[id]) continue;
    seen.add(id);
    for (const c of scene.nodes[id].choices) for (const r of c.next) queue.push(r.to);
  }
  for (const id of Object.keys(scene.nodes)) if (!seen.has(id)) errors.push(`${id}: unreachable`);
  return errors;
}
