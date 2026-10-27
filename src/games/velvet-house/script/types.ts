/**
 * Scripts: cutscenes and story beats as data. A script is a list of steps; the engine (engine.ts) runs them one at a
 * time against a host that knows how to do things in the world (spawn a visitor, walk, say a line). Nothing here
 * touches the screen, so the whole thing runs and is tested without a browser.
 */
export type FlagValue = string | number | boolean;
export type Preset = 'warm' | 'calm' | 'bubbly' | 'dry';

/** 'jordan' and 'maya' are the two who live here; anything else is a visitor by id (Dez). */
export type Actor = string;

/** Where: 'door', 'mark:entry.inside', 'obj:<id>', 'objType:sofa', or an exact spot. The host resolves it. */
export type PlaceRef = string | { level: number; x: number; y: number };

/** What a line says: a key into the line book, a variant per companion voice, or the next from a pool that does not repeat. */
export type LineRef = string | { byPreset: Record<Preset, string> } | { pool: string } | { bank: 'humor' | 'communication'; slot: string };

/** Lines by how the companion talks: bank (humor or communication) → style → slot → line. */
export type LineBank = Record<'humor' | 'communication', Record<string, Record<string, string>>>;

/** Things on screen a script can spotlight or allow. */
export type UiTarget = `tab:${string}` | 'floorbar' | 'camera' | 'wallet' | 'bill' | 'needs' | `obj:${string}` | `objType:${string}`;

export type Mode = 'cutscene' | 'guided' | 'beat';

export interface GameEvent { type: string; [key: string]: FlagValue | undefined }

/**
 * Something true about the house itself, checked by the host: an object's type, where it stands (within `within` of a
 * mark, default 0.6), how it faces, whether its light is on. A beat that waits on this ends when the world is right, not
 * when a button was pressed.
 */
export interface WorldCond { obj: string; exists?: boolean; is?: string; at?: PlaceRef; within?: number; rot?: number; lightOn?: boolean }

/** What the host page sends after the game starts; a script can wait for it (`needs.host`). */
export type HostNeed = 'profile' | 'plot';

export type Cond =
  | { flag: string; equals?: FlagValue; exists?: boolean }
  | { event: string; match?: Record<string, FlagValue> }
  | { world: WorldCond }
  | { time: { day?: number; weekday?: number; after?: number; before?: number } }
  | { scriptDone: string }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export interface ChoiceOption {
  label: string;
  set?: Record<string, FlagValue>;
  steps?: Step[];
  /** Exactly one per choice: what skipping picks. */
  default?: boolean;
}

export type Step =
  | { do: 'mode'; mode: Mode; allow?: UiTarget[] }
  | { do: 'spawn'; npc: string; at: PlaceRef; carrying?: string }
  | { do: 'despawn'; npc: string }
  | { do: 'carry'; who: Actor; carrying: string | null }
  | { do: 'place'; who: Actor; at: PlaceRef; face?: Actor | PlaceRef }
  | { do: 'walk'; who: Actor; to: PlaceRef; wait?: boolean }
  | { do: 'face'; who: Actor; toward: Actor | PlaceRef }
  | { do: 'act'; who: Actor; act: string; at?: PlaceRef; wait?: boolean }
  | { do: 'emote'; who: Actor; emote: 'alert' | 'laugh' | 'wave' | 'heart' | 'think' }
  | { do: 'camera'; focus: Actor | PlaceRef | 'wide'; zoom?: number; level?: number }
  | { do: 'say'; who: Actor; line: LineRef }
  | { do: 'choice'; options: ChoiceOption[] }
  | { do: 'card'; title: string; body: string; spotlight?: UiTarget; button?: string }
  | { do: 'highlight'; target: UiTarget | null }
  | { do: 'outline'; objType: string; at: PlaceRef; rot?: number; color?: 'partner' | 'player' } 
  | { do: 'set'; flag: string; value: FlagValue }
  | { do: 'give'; money?: number; items?: string[]; object?: { type: string; at: PlaceRef; id?: string; contents?: string; col?: string } }
  | { do: 'deliver'; category: string; id?: string }
  | { do: 'unlock'; what: string }
  | { do: 'clock'; day?: number; minutes?: number }
  /** A full-screen opening shot (the drive up to the house); waits until it ends. */
  | { do: 'intro'; kind: 'arrival' }
  /** Pulls the room toward evening (0 to 0.42) without moving the clock, so the lights can be seen; 0 puts it back. */
  | { do: 'dim'; amount: number }
  /** `arrive`: wait until these people have stopped walking (for walks started with `wait: false`). */
  | { do: 'wait'; seconds?: number; until?: Cond; arrive?: Actor[] }
  | { do: 'if'; cond: Cond; then: Step[]; else?: Step[] }
  | { do: 'run'; script: string }
  | { do: 'checkpoint' };

export interface ScriptDef {
  id: string;
  trigger: { on: 'newGame' } | { on: 'cond'; cond: Cond };
  mode: Mode;
  /** Plays once and is then done (the default). Deliveries set false. */
  once?: boolean;
  /** Higher starts first when several are waiting. */
  priority?: number;
  /** Values taken from the event that triggered it: `{ category: '$event.category' }`. */
  vars?: Record<string, string>;
  /**
   * What must be in place before the script starts: `host` messages applied (or `timeoutMs` passed, default 1500), and
   * `hold`: residents the script keeps for itself from start to finish, so free will never moves them mid-scene.
   */
  needs?: { host?: HostNeed[]; timeoutMs?: number; hold?: Actor[] };
  steps: Step[];
}

/** What is saved. */
export interface ScriptRuntime {
  done: string[];
  /** The script playing and where to pick it up (`redo`: run the step at `path` again, used for mode steps so the screen is rebuilt). */
  active: { id: string; path: PathItem[]; vars: Record<string, FlagValue>; redo?: boolean } | null;
  /** Waiting to start; a script a more urgent one interrupted carries where it was (`path`, `redo`: run that step again). */
  queue: { id: string; vars: Record<string, FlagValue>; path?: PathItem[]; redo?: boolean; since?: number; heldMs?: number }[];
  /** Per line pool: the indices used so far, so a line does not repeat until the pool has been through. */
  pools: Record<string, number[]>;
}

/** Where a checkpoint sits, through nested blocks: the step index at each level and which branch was taken. */
export interface PathItem { i: number; branch?: 'then' | 'else' | 'run' | number; script?: string }

export const NEW_RUNTIME = (): ScriptRuntime => ({ done: [], active: null, queue: [], pools: {} });

export interface LineBook {
  /** Single lines, or one per companion voice. */
  lines: Record<string, string | Partial<Record<Preset, string>>>;
  /** Pools of lines for a visitor who comes often. */
  pools: Record<string, string[]>;
  /** Lines that follow the companion's humor or communication style. */
  banks?: LineBank;
}

/** What the engine asks the world to do. The game implements it; tests use a fake. */
export interface ScriptHost {
  flags: Record<string, FlagValue>;
  clock(): { day: number; minutes: number };
  names(): { player: string; partner: string; town: string; preset: Preset; humor?: string; communication?: string; relationship?: string };
  setMode(mode: Mode | null, allow: UiTarget[]): void;
  spawn(npc: string, at: PlaceRef, carrying?: string): void;
  despawn(npc: string): void;
  carry(who: Actor, carrying: string | null): void;
  place(who: Actor, at: PlaceRef, face?: Actor | PlaceRef): void;
  walk(who: Actor, to: PlaceRef): void;
  /** True once they have stopped walking (or are not there). */
  arrived(who: Actor): boolean;
  face(who: Actor, toward: Actor | PlaceRef): void;
  act(who: Actor, act: string, at?: PlaceRef): void;
  actDone(who: Actor): boolean;
  emote(who: Actor, emote: string): void;
  camera(focus: Actor | PlaceRef | 'wide', zoom?: number, level?: number): void;
  /** Shows a line. `blocking`: wait for the player to tap through it. Returns how long to hold it when not blocking (seconds). */
  say(who: Actor, text: string, blocking: boolean): number;
  /** True once the player has dismissed the line shown by `say`. */
  sayDone(): boolean;
  showChoice(labels: string[]): void;
  /** The index chosen, or null while waiting. */
  choiceMade(): number | null;
  showCard(title: string, body: string, spotlight?: UiTarget, button?: string): void;
  cardDone(): boolean;
  highlight(target: UiTarget | null): void;
  outline(spec: { objType: string; at: PlaceRef; rot?: number; color?: 'partner' | 'player' } | null): void;
  give(step: { money?: number; items?: string[]; object?: { type: string; at: PlaceRef; id?: string; contents?: string; col?: string } }): void;
  /** What a visitor was carrying is set down: groceries at the door, or a moving box with a purchase in it. */
  deliver(category: string, id?: string): void;
  unlock(what: string): void;
  setClock(day?: number, minutes?: number): void;
  /** Starts a full-screen opening shot; `introDone` is true once it has ended. */
  dim?(amount: number): void;
  intro?(kind: 'arrival'): void;
  introDone?(): boolean;
  /** The script is done with these people: free will and idle choices are theirs again. */
  release(who: Actor[]): void;
  /** Keep these people for the script from its first step (see `ScriptDef.needs.hold`). */
  hold?(who: Actor[]): void;
  /** Is this true of the house right now? */
  check?(w: WorldCond): boolean;
  /** Has the host page sent this yet? */
  ready?(what: HostNeed): boolean;
}
