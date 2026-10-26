import type { Game } from '../kernel/game';
import { spend } from '../state/household';
import {
  CUTS, FABRICS, GENERATED_KINDS, PALETTES, bodyPart, cutLabel, decodeGarment, encodeGarment, generateGarment, priceOf, validateGarment,
  type Garment, type GarmentSlot, type Pattern, type PatternKind,
} from '../state/garment';
import { describeGarment, DESCRIBE_MAX } from '../state/describeGarment';
import { styleWords } from '../state/taste';
import { createGarmentPreview } from './garmentPreview';
import { clothToGarment } from '../state/legacyClothes';
import { OCCASIONS, OCCASION_LABEL, type Occasion, type SavedOutfit } from '../state/outfits';

/**
 * The Design Studio: make a garment (cut, cloth, colours, pattern and details) and see it on a mannequin as you go,
 * describe one in words, shop the daily boutique, or trade share codes. It builds its page once and updates it in
 * place, because the drawer around it is refreshed several times a second.
 */
type Tab = 'make' | 'pixel' | 'describe' | 'boutique' | 'outfits' | 'share';

const SLOT_LABEL: Partial<Record<GarmentSlot, string>> = { top: 'Top', outer: 'Jacket', dress: 'Dress', bottom: 'Bottoms' };
const STUDIO_SLOTS: GarmentSlot[] = ['top', 'outer', 'dress', 'bottom'];
const FABRIC_LABEL = (f: string): string => f[0].toUpperCase() + f.slice(1);
const KIND_LABEL: Record<string, string> = { 'color-block': 'Colour block', 'tie-dye': 'Tie-dye', polka: 'Polka dots' };
const kindLabel = (k: string): string => KIND_LABEL[k] ?? k[0].toUpperCase() + k.slice(1);
const RARITY_LABEL: Record<string, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', 'one-of-a-kind': 'One of a kind' };
const esc = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const START: Garment = validateGarment({ slot: 'top', cut: 'tee', fabric: 'cotton', base: '#c2413a', name: 'Custom tee', tags: [], rarity: 'one-of-a-kind' })!;

export function createStudio(g: Game): Partial<Game> {
  const { world, log, drawer } = g;
  const sec = drawer.el.querySelector('[data-page="studio"]') as HTMLElement;
  let cur: Garment = START;
  let tab: Tab = 'make';
  let message = '';
  let busy = false;
  let open = false;
  let raf = 0;

  sec.innerHTML = `<div class="vh-studio">
    <div class="vh-st-top">
      <canvas class="vh-st-preview" width="132" height="176" aria-label="Preview"></canvas>
      <div class="vh-st-meta">
        <input class="vh-st-name" maxlength="24" aria-label="Name" />
        <div class="vh-st-price" data-price></div>
        <div class="vh-st-actions">
          <button type="button" data-st="surprise">Surprise me</button>
          <button type="button" data-st="make" class="vh-st-primary">Make it</button>
        </div>
      </div>
    </div>
    <div class="vh-st-tabs" role="tablist">
      ${(['make', 'pixel', 'describe', 'boutique', 'outfits', 'share'] as Tab[]).map((t) => `<button type="button" role="tab" data-sttab="${t}">${t === 'make' ? 'Design' : t === 'pixel' ? 'Pixels' : t === 'describe' ? 'Describe' : t === 'boutique' ? 'Boutique' : t === 'outfits' ? 'Outfits' : 'Share'}</button>`).join('')}
    </div>
    <div class="vh-st-msg" data-msg aria-live="polite"></div>
    <div class="vh-st-pane" data-pane></div>
  </div>`;
  const preview = sec.querySelector('.vh-st-preview') as HTMLCanvasElement;
  const nameEl = sec.querySelector('.vh-st-name') as HTMLInputElement;
  const priceEl = sec.querySelector('[data-price]') as HTMLElement;
  const msgEl = sec.querySelector('[data-msg]') as HTMLElement;
  const pane = sec.querySelector('[data-pane]') as HTMLElement;
  const makeBtn = sec.querySelector('[data-st="make"]') as HTMLButtonElement;
  const mannequin = createGarmentPreview(preview);

  // What the mannequin wears with the design: the player's own other piece.
  function companion(): { top: Garment | null; bottom: Garment | null } {
    const look = g.people[0].look;
    const plainTop = validateGarment({ slot: 'top', cut: 'tee', fabric: 'cotton', base: look.top, name: 'tee' });
    const plainBottom = validateGarment({ slot: 'bottom', cut: 'straight', fabric: 'cotton', base: look.bottom, name: 'pants' });
    return { top: look.topGarment ?? plainTop, bottom: look.bottomGarment ?? plainBottom };
  }

  function drawPreview(t = 0): void {
    const other = companion();
    const part = bodyPart(cur);
    mannequin.draw(part === 'top' ? cur : other.top, part === 'bottom' ? cur : other.bottom, t);
  }

  let lastSync = 0;
  function loop(now: number): void {
    if (!open) return;
    drawPreview(now / 1000);
    if (now - lastSync > 500) { lastSync = now; syncHead(); }
    raf = requestAnimationFrame(loop);
  }

  const price = (): number => priceOf({ ...cur, rarity: 'common' });

  function say(text: string): void { message = text; msgEl.textContent = text; }

  function syncHead(): void {
    if (document.activeElement !== nameEl) nameEl.value = cur.name;
    const cost = price();
    priceEl.textContent = `$${cost} · ${cutLabel(cur.cut)}, ${cur.fabric}`;
    makeBtn.textContent = `Make it · $${cost}`;
    makeBtn.disabled = busy || world.household.money < cost;
    sec.querySelectorAll<HTMLElement>('[data-sttab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sttab === tab)));
  }

  /** Applies a change to the design; everything it produces is checked and clamped. */
  function change(next: Partial<Garment> | Garment, rebuild = true): void {
    const merged = validateGarment({ ...cur, ...next });
    if (!merged) return;
    // A design still carrying its starting name follows the cut.
    if (/^Custom /.test(cur.name) && 'cut' in next && next.cut) merged.name = `Custom ${cutLabel(next.cut).toLowerCase()}`;
    cur = merged;
    syncHead();
    drawPreview(performance.now() / 1000);
    if (rebuild) renderPane();
  }

  function setPattern(p: Pattern | undefined, rebuild = true): void {
    const next = { ...cur } as Garment;
    if (p) next.pattern = p; else delete next.pattern;
    change(next, rebuild);
  }

  const chip = (label: string, attr: string, value: string, on: boolean): string => `<button type="button" class="vh-st-chip${on ? ' vh-on' : ''}" ${attr}="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;
  const colourInput = (attr: string, value: string, label: string): string => `<label class="vh-st-colour"><input type="color" ${attr} value="${value}" aria-label="${esc(label)}" /></label>`;
  const slider = (attr: string, label: string, min: number, max: number, step: number, value: number): string =>
    `<label class="vh-st-slider"><span>${label}</span><input type="range" ${attr} min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;

  function makePane(): string {
    const p = cur.pattern;
    const swatches = [...new Set(PALETTES.flatMap((pl) => pl.colors))].slice(0, 18);
    const details = cur.details ?? {};
    const isBottom = cur.slot === 'bottom';
    const remixable = g.closet.filter((c) => !c.recipe && clothToGarment(c));
    return `
      ${remixable.length ? `<h5>Start from something you own</h5><div class="vh-st-row">${remixable.map((c) => `<button type="button" class="vh-st-chip" data-remix="${esc(c.id)}" data-remixcol="${esc(c.col)}">${esc(c.name)}</button>`).join('')}</div>` : ''}
      <h5>Piece</h5>
      <div class="vh-st-row">${STUDIO_SLOTS.map((s) => chip(SLOT_LABEL[s]!, 'data-slot', s, cur.slot === s)).join('')}</div>
      <div class="vh-st-row">${CUTS[cur.slot].map((c) => chip(cutLabel(c), 'data-cut', c, cur.cut === c)).join('')}</div>
      <h5>Cloth</h5>
      <div class="vh-st-row">${FABRICS.map((f) => chip(FABRIC_LABEL(f), 'data-fabric', f, cur.fabric === f)).join('')}</div>
      <h5>Colour</h5>
      <div class="vh-st-row vh-st-swatches">${swatches.map((c) => `<button type="button" class="vh-st-swatch${c === cur.base ? ' vh-on' : ''}" data-base="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}${colourInput('data-basepick', cur.base, 'Pick a colour')}</div>
      <h5>Pattern</h5>
      <div class="vh-st-row">${chip('None', 'data-kind', '', !p)}${GENERATED_KINDS.map((k) => chip(kindLabel(k), 'data-kind', k, p?.kind === k)).join('')}${p?.kind === 'pixel' ? chip('Pixel art', 'data-kind', 'pixel', true) : ''}</div>
      ${p ? `
        <div class="vh-st-row">${p.colors.map((c, i) => colourInput(`data-pcol="${i}"`, c, `Pattern colour ${i + 1}`)).join('')}
          ${p.colors.length < 3 ? '<button type="button" class="vh-st-chip" data-addcol>+ colour</button>' : ''}
          ${p.colors.length > 1 ? '<button type="button" class="vh-st-chip" data-dropcol>&minus; colour</button>' : ''}</div>
        ${slider('data-scale', 'Size', 0.25, 4, 0.025, p.scale)}${slider('data-angle', 'Angle', -90, 90, 1, p.angle)}${slider('data-density', 'Busy-ness', 0, 1, 0.01, p.density ?? 0.5)}
        <div class="vh-st-row"><button type="button" class="vh-st-chip" data-reseed>Shuffle motif</button>
          ${p.layer2 ? '<button type="button" class="vh-st-chip vh-on" data-layer2="off">Overlay on</button>' : '<button type="button" class="vh-st-chip" data-layer2="on">Add an overlay</button>'}</div>
        ${p.layer2 ? `<div class="vh-st-row">${(['stripes', 'polka', 'graphic', 'color-block'] as PatternKind[]).map((k) => chip(kindLabel(k), 'data-l2kind', k, p.layer2!.kind === k)).join('')}${colourInput('data-l2col', p.layer2.colors[0], 'Overlay colour')}</div>` : ''}
      ` : ''}
      <h5>Details</h5>
      <div class="vh-st-row">
        ${isBottom ? '' : chip('Pocket', 'data-detail', 'pocket', !!details.pocket) + chip('Buttons', 'data-detail', 'buttons', !!details.buttons) + (cur.cut === 'hoodie' ? chip('Drawstring', 'data-detail', 'drawstring', !!details.drawstring) : '')}
        ${isBottom && cur.cut !== 'shorts' && cur.cut !== 'skirt' ? chip('Rolled cuffs', 'data-detail', 'cuffs-rolled', details.cuffs === 'rolled') + chip('Contrast cuffs', 'data-detail', 'cuffs-contrast', details.cuffs === 'contrast') : ''}
      </div>
      ${cur.fabric === 'denim' ? slider('data-wash', 'Wash', 0, 1, 0.01, details.wash ?? 0.5) : ''}
      ${slider('data-distress', 'Worn-in', 0, 1, 0.01, details.distress ?? 0)}`;
  }

  function boutiquePane(): string {
    const items = g.boutiqueFor(world.day);
    return `<p class="vh-st-hint">A fresh rack every day. Rare pieces are ordered and arrive at 8 in the morning.</p>
      <div class="vh-st-row"><button type="button" class="vh-st-chip" data-mayagift>Ask ${esc(g.partnerName)} to design something for you</button></div>
      <div class="vh-st-boutique">${items.map((it, i) => `
      <div class="vh-st-card" data-card="${i}">
        <canvas width="66" height="88" data-bpreview="${i}"></canvas>
        <strong>${esc(it.garment.name)}</strong>
        <span class="vh-st-rarity" data-rarity="${it.garment.rarity}">${RARITY_LABEL[it.garment.rarity]}</span>
        <div class="vh-st-cardrow"><button type="button" data-tryit="${i}">Try</button><button type="button" data-buyit="${i}" ${it.bought || g.isOrdered(it.id) || world.household.money < it.price ? 'disabled' : ''}>${it.bought ? 'Owned' : g.isOrdered(it.id) ? 'On its way' : g.needsOrder(it.garment) ? `Order $${it.price}` : `$${it.price}`}</button></div>
      </div>`).join('')}</div>`;
  }

  function describePane(): string {
    return `<p class="vh-st-hint">Say what you want: "70s sunset over the ocean", "cozy cabin flannel", "something ${g.partnerName} would love".</p>
      <textarea class="vh-st-text" maxlength="${DESCRIBE_MAX}" rows="3" placeholder="Describe a garment…" data-describe-text></textarea>
      <div class="vh-st-row"><button type="button" class="vh-st-primary" data-describe ${busy ? 'disabled' : ''}>${busy ? 'Designing…' : 'Design it'}</button></div>`;
  }

  let occasion: Occasion = 'everyday';
  function outfitsPane(): string {
    const list = (g.flags.outfits ?? []) as SavedOutfit[];
    const names = (o: SavedOutfit): string => [o.top, o.bottom].map((r) => g.closet.find((c) => c.id === r?.id && c.col === r?.col)?.name).filter(Boolean).join(' + ') || 'pieces gone';
    return `<p class="vh-st-hint">Save what ${esc(g.simName)} has on for an occasion. ${esc(g.simName)} changes into it when the time comes.</p>
      <label class="vh-st-check"><input type="checkbox" data-auto ${g.flags.autoOutfit === false ? '' : 'checked'} /> Change automatically</label>
      <h5>Save what I'm wearing</h5>
      <div class="vh-st-row">${OCCASIONS.map((o) => chip(OCCASION_LABEL[o], 'data-occasion', o, occasion === o)).join('')}</div>
      <input class="vh-st-text" maxlength="24" placeholder="Name (optional)" data-outfit-name aria-label="Outfit name" />
      <div class="vh-st-row"><button type="button" class="vh-st-primary" data-saveoutfit>Save outfit</button></div>
      <h5>Saved outfits</h5>
      ${list.length ? list.map((o) => `<div class="vh-st-outfit"><div><strong>${esc(o.name)}</strong><span>${OCCASION_LABEL[o.occasion]} · ${esc(names(o))}</span></div>
        <div class="vh-st-cardrow"><button type="button" data-wearoutfit="${o.id}">Wear</button><button type="button" data-deleteoutfit="${o.id}" aria-label="Delete ${esc(o.name)}">&times;</button></div></div>`).join('') : '<p class="vh-st-hint">Nothing saved yet.</p>'}`;
  }

  // -- pixel art ------------------------------------------------------------------------------------------------
  const DEFAULT_PALETTE = ['#2b2b30', '#f2eee8', '#c2413a', '#e0a43a', '#7fb069', '#4a5da8', '#d24a7a'];
  const px = { w: 16, palette: [...DEFAULT_PALETTE], data: new Array<number>(256).fill(0), tool: 'pencil' as 'pencil' | 'erase' | 'fill', color: 1, mirror: false, undo: [] as number[][] };

  function loadPixelsFromDesign(): void {
    const art = cur.pattern?.kind === 'pixel' ? cur.pattern.pixels : undefined;
    if (!art) return;
    px.w = art.w;
    px.palette = [...art.palette, ...DEFAULT_PALETTE.slice(art.palette.length)].slice(0, 7);
    px.data = [...art.data].map(Number);
    px.undo = [];
  }

  function pixelPane(): string {
    const tool = (id: typeof px.tool, label: string) => chip(label, 'data-pxtool', id, px.tool === id);
    return `<p class="vh-st-hint">Draw a small picture and wear it as a print. It repeats across the cloth.</p>
      <canvas class="vh-st-pixgrid" width="256" height="256" data-pixgrid aria-label="Pixel canvas"></canvas>
      <div class="vh-st-row vh-st-swatches">${px.palette.map((c, i) => `<button type="button" class="vh-st-swatch${px.color === i + 1 && px.tool !== 'erase' ? ' vh-on' : ''}" data-pxcolor="${i + 1}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}
        ${colourInput('data-pxpick', px.palette[px.color - 1] ?? '#000000', 'Change this colour')}</div>
      <div class="vh-st-row">${tool('pencil', 'Draw')}${tool('erase', 'Erase')}${tool('fill', 'Fill')}${chip('Mirror', 'data-pxmirror', '1', px.mirror)}</div>
      <div class="vh-st-row">${chip('8 × 8', 'data-pxsize', '8', px.w === 8)}${chip('16 × 16', 'data-pxsize', '16', px.w === 16)}
        <button type="button" class="vh-st-chip" data-pxundo ${px.undo.length ? '' : 'disabled'}>Undo</button><button type="button" class="vh-st-chip" data-pxclear>Clear</button></div>
      ${slider('data-pxscale', 'Print size', 0.25, 4, 0.025, cur.pattern?.scale ?? 1)}`;
  }

  function drawPixelGrid(): void {
    const cv = pane.querySelector<HTMLCanvasElement>('[data-pixgrid]');
    const x = cv?.getContext('2d');
    if (!cv || !x) return;
    const cell = cv.width / px.w;
    for (let j = 0; j < px.w; j++) for (let i = 0; i < px.w; i++) {
      const v = px.data[j * px.w + i];
      x.fillStyle = v ? px.palette[v - 1] : (i + j) % 2 ? '#d9d2c6' : '#ebe5da';
      x.fillRect(i * cell, j * cell, cell, cell);
    }
    x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 1; x.beginPath();
    for (let k = 0; k <= px.w; k++) { x.moveTo(k * cell + 0.5, 0); x.lineTo(k * cell + 0.5, cv.height); x.moveTo(0, k * cell + 0.5); x.lineTo(cv.width, k * cell + 0.5); }
    x.stroke();
  }

  /** Puts the picture on the garment as an all-over print (or takes the print off when it is empty). */
  function applyPixels(): void {
    const used = px.data.reduce((m, v) => Math.max(m, v), 0);
    if (!used) { if (cur.pattern?.kind === 'pixel') setPattern(undefined, false); return; }
    const old = cur.pattern?.kind === 'pixel' ? cur.pattern : undefined;
    const palette = px.palette.slice(0, used);
    setPattern({ kind: 'pixel', colors: [palette[0]], scale: old?.scale ?? 1, angle: 0, density: 0.5, seed: 1, pixels: { w: px.w, h: px.w, palette, data: px.data.join('') } }, false);
  }

  function paintCell(i: number, j: number): void {
    const set = (a: number, b: number) => { if (a >= 0 && b >= 0 && a < px.w && b < px.w) px.data[b * px.w + a] = px.tool === 'erase' ? 0 : px.color; };
    set(i, j);
    if (px.mirror) set(px.w - 1 - i, j);
  }

  function floodFill(i: number, j: number): void {
    const target = px.data[j * px.w + i], to = px.color;
    if (target === to) return;
    const stack: [number, number][] = [[i, j]];
    while (stack.length) {
      const [a, b] = stack.pop()!;
      if (a < 0 || b < 0 || a >= px.w || b >= px.w || px.data[b * px.w + a] !== target) continue;
      px.data[b * px.w + a] = to;
      stack.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]);
    }
  }

  const pushUndo = (): void => { px.undo.push([...px.data]); if (px.undo.length > 30) px.undo.shift(); };

  function wirePixelGrid(): void {
    const cv = pane.querySelector<HTMLCanvasElement>('[data-pixgrid]');
    if (!cv) return;
    let down = false;
    const cellAt = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect();
      return [Math.min(px.w - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * px.w))), Math.min(px.w - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * px.w)))];
    };
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', (e) => {
      down = true; cv.setPointerCapture?.(e.pointerId);
      pushUndo();
      const [i, j] = cellAt(e);
      if (px.tool === 'fill') floodFill(i, j); else paintCell(i, j);
      drawPixelGrid();
    });
    cv.addEventListener('pointermove', (e) => { if (!down || px.tool === 'fill') return; const [i, j] = cellAt(e); paintCell(i, j); drawPixelGrid(); });
    const end = () => { if (!down) return; down = false; applyPixels(); const u = pane.querySelector<HTMLButtonElement>('[data-pxundo]'); if (u) u.disabled = !px.undo.length; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  function sharePane(): string {
    const code = encodeGarment(cur);
    return `<h5>This design</h5>
      <textarea class="vh-st-code" readonly rows="3" data-code>${code}</textarea>
      <div class="vh-st-row"><button type="button" class="vh-st-chip" data-copy>Copy code</button></div>
      <h5>Use someone's code</h5>
      <input class="vh-st-text" placeholder="VH-…" data-incode aria-label="A share code" />
      <div class="vh-st-row"><button type="button" class="vh-st-primary" data-load>Load it</button></div>`;
  }

  function drawBoutiquePreviews(): void {
    const items = g.boutiqueFor(world.day);
    const other = companion();
    pane.querySelectorAll<HTMLCanvasElement>('[data-bpreview]').forEach((cv) => {
      const it = items[Number(cv.dataset.bpreview)];
      if (!it) return;
      const part = bodyPart(it.garment);
      createGarmentPreview(cv).draw(part === 'top' ? it.garment : other.top, part === 'bottom' ? it.garment : other.bottom, 0);
    });
  }

  function renderPane(): void {
    pane.innerHTML = tab === 'make' ? makePane() : tab === 'boutique' ? boutiquePane() : tab === 'describe' ? describePane() : tab === 'outfits' ? outfitsPane() : tab === 'pixel' ? pixelPane() : sharePane();
    if (tab === 'boutique') drawBoutiquePreviews();
    if (tab === 'pixel') { drawPixelGrid(); wirePixelGrid(); }
    syncHead();
  }

  // -- actions --------------------------------------------------------------------------------------------------
  function make(): void {
    const cost = price();
    if (!spend(world.household, cost)) { say('Not enough money for that one.'); return; }
    const garment = { ...cur, rarity: 'one-of-a-kind' as const };
    const piece = g.ownGarment(garment);
    say(`Made the ${garment.name} for $${cost}.`);
    log(`Made the ${garment.name} for $${cost}.`);
    g.wearOutfitPiece(piece);
    g.reactToOutfit(garment, 'made');
    syncHead();
  }

  async function describe(): Promise<void> {
    const text = (pane.querySelector('[data-describe-text]') as HTMLTextAreaElement | null)?.value ?? '';
    if (!text.trim() || busy) { say('Tell me what it should look like first.'); return; }
    busy = true; renderPane(); say('Sketching…');
    const words = styleWords(g.style).loves;
    const r = await describeGarment(text, g.s.sample, { wearerName: g.simName, styleWords: words });
    busy = false;
    cur = { ...r.garment, name: r.garment.name };
    tab = 'make';
    renderPane();
    drawPreview(performance.now() / 1000);
    say(r.source === 'ai' ? 'Here is your design. Change anything you like.' : "Couldn't reach the designer, so here is one made from your words.");
  }

  async function askGift(): Promise<void> {
    if (busy) return;
    busy = true; say(`${g.partnerName} is sketching…`); syncHead();
    const r = await g.mayaGift();
    busy = false;
    say(r.ok ? `${g.partnerName} made you the ${r.garment!.name}.` : r.reason ?? '');
    renderPane();
  }

  function tryBoutique(i: number): void {
    const it = g.boutiqueFor(world.day)[i];
    if (!it) return;
    cur = it.garment;
    syncHead();
    drawPreview(performance.now() / 1000);
    say(`Trying on the ${it.garment.name}.`);
  }

  function buyBoutique(i: number): void {
    const it = g.boutiqueFor(world.day)[i];
    if (!it || it.bought || g.isOrdered(it.id)) return;
    if (g.needsOrder(it.garment)) {
      if (!spend(world.household, it.price)) { say('Not enough money.'); return; }
      g.orderGarment(it);
      log(`Ordered the ${it.garment.name} for $${it.price}. It comes at 8 in the morning.`);
      say(`Ordered. It arrives at 8 in the morning.`);
      renderPane();
      return;
    }
    if (!spend(world.household, it.price)) { say('Not enough money.'); return; }
    g.markBought(world.day, it.id);
    const piece = g.ownGarment(it.garment);
    log(`Bought the ${it.garment.name} for $${it.price}.`);
    say(`Bought the ${it.garment.name}.`);
    g.wearOutfitPiece(piece);
    g.reactToOutfit(it.garment, 'bought');
    renderPane();
  }

  function loadCode(): void {
    const raw = (pane.querySelector('[data-incode]') as HTMLInputElement | null)?.value ?? '';
    const gm = decodeGarment(raw);
    if (!gm) { say("That code doesn't look right. Check it and try again."); return; }
    cur = { ...gm, rarity: 'one-of-a-kind' };
    tab = 'make';
    renderPane();
    drawPreview(performance.now() / 1000);
    say(`Loaded the ${gm.name}.`);
  }

  async function copy(): Promise<void> {
    const code = (pane.querySelector('[data-code]') as HTMLTextAreaElement).value;
    try { await navigator.clipboard.writeText(code); say('Code copied.'); }
    catch { (pane.querySelector('[data-code]') as HTMLTextAreaElement).select(); say('Select the code and copy it.'); }
  }

  // -- events ---------------------------------------------------------------------------------------------------
  sec.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || !sec.contains(t)) return;
    const d = t.dataset;
    if (d.sttab) { tab = d.sttab as Tab; if (tab === 'pixel') loadPixelsFromDesign(); renderPane(); return; }
    if (d.pxtool) { px.tool = d.pxtool as typeof px.tool; renderPane(); return; }
    if (d.pxcolor) { px.color = Number(d.pxcolor); if (px.tool === 'erase') px.tool = 'pencil'; renderPane(); return; }
    if (d.pxmirror !== undefined) { px.mirror = !px.mirror; renderPane(); return; }
    if (d.pxsize) {
      const w = Number(d.pxsize);
      if (w !== px.w) { const old = px.data, ow = px.w; px.data = new Array<number>(w * w).fill(0); for (let j = 0; j < Math.min(w, ow); j++) for (let i = 0; i < Math.min(w, ow); i++) px.data[j * w + i] = old[j * ow + i]; px.w = w; px.undo = []; applyPixels(); }
      renderPane(); return;
    }
    if (d.pxundo !== undefined) { const prev = px.undo.pop(); if (prev) { px.data = prev; applyPixels(); renderPane(); } return; }
    if (d.pxclear !== undefined) { pushUndo(); px.data.fill(0); applyPixels(); renderPane(); return; }
    if (d.st === 'make') return make();
    if (d.st === 'surprise') { cur = generateGarment(Math.floor(Math.random() * 0xffffff), { rarity: 'rare' }); cur = { ...cur, rarity: 'one-of-a-kind' }; renderPane(); drawPreview(performance.now() / 1000); say('Something new.'); return; }
    if (d.remix) {
      const c = g.closet.find((x) => x.id === d.remix && x.col === d.remixcol);
      const gm = c && clothToGarment(c);
      if (gm) { cur = { ...gm, name: `Remix ${gm.name}`.slice(0, 24), rarity: 'one-of-a-kind' }; renderPane(); drawPreview(performance.now() / 1000); say(`Starting from the ${c!.name}.`); }
      return;
    }
    if (d.slot) { const slot = d.slot as GarmentSlot; change({ slot, cut: CUTS[slot][0] }); return; }
    if (d.cut) return change({ cut: d.cut });
    if (d.fabric) return change({ fabric: d.fabric as Garment['fabric'] });
    if (d.base) return change({ base: d.base });
    if (d.kind !== undefined) {
      if (d.kind === 'pixel') return;
      if (!d.kind) return setPattern(undefined);
      const old = cur.pattern;
      return setPattern({ kind: d.kind as PatternKind, colors: old?.colors ?? ['#f2eee8', '#2b2b30'], scale: old?.scale ?? 1.2, angle: old?.angle ?? 0, density: old?.density ?? 0.5, seed: old?.seed ?? 7, layer2: old?.layer2 });
    }
    const p = cur.pattern;
    if (d.addcol !== undefined && p) return setPattern({ ...p, colors: [...p.colors, '#f6e3c3'] });
    if (d.dropcol !== undefined && p) return setPattern({ ...p, colors: p.colors.slice(0, -1) });
    if (d.reseed !== undefined && p) return setPattern({ ...p, seed: Math.floor(Math.random() * 0xffffff) + 1 });
    if (d.layer2 && p) return setPattern({ ...p, layer2: d.layer2 === 'on' ? { kind: 'stripes', colors: [p.colors[0]], scale: 1.2, angle: 0, density: 0.4, seed: 3 } : undefined });
    if (d.l2kind && p?.layer2) return setPattern({ ...p, layer2: { ...p.layer2, kind: d.l2kind as PatternKind } });
    if (d.detail) {
      const dt = { ...(cur.details ?? {}) };
      if (d.detail === 'cuffs-rolled') dt.cuffs = dt.cuffs === 'rolled' ? undefined : 'rolled';
      else if (d.detail === 'cuffs-contrast') dt.cuffs = dt.cuffs === 'contrast' ? undefined : 'contrast';
      else (dt as Record<string, unknown>)[d.detail] = !(dt as Record<string, unknown>)[d.detail] || undefined;
      return change({ details: dt });
    }
    if (d.occasion) { occasion = d.occasion as Occasion; renderPane(); return; }
    if (d.saveoutfit !== undefined) {
      const name = (pane.querySelector('[data-outfit-name]') as HTMLInputElement).value;
      const o = g.saveOutfit(name, occasion);
      say(o ? `Saved ${o.name}.` : 'Put something on from your closet first.');
      renderPane();
      return;
    }
    if (d.wearoutfit) { const o = ((g.flags.outfits ?? []) as SavedOutfit[]).find((x) => x.id === d.wearoutfit); if (o) g.wearOutfit(o); return; }
    if (d.deleteoutfit) { g.deleteOutfit(d.deleteoutfit); renderPane(); return; }
    if (d.mayagift !== undefined) { void askGift(); return; }
    if (d.tryit) return tryBoutique(Number(d.tryit));
    if (d.buyit) return buyBoutique(Number(d.buyit));
    if (d.describe !== undefined) { void describe(); return; }
    if (d.copy !== undefined) { void copy(); return; }
    if (d.load !== undefined) loadCode();
  });

  // Sliders and colour pickers update the preview as they move, and rebuild the controls once they are let go.
  sec.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const p = cur.pattern;
    if (t.dataset.auto !== undefined) { g.flags.autoOutfit = t.checked; return; }
    if (t.dataset.pxpick !== undefined) { px.palette[px.color - 1] = t.value; drawPixelGrid(); applyPixels(); return; }
    if (t.dataset.pxscale !== undefined) { if (p?.kind === 'pixel') setPattern({ ...p, scale: Number(t.value) }, false); return; }
    if (t === nameEl) { cur = { ...cur, name: t.value.slice(0, 24) }; return; }
    if (t.dataset.basepick !== undefined) return change({ base: t.value }, false);
    if (!p) { if (t.dataset.wash !== undefined || t.dataset.distress !== undefined) liveDetail(t); return; }
    if (t.dataset.pcol !== undefined) { const colors = [...p.colors]; colors[Number(t.dataset.pcol)] = t.value; return setPattern({ ...p, colors }, false); }
    if (t.dataset.l2col !== undefined && p.layer2) return setPattern({ ...p, layer2: { ...p.layer2, colors: [t.value] } }, false);
    if (t.dataset.scale !== undefined) return setPattern({ ...p, scale: Number(t.value) }, false);
    if (t.dataset.angle !== undefined) return setPattern({ ...p, angle: Number(t.value) }, false);
    if (t.dataset.density !== undefined) return setPattern({ ...p, density: Number(t.value) }, false);
    if (t.dataset.wash !== undefined || t.dataset.distress !== undefined) liveDetail(t);
  });
  function liveDetail(t: HTMLInputElement): void {
    const dt = { ...(cur.details ?? {}) };
    if (t.dataset.wash !== undefined) dt.wash = Number(t.value); else dt.distress = Number(t.value) || undefined;
    change({ details: dt }, false);
  }
  nameEl.addEventListener('change', () => { cur = validateGarment({ ...cur, name: nameEl.value }) ?? cur; syncHead(); });

  // -- lifecycle ------------------------------------------------------------------------------------------------
  function studioPage(pg: string): void {
    const now = pg === 'studio';
    if (now === open) return;
    open = now;
    if (open) { renderPane(); say(message); raf = requestAnimationFrame(loop); }
    else cancelAnimationFrame(raf);
  }

  return { studioPage };
}
