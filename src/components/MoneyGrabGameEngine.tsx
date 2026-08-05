import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Pause, Trophy } from 'lucide-react';

interface MoneyGrabGameEngineProps {
  playerName: string;
  companionName: string;
  onGameComplete?: (finalScore: number, level: number) => void;
}

const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 19;
const TILE_SIZE = 30;
const MOVE_SPEED = 3;
const CASH_POINTS = 100;
const POWER_UP_POINTS = 500;

type Direction = 'up' | 'down' | 'left' | 'right';

interface Position {
  row: number;
  col: number;
}

interface PixelPosition {
  x: number;
  y: number;
}

interface Player {
  gridPos: Position;
  pixelPos: PixelPosition;
  currentDir: Direction | null;
  nextDir: Direction | null;
  score: number;
  powerUpActive: boolean;
  powerUpExpiry: number;
  isGrabbing: boolean;
}

interface Enemy {
  id: string;
  gridPos: Position;
  dir: Direction;
  color: string;
  lastHitTime: number;
  isPaused: boolean;
  isLocked?: boolean;
}

interface ExitPoint {
  position: Position;
  direction: 'up' | 'down' | 'left' | 'right';
}

function mirrorMazeHorizontal(layout: string[]): string[] {
  return layout.map(row => row.split('').reverse().join(''));
}

function generateMaze(level: number): { maze: number[][], entrance: Position, exit: ExitPoint, isMirrored: boolean } {
  const originalTemplates = [
    {
      layout: [
        "#####################",
        "#...................#",
        "#.###.#####.#####.#.#",
        "#...#...#.......#.#.#",
        "###.###.#.#####.#.#.#",
        "#.......#.#.....#...#",
        "#.#####.#.#.#######.#",
        "#.#...#...#.......#.#",
        "#.#.#.#########.###.#",
        "#...#.......#.......#",
        "#.#########.#.#####.#",
        "#.#.........#.....#.#",
        "#.#.#############.#.#",
        "#.#.............#.#.#",
        "#.#############.#.#.#",
        "#...#...#...#...#...#",
        "#.#.#.#.#.#.#.#####.#",
        "#.#...#...#.........#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#...................#",
        "#.#.#####.#.#####.#.#",
        "#.#.....#.#.#...#.#.#",
        "#.#####.#.#.#.#.#.#.#",
        "#.......#...#.#.#...#",
        "###.#########.#.###.#",
        "#...#.........#.#...#",
        "#.###.#########.###.#",
        "#.#...#.........#...#",
        "#.#.###.#########.#.#",
        "#.#.#...#.......#.#.#",
        "#.#.#.#########.#.#.#",
        "#.#.#.#.......#.#.#.#",
        "#.#.#.#######.#.#.#.#",
        "#.#.#.........#...#.#",
        "#.#.#############.#.#",
        "#...................#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#...................#",
        "#.###.#.#.#.#.###.#.#",
        "#.#...#.#.#.#...#.#.#",
        "#.#.###.#.#.###.#.#.#",
        "#.......#.#.....#...#",
        "#######.#.#.#######.#",
        "#.......#.#.........#",
        "#.#######.#########.#",
        "#.......#...........#",
        "#.#######.#########.#",
        "#.........#.........#",
        "###.#####.#.#######.#",
        "#...#.....#.#.......#",
        "#.###.#####.#.#####.#",
        "#...#.......#.....#.#",
        "#.#.#############.#.#",
        "#.#.................#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#...................#",
        "#.#######.#.#######.#",
        "#.#.....#.#.#.....#.#",
        "#.#.###.#.#.#.###.#.#",
        "#...#...#.#.#...#...#",
        "###.#.###.###.#.###.#",
        "#...#.........#.....#",
        "#.###############.#.#",
        "#...............#.#.#",
        "###.###########.#.#.#",
        "#...#...........#.#.#",
        "#.###.###########.#.#",
        "#.#...#...........#.#",
        "#.#.###.###########.#",
        "#.#...#.............#",
        "#.###.#############.#",
        "#...................#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#...................#",
        "#.#.#.#.#.#.#.#.#.#.#",
        "#.#.#.#.#.#.#.#.#.#.#",
        "#...................#",
        "#.#####.#####.#####.#",
        "#.....#.#...#.#.....#",
        "#.###.#.#.#.#.#.###.#",
        "#.#.#.#.#.#.#.#.#.#.#",
        "#.#.#.......#.#.#.#.#",
        "#.#.###########.#.#.#",
        "#.#.............#.#.#",
        "#.###############.#.#",
        "#.................#.#",
        "###.#.#############.#",
        "#...#...#...........#",
        "#.#####.###########.#",
        "#...................#",
        "#####################"
      ]
    }
  ];

  const isMirrored = level >= 5;
  const templateIndex = level % 5;
  let layout = originalTemplates[templateIndex].layout;

  if (isMirrored) {
    layout = mirrorMazeHorizontal(layout);
  }

  const templateStr = layout;
  const maze: number[][] = templateStr.map(row =>
    row.split('').map(cell => cell === '#' ? 1 : 0)
  );

  const exitSides = ['right', 'up', 'down', 'left'];
  const exitSide = exitSides[level % exitSides.length];

  let exit: ExitPoint;
  let entrance: Position;

  switch (exitSide) {
    case 'right':
      exit = {
        position: { row: Math.floor(MAZE_HEIGHT / 2), col: MAZE_WIDTH - 1 },
        direction: 'right' as Direction
      };
      entrance = { row: Math.floor(MAZE_HEIGHT / 2), col: 1 };
      break;
    case 'left':
      exit = {
        position: { row: Math.floor(MAZE_HEIGHT / 2), col: 0 },
        direction: 'left' as Direction
      };
      entrance = { row: Math.floor(MAZE_HEIGHT / 2), col: MAZE_WIDTH - 2 };
      break;
    case 'up':
      exit = {
        position: { row: 0, col: Math.floor(MAZE_WIDTH / 2) },
        direction: 'up' as Direction
      };
      entrance = { row: MAZE_HEIGHT - 2, col: Math.floor(MAZE_WIDTH / 2) };
      break;
    case 'down':
      exit = {
        position: { row: MAZE_HEIGHT - 1, col: Math.floor(MAZE_WIDTH / 2) },
        direction: 'down' as Direction
      };
      entrance = { row: 1, col: Math.floor(MAZE_WIDTH / 2) };
      break;
    default:
      exit = {
        position: { row: Math.floor(MAZE_HEIGHT / 2), col: MAZE_WIDTH - 1 },
        direction: 'right' as Direction
      };
      entrance = { row: Math.floor(MAZE_HEIGHT / 2), col: 1 };
  }

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const er = entrance.row + dr;
      const ec = entrance.col + dc;
      if (er > 0 && er < MAZE_HEIGHT - 1 && ec > 0 && ec < MAZE_WIDTH - 1) {
        maze[er][ec] = 0;
      }

      const xr = exit.position.row + dr;
      const xc = exit.position.col + dc;
      if (xr >= 0 && xr < MAZE_HEIGHT && xc >= 0 && xc < MAZE_WIDTH) {
        maze[xr][xc] = 0;
      }
    }
  }

  // Clear TWO columns/rows to ensure proper exit paths
  if (exitSide === 'right') {
    for (let r = 1; r < MAZE_HEIGHT - 1; r++) {
      maze[r][MAZE_WIDTH - 2] = 0;
      maze[r][MAZE_WIDTH - 1] = 0; // Also clear the border
    }
  } else if (exitSide === 'left') {
    for (let r = 1; r < MAZE_HEIGHT - 1; r++) {
      maze[r][0] = 0; // Clear the border
      maze[r][1] = 0;
    }
  } else if (exitSide === 'up') {
    for (let c = 1; c < MAZE_WIDTH - 1; c++) {
      maze[0][c] = 0; // Clear the border
      maze[1][c] = 0;
    }
  } else if (exitSide === 'down') {
    for (let c = 1; c < MAZE_WIDTH - 1; c++) {
      maze[MAZE_HEIGHT - 1][c] = 0; // Clear the border
      maze[MAZE_HEIGHT - 2][c] = 0;
    }
  }

  for (let r = 0; r < MAZE_HEIGHT; r++) {
    maze[r][0] = 1;
    maze[r][MAZE_WIDTH - 1] = 1;
  }
  for (let c = 0; c < MAZE_WIDTH; c++) {
    maze[0][c] = 1;
    maze[MAZE_HEIGHT - 1][c] = 1;
  }

  maze[entrance.row][entrance.col] = 0;
  maze[exit.position.row][exit.position.col] = 0;

  return { maze, entrance, exit, isMirrored };
}

function gridToPixel(pos: Position): PixelPosition {
  return {
    x: pos.col * TILE_SIZE + TILE_SIZE / 2,
    y: pos.row * TILE_SIZE + TILE_SIZE / 2
  };
}

function pixelToGrid(pixel: PixelPosition): Position {
  return {
    row: Math.floor(pixel.y / TILE_SIZE),
    col: Math.floor(pixel.x / TILE_SIZE)
  };
}

function isAligned(pixel: PixelPosition): boolean {
  let offsetX = (pixel.x - TILE_SIZE / 2) % TILE_SIZE;
  let offsetY = (pixel.y - TILE_SIZE / 2) % TILE_SIZE;

  if (offsetX > TILE_SIZE / 2) offsetX -= TILE_SIZE;
  if (offsetY > TILE_SIZE / 2) offsetY -= TILE_SIZE;

  return Math.abs(offsetX) <= 1 && Math.abs(offsetY) <= 1;
}

// Pac-Man style alignment - more lenient for smooth turning
function isNearCenter(pixel: PixelPosition): boolean {
  let offsetX = (pixel.x - TILE_SIZE / 2) % TILE_SIZE;
  let offsetY = (pixel.y - TILE_SIZE / 2) % TILE_SIZE;

  if (offsetX > TILE_SIZE / 2) offsetX -= TILE_SIZE;
  if (offsetY > TILE_SIZE / 2) offsetY -= TILE_SIZE;

  // Allow turning when within 5 pixels of center (Pac-Man style)
  return Math.abs(offsetX) <= 5 && Math.abs(offsetY) <= 5;
}

// Auto-center: Pull toward tile center on perpendicular axis
function autoCenterPosition(pixel: PixelPosition, dir: Direction): PixelPosition {
  const gridPos = pixelToGrid(pixel);
  const centerPixel = gridToPixel(gridPos);
  const result = { ...pixel };

  // When moving horizontally, gradually center vertically (and vice versa)
  if (dir === 'left' || dir === 'right') {
    const yDiff = centerPixel.y - pixel.y;
    if (Math.abs(yDiff) > 0.5) {
      result.y += Math.sign(yDiff) * Math.min(Math.abs(yDiff), 2);
    } else {
      result.y = centerPixel.y;
    }
  } else if (dir === 'up' || dir === 'down') {
    const xDiff = centerPixel.x - pixel.x;
    if (Math.abs(xDiff) > 0.5) {
      result.x += Math.sign(xDiff) * Math.min(Math.abs(xDiff), 2);
    } else {
      result.x = centerPixel.x;
    }
  }

  return result;
}

function canMove(maze: number[][], pos: Position, dir: Direction): boolean {
  const deltas: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };

  const delta = deltas[dir];
  const newRow = pos.row + delta.row;
  const newCol = pos.col + delta.col;

  if (newRow < 0 || newRow >= MAZE_HEIGHT || newCol < 0 || newCol >= MAZE_WIDTH) {
    return false;
  }

  const isWall = maze[newRow][newCol] === 1;

  // Debug logging for edge column blocking
  if (isWall && (newCol === 0 || newCol === MAZE_WIDTH - 1 || newRow === 0 || newRow === MAZE_HEIGHT - 1)) {
    console.log(`BLOCKED at edge [${newRow}, ${newCol}] from [${pos.row}, ${pos.col}] going ${dir}`);
  }

  return !isWall;
}

function findValidSpawnNear(maze: number[][], targetRow: number, targetCol: number): Position | null {
  // Check if target position is valid
  if (targetRow >= 0 && targetRow < MAZE_HEIGHT && targetCol >= 0 && targetCol < MAZE_WIDTH && maze[targetRow][targetCol] === 0) {
    return { row: targetRow, col: targetCol };
  }

  // Spiral search outward from target position to find nearest valid tile
  for (let radius = 1; radius <= 5; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) === radius || Math.abs(dc) === radius) {
          const r = targetRow + dr;
          const c = targetCol + dc;
          if (r >= 0 && r < MAZE_HEIGHT && c >= 0 && c < MAZE_WIDTH && maze[r][c] === 0) {
            return { row: r, col: c };
          }
        }
      }
    }
  }

  return null;
}

function calculateOppositeSpawns(maze: number[][], playerStart: Position, maxSpawns: number = 8): Position[] {
  // Calculate mathematical opposite corner from player start
  const oppositeRow = MAZE_HEIGHT - 1 - playerStart.row;
  const oppositeCol = MAZE_WIDTH - 1 - playerStart.col;

  console.log(`🎯 Player starts at [${playerStart.row}, ${playerStart.col}]`);
  console.log(`🎯 Calculated opposite corner: [${oppositeRow}, ${oppositeCol}]`);

  // Find spawn positions near the opposite corner
  const spawns: Position[] = [];

  // Search in expanding rings around opposite corner
  const searchPositions: Position[] = [
    { row: oppositeRow, col: oppositeCol }
  ];

  // Add positions in a spiral pattern
  for (let radius = 1; radius <= 4; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) === radius || Math.abs(dc) === radius) {
          searchPositions.push({ row: oppositeRow + dr, col: oppositeCol + dc });
        }
      }
    }
  }

  for (const searchPos of searchPositions) {
    const validPos = findValidSpawnNear(maze, searchPos.row, searchPos.col);
    if (validPos && !spawns.some(s => s.row === validPos.row && s.col === validPos.col)) {
      spawns.push(validPos);
      console.log(`  ✓ Found enemy spawn at [${validPos.row}, ${validPos.col}]`);
      if (spawns.length >= maxSpawns) break;
    }
  }

  // Fallback: if we couldn't find enough spawns near opposite corner, search the entire opposite quadrant
  if (spawns.length < maxSpawns) {
    console.log(`⚠️ Only found ${spawns.length} spawns near opposite corner, searching quadrant...`);
    const quadrantStartRow = oppositeRow > MAZE_HEIGHT / 2 ? Math.floor(MAZE_HEIGHT * 0.6) : 0;
    const quadrantEndRow = oppositeRow > MAZE_HEIGHT / 2 ? MAZE_HEIGHT : Math.floor(MAZE_HEIGHT * 0.4);
    const quadrantStartCol = oppositeCol > MAZE_WIDTH / 2 ? Math.floor(MAZE_WIDTH * 0.6) : 0;
    const quadrantEndCol = oppositeCol > MAZE_WIDTH / 2 ? MAZE_WIDTH : Math.floor(MAZE_WIDTH * 0.4);

    for (let r = quadrantStartRow; r < quadrantEndRow && spawns.length < maxSpawns; r++) {
      for (let c = quadrantStartCol; c < quadrantEndCol && spawns.length < maxSpawns; c++) {
        if (maze[r][c] === 0 && !spawns.some(s => s.row === r && s.col === c)) {
          spawns.push({ row: r, col: c });
          console.log(`  ✓ Quadrant spawn at [${r}, ${c}]`);
        }
      }
    }
  }

  console.log(`✅ Total spawns found: ${spawns.length}`);
  return spawns;
}

function placeCash(maze: number[][], exitPos: Position, entrance: Position): Position[] {
  const cash: Position[] = [];

  for (let row = 0; row < MAZE_HEIGHT; row++) {
    for (let col = 0; col < MAZE_WIDTH; col++) {
      if (maze[row][col] === 1) continue;
      if (row === exitPos.row && col === exitPos.col) continue;
      if (Math.abs(row - entrance.row) <= 2 && Math.abs(col - entrance.col) <= 2) continue;

      cash.push({ row, col });
    }
  }

  return cash;
}

function placePowerUps(maze: number[][], exitPos: Position, entrance: Position): Position[] {
  const powerUps: Position[] = [];

  const candidatePositions = [
    { row: 2, col: 2 },
    { row: 2, col: MAZE_WIDTH - 3 },
    { row: MAZE_HEIGHT - 3, col: 2 },
    { row: MAZE_HEIGHT - 3, col: MAZE_WIDTH - 3 },
    { row: Math.floor(MAZE_HEIGHT / 2), col: 2 },
    { row: Math.floor(MAZE_HEIGHT / 2), col: MAZE_WIDTH - 3 },
    { row: 2, col: Math.floor(MAZE_WIDTH / 2) },
    { row: MAZE_HEIGHT - 3, col: Math.floor(MAZE_WIDTH / 2) }
  ];

  for (const pos of candidatePositions) {
    if (pos.row >= 0 && pos.row < MAZE_HEIGHT && pos.col >= 0 && pos.col < MAZE_WIDTH) {
      if (maze[pos.row][pos.col] === 0) {
        if (Math.abs(pos.row - entrance.row) > 3 || Math.abs(pos.col - entrance.col) > 3) {
          if (pos.row !== exitPos.row || pos.col !== exitPos.col) {
            powerUps.push(pos);
            if (powerUps.length >= 1) break;
          }
        }
      }
    }
  }

  if (powerUps.length < 2) {
    for (let row = 3; row < MAZE_HEIGHT - 3; row += 4) {
      for (let col = 3; col < MAZE_WIDTH - 3; col += 4) {
        if (maze[row][col] === 0) {
          if (Math.abs(row - entrance.row) > 3 || Math.abs(col - entrance.col) > 3) {
            if (row !== exitPos.row || col !== exitPos.col) {
              powerUps.push({ row, col });
              if (powerUps.length >= 2) return powerUps;
            }
          }
        }
      }
    }
  }

  return powerUps;
}

function findNearestTarget(pos: Position, cash: Position[], powerUps: Position[]): Position | null {
  const allTargets = [...cash, ...powerUps];
  if (allTargets.length === 0) return null;

  for (const powerUp of powerUps) {
    const dist = Math.abs(pos.row - powerUp.row) + Math.abs(pos.col - powerUp.col);
    if (dist <= 5) {
      return powerUp;
    }
  }

  let nearest = cash[0];
  if (!nearest) return powerUps[0] || null;

  let minDist = Math.abs(pos.row - nearest.row) + Math.abs(pos.col - nearest.col);

  for (const money of cash) {
    const dist = Math.abs(pos.row - money.row) + Math.abs(pos.col - money.col);
    if (dist < minDist) {
      minDist = dist;
      nearest = money;
    }
  }

  return nearest;
}

// Track position history to prevent loops and oscillation
const positionHistory = new Map<string, Position[]>();

// BFS pathfinding - finds the actual shortest walkable path through the maze
function findPathBFS(
  maze: number[][],
  from: Position,
  to: Position
): Direction | null {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const deltas: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };

  // BFS queue: [position, firstDirection, depth]
  const queue: [Position, Direction | null, number][] = [[from, null, 0]];
  const visited = new Set<string>();
  visited.add(`${from.row},${from.col}`);

  const MAX_DEPTH = 150; // Prevent lag on very long paths

  while (queue.length > 0) {
    const [current, firstDir, depth] = queue.shift()!;

    if (depth > MAX_DEPTH) break;

    // Found target - return the first direction we took
    if (current.row === to.row && current.col === to.col) {
      return firstDir;
    }

    // Explore neighbors
    for (const dir of dirs) {
      const delta = deltas[dir];
      const next = {
        row: current.row + delta.row,
        col: current.col + delta.col
      };

      const key = `${next.row},${next.col}`;
      if (visited.has(key)) continue;

      if (canMove(maze, current, dir)) {
        visited.add(key);
        queue.push([next, firstDir || dir, depth + 1]);
      }
    }
  }

  return null; // No path found
}

// Smart direction selection with advanced oscillation detection and anti-backtracking
function getSmartDirection(
  maze: number[][],
  from: Position,
  target: Position,
  entityId: string,
  shouldFlee: boolean = false,
  otherEnemies: Enemy[] = []
): Direction | null {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const validDirs = dirs.filter(d => canMove(maze, from, d));

  if (validDirs.length === 0) return null;

  // Initialize history tracking
  if (!positionHistory.has(entityId)) {
    positionHistory.set(entityId, []);
  }

  const history = positionHistory.get(entityId)!;

  const deltas: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };

  // ENHANCED Oscillation detection - check for multiple patterns
  if (history.length >= 6) {
    // Check for A→B→A→B→A→B pattern (extended oscillation)
    const recent = history.slice(-6);
    const isExtendedOscillating =
      recent[0].row === recent[2].row && recent[0].col === recent[2].col &&
      recent[0].row === recent[4].row && recent[0].col === recent[4].col &&
      recent[1].row === recent[3].row && recent[1].col === recent[3].col &&
      recent[1].row === recent[5].row && recent[1].col === recent[5].col &&
      !(recent[0].row === recent[1].row && recent[0].col === recent[1].col);

    // Check if stuck in small area (all recent positions within 2-tile radius)
    const minRow = Math.min(...recent.map(p => p.row));
    const maxRow = Math.max(...recent.map(p => p.row));
    const minCol = Math.min(...recent.map(p => p.col));
    const maxCol = Math.max(...recent.map(p => p.col));
    const isStuckInArea = (maxRow - minRow <= 2) && (maxCol - minCol <= 2);

    if (isExtendedOscillating || isStuckInArea) {
      // Break the loop aggressively - clear history and explore randomly
      positionHistory.set(entityId, []);
      // Force movement in a less-traveled direction
      const leastUsedDir = validDirs[Math.floor(Math.random() * validDirs.length)];
      return leastUsedDir;
    }
  }

  // Check shorter oscillation pattern as backup
  if (history.length >= 4) {
    const recent = history.slice(-4);
    const isOscillating =
      recent[0].row === recent[2].row && recent[0].col === recent[2].col &&
      recent[1].row === recent[3].row && recent[1].col === recent[3].col &&
      !(recent[0].row === recent[1].row && recent[0].col === recent[1].col);

    if (isOscillating) {
      positionHistory.set(entityId, []);
      return validDirs[Math.floor(Math.random() * validDirs.length)];
    }
  }

  // HAMMER PROXIMITY AVOIDANCE - hammers avoid getting too close to each other
  if (entityId.startsWith('enemy-') && otherEnemies.length > 0) {
    const HAMMER_AVOID_DISTANCE = 4; // Must stay at least 4 tiles apart

    for (const otherEnemy of otherEnemies) {
      if (otherEnemy.id === entityId) continue;

      const distToOther = Math.abs(from.row - otherEnemy.gridPos.row) +
                         Math.abs(from.col - otherEnemy.gridPos.col);

      // If another hammer is too close, prioritize moving away
      if (distToOther < HAMMER_AVOID_DISTANCE) {
        const avoidDirs = validDirs.filter(dir => {
          const delta = deltas[dir];
          const newPos = {
            row: from.row + delta.row,
            col: from.col + delta.col
          };
          const newDist = Math.abs(newPos.row - otherEnemy.gridPos.row) +
                         Math.abs(newPos.col - otherEnemy.gridPos.col);
          return newDist > distToOther; // Only consider directions that increase distance
        });

        // If we have directions that move away, use them
        if (avoidDirs.length > 0) {
          return avoidDirs[Math.floor(Math.random() * avoidDirs.length)];
        }
      }
    }
  }

  // Anti-backtracking - filter out immediate return to previous position
  const previousPos = history.length > 0 ? history[history.length - 1] : null;
  const nonBacktrackDirs = validDirs.filter(dir => {
    if (!previousPos) return true;
    const delta = deltas[dir];
    const nextPos = { row: from.row + delta.row, col: from.col + delta.col };
    return !(nextPos.row === previousPos.row && nextPos.col === previousPos.col);
  });

  const dirsToConsider = nonBacktrackDirs.length > 0 ? nonBacktrackDirs : validDirs;

  let bestDir: Direction;

  if (shouldFlee) {
    // FLEE MODE - maximize distance from target
    let bestDist = -Infinity;
    bestDir = dirsToConsider[0];

    for (const dir of dirsToConsider) {
      const delta = deltas[dir];
      const newPos = {
        row: from.row + delta.row,
        col: from.col + delta.col
      };

      const dist = Math.abs(newPos.row - target.row) + Math.abs(newPos.col - target.col);
      const randomBonus = Math.random() * 2.0; // Increased randomness
      const score = dist + randomBonus;

      if (score > bestDist) {
        bestDist = score;
        bestDir = dir;
      }
    }
  } else {
    // CHASE MODE - use BFS pathfinding for accurate navigation
    bestDir = findPathBFS(maze, from, target) || dirsToConsider[0];

    if (!dirsToConsider.includes(bestDir)) {
      let bestScore = Infinity;
      bestDir = dirsToConsider[0];

      for (const dir of dirsToConsider) {
        const delta = deltas[dir];
        const newPos = {
          row: from.row + delta.row,
          col: from.col + delta.col
        };

        const dist = Math.abs(newPos.row - target.row) + Math.abs(newPos.col - target.col);
        const randomBonus = Math.random() * 2.0; // Increased randomness
        const score = dist + randomBonus;

        if (score < bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }
    }
  }

  // Update position history
  const lastPos = history[history.length - 1];
  if (!lastPos || lastPos.row !== from.row || lastPos.col !== from.col) {
    history.push({ ...from });
    if (history.length > 12) { // Increased history size
      history.shift();
    }
  }

  return bestDir;
}

export function MoneyGrabGameEngine({
  playerName,
  companionName,
  onGameComplete
}: MoneyGrabGameEngineProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [, setLevelScore] = useState(0);

  const [mazeData, setMazeData] = useState(() => generateMaze(0));
  const [maze, setMaze] = useState(mazeData.maze);
  const [exitPoint, setExitPoint] = useState<ExitPoint>(mazeData.exit);
  const [isMirrored, setIsMirrored] = useState(mazeData.isMirrored);

  const [player, setPlayer] = useState<Player>(() => {
    const startPos = mazeData.entrance;
    return {
      gridPos: startPos,
      pixelPos: gridToPixel(startPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    };
  });

  const [aiPlayer, setAiPlayer] = useState<Player>(() => {
    const startPos = { row: mazeData.entrance.row + 1, col: mazeData.entrance.col };
    return {
      gridPos: startPos,
      pixelPos: gridToPixel(startPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    };
  });

  const [cash, setCash] = useState<Position[]>(() => placeCash(maze, exitPoint.position, mazeData.entrance));
  const [powerUps, setPowerUps] = useState<Position[]>(() => placePowerUps(maze, exitPoint.position, mazeData.entrance));

  const [enemySpawnPoints, setEnemySpawnPoints] = useState<Position[]>(() => calculateOppositeSpawns(maze, mazeData.entrance, 2));

  const [enemies, setEnemies] = useState<Enemy[]>(() => {
    const colors = ['#ef4444', '#ec4899'];
    const dirs: Direction[] = ['left', 'right'];

    return enemySpawnPoints.slice(0, 2).map((spawn, i) => ({
      id: `${i + 1}`,
      gridPos: spawn,
      dir: dirs[i],
      color: colors[i],
      lastHitTime: 0,
      isPaused: false
    }));
  });

  const [gameStatus, setGameStatus] = useState<'ready' | 'levelintro' | 'playing' | 'paused' | 'gameover' | 'levelcomplete'>('ready');
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  const [roundWinner, setRoundWinner] = useState<'player' | 'companion' | 'tie' | null>(null);
  const [playerWins, setPlayerWins] = useState(0);
  const [companionWins, setCompanionWins] = useState(0);
  const [playerHitFlash, setPlayerHitFlash] = useState(false);
  const [aiHitFlash, setAiHitFlash] = useState(false);

  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());
  const enemyUpdateRef = useRef<number>(0);
  const lastCollisionRef = useRef<number>(0);

  // Refs to access current state without dependencies
  const mazeRef = useRef(maze);
  const cashRef = useRef(cash);
  const powerUpsRef = useRef(powerUps);
  const enemiesRef = useRef(enemies);
  const exitPointRef = useRef(exitPoint);
  const playerRef = useRef(player);
  const aiPlayerRef = useRef(aiPlayer);
  const enemySpawnPointsRef = useRef(enemySpawnPoints);

  // Keep refs in sync with state
  useEffect(() => { mazeRef.current = maze; }, [maze]);
  useEffect(() => { cashRef.current = cash; }, [cash]);
  useEffect(() => { powerUpsRef.current = powerUps; }, [powerUps]);
  useEffect(() => { enemiesRef.current = enemies; }, [enemies]);
  useEffect(() => { exitPointRef.current = exitPoint; }, [exitPoint]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { aiPlayerRef.current = aiPlayer; }, [aiPlayer]);
  useEffect(() => { enemySpawnPointsRef.current = enemySpawnPoints; }, [enemySpawnPoints]);

  useEffect(() => {
    if (gameStatus === 'gameover') {
      onGameComplete?.(player.score + aiPlayer.score, currentLevel + 1);
    }
  }, [gameStatus, player.score, aiPlayer.score, currentLevel, onGameComplete]);

  const startGame = () => {
    setGameStatus('levelintro');
    setTimeout(() => {
      setGameStatus('playing');
    }, 2000);
  };

  const loadNextLevel = () => {
    // Winner has already been calculated and set when exit was reached
    const winner = roundWinner;

    if (winner === 'player') {
      setPlayerWins(prev => prev + 1);
    } else if (winner === 'companion') {
      setCompanionWins(prev => prev + 1);
    }

    // Clear position history for fresh start on new level
    positionHistory.clear();

    const nextLevelNum = currentLevel + 1;
    const newMazeData = generateMaze(nextLevelNum);

    setCurrentLevel(nextLevelNum);
    setMazeData(newMazeData);
    setMaze(newMazeData.maze);
    setExitPoint(newMazeData.exit);
    setIsMirrored(newMazeData.isMirrored);

    const startPos = newMazeData.entrance;
    setPlayer({
      gridPos: startPos,
      pixelPos: gridToPixel(startPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    });

    const aiStartPos = { row: newMazeData.entrance.row + 1, col: newMazeData.entrance.col };
    setAiPlayer({
      gridPos: aiStartPos,
      pixelPos: gridToPixel(aiStartPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    });

    setCash(placeCash(newMazeData.maze, newMazeData.exit.position, newMazeData.entrance));
    setPowerUps(placePowerUps(newMazeData.maze, newMazeData.exit.position, newMazeData.entrance));

    // Use mathematical opposite spawn calculation - ONLY 2 hammers
    const spawns = calculateOppositeSpawns(newMazeData.maze, newMazeData.entrance, 2);
    setEnemySpawnPoints(spawns);

    const colors = ['#ef4444', '#ec4899'];
    const dirs: Direction[] = ['left', 'right'];

    const baseEnemies: Enemy[] = spawns.slice(0, 2).map((spawn, i) => ({
      id: `${i + 1}`,
      gridPos: spawn,
      dir: dirs[i],
      color: colors[i],
      lastHitTime: 0,
      isPaused: false
    }));

    setEnemies(baseEnemies);
    setLevelScore(0);

    setTimeout(() => {
      setShowLevelTransition(false);
      setGameStatus('levelintro');
      setTimeout(() => {
        setGameStatus('playing');
      }, 2500);
    }, 2500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {

      if (gameStatus !== 'playing') return;

      const dirMap: Record<string, Direction> = {
        'ArrowUp': 'up', 'w': 'up', 'W': 'up',
        'ArrowDown': 'down', 's': 'down', 'S': 'down',
        'ArrowLeft': 'left', 'a': 'left', 'A': 'left',
        'ArrowRight': 'right', 'd': 'right', 'D': 'right'
      };

      const dir = dirMap[e.key];
      if (dir) {
        e.preventDefault();
        setPlayer(prev => {
          if (!prev.currentDir) {
            if (canMove(maze, prev.gridPos, dir)) {
              return { ...prev, currentDir: dir, nextDir: null };
            }
          } else {
            return { ...prev, nextDir: dir };
          }
          return prev;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus, maze]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const gameLoop = () => {
      const now = Date.now();
      const delta = now - lastUpdateRef.current;
      lastUpdateRef.current = now;
      enemyUpdateRef.current += delta;

      // Access current values via refs
        const currentMaze = mazeRef.current;
        const currentCash = cashRef.current;
        const currentPowerUps = powerUpsRef.current;
        const currentExit = exitPointRef.current;
        const currentEnemySpawns = enemySpawnPointsRef.current;

        // ============ PLAYER MOVEMENT ============
        setPlayer(prev => {
          if (!prev.currentDir) return prev;

          const newPlayer = { ...prev };

          // PAC-MAN STYLE TURNING: Check for turn when near center (more lenient)
          if (isNearCenter(newPlayer.pixelPos) && newPlayer.nextDir) {
            if (canMove(currentMaze, newPlayer.gridPos, newPlayer.nextDir)) {
              // CORNER CUTTING: Snap to center when changing direction
              const centerPos = gridToPixel(newPlayer.gridPos);
              newPlayer.pixelPos = centerPos;
              newPlayer.currentDir = newPlayer.nextDir;
              newPlayer.nextDir = null;
            } else {
              // Can't turn yet, clear the buffered input to accept new commands
              newPlayer.nextDir = null;
            }
          }

          if (!newPlayer.currentDir) return newPlayer;

          const deltas: Record<Direction, PixelPosition> = {
            up: { x: 0, y: -MOVE_SPEED },
            down: { x: 0, y: MOVE_SPEED },
            left: { x: -MOVE_SPEED, y: 0 },
            right: { x: MOVE_SPEED, y: 0 }
          };

          const moveDelta = deltas[newPlayer.currentDir];
          let newPixelPos = {
            x: newPlayer.pixelPos.x + moveDelta.x,
            y: newPlayer.pixelPos.y + moveDelta.y
          };

          // AUTO-CENTER: Pull toward tile center on perpendicular axis (Pac-Man smoothness)
          newPixelPos = autoCenterPosition(newPixelPos, newPlayer.currentDir);

          const nextGridPos = pixelToGrid(newPixelPos);
          if (nextGridPos.row !== newPlayer.gridPos.row || nextGridPos.col !== newPlayer.gridPos.col) {
            if (!canMove(currentMaze, newPlayer.gridPos, newPlayer.currentDir)) {
              // Hit a wall - snap back to center and stop
              newPlayer.pixelPos = gridToPixel(newPlayer.gridPos);
              newPlayer.currentDir = null;
              return newPlayer;
            }
          }

          if (isAligned(newPixelPos)) {
            const newGridPos = pixelToGrid(newPixelPos);

            if (newGridPos.row !== newPlayer.gridPos.row || newGridPos.col !== newPlayer.gridPos.col) {
              newPlayer.gridPos = newGridPos;

              if (newGridPos.row === currentExit.position.row && newGridPos.col === currentExit.position.col) {
                const currentAI = aiPlayerRef.current;
                const winner = newPlayer.score > currentAI.score ? 'player' :
                               newPlayer.score < currentAI.score ? 'companion' : 'tie';
                setRoundWinner(winner);
                setShowLevelTransition(true);
                setGameStatus('levelcomplete');
                setTimeout(loadNextLevel, 1000);
                return newPlayer;
              }

              const collectRow = newGridPos.row;
              const collectCol = newGridPos.col;

              if (currentCash.some(f => f.row === collectRow && f.col === collectCol)) {
                setCash(prev => prev.filter(f => !(f.row === collectRow && f.col === collectCol)));
                newPlayer.score += CASH_POINTS;
                setLevelScore(prev => prev + CASH_POINTS);
                newPlayer.isGrabbing = true;
                setTimeout(() => setPlayer(p => ({ ...p, isGrabbing: false })), 200);
              }

              if (currentPowerUps.some(p => p.row === collectRow && p.col === collectCol)) {
                setPowerUps(prev => prev.filter(p => !(p.row === collectRow && p.col === collectCol)));
                newPlayer.powerUpActive = true;
                newPlayer.powerUpExpiry = Date.now() + 10000;
                newPlayer.score += POWER_UP_POINTS;
                setLevelScore(prev => prev + POWER_UP_POINTS);
                newPlayer.isGrabbing = true;
                setTimeout(() => setPlayer(p => ({ ...p, isGrabbing: false })), 200);
              }
            }
          }

          newPlayer.pixelPos = newPixelPos;

          if (newPlayer.powerUpActive && Date.now() > newPlayer.powerUpExpiry) {
            newPlayer.powerUpActive = false;
          }

          return newPlayer;
        });

        // ============ AI MOVEMENT ============
        setAiPlayer(prev => {
          const newAI = { ...prev };
          const currentEnemies = enemiesRef.current;

          // PAC-MAN STYLE: Use near-center for AI decision making too
          if (isNearCenter(newAI.pixelPos)) {
            // Check if being chased by nearby enemies
            const nearbyEnemy = currentEnemies.find(e =>
              !e.isPaused &&
              Math.abs(e.gridPos.row - newAI.gridPos.row) + Math.abs(e.gridPos.col - newAI.gridPos.col) <= 5
            );

            if (nearbyEnemy && !newAI.powerUpActive) {
              // FLEE from nearest enemy
              const aiMove = getSmartDirection(currentMaze, newAI.gridPos, nearbyEnemy.gridPos, 'ai-player', true);
              if (aiMove && aiMove !== newAI.currentDir) {
                // Snap to center when changing direction (corner cutting)
                newAI.pixelPos = gridToPixel(newAI.gridPos);
                newAI.currentDir = aiMove;
              }
            } else {
              // CHASE nearest target (cash or power-up)
              const target = findNearestTarget(newAI.gridPos, currentCash, currentPowerUps);

              if (target) {
                const aiMove = getSmartDirection(currentMaze, newAI.gridPos, target, 'ai-player', false);
                if (aiMove && aiMove !== newAI.currentDir) {
                  newAI.pixelPos = gridToPixel(newAI.gridPos);
                  newAI.currentDir = aiMove;
                }
              } else {
                // No targets left - head to exit
                const aiMove = getSmartDirection(currentMaze, newAI.gridPos, currentExit.position, 'ai-player', false);
                if (aiMove && aiMove !== newAI.currentDir) {
                  newAI.pixelPos = gridToPixel(newAI.gridPos);
                  newAI.currentDir = aiMove;
                }
              }
            }
          }

          if (!newAI.currentDir) return newAI;

          const deltas: Record<Direction, PixelPosition> = {
            up: { x: 0, y: -MOVE_SPEED },
            down: { x: 0, y: MOVE_SPEED },
            left: { x: -MOVE_SPEED, y: 0 },
            right: { x: MOVE_SPEED, y: 0 }
          };

          const moveDelta = deltas[newAI.currentDir];
          let newPixelPos = {
            x: newAI.pixelPos.x + moveDelta.x,
            y: newAI.pixelPos.y + moveDelta.y
          };

          // AUTO-CENTER: Pull toward tile center on perpendicular axis
          newPixelPos = autoCenterPosition(newPixelPos, newAI.currentDir);

          const nextGridPos = pixelToGrid(newPixelPos);
          if (nextGridPos.row !== newAI.gridPos.row || nextGridPos.col !== newAI.gridPos.col) {
            if (!canMove(currentMaze, newAI.gridPos, newAI.currentDir)) {
              newAI.pixelPos = gridToPixel(newAI.gridPos);
              newAI.currentDir = null;
              return newAI;
            }
          }

          if (isAligned(newPixelPos)) {
            const newGridPos = pixelToGrid(newPixelPos);

            if (newGridPos.row !== newAI.gridPos.row || newGridPos.col !== newAI.gridPos.col) {
              newAI.gridPos = newGridPos;

              if (newGridPos.row === currentExit.position.row && newGridPos.col === currentExit.position.col) {
                const currentPlayer = playerRef.current;
                const winner = currentPlayer.score > newAI.score ? 'player' :
                               currentPlayer.score < newAI.score ? 'companion' : 'tie';
                setRoundWinner(winner);
                setShowLevelTransition(true);
                setGameStatus('levelcomplete');
                setTimeout(loadNextLevel, 1000);
                return newAI;
              }

              const aiCollectRow = newGridPos.row;
              const aiCollectCol = newGridPos.col;

              if (currentCash.some(f => f.row === aiCollectRow && f.col === aiCollectCol)) {
                setCash(prev => prev.filter(f => !(f.row === aiCollectRow && f.col === aiCollectCol)));
                newAI.score += CASH_POINTS;
                newAI.isGrabbing = true;
                setTimeout(() => setAiPlayer(p => ({ ...p, isGrabbing: false })), 200);
              }

              if (currentPowerUps.some(p => p.row === aiCollectRow && p.col === aiCollectCol)) {
                setPowerUps(prev => prev.filter(p => !(p.row === aiCollectRow && p.col === aiCollectCol)));
                newAI.powerUpActive = true;
                newAI.powerUpExpiry = Date.now() + 10000;
                newAI.score += POWER_UP_POINTS;
                newAI.isGrabbing = true;
                setTimeout(() => setAiPlayer(p => ({ ...p, isGrabbing: false })), 200);
              }
            }
          }

          newAI.pixelPos = newPixelPos;

          if (newAI.powerUpActive && Date.now() > newAI.powerUpExpiry) {
            newAI.powerUpActive = false;
          }

          return newAI;
        });

        // ============ ENEMY MOVEMENT ============
        const enemySpeed = 200 - (currentLevel * 20);
        if (enemyUpdateRef.current > Math.max(enemySpeed, 80)) {
          enemyUpdateRef.current = 0;

          setEnemies(prev => {
            const currentPlayer = playerRef.current;
            const currentAI = aiPlayerRef.current;

            return prev.map(enemy => {
              const currentTime = Date.now();
              const timeSinceHit = currentTime - enemy.lastHitTime;

              if (enemy.isPaused) {
                if (timeSinceHit > 1000) {
                  return { ...enemy, isPaused: false };
                }
                return enemy;
              }

              // Find nearest player using Manhattan distance (quick check)
              const dist1 = Math.abs(enemy.gridPos.row - currentPlayer.gridPos.row) +
                           Math.abs(enemy.gridPos.col - currentPlayer.gridPos.col);
              const dist2 = Math.abs(enemy.gridPos.row - currentAI.gridPos.row) +
                           Math.abs(enemy.gridPos.col - currentAI.gridPos.col);

              const nearestIsPlayer = dist1 < dist2;
              const nearestPlayer = nearestIsPlayer ? currentPlayer : currentAI;
              const shouldFlee = nearestPlayer.powerUpActive || (timeSinceHit < 5000 && timeSinceHit > 0);

              // Get all other enemies for proximity avoidance
              const otherEnemies = prev.filter(e => e.id !== enemy.id);

              // Use smart pathfinding to chase or flee (with hammer avoidance)
              const newDir = getSmartDirection(
                currentMaze,
                enemy.gridPos,
                nearestPlayer.gridPos,
                `enemy-${enemy.id}`,
                shouldFlee,
                otherEnemies
              );

              if (!newDir) return enemy;

              const posDeltas: Record<Direction, Position> = {
                up: { row: -1, col: 0 },
                down: { row: 1, col: 0 },
                left: { row: 0, col: -1 },
                right: { row: 0, col: 1 }
              };

              const posDelta = posDeltas[newDir];
              return {
                ...enemy,
                dir: newDir,
                gridPos: {
                  row: enemy.gridPos.row + posDelta.row,
                  col: enemy.gridPos.col + posDelta.col
                }
              };
            });
          });
        }

        // ============ COLLISION DETECTION (SEPARATE FROM MOVEMENT) ============
        const currentEnemies = enemiesRef.current;
        const currentPlayer = playerRef.current;
        const currentAI = aiPlayerRef.current;
        const currentTime = Date.now();

        // Calculate center position for teleportation
        const centerPos = { row: Math.floor(MAZE_HEIGHT / 2), col: Math.floor(MAZE_WIDTH / 2) };
        const validCenterPos = findValidSpawnNear(currentMaze, centerPos.row, centerPos.col) || centerPos;

        for (const enemy of currentEnemies) {
          // Player collision
          if (enemy.gridPos.row === currentPlayer.gridPos.row &&
              enemy.gridPos.col === currentPlayer.gridPos.col) {
            if (!currentPlayer.powerUpActive) {
              if (currentTime - enemy.lastHitTime > 2000) {
                // TELEPORT PLAYER TO CENTER - hammer keeps moving
                setPlayer(p => ({
                  ...p,
                  score: p.score - 200,
                  gridPos: validCenterPos,
                  pixelPos: gridToPixel(validCenterPos),
                  currentDir: null,
                  nextDir: null
                }));
                setLevelScore(s => s - 200);
                setPlayerHitFlash(true);
                setTimeout(() => setPlayerHitFlash(false), 300);
                setEnemies(prev => prev.map(e =>
                  e.id === enemy.id ? { ...e, lastHitTime: currentTime } : e
                ));
              }
            } else {
              setPlayer(p => ({ ...p, score: p.score + 500 }));
              setLevelScore(s => s + 500);
              const enemyIndex = parseInt(enemy.id) - 1;
              const respawnPos = currentEnemySpawns[enemyIndex] || currentEnemySpawns[0];
              setEnemies(prev => prev.map(e =>
                e.id === enemy.id ? { ...e, gridPos: respawnPos, lastHitTime: 0, isPaused: false } : e
              ));
            }
          }

          // AI collision
          if (enemy.gridPos.row === currentAI.gridPos.row &&
              enemy.gridPos.col === currentAI.gridPos.col) {
            if (!currentAI.powerUpActive) {
              if (currentTime - enemy.lastHitTime > 2000) {
                // TELEPORT AI TO CENTER - hammer keeps moving
                setAiPlayer(p => ({
                  ...p,
                  score: p.score - 200,
                  gridPos: validCenterPos,
                  pixelPos: gridToPixel(validCenterPos),
                  currentDir: null,
                  nextDir: null
                }));
                setAiHitFlash(true);
                setTimeout(() => setAiHitFlash(false), 300);
                setEnemies(prev => prev.map(e =>
                  e.id === enemy.id ? { ...e, lastHitTime: currentTime } : e
                ));
              }
            } else {
              setAiPlayer(p => ({ ...p, score: p.score + 500 }));
              const enemyIndex = parseInt(enemy.id) - 1;
              const respawnPos = currentEnemySpawns[enemyIndex] || currentEnemySpawns[0];
              setEnemies(prev => prev.map(e =>
                e.id === enemy.id ? { ...e, gridPos: respawnPos, lastHitTime: 0, isPaused: false } : e
              ));
            }
          }
        }

        // Player vs AI collision
        if (currentPlayer.gridPos.row === currentAI.gridPos.row &&
            currentPlayer.gridPos.col === currentAI.gridPos.col &&
            currentTime - lastCollisionRef.current > 1000) {

          if (currentPlayer.powerUpActive && currentAI.powerUpActive) {
            lastCollisionRef.current = currentTime;
            setPlayer(p => ({ ...p, powerUpActive: false, powerUpExpiry: 0 }));
            setAiPlayer(p => ({ ...p, powerUpActive: false, powerUpExpiry: 0 }));
          } else if (currentPlayer.powerUpActive && !currentAI.powerUpActive) {
            lastCollisionRef.current = currentTime;
            setAiHitFlash(true);
            setTimeout(() => setAiHitFlash(false), 500);
            const aiRespawn = { row: mazeData.entrance.row + 1, col: mazeData.entrance.col };
            setAiPlayer(p => ({
              ...p,
              score: p.score - 200,
              gridPos: aiRespawn,
              pixelPos: gridToPixel(aiRespawn),
              currentDir: null
            }));
          } else if (!currentPlayer.powerUpActive && currentAI.powerUpActive) {
            lastCollisionRef.current = currentTime;
            setPlayerHitFlash(true);
            setTimeout(() => setPlayerHitFlash(false), 500);
            setPlayer(p => ({
              ...p,
              score: p.score - 200,
              gridPos: mazeData.entrance,
              pixelPos: gridToPixel(mazeData.entrance),
              currentDir: null,
              nextDir: null
            }));
            setLevelScore(s => s - 200);
          }
        }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameStatus, currentLevel]);

  const resetGame = () => {
    setCurrentLevel(0);
    setLevelScore(0);
    setPlayerWins(0);
    setCompanionWins(0);
    setRoundWinner(null);

    // Clear position history for fresh start
    positionHistory.clear();

    const newMazeData = generateMaze(0);
    setMazeData(newMazeData);
    setMaze(newMazeData.maze);
    setExitPoint(newMazeData.exit);
    setIsMirrored(newMazeData.isMirrored);

    const startPos = newMazeData.entrance;
    setPlayer({
      gridPos: startPos,
      pixelPos: gridToPixel(startPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    });

    const aiStartPos = { row: newMazeData.entrance.row + 1, col: newMazeData.entrance.col };
    setAiPlayer({
      gridPos: aiStartPos,
      pixelPos: gridToPixel(aiStartPos),
      currentDir: null,
      nextDir: null,
      score: 0,
      powerUpActive: false,
      powerUpExpiry: 0,
      isGrabbing: false
    });

    setCash(placeCash(newMazeData.maze, newMazeData.exit.position, newMazeData.entrance));
    setPowerUps(placePowerUps(newMazeData.maze, newMazeData.exit.position, newMazeData.entrance));

    // Use mathematical opposite spawn calculation - ONLY 2 hammers
    const spawns = calculateOppositeSpawns(newMazeData.maze, newMazeData.entrance, 2);
    setEnemySpawnPoints(spawns);

    const colors = ['#ef4444', '#ec4899'];
    const dirs: Direction[] = ['left', 'right'];

    setEnemies(spawns.slice(0, 2).map((spawn, i) => ({
      id: `${i + 1}`,
      gridPos: spawn,
      dir: dirs[i],
      color: colors[i],
      lastHitTime: 0,
      isPaused: false
    })));

    setShowLevelTransition(false);
    setGameStatus('ready');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white">💰 Money Grab 💰</h1>
            <div className="text-white text-sm mt-1">Level {currentLevel + 1}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setGameStatus(s => s === 'playing' ? 'paused' : 'playing')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {gameStatus === 'playing' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={resetGame}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex justify-between items-center mb-4 gap-4">
              <div className="flex-1 bg-black bg-opacity-75 text-white px-4 py-3 rounded-lg border-2 border-yellow-400">
                <div className="text-xs text-gray-400">{playerName} ✋</div>
                <div className="text-2xl font-bold text-yellow-400">${player.score}</div>
                <div className="text-xs text-gray-400 mt-1">Rounds Won: {playerWins}</div>
              </div>

              <div className="flex-1 bg-black bg-opacity-75 text-white px-4 py-3 rounded-lg border-2 border-blue-400">
                <div className="text-xs text-gray-400 text-right">{companionName} 👋</div>
                <div className="text-2xl font-bold text-blue-400 text-right">${aiPlayer.score}</div>
                <div className="text-xs text-gray-400 text-right mt-1">Rounds Won: {companionWins}</div>
              </div>
            </div>

            <div className="relative bg-gray-900 p-4 rounded-lg shadow-2xl">
              <svg
                width={MAZE_WIDTH * TILE_SIZE}
                height={MAZE_HEIGHT * TILE_SIZE}
                className="mx-auto"
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>

                {maze.map((row, r) =>
                  row.map((cell, c) =>
                    cell === 1 ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c * TILE_SIZE}
                        y={r * TILE_SIZE}
                        width={TILE_SIZE}
                        height={TILE_SIZE}
                        fill={isMirrored ? "#eab308" : "#2563eb"}
                        stroke={isMirrored ? "#facc15" : "#3b82f6"}
                        strokeWidth="1"
                      />
                    ) : null
                  )
                )}

                <g transform={`translate(${exitPoint.position.col * TILE_SIZE + TILE_SIZE/2}, ${exitPoint.position.row * TILE_SIZE + TILE_SIZE/2})`}>
                  <circle r="14" fill="#10b981" opacity="0.3" filter="url(#glow)">
                    <animate attributeName="r" values="14;16;14" dur="1s" repeatCount="indefinite"/>
                  </circle>
                  <text textAnchor="middle" y="8" fontSize="24" fill="#fff">🚪</text>
                </g>

                {cash.map((money, i) => (
                  <g key={`cash-${i}`} transform={`translate(${money.col * TILE_SIZE + TILE_SIZE/2}, ${money.row * TILE_SIZE + TILE_SIZE/2})`}>
                    <text textAnchor="middle" y="5" fontSize="12" fill="#10b981">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0;-2;2;-1;1;0"
                        dur="0.6s"
                        repeatCount="indefinite"
                      />
                      💵
                    </text>
                  </g>
                ))}

                {powerUps.map((pu, i) => (
                  <g key={`power-${i}`} transform={`translate(${pu.col * TILE_SIZE + TILE_SIZE/2}, ${pu.row * TILE_SIZE + TILE_SIZE/2})`}>
                    <circle r="10" fill="#fbbf24" opacity="0.3">
                      <animate attributeName="r" values="10;13;10" dur="1s" repeatCount="indefinite"/>
                    </circle>
                    <text textAnchor="middle" y="8" fontSize="20">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0 0 0;360 0 0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      💰
                    </text>
                  </g>
                ))}

                {enemies.map(enemy => (
                  <g
                    key={enemy.id}
                    transform={`translate(${enemy.gridPos.col * TILE_SIZE + TILE_SIZE/2}, ${enemy.gridPos.row * TILE_SIZE + TILE_SIZE/2 - 3})`}
                  >
                    {enemy.isLocked && (
                      <circle r="16" fill="#ff0000" opacity="0.3">
                        <animate attributeName="r" values="16;20;16" dur="0.5s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.3;0.6;0.3" dur="0.5s" repeatCount="indefinite"/>
                      </circle>
                    )}
                    <text textAnchor="middle" y="8" fontSize="22">
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        values="0 0 6;-30 0 6;0 0 6;-30 0 6;0 0 6"
                        dur={enemy.isLocked ? "0.4s" : "0.7s"}
                        repeatCount="indefinite"
                      />
                      🔨
                    </text>
                  </g>
                ))}

                <g transform={`translate(${player.pixelPos.x}, ${player.pixelPos.y})`}>
                  {player.powerUpActive && (
                    <circle r="13" fill="#fbbf24" opacity="0.4">
                      <animate attributeName="r" values="13;17;13" dur="0.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.6;0.4" dur="0.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {playerHitFlash && (
                    <circle r="18" fill="#ef4444" opacity="0.8">
                      <animate attributeName="r" values="18;25;18" dur="0.3s" repeatCount="1"/>
                      <animate attributeName="opacity" values="0.8;0.3;0" dur="0.3s" repeatCount="1"/>
                    </circle>
                  )}
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#fbbf24" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {playerName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {player.powerUpActive ? '🔨' : (player.isGrabbing ? '✊' : '✋')}
                  </text>
                  {playerHitFlash && (
                    <text textAnchor="middle" y="30" fontSize="16" fill="#ef4444" fontWeight="bold">
                      -$200
                    </text>
                  )}
                </g>

                <g transform={`translate(${aiPlayer.pixelPos.x}, ${aiPlayer.pixelPos.y})`}>
                  {aiPlayer.powerUpActive && (
                    <circle r="13" fill="#3b82f6" opacity="0.4">
                      <animate attributeName="r" values="13;17;13" dur="0.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.6;0.4" dur="0.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {aiHitFlash && (
                    <circle r="18" fill="#ef4444" opacity="0.8">
                      <animate attributeName="r" values="18;25;18" dur="0.3s" repeatCount="1"/>
                      <animate attributeName="opacity" values="0.8;0.3;0" dur="0.3s" repeatCount="1"/>
                    </circle>
                  )}
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#3b82f6" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {companionName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {aiPlayer.powerUpActive ? '🔨' : (aiPlayer.isGrabbing ? '👊' : '👋')}
                  </text>
                  {aiHitFlash && (
                    <text textAnchor="middle" y="30" fontSize="16" fill="#ef4444" fontWeight="bold">
                      -$200
                    </text>
                  )}
                </g>
              </svg>

              {gameStatus === 'ready' && (
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 bg-opacity-95 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white max-w-md p-8">
                    <div className="text-6xl mb-6">💰</div>
                    <h2 className="text-5xl font-bold mb-4">Money Grab!</h2>
                    <p className="text-xl mb-6">Compete with {companionName} to collect the most money!</p>
                    <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-6 text-left">
                      <p className="mb-2"><strong>🎯 Goal:</strong> Collect more money than your companion</p>
                      <p className="mb-2"><strong>💵 Bills:</strong> $100 each</p>
                      <p className="mb-2"><strong>💰 Hammers:</strong> Power-ups worth $500</p>
                      <p className="mb-2"><strong>🚪 Exit:</strong> Whoever has more money wins the round!</p>
                    </div>
                    <button
                      onClick={startGame}
                      className="px-8 py-4 bg-white text-purple-600 rounded-lg font-bold text-xl hover:bg-gray-100 transition-all shadow-lg transform hover:scale-105"
                    >
                      Start Game!
                    </button>
                  </div>
                </div>
              )}

              {gameStatus === 'levelintro' && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-blue-700 bg-opacity-95 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white">
                    <h2 className="text-6xl font-bold mb-4 animate-pulse">Level {currentLevel + 1}</h2>
                    <p className="text-3xl mb-6">Get Ready!</p>
                    {currentLevel > 0 && roundWinner && (
                      <div className="bg-black bg-opacity-30 rounded-lg p-4 inline-block">
                        <p className="text-xl mb-2">Previous Round Winner:</p>
                        {roundWinner === 'player' && (
                          <p className="text-3xl font-bold text-yellow-400">🏆 {playerName}!</p>
                        )}
                        {roundWinner === 'companion' && (
                          <p className="text-3xl font-bold text-blue-400">🏆 {companionName}!</p>
                        )}
                        {roundWinner === 'tie' && (
                          <p className="text-3xl font-bold text-green-400">🤝 Tie!</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {showLevelTransition && roundWinner && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 bg-opacity-90 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white">
                    <Trophy className="w-20 h-20 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-4xl font-bold mb-4">Level Complete!</h2>
                    <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4 inline-block">
                      <div className="border-t border-white border-opacity-30 pt-3">
                        {roundWinner === 'player' && (
                          <p className="text-2xl font-bold text-yellow-400">🏆 {playerName} Wins This Round!</p>
                        )}
                        {roundWinner === 'companion' && (
                          <p className="text-2xl font-bold text-blue-400">🏆 {companionName} Wins This Round!</p>
                        )}
                        {roundWinner === 'tie' && (
                          <p className="text-2xl font-bold text-green-400">🤝 It's a Tie!</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {gameStatus === 'gameover' && (
                <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center rounded-lg">
                  <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-2xl p-8 text-center text-white shadow-2xl max-w-md">
                    <div className="text-6xl mb-4">💀</div>
                    <h2 className="text-4xl font-bold mb-4">Game Over!</h2>
                    <p className="text-xl mb-4">Made it to Level {currentLevel + 1}</p>

                    <div className="bg-black bg-opacity-30 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-yellow-300">{playerName} ✋</span>
                        <span className="text-2xl font-bold">${player.score}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-blue-300">{companionName} 👋</span>
                        <span className="text-2xl font-bold">${aiPlayer.score}</span>
                      </div>
                      <div className="border-t border-white border-opacity-30 mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-green-300">Team Total</span>
                          <span className="text-3xl font-bold">${player.score + aiPlayer.score}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-xl mb-6">
                      {player.score > aiPlayer.score ? (
                        <span className="text-yellow-400">🏆 {playerName} collected the most!</span>
                      ) : player.score < aiPlayer.score ? (
                        <span className="text-blue-400">🏆 {companionName} collected the most!</span>
                      ) : (
                        <span className="text-green-400">🤝 Perfect teamwork!</span>
                      )}
                    </div>

                    <button
                      onClick={resetGame}
                      className="px-8 py-4 bg-white text-red-600 rounded-lg font-bold text-lg hover:bg-gray-100 transition-all shadow-lg"
                    >
                      Play Again
                    </button>
                  </div>
                </div>
              )}

              {gameStatus === 'paused' && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="text-white text-4xl font-bold">PAUSED</div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">How To Play</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p><kbd className="px-2 py-1 bg-gray-200 rounded">↑↓←→</kbd> or <kbd className="px-2 py-1 bg-gray-200 rounded">WASD</kbd></p>
                <p className="mt-3"><strong className="text-purple-600">🏆 VS MODE:</strong> Collect more money than {companionName}!</p>
                <p><strong>✋ {playerName}:</strong> You (yellow border)</p>
                <p><strong>👋 {companionName}:</strong> AI opponent (blue border)</p>
                <p className="mt-2"><strong>💵 Bills:</strong> $100 each</p>
                <p><strong>💰 Hammer Power-up:</strong> $500 + become invincible for 10 seconds!</p>
                <p><strong>🔨 With Hammer:</strong> Defeat enemy hammers for $500, steal from opponent!</p>
                <p><strong>⚡ Both Have Hammers:</strong> Collision = both lose power-up</p>
                <p className="text-xs text-red-600 font-semibold mt-3">💸 Get Hit by Hammer: Lose $200 + respawn</p>
                <p className="text-xs text-blue-600 mt-2">🚪 Exit: Player with most $ wins the round!</p>
                <p className="text-xs text-purple-600 mt-1 font-bold">First to exit triggers scoring!</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Level Progress</h3>
              <div className="text-3xl font-bold">Level {currentLevel + 1}</div>
              <div className="text-sm opacity-75 mt-1">Enemies: {enemies.length} hammers</div>
              <div className="text-xs opacity-75 mt-1">4 Unique Mazes (Repeating)</div>
              <div className="text-xs opacity-90 mt-2 font-semibold">
                {playerWins > companionWins ? `${playerName} Leading!` :
                 companionWins > playerWins ? `${companionName} Leading!` :
                 playerWins > 0 ? 'Tied Score!' : 'No winner yet'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
