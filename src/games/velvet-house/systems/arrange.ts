import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour, otherFloors, relocate, canStore, type PlacementCheck } from '../state/arrange';
import { TYPES, type ObjectInstance } from '../state/objects';
import { LEVEL_NAMES, FLOOR_ORDER, ATTIC, roomName } from '../state/house';
import { buildWorld } from '../state/agents';
import { type ArrangeState } from '../ui/drawer';
import type { Game } from '../kernel/game';

export function createArrange(g: Game): Partial<Game> {
  const { world, save, people, house, view, log, canvas, stage, art, hasAttic, cam, drawer } = g;
  // Arrange mode: tap a piece to select it (it gets an outline), then drag it.
  let arranging = false;
  let selectedObj: ObjectInstance | null = null;
  let heldObj: ObjectInstance | null = null; // the piece being dragged right now
  let heldOrig: { x: number; y: number; rot: number } | null = null;
  let heldGrab: [number, number] = [0, 0]; // where on the piece it was grabbed, so it doesn't jump under the finger
  let dragCandidate: { id: number; obj: ObjectInstance; x: number; y: number } | null = null;
  let wasPaused = false;

  // Arrange mode
  const toggleArrange = (): void => { if (arranging) drawer.close(); else drawer.open('arrange'); };
  function enterArrange(): void {
    if (arranging) return;
    arranging = true;
    stage.classList.add('vh-arranging');
    selectedObj = null;
    heldObj = null;
    wasPaused = view.paused;
    view.paused = true;
    g.syncControls();
  }
  function exitArrange(): void {
    if (!arranging) return;
    cancelHold();
    arranging = false;
    selectedObj = null;
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
    if (heldObj) heldCheck = checkPlacement(world.objs, heldObj, peopleOnFloor());
  }
  const movableHere = (): string[] => world.objs.filter(o => o.level === view.level && isMovable(o)).map(o => o.id);
  // Select a piece: jump to its floor, outline it, and bring it into frame.
  function selectObject(o: ObjectInstance | null): void {
    cancelHold();
    selectedObj = o;
    if (!o) return;
    if (o.level !== view.level) { selectedObj = null; g.setLevel(o.level); selectedObj = o; }
    // On a phone held upright the whole house is small: close in on the piece so it's easy to drag.
    if (canvas.getBoundingClientRect().width < 560 && cam.tz < 1.6) cam.tz = 1.8;
    if (cam.tz > 1.05) {
      const [fw, fd] = [TYPES[o.type].W, TYPES[o.type].D];
      const [px, py] = art.project(o.x + fw / 2, o.y + fd / 2, (TYPES[o.type].h ?? 1) / 2);
      cam.tfx = px; cam.tfy = py;
    }
  }
  // Set a piece down for good: the house learns where it is now.
  function commitMove(o: ObjectInstance, verb = 'Moved'): void {
    log(`${verb} the ${nameOf(o)}.`);
    art.objectPlaced(o.id);
    relearnLayout(o);
  }
  // Turn the selected piece a quarter, skipping turns that don't fit.
  function rotateSelected(): void {
    const o = heldObj ?? selectedObj;
    if (!o) return;
    const orig = { x: o.x, y: o.y, rot: o.rot };
    if (o === heldObj) { rotateAboutCentre(o); recheck(); return; }
    for (let i = 0; i < 3; i++) {
      rotateAboutCentre(o);
      if (checkPlacement(world.objs, o, peopleOnFloor()).ok) { commitMove(o, 'Turned'); return; }
    }
    Object.assign(o, orig);
    log(`There's no room to turn the ${nameOf(o)} here.`);
  }
  function recolourHeld(): void {
    const o = heldObj ?? selectedObj ?? hoverObj;
    const col = o && nextColour(o);
    if (!o || !col) return;
    o.col = col;
    log(`Changed the ${nameOf(o)}'s colour.`);
  }
  // Put a dragged piece back where it was picked up.
  function cancelHold(): void {
    if (heldObj && heldOrig) { heldObj.x = heldOrig.x; heldObj.y = heldOrig.y; heldObj.rot = heldOrig.rot; }
    heldObj = null;
    heldOrig = null;
    dragCandidate = null;
  }
  // Carry the selected piece up or down the stairs to another floor.
  function carryTo(level: number): void {
    const o = selectedObj;
    if (!o || !otherFloors(o).includes(level) || (level === ATTIC && !hasAttic())) return;
    const from = o.level;
    if (!relocate(world.objs, o, level, peopleOnFloor())) { log(`There's no room for the ${nameOf(o)} on the ${LEVEL_NAMES[level].toLowerCase()}.`); return; }
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
    world.objs.splice(i, 1);
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
  // What arrange mode tells the art to draw.
  function arrangeFrame() {
    if (!arranging) return null;
    return {
      movable: movableHere(),
      held: heldObj?.id ?? null, selected: selectedObj?.id ?? null,
      valid: heldCheck.ok, hover: hoverObj?.id ?? null,
    };
  }
  // The Arrange list: everything that can move, wherever it is in the house.
  function arrangeState(): ArrangeState {
    const items = world.objs.filter(isMovable).map((o) => {
      const t = TYPES[o.type];
      const [fw, fd] = t.W && o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
      return { id: o.id, name: t.name ?? o.type, room: roomName(o.level, o.x + fw / 2, o.y + fd / 2), level: o.level, color: o.col };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.room.localeCompare(b.room));
    const o = selectedObj;
    return {
      floors: [...LEVEL_NAMES],
      order: FLOOR_ORDER.filter(l => l !== ATTIC || hasAttic()),
      stored: storage.map(o => ({ id: o.id, name: TYPES[o.type]?.name ?? o.type, color: o.col })),
      level: view.level,
      items,
      selected: o ? {
        id: o.id, name: TYPES[o.type]?.name ?? o.type,
        where: `${LEVEL_NAMES[o.level]} · ${items.find(i => i.id === o.id)?.room ?? ''}`,
        canColour: !!nextColour(o),
        canStore: canStore(o),
        moveTo: otherFloors(o).filter(l => l !== ATTIC || hasAttic()),
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
    if (!o) return;
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
    if (dragCandidate && dragCandidate.id === e.pointerId) {
      if (!heldObj) {
        if (Math.hypot(e.clientX - dragCandidate.x, e.clientY - dragCandidate.y) < DRAG_SLOP) return;
        heldObj = dragCandidate.obj;
        heldOrig = { x: heldObj.x, y: heldObj.y, rot: heldObj.rot };
        g.s.suppressClick = true;
      }
      const [wx, wy] = worldAt(sx, sy);
      centreAt(heldObj, wx - heldGrab[0], wy - heldGrab[1]);
      recheck();
    } else if (!heldObj && e.pointerType === 'mouse') {
      const o = movableAt(sx, sy);
      hoverObj = o;
      canvas.style.cursor = o ? (o === selectedObj ? 'grab' : 'pointer') : '';
    }
  });
  // Let go: it stays where it fits, or goes back to where it was.
  const dropHeld = (e: PointerEvent): void => {
    if (!dragCandidate || dragCandidate.id !== e.pointerId) return;
    const o = heldObj;
    dragCandidate = null;
    if (!o) return;
    recheck();
    if (heldCheck.ok) {
      heldObj = null; heldOrig = null;
      commitMove(o);
    } else {
      log(`${heldCheck.reason ?? "It doesn't fit there."} Back it goes.`);
      cancelHold();
    }
    heldCheck = { ok: true };
  };
  canvas.addEventListener('pointerup', dropHeld);
  canvas.addEventListener('pointercancel', (e) => { if (dragCandidate?.id === e.pointerId) { cancelHold(); heldCheck = { ok: true }; } });


  const isArranging = (): boolean => arranging;
  function dropSelectionIfOffFloor(lv: number): void {
    if (selectedObj && selectedObj.level !== lv) { cancelHold(); selectedObj = null; }
  }
  function escapeArrange(): void { if (heldObj) cancelHold(); else selectedObj = null; }
  /** A second finger came down: let go of whatever is being dragged. */
  function abortDrag(): void {
    if (heldObj) { cancelHold(); heldCheck = { ok: true }; }
    dragCandidate = null;
  }
  return { storage, toggleArrange, enterArrange, exitArrange, selectObject, commitMove, rotateSelected, recolourHeld, cancelHold, carryTo, storeSelected, unstore, relearnLayout, arrangeFrame, arrangeState, movableAt, worldAt, peopleOnFloor, nameOf, isArranging, dropSelectionIfOffFloor, escapeArrange, abortDrag };
}
