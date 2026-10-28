// Notes: what a coach or assistant uncovers with someone on the way to a goal, kept where it can be found again.
// After a helper's reply, `captureGoalNote` decides whether it contained real, reusable information tied to one of
// the person's goals (what a filing needs, the steps and fees, a deadline, where to apply) and, if so, saves a short
// review of it. Everything here that doesn't touch the network is pure, so it is tested on its own.

export const NOTE_MIN_REPLY_CHARS = 350;
const DAILY_NOTE_CAP = 30;

export interface NoteGoal { id: string; title: string }
export interface NoteTask { id: string; description: string; goalId: string | null }
export interface NoteContext { goals: NoteGoal[]; tasks: NoteTask[]; recentTitles: string[] }

export interface NoteDraft {
  title: string;
  summary: string;
  keyPoints: string[];
  nextStep: string | null;
  goalId: string;
  commitmentId: string | null;
}

const INFO_WORDS = /\b(steps?|requirements?|required|requires?|fees?|costs?|deadlines?|forms?|apply|application|submit|file|filing|register|registration|licen[cs]e|permit|documents?|paperwork|bring|before you|resources?|website|office|contact|eligible|eligibility|timeline|within \d+)\b/gi;

/** A cheap check first, so most replies (greetings, encouragement, questions back) never cost a model call. */
export function worthConsidering(assistantMessage: string): boolean {
  const reply = assistantMessage.trim();
  if (reply.length < NOTE_MIN_REPLY_CHARS) return false;
  if (reply.endsWith('?') && reply.length < 700) return false;
  const listLines = reply.split('\n').filter(l => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length;
  const keywordHits = new Set((reply.match(INFO_WORDS) ?? []).map(w => w.toLowerCase())).size;
  const hasNumbers = /\d/.test(reply);
  return listLines >= 2 || keywordHits >= 3 || (keywordHits >= 2 && hasNumbers);
}

export function buildNotePrompt(ctx: NoteContext, userMessage: string, assistantMessage: string): { system: string; user: string } {
  const goals = ctx.goals.map(g => `- ${g.id}: ${g.title}`).join('\n');
  const tasks = ctx.tasks.length ? ctx.tasks.map(t => `- ${t.id}: ${t.description}`).join('\n') : '(none)';
  const recent = ctx.recentTitles.length ? ctx.recentTitles.map(t => `- ${t}`).join('\n') : '(none)';
  const system = `You keep notes for a person working toward goals with a coach or assistant. After each reply you decide whether it gave SUPPLEMENTAL INFORMATION worth saving: concrete, reusable facts or steps that move one of their goals forward, such as requirements, steps in order, costs and fees, deadlines, forms, who to contact, where to apply, or a comparison that settles a choice.

Do NOT save: greetings, encouragement, check-ins, restating their plan, general opinions or advice with no specifics, a question back to them, or anything not tied to one of their goals. Do NOT save something a note below already covers.

Their goals:
${goals}

Their open tasks:
${tasks}

Notes already saved (titles):
${recent}

Return ONLY a JSON object, no commentary:
{"save": true or false, "title": "specific, under 70 characters, e.g. Trademark filing: what the USPTO needs", "summary": "2 to 4 sentences reviewing what was uncovered, written plainly; you may **bold** the single most important phrase", "keyPoints": ["3 to 7 short, concrete items: steps, numbers, names, dates"], "nextStep": "the one thing to do next, or null", "goalId": "one of the goal ids above", "taskId": "one of the open task ids this is for, or null"}
Use only what the reply actually said. Never invent a fee, date, name or step. If it is not worth saving, return {"save": false}.`;
  const user = `The person said:\n"""\n${userMessage.slice(0, 1500)}\n"""\n\nTheir coach or assistant replied:\n"""\n${assistantMessage.slice(0, 5000)}\n"""`;
  return { system, user };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** The note the model wrote, checked against what it was allowed to choose from; null if it isn't worth keeping. */
export function parseNoteReply(raw: string | null, ctx: NoteContext): NoteDraft | null {
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj: Record<string, unknown>;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (obj.save !== true) return null;

  const title = clean(obj.title, 90);
  const summary = clean(obj.summary, 900);
  const keyPoints = Array.isArray(obj.keyPoints)
    ? obj.keyPoints.map(p => clean(p, 200)).filter(Boolean).slice(0, 7)
    : [];
  if (title.length < 3 || summary.length < 10 || keyPoints.length === 0) return null;

  // A note belongs to a goal: the one the model named, or the only one they have.
  const named = typeof obj.goalId === 'string' ? ctx.goals.find(g => g.id === obj.goalId) : undefined;
  const goal = named ?? (ctx.goals.length === 1 ? ctx.goals[0] : undefined);
  if (!goal) return null;

  const task = typeof obj.taskId === 'string' ? ctx.tasks.find(t => t.id === obj.taskId) : undefined;
  const nextStep = clean(obj.nextStep, 300) || null;

  if (ctx.recentTitles.some(t => normalize(t) === normalize(title))) return null;
  return { title, summary, keyPoints, nextStep, goalId: goal.id, commitmentId: task?.id ?? null };
}

// deno-lint-ignore no-explicit-any
type Db = any;

export interface CaptureDeps {
  admin: Db;
  anthropicKey: string;
  model: string;
  userId: string;
  companionId: string;
  userMessage: string;
  assistantMessage: string;
  /** For tests: stands in for the model call. */
  callModel?: (system: string, user: string) => Promise<string | null>;
}

async function callAnthropic(key: string, model: string, system: string, user: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 700, temperature: 0.2, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type?: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  return text || null;
}

/** Saves a note if the reply earned one. Returns what happened, for the logs. */
export async function captureGoalNote(d: CaptureDeps): Promise<'saved' | 'not-worth-a-call' | 'no-goal' | 'capped' | 'not-a-note'> {
  if (!worthConsidering(d.assistantMessage)) return 'not-worth-a-call';

  const { data: goalRows } = await d.admin
    .from('user_goals')
    .select('id, title, source_companion_id')
    .eq('user_id', d.userId)
    .eq('status', 'active')
    .limit(8);
  const goals: NoteGoal[] = ((goalRows ?? []) as Array<{ id: string; title: string; source_companion_id: string | null }>)
    // The goal this helper carries comes first.
    .sort((a, b) => Number(b.source_companion_id === d.companionId) - Number(a.source_companion_id === d.companionId))
    .map(g => ({ id: g.id, title: g.title }));
  if (goals.length === 0) return 'no-goal';

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await d.admin.from('goal_notes').select('id', { count: 'exact', head: true }).eq('user_id', d.userId).gte('created_at', since);
  if ((count ?? 0) >= DAILY_NOTE_CAP) return 'capped';

  const [{ data: taskRows }, { data: recentRows }] = await Promise.all([
    d.admin.from('coaching_commitments').select('id, description, goal_id').eq('user_id', d.userId).in('status', ['pending', 'in_progress', 'missed']).limit(15),
    d.admin.from('goal_notes').select('title').eq('user_id', d.userId).order('created_at', { ascending: false }).limit(10),
  ]);
  const ctx: NoteContext = {
    goals,
    tasks: ((taskRows ?? []) as Array<{ id: string; description: string; goal_id: string | null }>).map(t => ({ id: t.id, description: t.description, goalId: t.goal_id })),
    recentTitles: ((recentRows ?? []) as Array<{ title: string }>).map(r => r.title),
  };

  const { system, user } = buildNotePrompt(ctx, d.userMessage, d.assistantMessage);
  const raw = d.callModel ? await d.callModel(system, user) : await callAnthropic(d.anthropicKey, d.model, system, user);
  const note = parseNoteReply(raw, ctx);
  if (!note) return 'not-a-note';

  const { error } = await d.admin.from('goal_notes').insert({
    user_id: d.userId,
    goal_id: note.goalId,
    companion_id: d.companionId,
    commitment_id: note.commitmentId,
    title: note.title,
    summary: note.summary,
    key_points: note.keyPoints,
    next_step: note.nextStep,
  });
  if (error) throw error;
  return 'saved';
}
