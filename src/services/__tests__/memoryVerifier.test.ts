import { describe, it, expect, vi } from 'vitest';
import {
  verifierMode, normalizeVerdict, verifyMemory, parsePgVector, relatednessCosine, isProtectedRow, isExplicitCorrection,
  decideRevision, wouldHave, DEFAULT_T_RELATED, type RevisionInput,
} from '../../../supabase/functions/_shared/memoryVerifier';

const MSG = 'I never wrote the series, I am just reading it';
const base: RevisionInput = { verdict: 'contradicts', confidence: 0.95, cosine: 0.7, protectedRow: false, explicit: false };
const now = new Date('2026-10-27T12:00:00Z');

describe('verifierMode', () => {
  it('defaults to off, so nothing changes until the flag is set', () => {
    expect(verifierMode(undefined)).toBe('off');
    expect(verifierMode('')).toBe('off');
    expect(verifierMode('banana')).toBe('off');
  });
  it('accepts shadow and enforce in any case', () => {
    expect(verifierMode('Shadow')).toBe('shadow');
    expect(verifierMode(' ENFORCE ')).toBe('enforce');
  });
});

describe('normalizeVerdict', () => {
  it('keeps a contradicts verdict whose quote is in the message', () => {
    const v = normalizeVerdict({ verdict: 'contradicts', quote: 'I am just reading it', confidence: 0.9 }, MSG);
    expect(v.verdict).toBe('contradicts');
    expect(v.quote).toBe('I am just reading it');
  });
  it('downgrades a contradicts whose quote is not in the message to unrelated', () => {
    const v = normalizeVerdict({ verdict: 'contradicts', quote: 'I quit my job yesterday', confidence: 0.99 }, MSG);
    expect(v.verdict).toBe('unrelated');
    expect(v.rawVerdict).toBe('contradicts');
    expect(v.quoteGrounded).toBe(false);
  });
  it('treats junk output as unrelated with zero confidence', () => {
    const v = normalizeVerdict({ verdict: 'destroy', confidence: 'high' }, MSG);
    expect(v.verdict).toBe('unrelated');
    expect(v.confidence).toBe(0);
    expect(normalizeVerdict(undefined, MSG).verdict).toBe('unrelated');
  });
  it('clamps confidence into 0..1', () => {
    expect(normalizeVerdict({ verdict: 'unrelated', confidence: 7 }, MSG).confidence).toBe(1);
  });
});

describe('verifyMemory', () => {
  const call = (body: unknown, ok = true) =>
    vi.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;
  const args = { apiKey: 'k', model: 'm', kind: 'fact', content: 'User is an author', message: MSG };

  it('returns the normalized verdict from the forced tool call', async () => {
    const fetchImpl = call({ content: [{ type: 'tool_use', input: { verdict: 'contradicts', quote: 'I am just reading it', confidence: 0.9 } }] });
    const v = await verifyMemory({ ...args, fetchImpl });
    expect(v?.verdict).toBe('contradicts');
    const sent = JSON.parse((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sent.tool_choice).toEqual({ type: 'tool', name: 'verify_memory' });
    expect(sent.messages[0].content).toContain('User is an author');
  });
  it('returns null on an HTTP error, a missing tool call, or a throw', async () => {
    expect(await verifyMemory({ ...args, fetchImpl: call({}, false) })).toBeNull();
    expect(await verifyMemory({ ...args, fetchImpl: call({ content: [] }) })).toBeNull();
    expect(await verifyMemory({ ...args, fetchImpl: vi.fn().mockRejectedValue(new Error('x')) as unknown as typeof fetch })).toBeNull();
  });
});

describe('vectors', () => {
  it('parses the string form PostgREST returns', () => {
    expect(parsePgVector('[0.1,0.2]')).toEqual([0.1, 0.2]);
    expect(parsePgVector([1, 2])).toEqual([1, 2]);
    expect(parsePgVector(null)).toBeNull();
    expect(parsePgVector('nope')).toBeNull();
  });
  it('gives no cosine when a vector is missing or sizes differ, so the gate stands aside', () => {
    expect(relatednessCosine(null, [1])).toBeNull();
    expect(relatednessCosine([1, 0], [1])).toBeNull();
    expect(relatednessCosine([1, 0], [1, 0])).toBeCloseTo(1);
  });
});

describe('isProtectedRow', () => {
  const fresh = { source: 'inferred', confirm_count: 1, created_at: '2026-10-26T12:00:00Z' };
  it('leaves a fresh single-observation inference unprotected', () => expect(isProtectedRow(fresh, now)).toBe(false));
  it('protects user-stated and user-edited rows', () => {
    expect(isProtectedRow({ ...fresh, source: 'user_stated' }, now)).toBe(true);
    expect(isProtectedRow({ ...fresh, source: 'user_edited' }, now)).toBe(true);
  });
  it('protects rows confirmed twice or older than a week', () => {
    expect(isProtectedRow({ ...fresh, confirm_count: 2 }, now)).toBe(true);
    expect(isProtectedRow({ ...fresh, created_at: '2026-10-19T11:00:00Z' }, now)).toBe(true);
    expect(isProtectedRow({ ...fresh, created_at: '2026-10-21T12:00:00Z' }, now)).toBe(false);
  });
});

describe('isExplicitCorrection', () => {
  it('spots a visible correction', () => {
    expect(isExplicitCorrection("No, that's wrong, I don't work there")).toBe(true);
    expect(isExplicitCorrection('I do not live there anymore')).toBe(true);
  });
  it('does not fire on ordinary talk', () => {
    expect(isExplicitCorrection('My new manager at Globex is great')).toBe(false);
  });
});

describe('decideRevision', () => {
  it('lets a confident contradiction retire an unprotected row', () => {
    expect(decideRevision(base, now)).toEqual({ action: 'apply', reason: 'ok' });
  });
  it('blocks anything the verifier did not call a contradiction', () => {
    expect(decideRevision({ ...base, verdict: 'unrelated' }, now).action).toBe('block');
    expect(decideRevision({ ...base, verdict: 'entails' }, now).action).toBe('block');
  });
  it('blocks a weak contradiction', () => {
    expect(decideRevision({ ...base, confidence: 0.59 }, now)).toEqual({ action: 'block', reason: 'low_confidence' });
  });
  it('blocks when the quote is far from the memory, whatever the verifier said', () => {
    expect(decideRevision({ ...base, cosine: DEFAULT_T_RELATED - 0.01 }, now)).toEqual({ action: 'block', reason: 'vector' });
    expect(decideRevision({ ...base, cosine: DEFAULT_T_RELATED }, now).action).toBe('apply');
  });
  it('lets the verifier decide alone when there are no vectors', () => {
    expect(decideRevision({ ...base, cosine: null }, now).action).toBe('apply');
  });
  it('honours a custom threshold', () => {
    expect(decideRevision({ ...base, cosine: 0.4, tRelated: 0.5 }, now).action).toBe('block');
  });
  it('disputes a protected row on the first signal instead of retiring it', () => {
    expect(decideRevision({ ...base, protectedRow: true }, now)).toEqual({ action: 'dispute', reason: 'first_signal' });
  });
  it('retires a protected row on a second signal from a later message', () => {
    const prior = new Date(now.getTime() - 5 * 60_000).toISOString();
    expect(decideRevision({ ...base, protectedRow: true, priorDisputeAt: prior }, now)).toEqual({ action: 'apply', reason: 'second_signal' });
  });
  it('does not count a second op in the same minute as a second signal', () => {
    const prior = new Date(now.getTime() - 10_000).toISOString();
    expect(decideRevision({ ...base, protectedRow: true, priorDisputeAt: prior }, now).action).toBe('dispute');
  });
  it('applies an explicit, very confident correction of a protected row at once', () => {
    expect(decideRevision({ ...base, protectedRow: true, explicit: true, confidence: 0.92 }, now)).toEqual({ action: 'apply', reason: 'explicit' });
    expect(decideRevision({ ...base, protectedRow: true, explicit: true, confidence: 0.8 }, now).action).toBe('dispute');
  });
  it('still gates an explicit correction by relatedness', () => {
    expect(decideRevision({ ...base, protectedRow: true, explicit: true, cosine: 0.05 }, now).action).toBe('block');
  });
  it('lets an update that merely elaborates through, but only past the relatedness gate', () => {
    const elab = { ...base, verdict: 'entails' as const, allowEntails: true, protectedRow: true };
    expect(decideRevision(elab, now)).toEqual({ action: 'apply', reason: 'ok' });
    expect(decideRevision({ ...elab, cosine: 0.05 }, now).action).toBe('block');
    expect(decideRevision({ ...elab, allowEntails: false }, now).action).toBe('block');
  });
  it('never applies an unrelated verdict, even with allowEntails, protection or an explicit correction', () => {
    expect(decideRevision({ ...base, verdict: 'unrelated', allowEntails: true, protectedRow: false, explicit: true }, now).action).toBe('block');
  });
  it('wouldHave maps decisions for the shadow log', () => {
    expect(wouldHave({ action: 'apply', reason: 'ok' })).toBe('applied');
    expect(wouldHave({ action: 'dispute', reason: 'first_signal' })).toBe('disputed');
    expect(wouldHave({ action: 'block', reason: 'vector' })).toBe('blocked');
  });
});
