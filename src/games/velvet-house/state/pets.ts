export type PetKind = 'cat' | 'dog';
export type PetState = 'idle' | 'walk' | 'sleep' | 'eat' | 'sit' | 'beg' | 'door' | 'potty' | 'litter' | 'groom' | 'wait' | 'happy';
export type PetPose = 'stand' | 'walk' | 'run' | 'sit' | 'sleep' | 'eat' | 'crouch' | 'groom' | 'play' | 'happy';
export type PetWant = 'feed' | 'play' | 'love' | null;

export interface PetNeeds {
  food: number;
  play: number;
  love: number;
  bladder?: number;
}

export interface Pet {
  id: string;
  kind: PetKind;
  coat: PetCoat;
  furRGB: string;
  name: string;
  level: number;
  x: number;
  y: number;
  z: number;
  alpha: number;
  front: boolean;
  flip: number;
  route: unknown[];
  state: PetState;
  pose: PetPose;
  timer: number;
  seed: number;
  needs: PetNeeds;
  bowlFood: number;
  litterUses: number;
  litterT: number;
  hearts: number;
  away: { until: number } | null;
  hold: unknown | null;
  cameIn: number;
  spd: number;
  want: PetWant;
  who: unknown | null;
  next: { state: PetState; dur: number; who: unknown } | null;
  offBed?: number[];
  doorLogged?: boolean;
  followT?: number;
  bowl?: unknown;
  bed?: unknown;
  litter?: unknown;
}

export interface PetCoat {
  n: string;
  c: string;
  d: string;
  rgb: string;
}

export const PET_COATS: Record<PetKind, PetCoat[]> = {
  cat: [
    { n: 'orange tabby', c: '#D9822B', d: '#B5651D', rgb: '217,130,43' },
    { n: 'gray', c: '#8E8A90', d: '#6E6A70', rgb: '142,138,144' },
    { n: 'black', c: '#2F2C34', d: '#1E1C22', rgb: '60,56,64' },
    { n: 'cream', c: '#EFE3CF', d: '#CDBFA8', rgb: '220,210,190' },
  ],
  dog: [
    { n: 'golden', c: '#D2A86E', d: '#A87E48', rgb: '201,162,107' },
    { n: 'chocolate', c: '#6B4A35', d: '#4F3524', rgb: '107,74,53' },
    { n: 'black and white', c: '#2F2C34', d: '#F2EEE8', rgb: '60,56,64' },
  ],
};

export const PET_NAMES: Record<PetKind, string[]> = {
  cat: ['Biscuit', 'Mochi', 'Pepper', 'Juniper', 'Nori'],
  dog: ['Waffles', 'Bruno', 'Cocoa', 'Rocket', 'Pudding'],
};

export const PET_STATE_POSE: Record<string, PetPose> = {
  potty: 'crouch',
  eat: 'eat',
  sleep: 'sleep',
  litter: 'crouch',
  door: 'sit',
  beg: 'sit',
  sit: 'sit',
  idle: 'stand',
  groom: 'groom',
};

export const PET_DECAY: Record<PetKind, PetNeeds> = {
  dog: { food: 5, play: 5.5, love: 3.5, bladder: 7 },
  cat: { food: 4, play: 4, love: 3 },
};

export function petMood(p: Pet): 'happy' | 'okay' | 'needy' | 'miserable' {
  const vals = Object.values(p.needs);
  const v = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (v > 70) return 'happy';
  if (v > 45) return 'okay';
  if (v > 25) return 'needy';
  return 'miserable';
}

export function petFree(p: Pet): boolean {
  return !p.away && !p.hold && !(p.route[0] && (p.route[0] as { type?: string }).type === 'stair');
}

export function petWantsNow(p: Pet): boolean {
  if (p.want === 'feed') return p.needs.food < 50 && !(p.bowlFood > 0);
  if (p.want === 'play') return p.needs.play < 55;
  if (p.want === 'love') return p.needs.love < 55;
  return false;
}

export function petDecayNeeds(p: Pet, gm: number): void {
  const D = PET_DECAY[p.kind];
  const slow = p.away ? 0.4 : p.state === 'sleep' ? 0.35 : 1;
  for (const k in p.needs) {
    const key = k as keyof PetNeeds;
    const d = D[key] || 0;
    const mul = key === 'bladder' ? (p.away ? 0 : 1) : slow;
    p.needs[key] = Math.max(0, Math.min(100, p.needs[key]! - d * mul * gm / 60)) as number;
  }
}

export function petEnd(p: Pet): void {
  if (p.state === 'eat') {
    const take = Math.min(p.bowlFood || 0, 1);
    p.bowlFood = (p.bowlFood || 0) - take;
    if (take) p.needs.food = Math.min(100, p.needs.food + 60);
  }
  if (p.state === 'litter') {
    p.litterUses = (p.litterUses || 0) + 1;
    p.litterT = 0;
  }
  if (p.state === 'potty') {
    p.needs.bladder = 100;
    p.doorLogged = false;
  }
  if (p.z > 0) {
    if (p.offBed) [p.x, p.y] = p.offBed;
    p.z = 0;
  }
  p.state = 'idle';
  p.pose = 'stand';
  p.timer = 0;
  p.want = null;
}

export function petPick(pets: Pet[], kind: 'play' | 'love'): Pet | null {
  const free = pets.filter(petFree);
  if (!free.length) return null;
  free.sort((a, b) => a.needs[kind] - b.needs[kind]);
  return free[0];
}

export function weight(v: number): number {
  return Math.max(0, 1 - v / 100);
}

export function petScoreForActivity(
  pets: Pet[],
  petFood: number,
  n: string,
  isMaya: boolean,
  hour: number
): number {
  const home = pets.filter(p => !p.away);
  const mul = isMaya ? 1.25 : 1;
  if (!home.length) return -1;

  if (n === 'feedPet') {
    const p = home.find(q => q.needs.food < 50 && !(q.bowlFood > 0));
    return p && petFood > 0 ? (0.25 + weight(p.needs.food) * 0.5) * mul : -1;
  }
  if (n === 'scoop') {
    const p = home.find(q => q.kind === 'cat');
    return p && p.litterUses >= 3 ? 0.05 * p.litterUses * mul : -1;
  }
  if (n === 'walkDog') {
    const p = home.find(q => q.kind === 'dog');
    return p && petFree(p) && (p.needs.bladder! < 45 || p.needs.play < 45) && hour >= 6 && hour < 22.5
      ? (0.12 + weight(p.needs.bladder || 50) * 0.6 + weight(p.needs.play) * 0.25) * mul
      : -1;
  }
  const p = petPick(pets, n === 'playPet' ? 'play' : 'love');
  if (!p) return -1;
  return (n === 'playPet'
    ? 0.05 + weight(p.needs.play) * 0.4
    : 0.08 + weight(p.needs.love) * 0.45
  ) * (isMaya ? 1.15 : 1) * mul;
}

export function petActivityLabel(p: Pet, hour: number): string {
  if (p.away) return `back around ${clockText(p.away.until % 1440)}`;
  if (p.hold) {
    const h = p.hold as { task?: { name?: string; phase?: string }, away?: unknown };
    if (h.task && h.task.name === 'errand') return 'Going for a walk';
    if (h.task && h.task.phase === 'do') return h.task.name === 'playPet' ? 'Playing' : 'Getting pets';
    return 'Waiting';
  }
  if (p.state === 'walk') {
    if (p.next?.state === 'door') return 'Heading to the door';
    if (p.next?.state === 'eat') return 'Heading to the bowl';
    return 'Trotting around';
  }
  if (p.state === 'beg') {
    return p.want === 'feed' ? 'Begging for food'
      : p.want === 'play' ? 'Wants to play'
      : p.want === 'love' ? 'Wants attention'
      : 'Hanging out';
  }
  const labels: Record<string, string> = {
    potty: 'Doing their business',
    sleep: inWindow(hour, 23, 6.5) ? 'Asleep' : 'Napping',
    eat: 'Eating',
    door: 'Waiting to go out',
    litter: 'In the litter box',
    groom: 'Grooming',
    sit: 'Sitting',
    idle: 'Chilling',
  };
  return labels[p.state] || 'Chilling';
}

function inWindow(h: number, start: number, end: number): boolean {
  if (start <= end) return h >= start && h < end;
  return h >= start || h < end;
}

function clockText(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  const ap = h < 12 ? 'am' : 'pm';
  const dh = h % 12 || 12;
  return `${dh}:${m.toString().padStart(2, '0')}${ap}`;
}
