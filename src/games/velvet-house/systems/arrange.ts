import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour, otherFloors, relocate, canStore, surfaceUnder, putOn, takeOff, carryOnTop, fridgeUnder, type PlacementCheck, type Pose } from '../state/arrange';
import { looksFor, changeLook } from '../state/skins';
import { TYPES, footprint, displayName, type ObjectInstance } from '../state/objects';
import { LEVEL_NAMES, FLOOR_ORDER, ATTIC, WX, WY, roomName } from '../state/house';
import { buildWorld } from '../state/agents';
import { addFood } from '../state/vitals';
import { type ArrangeState } from '../ui/drawer';
import type { Game } from '../kernel/game';

export function createArrange(g: Game): Partial<Game> {
  const { world, save, people, house, view, log, canvas, stage, art, hasAttic, drawer } = g;
  // Arrange mode: tap a piece to select it (it gets an outline), then drag it.
  let arranging = false;
  let selectedObj: ObjectInstance | null = null;
  // A wall piece picked in Arrange, and the drag that slides it along its wall.
  let selectedWall: string | null = null;
  let wallDrag: { id: number; wall: string; x: number; y: number; moving: boolean; grab: [number, number] } | null = null;
  let heldObj: ObjectInstance | null = null; // the piece being dragged right now
  let heldOrig: { x: number; y: number; rot: number; on?: string; z?: number } | null = null;
  // What was on the piece being carried when it was picked up, so putting it back puts those back too.
  let heldKids: Array<{ o: ObjectInstance; x: number; y: number; rot: number; level: number }> = [];
  let heldGrab: [number, number] = [0, 0]; // where on the piece it was grabbed, so it doesn't jump under the finger
  let dragCandidate: { id: number; obj: ObjectInstance; x: number; y: number } | null = null;
  // A piece let go of but not set down yet: it stays where it was dropped, red or green, until Set it down (or Put it
  // back). Letting go of a drag never sets anything.
  let floating: ObjectInstance | null = null;
  let floatOrig: { x: number; y: number; rot: number; level: number; on?: string; z?: number } | null = null;
  let floatKids: Array<{ o: ObjectInstance; x: number; y: number; rot: number; level: number }> = [];
  let floatCheck: PlacementCheck = { ok: true };
  let wasPaused = false;
  let ghost: { x: number; y: number; h: number; level: number } | null = null;
  // The lesson's outline as the piece itself would be set: where its corner goes and how it faces.
  let ghostSpec: { type: string; level: number; x: number; y: number; rot: number } | null = null;

  // Arrange mode
  const toggleArrange = (): void => { if (arranging) drawer.close(); else drawer.open('arrange'); };
  function enterArrange(): void {
    if (arranging) return;
    arranging = true;
    stage.classList.add('vh-arranging');
    selectedObj = null;
    selectedWall = null;
    heldObj = null;
    wasPaused = view.paused;
    view.paused = true;
    g.syncControls();
    // Whole house in the band the panel leaves free (selecting a piece frames that instead).
    const corners: Array<[number, number]> = [[0, 0], [WX, 0], [0, WY], [WX, WY]].map(([x, y]) => art.project(x, y, 0));
    g.frameView(corners, 1, 0.3);
  }
  function exitArrange(): void {
    if (!arranging) return;
    cancelHold();
    settleFloating();
    arranging = false;
    selectedObj = null;
    selectedWall = null;
    wallDrag = null;
    dragCandidate = null;
    hoverObj = null;
    canvas.style.cursor = '';
    g.resetCamera();
    stage.classList.remove('vh-arranging');
    view.paused = wasPaused;
    g.syncControls();
  }
  // Whether the carried piece fits where it is, and why not.
  let heldCheck: PlacementCheck = { ok: true };
  let hoverObj: ObjectInstance | null = null;
  const peopleOnFloor = () => people.filter(p => !p.onStairs);
  const nameOf = (o: ObjectInstance) => (TYPES[o.type]?.name ?? 'furniture').toLowerCase();
  function recheck(): void {
    if (!heldObj) return;
    heldCheck = heldObj.type === 'food' && fridgeUnder(world.objs, heldObj) ? { ok: true } : checkPlacement(world.objs, heldObj, peopleOnFloor());
  }
  const movableHere = (): string[] => world.objs.filter(o => o.level === view.level && isMovable(o)).map(o => o.id);
  // Select a piece: jump to its floor, outline it, and bring it into frame.
  function selectObject(o: ObjectInstance | null): void {
    cancelHold();
    if (floating && o !== floating) settleFloating();
    selectedWall = null;
    selectedObj = o;
    if (!o) return;
    if (o.level !== view.level) { selectedObj = null; g.setLevel(o.level); selectedObj = o; }
    // Frame the piece, and the spot it is headed for when a lesson has marked one, in the space the panels leave.
    // On a phone held upright the whole house is small, so close in on the piece; on a big screen leave the view alone
    // unless a lesson has marked a spot to frame.
    const phone = canvas.getBoundingClientRect().width < 560;
    const pts: Array<[number, number]> = [pieceView(o)];
    const lesson = ghost && ghost.level === o.level;
    if (lesson) pts.push(art.project(ghost!.x, ghost!.y, ghost!.h));
    if (lesson) g.frameView(pts, phone ? 1.8 : 2);
    else if (phone || g.cam.tz > 1.05) g.frameView(pts, Math.max(g.cam.tz, phone ? 1.8 : 1));
  }
  const pieceView = (o: ObjectInstance): [number, number] => {
    const [fw, fd] = footprint(o);
    return art.project(o.x + fw / 2, o.y + fd / 2, (TYPES[o.type].h ?? 1) / 2);
  };
  function heldCentre() {
    if (!heldObj) return null;
    const [fw, fd] = footprint(heldObj);
    return { x: heldObj.x + fw / 2, y: heldObj.y + fd / 2, h: (TYPES[heldObj.type].h ?? 1) / 2 };
  }
  function setGhostTarget(t: { type: string; level: number; x: number; y: number; rot?: number } | null): void {
    const T = t && TYPES[t.type];
    if (!t || !T) { ghost = null; ghostSpec = null; return; }
    ghostSpec = { type: t.type, level: t.level, x: t.x, y: t.y, rot: t.rot ?? 0 };
    const [fw, fd] = (t.rot ?? 0) % 2 ? [T.D, T.W] : [T.W, T.D];
    ghost = { level: t.level, x: t.x + fw / 2, y: t.y + fd / 2, h: (T.h ?? 1) / 2 };
  }
  // A lesson's piece is set exactly on the outline's spot once it is close. Only its place moves: how it faces is the
  // player's to change with Rotate (the lesson teaches that).
  function snapToOutline(o: ObjectInstance, within = 2.5): boolean {
    const s = ghostSpec;
    if (!s || s.type !== o.type || s.level !== o.level) return false;
    if (Math.hypot(o.x - s.x, o.y - s.y) > within) return false;
    const was = { x: o.x, y: o.y };
    Object.assign(o, { x: s.x, y: s.y });
    if (checkPlacement(world.objs, o, peopleOnFloor()).ok) return true;
    Object.assign(o, was);
    return false;
  }
  /** The piece in hand or set loose, if any: it does not count as placed until it is set down. */
  const inHand = (): string | null => heldObj?.id ?? floating?.id ?? null;
  /** Set it down: the loose (or selected) piece stays for good if it fits; if not, it stays loose and says why. */
  function setDown(): void {
    cancelHold();
    const o = floating ?? selectedObj;
    if (!o) return;
    if (o.type === 'food') { const fridge = fridgeUnder(world.objs, o); if (fridge) { floating = null; floatOrig = null; floatKids = []; floatCheck = { ok: true }; g.putFoodAway(o, fridge); return; } }
    const was = { x: o.x, y: o.y };
    snapToOutline(o, 2.5);
    const check = checkPlacement(world.objs, o, peopleOnFloor());
    if (!check.ok) { Object.assign(o, was); floatCheck = check; log(`${check.reason ?? "It doesn't fit there."} Move it, or tap Put it back.`); return; }
    floating = null; floatOrig = null; floatKids = []; floatCheck = { ok: true };
    commitMove(o, 'Set down');
  }
  /** Put it back: the loose piece returns to where it was picked up. */
  function putBack(): void {
    cancelHold();
    if (!floating || !floatOrig) return;
    const o = floating;
    Object.assign(o, { x: floatOrig.x, y: floatOrig.y, rot: floatOrig.rot, level: floatOrig.level });
    if (floatOrig.on) { o.on = floatOrig.on; o.z = floatOrig.z; } else takeOff(o);
    for (const k of floatKids) Object.assign(k.o, { x: k.x, y: k.y, rot: k.rot, level: k.level });
    floating = null; floatOrig = null; floatKids = []; floatCheck = { ok: true };
    relearnLayout(o);
    log(`Put the ${nameOf(o)} back.`);
  }
  /** Leaving a loose piece behind (closing Arrange, picking another): it stays if it fits, else it goes back. */
  function settleFloating(): void {
    if (!floating) return;
    if (checkPlacement(world.objs, floating, peopleOnFloor()).ok) setDown(); else putBack();
  }
  const snapSelectedToOutline = (): void => setDown();
  /** Food set down on the fridge: the door swings open, the groceries go in, the crate is gone. */
  function putFoodAway(food: ObjectInstance, fridge: ObjectInstance): void {
    const bags = (g.flags.bags ?? {}) as Record<string, { servings: number; fresh: boolean }>;
    const what = bags[food.id] ?? { servings: 6, fresh: false };
    delete bags[food.id];
    const i = world.objs.indexOf(food);
    if (i >= 0) world.objs.splice(i, 1);
    if (selectedObj === food) selectedObj = null;
    addFood(world.household, what.servings, what.fresh);
    art.poke(fridge, '');
    art.burst(fridge.level, fridge.x + 0.45, fridge.y + 0.4, 0.9);
    relearnLayout(fridge);
    log(`Put the groceries away: ${what.servings} ${what.fresh ? 'fresh ' : ''}meals in the fridge.`);
    g.scriptEmit({ type: 'groceries.putaway', servings: what.servings });
  }
  function commitMove(o: ObjectInstance, verb = 'Moved'): void {
    log(`${verb} the ${nameOf(o)}.`);
    art.objectPlaced(o.id);
    relearnLayout(o);
    g.scriptEmit({ type: 'obj.placed', objId: o.id, objType: o.type });
  }
  // Turn the piece a quarter where it stands. A piece that was set is loose again afterwards: Set it down keeps it.
  function rotateSelected(): void {
    const o = heldObj ?? floating ?? selectedObj;
    if (!o) return;
    if (o !== heldObj && o !== floating) { floating = o; floatOrig = { x: o.x, y: o.y, rot: o.rot, level: o.level, on: o.on, z: o.z }; floatKids = world.objs.filter((k) => k.on === o.id).map((k) => ({ o: k, x: k.x, y: k.y, rot: k.rot, level: k.level })); }
    const prev: Pose = { x: o.x, y: o.y, rot: o.rot };
    rotateAboutCentre(o);
    carryOnTop(world.objs, o, prev);
    if (o === heldObj) recheck(); else floatCheck = checkPlacement(world.objs, o, peopleOnFloor());
  }
  function recolourHeld(): void {
    const o = heldObj ?? selectedObj ?? hoverObj;
    const col = o && nextColour(o);
    if (!o || !col) return;
    o.col = col;
    log(`Changed the ${nameOf(o)}'s colour.`);
  }
  // Change the selected piece to one of the looks the player has (or its stock look, ''): free, as they own them.
  function useLook(skin: string): void {
    const o = selectedObj;
    if (!o || !looksFor(o, g.owned).some((l) => l.id === skin)) return;
    changeLook(o, skin);
    log(`The ${nameOf(o)} is now the ${displayName(o).toLowerCase()}.`);
  }
  // Put a dragged piece back where it was picked up.
  function cancelHold(): void {
    if (heldObj && heldOrig) {
      heldObj.x = heldOrig.x; heldObj.y = heldOrig.y; heldObj.rot = heldOrig.rot;
      if (heldOrig.on) { heldObj.on = heldOrig.on; heldObj.z = heldOrig.z; } else takeOff(heldObj);
      for (const k of heldKids) Object.assign(k.o, { x: k.x, y: k.y, rot: k.rot, level: k.level });
    }
    heldObj = null;
    heldOrig = null;
    heldKids = [];
    dragCandidate = null;
  }
  // Carry the selected piece up or down the stairs to another floor.
  function carryTo(level: number): void {
    const o = selectedObj;
    if (!o || !otherFloors(o).includes(level) || (level === ATTIC && !hasAttic())) return;
    const from = o.level;
    const before: Pose = { x: o.x, y: o.y, rot: o.rot };
    if (!relocate(world.objs, o, level, peopleOnFloor())) { log(`There's no room for the ${nameOf(o)} on the ${LEVEL_NAMES[level].toLowerCase()}.`); return; }
    carryOnTop(world.objs, o, before);
    selectedObj = null;
    g.setLevel(level);
    selectedObj = o;
    log(`Carried the ${nameOf(o)} ${level > from ? 'up' : 'down'} to the ${LEVEL_NAMES[level].toLowerCase()}. Drag it where you want it.`);
    commitMove(o, 'Set down');
  }
  // Storage: pieces put away leave the house but stay yours, and are saved.
  const storage: ObjectInstance[] = Array.isArray((save as { storage?: unknown } | null)?.storage)
    ? ((save as { storage: ObjectInstance[] }).storage).filter(o => o && TYPES[o.type]).map(o => ({ ...o }))
    : [];
  function storeSelected(): void {
    const o = selectedObj;
    if (!o || !canStore(o)) return;
    cancelHold();
    const i = world.objs.indexOf(o);
    if (i < 0) return;
    // Whatever was on it is set down on the floor nearby.
    for (const k of world.objs.filter((q) => q.on === o.id)) {
      takeOff(k);
      if (!relocate(world.objs, k, o.level, peopleOnFloor(), [o.x, o.y])) { world.objs.splice(world.objs.indexOf(k), 1); storage.push(k); }
    }
    world.objs.splice(world.objs.indexOf(o), 1);
    storage.push(o);
    selectedObj = null;
    relearnLayout(o);
    log(`Put the ${nameOf(o)} in storage.`);
  }
  function unstore(id: string): void {
    const i = storage.findIndex(o => o.id === id);
    if (i < 0) return;
    const [o] = storage.splice(i, 1);
    world.objs.push(o);
    if (!relocate(world.objs, o, view.level, peopleOnFloor())) {
      world.objs.pop();
      storage.splice(i, 0, o);
      log(`There's no room for the ${nameOf(o)} on the ${LEVEL_NAMES[view.level].toLowerCase()}.`);
      return;
    }
    selectedObj = o;
    log(`Took the ${nameOf(o)} out of storage. Drag it where you want it.`);
    commitMove(o, 'Set down');
  }
  // After a move, the household learns the new layout: the spots to stand at,
  // the walkable floor, and anyone heading to (or using) the moved piece
  // starts over, so they walk to where it is now.
  function relearnLayout(moved: ObjectInstance): void {
    Object.assign(house, buildWorld(world.objs));
    for (const p of people) {
      if (p.task?.slot?.id.startsWith(moved.id + ':')) {
        if (p.task.phase === 'do' && p.task.slot.pos) { [p.x, p.y] = p.task.slot.stand; p.z = 0; }
        p.task = null;
        p.idle = 0.2;
      }
    }
  }
  // Wall pieces: picked by a tap on the wall or from the list; they slide along their wall; Take it down stores them.
  const wallAt = (sx: number, sy: number): string | null => (arranging ? art.hitWallObj(view.level, sx, sy) : null);
  function selectWall(id: string | null): void {
    cancelHold();
    settleFloating();
    selectedObj = null;
    selectedWall = id;
    if (!id) return;
    const w = art.wallObjsAll().find((x) => x.id === id);
    if (w && w.level !== view.level) g.setLevel(w.level);
    const p = art.wallObjView(id);
    const phone = canvas.getBoundingClientRect().width < 560;
    if (p && (phone || g.cam.tz > 1.05)) g.frameView([p], Math.max(g.cam.tz, phone ? 1.8 : 1));
  }
  function takeDownWall(): void {
    if (!selectedWall) return;
    const name = art.takeDownWallObj(selectedWall);
    selectedWall = null;
    if (name) log(`Took the ${name.toLowerCase()} down. It's in storage.`);
  }
  function rehangWall(id: string): void {
    const w = art.storedWallObjs().find((x) => x.id === id);
    if (!w) return;
    if (!art.rehangWallObj(id, view.level)) { log(`There's no wall for the ${w.name.toLowerCase()} here.`); return; }
    selectObject(null);
    selectedWall = id;
    log(`Hung the ${w.name.toLowerCase()} in the ${LEVEL_NAMES[view.level].toLowerCase()}. Drag it along the wall.`);
  }
  // What arrange mode tells the art to draw.
  function arrangeFrame() {
    if (!arranging) return null;
    return {
      movable: movableHere(),
      held: heldObj?.id ?? floating?.id ?? null, selected: selectedObj?.id ?? null,
      valid: heldObj ? heldCheck.ok : floating ? floatCheck.ok : true, hover: hoverObj?.id ?? null,
      wall: selectedWall, wallValid: selectedWall ? art.wallObjClear(selectedWall) : true,
    };
  }
  // The Arrange list: everything that can move, wherever it is in the house.
  function arrangeState(): ArrangeState {
    const items = world.objs.filter(isMovable).map((o) => {
      const t = TYPES[o.type];
      const [fw, fd] = t.W && o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
      return { id: o.id, name: displayName(o), room: roomName(o.level, o.x + fw / 2, o.y + fd / 2), level: o.level, color: o.col };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.room.localeCompare(b.room));
    const walls = art.wallObjsAll().map((w) => ({ id: w.id, name: w.name, room: 'On the wall', level: w.level, color: w.col }));
    const o = selectedObj;
    const wall = selectedWall ? walls.find((w) => w.id === selectedWall) ?? null : null;
    return {
      floors: [...LEVEL_NAMES],
      order: FLOOR_ORDER.filter(l => l !== ATTIC || hasAttic()),
      stored: [...storage.map(o => ({ id: o.id, name: displayName(o), color: o.col })), ...art.storedWallObjs().map((w) => ({ id: w.id, name: w.name, color: w.col }))],
      level: view.level,
      items: [...items, ...walls],
      selected: wall ? {
        id: wall.id, name: wall.name, where: `${LEVEL_NAMES[wall.level]} · on the wall`, wall: true,
        canColour: false, looks: [], canStore: false, moveTo: [], loose: false, fits: true,
      } : o ? {
        id: o.id, name: displayName(o),
        where: `${LEVEL_NAMES[o.level]} · ${items.find(i => i.id === o.id)?.room ?? ''}`,
        canColour: !!nextColour(o),
        looks: looksFor(o, g.owned),
        canStore: canStore(o),
        moveTo: otherFloors(o).filter(l => l !== ATTIC || hasAttic()),
        loose: o === floating, fits: o === floating ? floatCheck.ok : true, reason: o === floating && !floatCheck.ok ? floatCheck.reason : undefined,
      } : null,
    };
  }
  const worldAt = (sx: number, sy: number): [number, number] => art.unproject(sx, sy);
  const movableAt = (sx: number, sy: number): ObjectInstance | null => {
    const o = art.hitObject(view.level, sx, sy, movableHere());
    return o && isMovable(o) ? o : null;
  };

  // Arrange mode: press a piece to select it and drag to carry it (mouse or
  // finger). With a mouse, whatever's under the pointer is highlighted.
  const DRAG_SLOP = 6;
  canvas.addEventListener('pointerdown', (e) => {
    if (!arranging || !e.isPrimary || e.button > 0) return;
    const [sx, sy] = g.toView(e.clientX, e.clientY);
    const o = movableAt(sx, sy);
    if (!o) {
      // Nothing on the floor there: maybe a wall piece, which slides along its wall.
      const wid = wallAt(sx, sy);
      if (!wid) return;
      selectWall(wid);
      const c = art.wallObjView(wid) ?? [sx, sy];
      wallDrag = { id: e.pointerId, wall: wid, x: e.clientX, y: e.clientY, moving: false, grab: [sx - c[0], sy - c[1]] };
      try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable: drag still works while over the canvas */ }
      return;
    }
    selectObject(o);
    const [wx, wy] = worldAt(sx, sy), [fw, fd] = [TYPES[o.type].W, TYPES[o.type].D];
    const [cw, cd] = o.rot % 2 ? [fd, fw] : [fw, fd];
    heldGrab = [wx - (o.x + cw / 2), wy - (o.y + cd / 2)];
    dragCandidate = { id: e.pointerId, obj: o, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not capturable: drag still works while over the canvas */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!arranging) return;
    const [sx, sy] = g.toView(e.clientX, e.clientY);
    if (wallDrag && wallDrag.id === e.pointerId) {
      if (!wallDrag.moving) { if (Math.hypot(e.clientX - wallDrag.x, e.clientY - wallDrag.y) < DRAG_SLOP) return; wallDrag.moving = true; g.s.suppressClick = true; }
      art.moveWallObj(wallDrag.wall, sx, sy, wallDrag.grab);
      return;
    }
    if (dragCandidate && dragCandidate.id === e.pointerId) {
      if (!heldObj) {
        if (Math.hypot(e.clientX - dragCandidate.x, e.clientY - dragCandidate.y) < DRAG_SLOP) return;
        heldObj = dragCandidate.obj;
        const again = floating === heldObj && floatOrig;
        heldOrig = again ? { x: floatOrig!.x, y: floatOrig!.y, rot: floatOrig!.rot, on: floatOrig!.on, z: floatOrig!.z } : { x: heldObj.x, y: heldObj.y, rot: heldObj.rot, on: heldObj.on, z: heldObj.z };
        heldKids = again ? floatKids : world.objs.filter((k) => k.on === heldObj!.id).map((k) => ({ o: k, x: k.x, y: k.y, rot: k.rot, level: k.level }));
        if (again) { floating = null; floatOrig = null; floatKids = []; }
        g.s.suppressClick = true;
      }
      const [wx, wy] = worldAt(sx, sy);
      const prev: Pose = { x: heldObj.x, y: heldObj.y, rot: heldObj.rot };
      centreAt(heldObj, wx - heldGrab[0], wy - heldGrab[1]);
      // A small piece over a table or shelf sits on it; anything on a piece being carried goes along.
      if (TYPES[heldObj.type].small) {
        const host = surfaceUnder(world.objs, heldObj, wx, wy);
        if (host) putOn(heldObj, host); else takeOff(heldObj);
      } else carryOnTop(world.objs, heldObj, prev);
      recheck();
    } else if (!heldObj && e.pointerType === 'mouse') {
      const o = movableAt(sx, sy);
      hoverObj = o;
      canvas.style.cursor = o ? (o === selectedObj ? 'grab' : 'pointer') : wallAt(sx, sy) ? 'grab' : '';
    }
  });
  // Let go: it stays where it fits, or goes back to where it was.
  const dropHeld = (e: PointerEvent): void => {
    if (wallDrag && wallDrag.id === e.pointerId) {
      const w = art.wallObjsAll().find((x) => x.id === wallDrag!.wall);
      if (wallDrag.moving && w) log(art.wallObjClear(w.id) ? `Moved the ${w.name.toLowerCase()}.` : `The ${w.name.toLowerCase()} overlaps something. Slide it along a little.`);
      wallDrag = null;
      return;
    }
    if (!dragCandidate || dragCandidate.id !== e.pointerId) return;
    const o = heldObj;
    const tapped = dragCandidate.obj;
    dragCandidate = null;
    // A tap (no drag) on a moving box opens it, even while arranging: boxes are for opening.
    if (!o) { if ((tapped.type === 'pbox' || tapped.type === 'bag') && tapped.contents) g.handleObjectAction(tapped, 'unpack'); return; }
    recheck();
    // Food let go of on the fridge goes straight in: the door swings open and the groceries are put away.
    if (o.type === 'food') { const fridge = fridgeUnder(world.objs, o); if (fridge) { heldObj = null; heldOrig = null; heldKids = []; heldCheck = { ok: true }; g.putFoodAway(o, fridge); return; } }
    // Let go: the piece stays where it is, loose, until Set it down. Red means it does not fit yet.
    floating = o; floatOrig = heldOrig ? { ...heldOrig, level: o.level } : { x: o.x, y: o.y, rot: o.rot, level: o.level }; floatKids = heldKids; floatCheck = heldCheck;
    heldObj = null; heldOrig = null; heldKids = [];
    if (!floatCheck.ok) log(`${floatCheck.reason ?? "It doesn't fit there."} Move it, or tap Put it back.`);
    heldCheck = { ok: true };
  };
  canvas.addEventListener('pointerup', dropHeld);
  canvas.addEventListener('pointercancel', (e) => { if (wallDrag?.id === e.pointerId) wallDrag = null; if (dragCandidate?.id === e.pointerId) { cancelHold(); heldCheck = { ok: true }; } });


  const isArranging = (): boolean => arranging;
  function dropSelectionIfOffFloor(lv: number): void {
    if (selectedObj && selectedObj.level !== lv) { cancelHold(); settleFloating(); selectedObj = null; }
  }
  function escapeArrange(): void { if (heldObj) cancelHold(); else if (floating) putBack(); else { selectedObj = null; selectedWall = null; } }
  /** A second finger came down: let go of whatever is being dragged. */
  function abortDrag(): void {
    if (heldObj) { cancelHold(); heldCheck = { ok: true }; }
    dragCandidate = null;
    wallDrag = null;
  }
  return { storage, toggleArrange, enterArrange, exitArrange, selectObject, wallAt, selectWall, takeDownWall, rehangWall, commitMove, rotateSelected, recolourHeld, useLook, cancelHold, carryTo, storeSelected, unstore, relearnLayout, arrangeFrame, arrangeState, movableAt, worldAt, peopleOnFloor, nameOf, isArranging, snapSelectedToOutline, setDown, putBack, putFoodAway, inHand, heldCentre, setGhostTarget, ghostTarget: () => ghost, dropSelectionIfOffFloor, escapeArrange, abortDrag };
}
