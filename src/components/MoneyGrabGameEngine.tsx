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
}

interface ExitPoint {
  position: Position;
  direction: 'up' | 'down' | 'left' | 'right';
}

function generateMaze(level: number): { maze: number[][], entrance: Position, exit: ExitPoint } {
  const templates = [
    {
      layout: [
        "#####################",
        "#........#..........#",
        "#.###.##.#.##.###.#",
        "#...#.......#...#.#",
        "###.#.#####.#.###.#",
        "#.....#...#.......#",
        "#.###.#.#.#.###.###",
        "#.#.....#.....#...#",
        "#.#.###.###.#.###.#",
        "#...................#",
        "#.#.###.###.#.###.#",
        "#.#.....#.....#...#",
        "#.###.#.#.#.###.###",
        "#.....#...#.......#",
        "###.#.#####.#.###.#",
        "#...#.......#...#.#",
        "#.###.##.#.##.###.#",
        "#........#..........#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#.................#",
        "#.###.#######.###.#",
        "#...#.........#...#",
        "###.#.#######.#.###",
        "#.....#.....#.....#",
        "#.###.#.###.#.###.#",
        "#.#.....#.....#.#",
        "#.#.###.#.###.#.#",
        "#...................#",
        "#.#.###.#.###.#.#",
        "#.#.....#.....#.#",
        "#.###.#.###.#.###.#",
        "#.....#.....#.....#",
        "###.#.#######.#.###",
        "#...#.........#...#",
        "#.###.#######.###.#",
        "#.................#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#.#.#.#.#.#.#.#.#.#",
        "#.................#",
        "#.###.#######.###.#",
        "#.#.............#.#",
        "#.#.###.###.###.#.#",
        "#.......#.#.......#",
        "#.#####.#.#.#####.#",
        "#.......#.#.......#",
        "#...................#",
        "#.......#.#.......#",
        "#.#####.#.#.#####.#",
        "#.......#.#.......#",
        "#.#.###.###.###.#.#",
        "#.#.............#.#",
        "#.###.#######.###.#",
        "#.................#",
        "#.#.#.#.#.#.#.#.#.#",
        "#####################"
      ]
    },
    {
      layout: [
        "#####################",
        "#.................#",
        "###.#.#########.#.#",
        "#...#.#.......#.#.#",
        "#.###.#.#####.#.#.#",
        "#.#...#.....#.#...#",
        "#.#.#######.###.###",
        "#.#.#.......#.....#",
        "#.#.#.#####.#####.#",
        "#...................#",
        "#.#.#####.#.#####.#",
        "#.....#.......#.#.#",
        "###.###.#######.#.#",
        "#...#.#.....#...#.#",
        "#.#.#.#.#####.###.#",
        "#.#.#.......#.#...#",
        "#.#.#########.#.###",
        "#.................#",
        "#####################"
      ]
    }
  ];

  const templateStr = templates[level % templates.length].layout;
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

  return { maze, entrance, exit };
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

  // JavaScript modulo with negative numbers wraps around (e.g., -1 % 30 = 29)
  // Adjust offsets greater than TILE_SIZE/2 to be negative (e.g., 29 -> -1)
  if (offsetX > TILE_SIZE / 2) offsetX -= TILE_SIZE;
  if (offsetY > TILE_SIZE / 2) offsetY -= TILE_SIZE;

  // STRICTER alignment check - must be within 1 pixel of center
  // With MOVE_SPEED=3 and TILE_SIZE=30, we hit exact alignment at 15, 45, 75, etc.
  return Math.abs(offsetX) <= 1 && Math.abs(offsetY) <= 1;
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

// Track AI position history to prevent loops
const aiLastPositions = new Map<string, Position[]>();

function getAIDirection(
  maze: number[][],
  from: Position,
  target: Position,
  enemies: Enemy[],
  playerPos: Position,
  playerId: string = 'ai-player'
): Direction | null {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const validDirs = dirs.filter(d => canMove(maze, from, d));

  if (validDirs.length === 0) return null;

  // Get position history for this AI
  if (!aiLastPositions.has(playerId)) {
    aiLastPositions.set(playerId, []);
  }
  const history = aiLastPositions.get(playerId)!;

  // Define deltas once for reuse
  const deltas: Record<Direction, Position> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };

  // Filter out moves that would return to recent positions (prevent loops)
  const nonLoopingDirs = validDirs.filter(dir => {
    const delta = deltas[dir];
    const nextPos = { row: from.row + delta.row, col: from.col + delta.col };

    // Check if this position was visited in last 3 moves
    const wasRecentlyVisited = history.some(pos =>
      pos.row === nextPos.row && pos.col === nextPos.col
    );

    return !wasRecentlyVisited;
  });

  // Use non-looping directions if available, otherwise use any valid direction
  const dirsToConsider = nonLoopingDirs.length > 0 ? nonLoopingDirs : validDirs;

  const isBeingChased = enemies.some(e =>
    Math.abs(e.gridPos.row - from.row) + Math.abs(e.gridPos.col - from.col) <= 3
  );

  let bestDir = dirsToConsider[0];
  let bestScore = isBeingChased ? -Infinity : Infinity;

  for (const dir of dirsToConsider) {
    const delta = deltas[dir];
    const newPos = {
      row: from.row + delta.row,
      col: from.col + delta.col
    };

    if (isBeingChased) {
      // RUN AWAY - maximize distance from enemies
      let minEnemyDist = Infinity;
      for (const enemy of enemies) {
        const dist = Math.abs(newPos.row - enemy.gridPos.row) +
                    Math.abs(newPos.col - enemy.gridPos.col);
        minEnemyDist = Math.min(minEnemyDist, dist);
      }

      if (minEnemyDist > bestScore) {
        bestScore = minEnemyDist;
        bestDir = dir;
      }
    } else {
      // CHASE TARGET - minimize distance to target
      const distToTarget = Math.abs(newPos.row - target.row) + Math.abs(newPos.col - target.col);

      // Also consider enemy proximity (avoid getting too close)
      let minEnemyDist = Infinity;
      for (const enemy of enemies) {
        const enemyDist = Math.abs(newPos.row - enemy.gridPos.row) +
                         Math.abs(newPos.col - enemy.gridPos.col);
        minEnemyDist = Math.min(minEnemyDist, enemyDist);
      }

      let score = distToTarget;

      // Penalty if getting too close to enemies
      if (minEnemyDist < 3) {
        score += (3 - minEnemyDist) * 10;
      }

      // Small randomness to break ties
      if (Math.random() < 0.05) {
        score += Math.random() * 0.5;
      }

      if (score < bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
  }

  // Update position history (keep last 3 positions)
  history.push({ ...from });
  if (history.length > 3) {
    history.shift();
  }

  return bestDir;
}

export function MoneyGrabGameEngine({
  playerName,
  companionName,
  onGameComplete
}: MoneyGrabGameEngineProps) {
  const [currentLevel, setCurrentLevel] = useState(0);
  const [levelScore, setLevelScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const [mazeData, setMazeData] = useState(() => generateMaze(0));
  const [maze, setMaze] = useState(mazeData.maze);
  const [exitPoint, setExitPoint] = useState<ExitPoint>(mazeData.exit);

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
  const [powerUps, setPowerUps] = useState<Position[]>([]);

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

  const [gameStatus, setGameStatus] = useState<'playing' | 'paused' | 'gameover' | 'levelcomplete'>('playing');
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  const [showDebugMenu, setShowDebugMenu] = useState(false);

  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());
  const enemyUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (gameStatus === 'gameover') {
      onGameComplete?.(totalScore + player.score + aiPlayer.score, currentLevel + 1);
    }
  }, [gameStatus, totalScore, player.score, aiPlayer.score, currentLevel, onGameComplete]);

  useEffect(() => {
    const newPowerUps: Position[] = [];
    const corners = [
      { row: 2, col: 2 },
      { row: 2, col: MAZE_WIDTH - 3 },
      { row: MAZE_HEIGHT - 3, col: 2 },
      { row: MAZE_HEIGHT - 3, col: MAZE_WIDTH - 3 }
    ];

    for (const corner of corners) {
      if (maze[corner.row][corner.col] === 0) {
        newPowerUps.push(corner);
      }
    }
    setPowerUps(newPowerUps);
  }, [maze]);

  const loadNextLevel = () => {
    const nextLevelNum = currentLevel + 1;
    const newMazeData = generateMaze(nextLevelNum);

    setCurrentLevel(nextLevelNum);
    setMazeData(newMazeData);
    setMaze(newMazeData.maze);
    setExitPoint(newMazeData.exit);

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
      setGameStatus('playing');
    }, 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle debug menu with 'D' key (Shift+D)
      if (e.key === 'd' || e.key === 'D') {
        if (e.shiftKey) {
          e.preventDefault();
          setShowDebugMenu(prev => !prev);
          return;
        }
      }

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

      if (delta >= 16) {
        lastUpdateRef.current = now;
        enemyUpdateRef.current += delta;

        setPlayer(prev => {
          if (!prev.currentDir) return prev;

          const newPlayer = { ...prev };

          if (isAligned(newPlayer.pixelPos) && newPlayer.nextDir) {
            if (canMove(maze, newPlayer.gridPos, newPlayer.nextDir)) {
              newPlayer.currentDir = newPlayer.nextDir;
              newPlayer.nextDir = null;
            }
          }

          const deltas: Record<Direction, PixelPosition> = {
            up: { x: 0, y: -MOVE_SPEED },
            down: { x: 0, y: MOVE_SPEED },
            left: { x: -MOVE_SPEED, y: 0 },
            right: { x: MOVE_SPEED, y: 0 }
          };

          const delta = deltas[newPlayer.currentDir];
          const newPixelPos = {
            x: newPlayer.pixelPos.x + delta.x,
            y: newPlayer.pixelPos.y + delta.y
          };

          // Only update grid position and check collisions when aligned
          if (isAligned(newPixelPos)) {
            const newGridPos = pixelToGrid(newPixelPos);

            if (newGridPos.row !== newPlayer.gridPos.row || newGridPos.col !== newPlayer.gridPos.col) {
              if (!canMove(maze, newPlayer.gridPos, newPlayer.currentDir)) {
                newPlayer.pixelPos = gridToPixel(newPlayer.gridPos);
                newPlayer.currentDir = null;
                return newPlayer;
              }

              newPlayer.gridPos = newGridPos;

              // Check exit
              if (newGridPos.row === exitPoint.position.row && newGridPos.col === exitPoint.position.col) {
                setTotalScore(prev => prev + newPlayer.score);
                setShowLevelTransition(true);
                setGameStatus('levelcomplete');
                setTimeout(loadNextLevel, 500);
                return newPlayer;
              }

              // Check cash collection (ONLY when aligned on grid cell)
              const collectRow = newGridPos.row;
              const collectCol = newGridPos.col;
              const hasCash = cash.some(f => f.row === collectRow && f.col === collectCol);
              if (hasCash) {
                console.log(`✋ Player collected cash at grid [${newGridPos.row}, ${newGridPos.col}] pixel [${Math.round(newPlayer.pixelPos.x)}, ${Math.round(newPlayer.pixelPos.y)}]`);
                setCash(prev => prev.filter(f => !(f.row === collectRow && f.col === collectCol)));
                newPlayer.score += CASH_POINTS;
                setLevelScore(prev => prev + CASH_POINTS);

                newPlayer.isGrabbing = true;
                setTimeout(() => {
                  setPlayer(p => ({ ...p, isGrabbing: false }));
                }, 200);
              }

              // Check power-up collection
              const hasPowerUp = powerUps.some(p => p.row === collectRow && p.col === collectCol);
              if (hasPowerUp) {
                setPowerUps(prev => prev.filter(p => !(p.row === collectRow && p.col === collectCol)));
                newPlayer.powerUpActive = true;
                newPlayer.powerUpExpiry = Date.now() + 10000;
                newPlayer.score += POWER_UP_POINTS;
                setLevelScore(prev => prev + POWER_UP_POINTS);

                newPlayer.isGrabbing = true;
                setTimeout(() => {
                  setPlayer(p => ({ ...p, isGrabbing: false }));
                }, 200);
              }
            }
          }

          // Always update pixel position for smooth movement
          newPlayer.pixelPos = newPixelPos;

          if (newPlayer.powerUpActive && Date.now() > newPlayer.powerUpExpiry) {
            newPlayer.powerUpActive = false;
          }

          return newPlayer;
        });

        setAiPlayer(prev => {
          const newAI = { ...prev };

          if (isAligned(newAI.pixelPos)) {
            const target = findNearestTarget(newAI.gridPos, cash, powerUps);

            if (target) {
              const aiMove = getAIDirection(maze, newAI.gridPos, target, enemies, player.gridPos, 'ai-player');
              if (aiMove) {
                newAI.currentDir = aiMove;
              }
            } else {
              const exitTarget = exitPoint.position;
              const aiMove = getAIDirection(maze, newAI.gridPos, exitTarget, enemies, player.gridPos, 'ai-player');
              if (aiMove) {
                newAI.currentDir = aiMove;
              } else if (!newAI.currentDir) {
                const dirs: Direction[] = ['up', 'down', 'left', 'right'];
                const validDirs = dirs.filter(d => canMove(maze, newAI.gridPos, d));
                if (validDirs.length > 0) {
                  newAI.currentDir = validDirs[Math.floor(Math.random() * validDirs.length)];
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

          const delta = deltas[newAI.currentDir];
          const newPixelPos = {
            x: newAI.pixelPos.x + delta.x,
            y: newAI.pixelPos.y + delta.y
          };

          // Only update grid position and check collisions when aligned
          if (isAligned(newPixelPos)) {
            const newGridPos = pixelToGrid(newPixelPos);

            if (newGridPos.row !== newAI.gridPos.row || newGridPos.col !== newAI.gridPos.col) {
              if (!canMove(maze, newAI.gridPos, newAI.currentDir)) {
                newAI.pixelPos = gridToPixel(newAI.gridPos);
                newAI.currentDir = null;
                return newAI;
              }

              newAI.gridPos = newGridPos;

              // Check exit
              if (newGridPos.row === exitPoint.position.row && newGridPos.col === exitPoint.position.col) {
                setShowLevelTransition(true);
                setGameStatus('levelcomplete');
                setTimeout(loadNextLevel, 500);
                return newAI;
              }

              // Check cash collection (ONLY when aligned on grid cell)
              const aiCollectRow = newGridPos.row;
              const aiCollectCol = newGridPos.col;
              const aiHasCash = cash.some(f => f.row === aiCollectRow && f.col === aiCollectCol);
              if (aiHasCash) {
                console.log(`👋 AI collected cash at grid [${newGridPos.row}, ${newGridPos.col}] pixel [${Math.round(newAI.pixelPos.x)}, ${Math.round(newAI.pixelPos.y)}]`);
                setCash(prev => prev.filter(f => !(f.row === aiCollectRow && f.col === aiCollectCol)));
                newAI.score += CASH_POINTS;

                newAI.isGrabbing = true;
                setTimeout(() => {
                  setAiPlayer(p => ({ ...p, isGrabbing: false }));
                }, 200);
              }

              // Check power-up collection
              const aiHasPowerUp = powerUps.some(p => p.row === aiCollectRow && p.col === aiCollectCol);
              if (aiHasPowerUp) {
                setPowerUps(prev => prev.filter(p => !(p.row === aiCollectRow && p.col === aiCollectCol)));
                newAI.powerUpActive = true;
                newAI.powerUpExpiry = Date.now() + 10000;
                newAI.score += POWER_UP_POINTS;

                newAI.isGrabbing = true;
                setTimeout(() => {
                  setAiPlayer(p => ({ ...p, isGrabbing: false }));
                }, 200);
              }
            }
          }

          // Always update pixel position for smooth movement
          newAI.pixelPos = newPixelPos;

          if (newAI.powerUpActive && Date.now() > newAI.powerUpExpiry) {
            newAI.powerUpActive = false;
          }

          return newAI;
        });

        const enemySpeed = 200 - (currentLevel * 20);
        if (enemyUpdateRef.current > Math.max(enemySpeed, 80)) {
          enemyUpdateRef.current = 0;

          setEnemies(prev => prev.map(enemy => {
            const currentTime = Date.now();
            const timeSinceHit = currentTime - enemy.lastHitTime;

            // If paused (just hit player), unpause after 1 second
            if (enemy.isPaused) {
              if (timeSinceHit > 1000) {
                return { ...enemy, isPaused: false };
              }
              return enemy;
            }

            const dist1 = Math.abs(enemy.gridPos.row - player.gridPos.row) +
                         Math.abs(enemy.gridPos.col - player.gridPos.col);
            const dist2 = Math.abs(enemy.gridPos.row - aiPlayer.gridPos.row) +
                         Math.abs(enemy.gridPos.col - aiPlayer.gridPos.col);

            const nearestIsPlayer = dist1 < dist2;
            const nearestPlayer = nearestIsPlayer ? player : aiPlayer;

            // Determine behavior: flee if player has hammer OR if on cooldown
            const shouldFlee = nearestPlayer.powerUpActive || (timeSinceHit < 5000 && timeSinceHit > 0);

            const dirs: Direction[] = ['up', 'down', 'left', 'right'];
            const validDirs = dirs.filter(d => canMove(maze, enemy.gridPos, d));

            if (validDirs.length === 0) return enemy;

            let bestDir = validDirs[0];
            let bestDist = shouldFlee ? -Infinity : Infinity;

            for (const dir of validDirs) {
              const deltas: Record<Direction, Position> = {
                up: { row: -1, col: 0 },
                down: { row: 1, col: 0 },
                left: { row: 0, col: -1 },
                right: { row: 0, col: 1 }
              };

              const delta = deltas[dir];
              const newPos = {
                row: enemy.gridPos.row + delta.row,
                col: enemy.gridPos.col + delta.col
              };

              const distToTarget = Math.abs(newPos.row - nearestPlayer.gridPos.row) +
                                  Math.abs(newPos.col - nearestPlayer.gridPos.col);

              if (shouldFlee) {
                // RUN AWAY - pick direction that INCREASES distance
                if (distToTarget > bestDist) {
                  bestDist = distToTarget;
                  bestDir = dir;
                }
              } else {
                // CHASE - pick direction that DECREASES distance
                if (distToTarget < bestDist) {
                  bestDist = distToTarget;
                  bestDir = dir;
                }
              }
            }

            const deltas: Record<Direction, Position> = {
              up: { row: -1, col: 0 },
              down: { row: 1, col: 0 },
              left: { row: 0, col: -1 },
              right: { row: 0, col: 1 }
            };

            const delta = deltas[bestDir];
            return {
              ...enemy,
              dir: bestDir,
              gridPos: {
                row: enemy.gridPos.row + delta.row,
                col: enemy.gridPos.col + delta.col
              }
            };
          }));
        }

        setPlayer(prev => {
          const newPlayer = { ...prev };
          const currentTime = Date.now();

          for (const enemy of enemies) {
            if (enemy.gridPos.row === newPlayer.gridPos.row &&
                enemy.gridPos.col === newPlayer.gridPos.col) {
              if (!newPlayer.powerUpActive) {
                // Only hit if enemy isn't on cooldown
                if (currentTime - enemy.lastHitTime > 5000) {
                  // Lose money but DON'T stop movement
                  newPlayer.score = Math.max(0, newPlayer.score - 200);
                  setLevelScore(s => Math.max(0, s - 200));

                  // Put enemy on cooldown - pause and retreat
                  setEnemies(prev => prev.map(e =>
                    e.id === enemy.id
                      ? { ...e, lastHitTime: currentTime, isPaused: true }
                      : e
                  ));
                }
              } else {
                // Player has hammer - can defeat enemy hammer
                newPlayer.score += 500;
                setLevelScore(s => s + 500);
                // Respawn enemy hammer at its original spawn point
                const enemyIndex = parseInt(enemy.id) - 1;
                const respawnPos = enemySpawnPoints[enemyIndex] || enemySpawnPoints[0] || { row: Math.floor(MAZE_HEIGHT / 2), col: Math.floor(MAZE_WIDTH / 2) };
                setEnemies(prev => prev.map(e =>
                  e.id === enemy.id
                    ? { ...e, gridPos: respawnPos, lastHitTime: 0, isPaused: false }
                    : e
                ));
              }
            }
          }
          return newPlayer;
        });

        setAiPlayer(prev => {
          const newAI = { ...prev };
          const currentTime = Date.now();

          for (const enemy of enemies) {
            if (enemy.gridPos.row === newAI.gridPos.row &&
                enemy.gridPos.col === newAI.gridPos.col) {
              if (!newAI.powerUpActive) {
                // Only hit if enemy isn't on cooldown
                if (currentTime - enemy.lastHitTime > 5000) {
                  // AI loses money but DON'T stop movement
                  newAI.score = Math.max(0, newAI.score - 200);

                  // Put enemy on cooldown - pause and retreat
                  setEnemies(prev => prev.map(e =>
                    e.id === enemy.id
                      ? { ...e, lastHitTime: currentTime, isPaused: true }
                      : e
                  ));
                }
              } else {
                // AI has hammer - can defeat enemy hammer
                newAI.score += 500;
                // Respawn enemy hammer at its original spawn point
                const enemyIndex = parseInt(enemy.id) - 1;
                const respawnPos = enemySpawnPoints[enemyIndex] || enemySpawnPoints[0] || { row: Math.floor(MAZE_HEIGHT / 2), col: Math.floor(MAZE_WIDTH / 2) };
                setEnemies(prev => prev.map(e =>
                  e.id === enemy.id
                    ? { ...e, gridPos: respawnPos, lastHitTime: 0, isPaused: false }
                    : e
                ));
              }
            }
          }
          return newAI;
        });

        // Check player vs player collision (when both have hammers)
        if (player.gridPos.row === aiPlayer.gridPos.row &&
            player.gridPos.col === aiPlayer.gridPos.col) {

          if (player.powerUpActive && aiPlayer.powerUpActive) {
            // Both have hammers - both lose power-up
            setPlayer(p => ({ ...p, powerUpActive: false, powerUpExpiry: 0 }));
            setAiPlayer(p => ({ ...p, powerUpActive: false, powerUpExpiry: 0 }));
          } else if (player.powerUpActive && !aiPlayer.powerUpActive) {
            // Player has hammer, AI doesn't - AI loses money and respawns
            setAiPlayer(p => ({
              ...p,
              score: Math.max(0, p.score - 200),
              gridPos: { row: mazeData.entrance.row + 1, col: mazeData.entrance.col },
              pixelPos: gridToPixel({ row: mazeData.entrance.row + 1, col: mazeData.entrance.col }),
              currentDir: null
            }));
          } else if (!player.powerUpActive && aiPlayer.powerUpActive) {
            // AI has hammer, player doesn't - player loses money and respawns
            setPlayer(p => ({
              ...p,
              score: Math.max(0, p.score - 200),
              gridPos: mazeData.entrance,
              pixelPos: gridToPixel(mazeData.entrance),
              currentDir: null,
              nextDir: null
            }));
            setLevelScore(s => Math.max(0, s - 200));
          }
        }
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameStatus, maze, cash, powerUps, enemies, exitPoint, currentLevel, player.gridPos, aiPlayer.gridPos]);

  const resetGame = () => {
    setCurrentLevel(0);
    setTotalScore(0);
    setLevelScore(0);

    const newMazeData = generateMaze(0);
    setMazeData(newMazeData);
    setMaze(newMazeData.maze);
    setExitPoint(newMazeData.exit);

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
    setGameStatus('playing');
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
              </div>

              <div className="flex-1 bg-black bg-opacity-75 text-white px-4 py-3 rounded-lg">
                <div className="text-xs text-gray-400 text-center">Combined Score</div>
                <div className="text-xl font-bold text-green-400 text-center">${totalScore + player.score + aiPlayer.score}</div>
              </div>

              <div className="flex-1 bg-black bg-opacity-75 text-white px-4 py-3 rounded-lg border-2 border-blue-400">
                <div className="text-xs text-gray-400 text-right">{companionName} 👋</div>
                <div className="text-2xl font-bold text-blue-400 text-right">${aiPlayer.score}</div>
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
                        fill="#2563eb"
                        stroke="#3b82f6"
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
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#fbbf24" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {playerName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {player.powerUpActive ? '🔨' : (player.isGrabbing ? '✊' : '✋')}
                  </text>
                </g>

                <g transform={`translate(${aiPlayer.pixelPos.x}, ${aiPlayer.pixelPos.y})`}>
                  {aiPlayer.powerUpActive && (
                    <circle r="13" fill="#3b82f6" opacity="0.4">
                      <animate attributeName="r" values="13;17;13" dur="0.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.6;0.4" dur="0.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#3b82f6" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {companionName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {aiPlayer.powerUpActive ? '🔨' : (aiPlayer.isGrabbing ? '👊' : '👋')}
                  </text>
                </g>

                {/* DEBUG OVERLAY - Toggle with Shift+D */}
                {showDebugMenu && (
                  <g>
                    <rect x="5" y="5" width="310" height="190" fill="black" opacity="0.8" rx="5"/>
                    <text x="15" y="25" fill="#fbbf24" fontSize="12" fontWeight="bold">
                      DEBUG INFO (Shift+D to toggle)
                    </text>
                    <text x="15" y="45" fill="white" fontSize="10">
                      Player Grid: [{player.gridPos.row}, {player.gridPos.col}]
                    </text>
                    <text x="15" y="60" fill="white" fontSize="10">
                      Player Pixel: [{Math.round(player.pixelPos.x)}, {Math.round(player.pixelPos.y)}]
                    </text>
                    <text x="15" y="75" fill="white" fontSize="10">
                      Player Offset: X={Math.round((player.pixelPos.x - TILE_SIZE / 2) % TILE_SIZE)} Y={Math.round((player.pixelPos.y - TILE_SIZE / 2) % TILE_SIZE)}
                    </text>
                    <text x="15" y="90" fill={isAligned(player.pixelPos) ? '#10b981' : '#ef4444'} fontSize="11" fontWeight="bold">
                      Player Aligned: {isAligned(player.pixelPos) ? 'YES ✓' : 'NO ✗'}
                    </text>
                    <text x="15" y="110" fill="white" fontSize="10">
                      AI Grid: [{aiPlayer.gridPos.row}, {aiPlayer.gridPos.col}]
                    </text>
                    <text x="15" y="125" fill="white" fontSize="10">
                      AI Pixel: [{Math.round(aiPlayer.pixelPos.x)}, {Math.round(aiPlayer.pixelPos.y)}]
                    </text>
                    <text x="15" y="140" fill="white" fontSize="10">
                      AI Offset: X={Math.round((aiPlayer.pixelPos.x - TILE_SIZE / 2) % TILE_SIZE)} Y={Math.round((aiPlayer.pixelPos.y - TILE_SIZE / 2) % TILE_SIZE)}
                    </text>
                    <text x="15" y="155" fill={isAligned(aiPlayer.pixelPos) ? '#10b981' : '#ef4444'} fontSize="11" fontWeight="bold">
                      AI Aligned: {isAligned(aiPlayer.pixelPos) ? 'YES ✓' : 'NO ✗'}
                    </text>
                    <text x="15" y="175" fill="#10b981" fontSize="11" fontWeight="bold">
                      Cash Count: {cash.length}
                    </text>
                    <text x="15" y="190" fill="#fbbf24" fontSize="9">
                      Alignment threshold: ±1px
                    </text>
                  </g>
                )}
              </svg>

              {showLevelTransition && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 bg-opacity-90 flex items-center justify-center rounded-lg">
                  <div className="text-center text-white">
                    <Trophy className="w-20 h-20 mx-auto mb-4 animate-bounce" />
                    <h2 className="text-4xl font-bold mb-2">Level Complete!</h2>
                    <p className="text-2xl">+${levelScore}</p>
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

                    <div className="text-lg mb-6">Grand Total: ${totalScore + player.score + aiPlayer.score}</div>

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
                <p><kbd className="px-2 py-1 bg-gray-200 rounded">Shift+D</kbd> Toggle Debug</p>
                <p className="mt-3"><strong>🎯 Mission:</strong> Team up to collect money!</p>
                <p><strong>✋ {playerName}:</strong> You control (yellow)</p>
                <p><strong>👋 {companionName}:</strong> Your companion (blue)</p>
                <p className="text-xs italic">Starts one tile below you</p>
                <p className="mt-2"><strong>💵 Cash:</strong> $100 per bill</p>
                <p><strong>💰 Power-up:</strong> Grab a hammer for 10 seconds!</p>
                <p><strong>🔨 With Hammer:</strong> Hit enemy hammers, collect bills, invincible!</p>
                <p><strong>⚡ Hammer Clash:</strong> If both have hammers and collide, both lose them!</p>
                <p className="text-xs text-red-600 font-semibold mt-3">💸 Get Hit: Lose $200 and respawn at entrance</p>
                <p className="text-xs text-blue-600 mt-2">💡 Reach the exit 🚪 to advance!</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
              <h3 className="text-lg font-bold mb-2">Level Progress</h3>
              <div className="text-3xl font-bold">{currentLevel + 1}</div>
              <div className="text-sm opacity-75 mt-1">Enemies: {enemies.length}</div>
              <div className="text-xs opacity-75 mt-1">Procedurally Generated</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
