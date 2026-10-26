import { ATTIC_STAIR_OBJS, type ObjectInstance } from '../state/objects';
import { RNG } from '../state/rng';
import { buildWorld, createAgent, type Agent, type AgentId } from '../state/agents';
import { type CharacterNeeds } from '../state/types';
import { createHouseArt, type PersonFrame } from '../art/houseArt.js';
import { createGpuLights } from '../engine/gpuLights.js';
import { createGBuffer } from '../engine/gbuffer';
import { createDeferredLights } from '../engine/deferredLights';
import { qualityManager } from '../engine/qualityTier';
import { CATALOG, type CatalogEntry } from '../state/catalog';
import { rollStyle, computeTasteNorm, type StyleProfile, type CatalogItem } from '../state/taste';
import { type ChatTurn, type CompanionConfig, type SampleFn } from '../state/companionAI';
import { PICTURE_WALLS } from '../state/pictureWalls';
import { createDrawer, type ArrangeState, type DrawerPage } from '../ui/drawer';
import { clothByKey, clothId, type OwnedCloth, type Wardrobe } from '../state/clothing';
import { createDialogue, createTray } from '../ui/dialogue';
import { WALL_MODES, DEFAULT_LOOKS, lookFrom, nameFrom, type World } from '../kernel/config';
import { type MemoryStore } from '../state/memory';
import { mountShell } from '../ui/shell';
import { loadWorld } from './config';


/** What the camera, the controls and the modules read and change while the game runs. */
export interface View {
  level: number;
  rot: number;
  wallIdx: number;
  speedIdx: number;
  paused: boolean;
  t: number;
  follow: AgentId | null;
}

/** Plain values that more than one module changes. Everything else on Game is set once. */
export interface GameState {
  bond: number;
  freeWill: boolean;
  wardrobe: Wardrobe | null;
  wornHat: string;
  lifeGoal: string | null;
  settleDone: boolean;
  chatTurns: ChatTurn[];
  sample: SampleFn | null;
  chatBudgetDay: number;
  drawerPage: DrawerPage;
  qualityIdx: number;
  saveRev: number;
  suppressClick: boolean;
}

export interface ArrangeFrame { movable: string[]; held: string | null; selected: string | null; valid: boolean; hover: string | null }
export interface Video { id: string; title: string; channelTitle: string; thumbnail: string }

/**
 * The running game. `createGame` fills in the data and the page; each module then adds what it owns
 * (`Object.assign(g, createX(g))`). A module calls the others through `g`, so the order they are made in only
 * matters for things read once at the start.
 */
export interface Game {
  app: HTMLElement;
  world: World;
  save: Record<string, unknown> | null;
  simName: string;
  partnerName: string;
  townName: string;
  people: Agent[];
  house: ReturnType<typeof buildWorld>;
  rng: RNG;
  rngSeed: number;
  view: View;
  s: GameState;
  owned: Set<string>;
  closet: OwnedCloth[];
  flags: Record<string, unknown>;
  style: StyleProfile;
  tasteNorm: ReturnType<typeof computeTasteNorm>;
  coreMem: string[];
  memories: string[];
  pastMem: string[];
  memStore: MemoryStore;
  companionCfg: CompanionConfig;
  log: (msg: string) => void;
  logEntries: string[];
  logEl: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  stage: Element;
  el: (name: string) => HTMLElement;
  btn: (act: string) => HTMLButtonElement;
  personEl: (id: AgentId) => HTMLButtonElement;
  art: ReturnType<typeof createHouseArt>;
  pictureThumbs: Record<string, string>;
  hasAttic: () => boolean;
  storage: ObjectInstance[];
  townSign: HTMLElement;
  drawer: ReturnType<typeof createDrawer>;
  dialogue: ReturnType<typeof createDialogue>;
  tray: ReturnType<typeof createTray>;
  cam: { z: number; fx: number; fy: number; tz: number; tfx: number; tfy: number };

  // camera
  fit(): void;
  applyCamera(frameDt: number): void;
  toView(clientX: number, clientY: number): [number, number];
  zoomAt(clientX: number, clientY: number, factor: number): void;
  resetCamera(): void;
  // controls
  syncControls(): void;
  setLevel(lv: number, keepFollow?: boolean): void;
  rotate(): void;
  cycleWalls(): void;
  togglePause(): void;
  toggleFollow(id: AgentId): void;
  // arrange
  toggleArrange(): void;
  enterArrange(): void;
  exitArrange(): void;
  selectObject(o: ObjectInstance | null): void;
  commitMove(o: ObjectInstance, verb?: string): void;
  rotateSelected(): void;
  recolourHeld(): void;
  cancelHold(): void;
  carryTo(level: number): void;
  storeSelected(): void;
  unstore(id: string): void;
  relearnLayout(moved: ObjectInstance): void;
  arrangeFrame(): ArrangeFrame | null;
  arrangeState(): ArrangeState;
  movableAt(sx: number, sy: number): ObjectInstance | null;
  worldAt(sx: number, sy: number): [number, number];
  peopleOnFloor(): Agent[];
  nameOf(o: ObjectInstance): string;
  isArranging(): boolean;
  dropSelectionIfOffFloor(lv: number): void;
  escapeArrange(): void;
  abortDrag(): void;
  // tapping things
  findObjectAt(sx: number, sy: number): ObjectInstance | null;
  showObjectActions(obj: ObjectInstance, x: number, y: number, poked?: boolean): void;
  handleObjectAction(obj: ObjectInstance, tag: string): void;
  handleOrder(chain: string): void;
  counterPartAt(obj: ObjectInstance, sx: number, sy: number): string;
  // shop, chat, save, drawer, goals
  handleBuy(item: CatalogEntry, color?: string): void;
  handleBuyAvatarItem(id: string): void;
  openChat(): void;
  handleCloseChat(): void;
  handleTalk(text: string): Promise<void>;
  doSave(): void;
  refreshDrawer(): void;
  refreshPeople(): void;
  goalsTick(): void;
  // avatar and host
  applyAvatar(person: Agent, look: { sprites?: unknown; body?: unknown; outfit?: unknown }, who: AgentId): void;
  wearPiece(piece: OwnedCloth): void;
  tellHostLook(top?: OwnedCloth, bottom?: OwnedCloth, hat?: string): void;
  doVidSearch(query: string, cb: (videos: Video[]) => void): void;
  toFrame(p: Agent): PersonFrame;
}

/** Loads the save and builds the data and the page. The modules are added on top by main.ts. */
export function createGame(app: HTMLElement): Game | null {
  const world = loadWorld();
  const save = world.save;

  // Names and looks from save or defaults
  const simName = nameFrom(save?.simName, 'Jordan');
  const partnerName = nameFrom(save?.partnerName, 'Maya');
  const townName = nameFrom(save?.townName, 'Honeysuckle Hollow');

  const people: Agent[] = [
    createAgent('jordan', simName, (save?.jordan as { needs?: Partial<CharacterNeeds> })?.needs, lookFrom(save?.look, DEFAULT_LOOKS.jordan)),
    createAgent('maya', partnerName, (save?.maya as { needs?: Partial<CharacterNeeds> })?.needs, lookFrom(save?.mayaLook, DEFAULT_LOOKS.maya)),
  ];
  const house = buildWorld(world.objs);
  const rngSeed = typeof save?.rngSeed === 'number' ? save.rngSeed : Date.now() & 0xffffffff;
  const rng = new RNG(rngSeed);

  // Game state
  const owned = new Set<string>(Array.isArray(save?.owned) ? save!.owned as string[] : []);
  // Closet: default pieces plus anything bought from the Clothes tab
  const closet: OwnedCloth[] = Array.isArray(save?.closet)
    ? (save!.closet as OwnedCloth[]).filter(c => c.id.startsWith('sig-') || clothByKey(c.id.slice(2)))
    : [
      { slot: 'top', style: 'tee', col: people[0].look.top, name: 'Old tee', id: clothId('tee') },
      { slot: 'top', style: 'tee', col: people[1].look.top, name: 'Shared tee', id: clothId('tee') },
      { slot: 'bottom', style: 'pants', col: people[0].look.bottom, name: 'Old jeans', id: clothId('jeans') },
    ];
  if (!closet.some(c => c.slot === 'bottom')) closet.push({ slot: 'bottom', style: 'pants', col: people[0].look.bottom, name: 'Old jeans', id: clothId('jeans') });
  // What the avatar wardrobe lets the player wear (sent by the host), and the avatar hat they have on.
  const flags: Record<string, unknown> = (save?.flags as Record<string, unknown>) ?? {};
  if (!flags.settleSeen) flags.settleSeen = [];
  if (!flags.styledSet) flags.styledSet = [];
  if (!flags.lifeStep) flags.lifeStep = 0;

  // Style and taste
  const savedStyle = save?.style as Record<string, number> | undefined;
  const style: StyleProfile = savedStyle
    ? { ...savedStyle } as StyleProfile
    : rollStyle(() => rng.next());
  const tasteNorm = computeTasteNorm(CATALOG as unknown as CatalogItem[], style);

  // Memories
  const coreMem: string[] = Array.isArray(save?.coreMem) ? [...save!.coreMem as string[]] : [];
  const memories: string[] = Array.isArray(save?.memories) ? [...save!.memories as string[]] : [];
  const pastMem: string[] = Array.isArray(save?.pastMem) ? [...save!.pastMem as string[]] : [];
  const memStore = { coreMem, memories, pastMem };

  // Chat


  // Companion config
  const companionCfg: CompanionConfig = {
    name: partnerName,
    pronoun: (save?.companion as { pronoun?: 'she' | 'he' | 'they' })?.pronoun ?? 'she',
    preset: (save?.companion as { preset?: 'warm' | 'calm' | 'bubbly' | 'dry' })?.preset ?? 'warm',
    bio: (save?.companion as { bio?: string })?.bio ?? '',
    source: (save?.companion as { source?: 'game' | 'velvet' })?.source ?? 'game',
  };

  // Log
  const logEl = document.createElement('ul');
  logEl.className = 'vh-log';
  const logEntries: string[] = [];
  const log = (msg: string): void => {
    if (!msg) return;
    logEntries.unshift(msg);
    if (logEntries.length > 30) logEntries.pop();
    const li = document.createElement('li');
    li.textContent = msg;
    logEl.prepend(li);
    while (logEl.children.length > 8) logEl.lastChild!.remove();
  };

  const shell = mountShell(app, people, logEl);
  if (!shell) return null;
  const { canvas, ctx, stage, el, btn, personEl } = shell;

  const gpuLights = createGpuLights();
  const gbuffer = createGBuffer();
  const deferredLights = createDeferredLights();
  const art = createHouseArt(ctx, {
    gpuLights: () => gpuLights,
    gbuffer: () => gbuffer,
    deferredLights: () => deferredLights,
    quality: () => qualityManager.getTier(),
  });
  art.registerPictures(PICTURE_WALLS);
  const pictureThumbs: Record<string, string> = Object.fromEntries(PICTURE_WALLS.filter(w => w.thumb).map(w => [w.id, w.thumb]));
  art.applySave(save);
  const savedMode = (save as { wallMode?: string })?.wallMode;
  const view = {
    level: 1,
    rot: 0,
    wallIdx: Math.max(0, WALL_MODES.findIndex((w) => w.mode === savedMode)),
    speedIdx: 0,
    paused: false,
    t: 0,
    follow: null as AgentId | null,
  };

  // The attic exists once its stairs have been built.
  const hasAttic = (): boolean => world.objs.some(o => o.id === ATTIC_STAIR_OBJS[0].id);

  const s: GameState = {
    bond: typeof save?.bond === 'number' ? save.bond : 58,
    freeWill: typeof save?.freeWill === 'boolean' ? save.freeWill : true,
    wardrobe: null as Wardrobe | null,
    wornHat: 'none',
    lifeGoal: typeof save?.lifeGoal === 'string' ? save!.lifeGoal : null,
    settleDone: typeof save?.settleDone === 'boolean' ? save!.settleDone : false,
    chatTurns: Array.isArray(save?.turns) ? [...save!.turns as ChatTurn[]] : [],
    sample: null as SampleFn | null,
    chatBudgetDay: -1, drawerPage: '', qualityIdx: 0, suppressClick: false,
    saveRev: typeof (world.save as { rev?: unknown } | null)?.rev === 'number' ? (world.save as { rev: number }).rev : 0,
  };

  return {
    app, world, save, simName, partnerName, townName, people, house, rng, rngSeed, view, s,
    owned, closet, flags, style, tasteNorm, coreMem, memories, pastMem, memStore, companionCfg,
    log, logEntries, logEl, canvas, ctx, stage, el, btn, personEl, art, pictureThumbs, hasAttic,
  } as unknown as Game;
}
