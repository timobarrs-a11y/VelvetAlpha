import { describe, it, expect } from 'vitest';
import { describeGarment, parseGarmentReply, fallbackGarment, describePreamble, seedOf } from '../state/describeGarment';
import { validateGarment } from '../state/garment';

const GOOD = '{"slot":"top","cut":"hoodie","fabric":"flannel","base":"#a63a2c","pattern":{"kind":"plaid","colors":["#2e3b57","#e8dcc0"],"scale":1.2,"angle":0,"density":0.5,"seed":4},"tags":["cozy"],"name":"Cabin Plaid"}';

describe('parseGarmentReply', () => {
  it('reads a clean reply', () => {
    const g = parseGarmentReply(GOOD)!;
    expect(g.cut).toBe('hoodie');
    expect(g.name).toBe('Cabin Plaid');
    expect(g.rarity).toBe('one-of-a-kind');
  });

  it('finds the recipe in a reply with words and a code fence around it', () => {
    expect(parseGarmentReply('Sure! Here you go:\n```json\n' + GOOD + '\n```\nEnjoy.')!.base).toBe('#a63a2c');
  });

  it('clamps what it finds', () => {
    const g = parseGarmentReply('{"slot":"top","cut":"cape","fabric":"lava","base":"#00ff00","pattern":{"kind":"stripes","colors":["#ffffff"],"scale":999,"angle":9999,"seed":1},"name":"<script>alert(1)</script>"}')!;
    expect(g.cut).toBe('tee');
    expect(g.fabric).toBe('cotton');
    expect(g.pattern!.scale).toBe(4);
    expect(g.name).not.toContain('<');
  });

  it('gives nothing for nonsense', () => {
    expect(parseGarmentReply('I cannot do that.')).toBeNull();
    expect(parseGarmentReply('{"slot":"top"')).toBeNull();
    expect(parseGarmentReply('{"hello":1}')).toBeNull();
    expect(parseGarmentReply('{"slot":"cape"}')).toBeNull();
  });
});

describe('fallbackGarment', () => {
  it('is the same for the same words, and valid', () => {
    expect(fallbackGarment('70s sunset')).toEqual(fallbackGarment('  70S Sunset '));
    expect(validateGarment(fallbackGarment('70s sunset'))).not.toBeNull();
    expect(seedOf('a')).not.toBe(seedOf('b'));
  });

  it('listens for a slot and a mood', () => {
    expect(fallbackGarment('a cozy dress').slot).toBe('dress');
    expect(fallbackGarment('worn-in blue jeans').slot).toBe('bottom');
    expect(fallbackGarment('a cozy cabin jacket').slot).toBe('outer');
  });
});

describe('describeGarment', () => {
  it('uses the AI answer when it is good', async () => {
    const calls: string[][] = [];
    const r = await describeGarment('cozy cabin flannel', async (input) => { calls.push(input); return GOOD; });
    expect(r.source).toBe('ai');
    expect(calls[0][0]).toContain('ONE JSON object');
    expect(calls[0][1]).toBe('cozy cabin flannel');
  });

  it('falls back when the AI is down, refuses, or talks nonsense', async () => {
    for (const sample of [async () => { throw new Error('budget'); }, async () => 'no', null]) {
      const r = await describeGarment('sunset over the ocean', sample as never);
      expect(r.source).toBe('fallback');
      expect(validateGarment(r.garment)).not.toBeNull();
    }
  });

  it('trims long and odd input', async () => {
    let seen = '';
    await describeGarment('x'.repeat(500) + '\u0000', async (i) => { seen = i[1]; return GOOD; });
    expect(seen.length).toBe(120);
  });

  it('names the wearer in the prompt when it knows them', () => {
    expect(describePreamble({ wearerName: 'Maya', styleWords: ['cozy', 'vintage'] })).toContain('Maya, who likes cozy, vintage things');
  });
});
