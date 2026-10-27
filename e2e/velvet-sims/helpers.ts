import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FrameLocator, Page } from '@playwright/test';

export const SAVE_KEY = 'velvet-sims:e2e';
const HOST = readFileSync(join(process.cwd(), 'e2e/velvet-sims/host.html'), 'utf-8');

export interface Obj { id: string; type: string; level: number; x: number; y: number; rot: number; on?: string; z?: number }

/** Opens the game inside the stand-in host page and waits for it to be ready. */
export async function openGame(page: Page, opts: { fresh?: boolean; freeze?: boolean; script?: boolean; menu?: boolean; seed?: (save: Record<string, unknown>) => void } = {}): Promise<FrameLocator> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as unknown as { __errors: string[] }).__errors = errors;
  await page.route('**/__e2e/host.html*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: HOST }));
  const query = [opts.script && 'script', opts.menu && 'menu', opts.freeze && 'freeze'].filter(Boolean).join('&');
  const url = '/__e2e/host.html' + (query ? `?${query}` : '');
  await page.goto(url);
  if (opts.fresh !== false) await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);
  await page.goto(url);
  if (!opts.menu) await waitReady(page);
  return page.frameLocator('#g');
}

export function pageErrors(page: Page): string[] {
  return (page as unknown as { __errors?: string[] }).__errors ?? [];
}

export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const f = document.getElementById('g') as HTMLIFrameElement | null;
    const w = f?.contentWindow as (Window & { __velvet?: unknown }) | null;
    return !!w?.__velvet && !!f?.contentDocument?.querySelector('.vh-canvas');
  });
  await page.waitForTimeout(500);
}

/** Runs code inside the game's window, with its test hook as `v`. */
export async function inGame<T>(page: Page, fn: string): Promise<T> {
  return page.evaluate((code) => {
    const f = document.getElementById('g') as HTMLIFrameElement;
    const w = f.contentWindow as unknown as { __velvet: unknown; localStorage: Storage };
    return new Function('v', 'ls', `return (${code})`)(w.__velvet, w.localStorage);
  }, fn) as Promise<T>;
}

export const objects = (page: Page) => inGame<Obj[]>(page, 'v.objects()');
export const savedGame = (page: Page) => inGame<Record<string, any>>(page, `JSON.parse(ls.getItem('${SAVE_KEY}'))`);
export const saveNow = (page: Page) => inGame<void>(page, 'v.saveGame()');
export const setMoney = (page: Page, n: number) => inGame<void>(page, `(v.money = ${n})`);

/** Where a piece is on screen (page coordinates), so a test can press and drag it. */
export async function clientPosOf(page: Page, id: string): Promise<[number, number]> {
  const p = await inGame<[number, number] | null>(page, `v.clientPosOf(${JSON.stringify(id)})`);
  if (!p) throw new Error(`no such piece: ${id}`);
  return p;
}

export async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / 8, from[1] + ((to[1] - from[1]) * i) / 8);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

/**
 * Drags a piece into a story mark's outline the way a player does: holding it and steering toward the mark while the
 * camera follows the carried piece, re-reading where the mark is on screen at every step, and letting go once the
 * piece's place in the room is within `within` of the mark. Returns the piece's final place.
 */
export async function dragToMark(page: Page, id: string, mark: string, type: string, rot: number, within = 0.5, maxSteps = 60): Promise<Obj> {
  const m = await inGame<{ x: number; y: number } | null>(page, `(v.marks()[${JSON.stringify(mark)}] ?? null)`);
  if (!m) throw new Error(`no such mark: ${mark}`);
  const where = async (): Promise<Obj> => (await objects(page)).find((o) => o.id === id)!;
  const from = await inGame<[number, number] | null>(page, `v.clientPosOf(${JSON.stringify(id)})`);
  if (!from) throw new Error(`cannot see ${id} on screen`);
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  let at: [number, number] = from;
  // A first nudge past the drag threshold, so the piece is in hand.
  at = [at[0] + 10, at[1] + 10]; await page.mouse.move(at[0], at[1]); await page.waitForTimeout(50);
  let piece = await where();
  for (let i = 0; i < maxSteps && Math.hypot(piece.x - m.x, piece.y - m.y) > within; i++) {
    const to = await inGame<[number, number] | null>(page, `v.markClientPos(${JSON.stringify(mark)}, ${JSON.stringify(type)}, ${rot})`);
    if (!to) break;
    // Where the piece is on screen now versus where the mark is: move the pointer by that difference, in part.
    const now = await inGame<[number, number] | null>(page, `v.clientPosOf(${JSON.stringify(id)})`);
    if (!now) break;
    const k = 0.5;
    at = [at[0] + (to[0] - now[0]) * k, at[1] + (to[1] - now[1]) * k];
    await page.mouse.move(at[0], at[1]);
    await page.waitForTimeout(60);
    piece = await where();
  }
  await page.mouse.up();
  await page.waitForTimeout(400);
  piece = await where();
  console.log(`drag ${id} -> ${mark}: let go at (${piece.x.toFixed(2)}, ${piece.y.toFixed(2)}) rot ${piece.rot}; mark (${m.x}, ${m.y})`);
  return piece;
}
