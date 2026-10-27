// Types for streetArt.js (the Velvet World art kit). The kit is plain JS so the demo page can
// inline it; import it from TypeScript as `../art/streetArt.js` and these types apply.

export type HouseStyle =
  | 'standard' | 'cottage' | 'bungalow' | 'ranch' | 'cabin'
  | 'craftsman' | 'modern' | 'colonial' | 'victorian' | 'villa'
  | 'lighthouse' | 'observatory' | 'treehouse' | 'windmill' | 'castle';
export type HouseTier = 'starter' | 'member' | 'earned';
export type Season = 'spring' | 'summer' | 'fall' | 'winter';
export type PlotLayer = 'back' | 'front';

export interface Option { id: string; label: string; free?: boolean }
export interface HouseStyleInfo { id: HouseStyle; label: string; tier: HouseTier; medal?: string }

export interface HouseConfig { style?: HouseStyle; body?: string; trim?: string; roof?: string; door?: string; windows?: string }
export interface PlotConfig {
  house?: HouseConfig;
  sign?: { style?: string; color?: string };
  car?: { type?: string; color?: string };
  pet?: { kind?: string; coat?: string };
  lawn?: string;
  tree?: string;
  extras?: { fountain?: boolean; flag?: boolean; lights?: boolean; lanterns?: boolean };
}
export interface PlotProfile {
  name: string;
  headline?: string | null;
  goal?: { label: string; pct: number } | null;
  medals?: string[];        // up to 3 slugs shown on the billboard
  earned?: string[];        // medals that unlock earned houses
  medalCount?: number;
  spaces?: string[];
  newNeighbor?: boolean;
  live?: boolean;           // a real person, so the town marks the house "live"
  address?: string;
  crew?: string | null;
}
export interface Plot {
  id: string;
  number?: number;
  member: boolean;
  origin?: { x: number; y: number } | null; // set in the town view (townSlot), null on the street
  profile: PlotProfile;
  config: PlotConfig;
  _resolved?: ResolvedPlot | null;          // cache; set to null whenever member/config/profile changes
  _meta?: PlotMeta;
}
export interface ResolvedPlot {
  member: boolean; seed: number; houseBy: 'starter' | 'member' | 'medal';
  house: Required<Omit<HouseConfig, 'style'>> & { style: HouseStyle; variant: Record<string, unknown> };
  sign: { style: string; color: string };
  car: { type: string; color: string } | null;
  pet: { kind: string; coat: string } | null;
  lawn: string; tree: string; extras: NonNullable<PlotConfig['extras']>; profile: PlotProfile;
}
export interface PlotMeta {
  resolved: ResolvedPlot;
  hit: { sign?: [number, number][]; house?: [number, number][]; [k: string]: [number, number][] | undefined };
  lights: unknown[]; chimneys: unknown[]; strips: unknown[]; number: number;
}
export interface Env { season: Season; hour: number; night: number; reducedMotion: boolean; zoom?: number }
export interface View { x0: number; y0: number; x1: number; y1: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Slot { x: number; y: number; row: number; col: number; address: string }
export interface TownLayout { slots: Slot[]; rows: number; width: number; depth: number; square: { x: number; y: number; cx: number; cy: number } }

export const TW: number, TH: number, ZH: number, LOT_W: number;
export const STREET: Record<'lawnFront' | 'walkFront' | 'vergeFront' | 'road0' | 'road1' | 'farVerge1' | 'farWalk1', number>;
export const STREET_NAME: string;
export const FONTS: Record<'ui' | 'display' | 'slab' | 'serif' | 'neon', string>;
export function iso(x: number, y: number, z?: number): [number, number];

export const HOUSE_STYLES: HouseStyleInfo[];
export const HOUSE_TIERS: Record<HouseTier, { label: string; note: string }>;
export function houseInfo(style: string): HouseStyleInfo;
export function houseTier(style: string): HouseTier;
export function houseUnlock(style: string, member: boolean, earned?: string[]): { ok: boolean; by: 'starter' | 'member' | 'medal' | null; need?: string; medal?: string };
export const WINDOW_STYLES: Option[], BILLBOARD_STYLES: Option[], CAR_TYPES: Option[], PET_TYPES: Option[], LAWN_STYLES: Option[], TREE_TYPES: Option[], EXTRAS: Option[];
export const COLORS: { body: string[]; trim: string[]; roof: string[]; door: string[]; car: string[]; sign: string[]; coat: Record<'dog' | 'cat', string[]> };
export const STYLE_DEFAULTS: Record<HouseStyle, Required<Omit<HouseConfig, 'style'>>>;
export const FREE_PRESETS: Array<Pick<Required<HouseConfig>, 'body' | 'trim' | 'roof' | 'door'>>;
export const TIER_COLORS: Record<'bronze' | 'silver' | 'gold' | 'legendary', string>;
export const MEDALS: Record<string, { name: string; tier: 'bronze' | 'silver' | 'gold' | 'legendary'; glyph: string }>;
export function resolvePlot(plot: Plot): ResolvedPlot;
export function shade(hex: string, amount: number): string;
export function mix(a: string, b: string, t: number): string;
export function rgba(hex: string, alpha: number): string;
export function glyph(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, size: number, color: string): void;

export function plotOrigin(i: number, plot?: Plot): [number, number];
export function plotBounds(i: number, plot?: Plot): Rect;
export function drawPlot(ctx: CanvasRenderingContext2D, plot: Plot, i: number, layer: PlotLayer, env: Env): PlotMeta;
export function drawPlotLive(ctx: CanvasRenderingContext2D, plot: Plot, i: number, meta: PlotMeta, t: number, env: Env): void;
export function drawPlotLights(ctx: CanvasRenderingContext2D, plot: Plot, i: number, meta: PlotMeta, t: number, env: Env): void;
export function lightingAt(hour: number, season: Season): { tint: string; night: number; golden: number };

export function townExtent(n: number): View;
export function drawTownGround(ctx: CanvasRenderingContext2D, n: number, env: Env, view: View | null, landmarkPct?: number): { lights: unknown[] };
export function drawTownFront(ctx: CanvasRenderingContext2D, n: number, env: Env, view: View | null): { lamps: unknown[] };
export function drawTownLights(ctx: CanvasRenderingContext2D, n: number, t: number, env: Env, ground: unknown, front: unknown): void;
export function drawWeather(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, env: Env): void;

export const TOWN: { perRow: number; rowPitch: number };
export const STREET_NAMES: string[];
export function townSlot(n: number): Slot;
export function townLayout(count: number): TownLayout;
export function townBounds(layout: TownLayout): Rect;
export function drawTownStreets(ctx: CanvasRenderingContext2D, layout: TownLayout, env: Env, view: View | null, detail: boolean): void;
export function drawTownSquare(ctx: CanvasRenderingContext2D, layout: TownLayout, env: Env, view: View | null, pct?: number): { lights: unknown[] };
export function drawPlotLowDetail(ctx: CanvasRenderingContext2D, plot: Plot, env: Env): void;
export function drawTownLightsLow(ctx: CanvasRenderingContext2D, plots: Plot[], t: number, env: Env, view: View | null): void;
