import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const art = fs.readFileSync(path.join(root, 'art/houseArt.js'), 'utf8');

describe('level data has one source', () => {
  it('the art imports levels, stairs, lights and names instead of redefining them', () => {
    for (const name of ['LEVELS', 'STAIRS', 'WALL_LIGHTS', 'LEVEL_NAMES', 'DOOR']) {
      expect(art).not.toMatch(new RegExp(`const ${name}\\s*=`));
    }
    expect(art).toMatch(/from '\.\.\/state\/house'/);
  });

  it('only house.ts declares the level names', () => {
    const files = fs.readdirSync(path.join(root, 'state')).filter((f) => f.endsWith('.ts'));
    const owners = files.filter((f) => /export const LEVEL_NAMES\s*=/.test(fs.readFileSync(path.join(root, 'state', f), 'utf8')));
    expect(owners).toEqual(['house.ts']);
  });
});

describe('object types', () => {
  it('the art adds drawing only; sizes, spots and lights live in state/objects.ts', () => {
    expect(art).toMatch(/TYPES as STATE_TYPES/);
    expect(art).not.toMatch(/\n\s+\w+: \{ W: /);
  });
});
