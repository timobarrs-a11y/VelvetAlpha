import { useState, useEffect, useRef } from 'react';
import { RotateCcw, Play, Pause, Trophy } from 'lucide-react';

/**
 * Money Grab - Team-based Pac-Man style game for AI Companion App
 * 
 * Usage: Pass playerName and companionName as props from your database
 * Example: <MoneyGrabGame playerName="Alex" companionName="Sophia" />
 */

// Constants
const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 19;
const TILE_SIZE = 30;
const MOVE_SPEED = 3;
const CASH_POINTS = 100;
const POWER_UP_POINTS = 500;

// Types
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
  isLocked: boolean;
  lockedTarget: 'player' | 'ai' | null;
  lockMoveCount: number;
}

interface ExitPoint {
  position: Position;
  direction: 'up' | 'down' | 'left' | 'right';
}

// Hand-crafted Pac-Man Style Maze Templates
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
  
  if (exitSide === 'right') {
    for (let r = 1; r < MAZE_HEIGHT - 1; r++) {
      maze[r][MAZE_WIDTH - 2] = 0;
    }
  } else if (exitSide === 'left') {
    for (let r = 1; r < MAZE_HEIGHT - 1; r++) {
      maze[r][1] = 0;
    }
  } else if (exitSide === 'up') {
    for (let c = 1; c < MAZE_WIDTH - 1; c++) {
      maze[1][c] = 0;
    }
  } else if (exitSide === 'down') {
    for (let c = 1; c < MAZE_WIDTH - 1; c++) {
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
  const offsetX = (pixel.x - TILE_SIZE / 2) % TILE_SIZE;
  const offsetY = (pixel.y - TILE_SIZE / 2) % TILE_SIZE;
  return Math.abs(offsetX) < 2 && Math.abs(offsetY) < 2;
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
  
  return maze[newRow][newCol] === 0;
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

function getAIDirection(
  maze: number[][], 
  from: Position, 
  target: Position,
  enemies: Enemy[],
  playerPos: Position
): Direction | null {
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const validDirs = dirs.filter(d => canMove(maze, from, d));
  
  if (validDirs.length === 0) return null;
  
  const isBeingChased = enemies.some(e => 
    e.isLocked && e.lockedTarget === 'ai' && 
    Math.abs(e.gridPos.row - from.row) + Math.abs(e.gridPos.col - from.col) <= 3
  );
  
  if (isBeingChased) {
    let bestDir = validDirs[0];
    let bestScore = -Infinity;
    
    for (const dir of validDirs) {
      const deltas: Record<Direction, Position> = {
        up: { row: -1, col: 0 },
        down: { row: 1, col: 0 },
        left: { row: 0, col: -1 },
        right: { row: 0, col: 1 }
      };
      
      const delta = deltas[dir];
      const newPos = {
        row: from.row + delta.row,
        col: from.col + delta.col
      };
      
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
    }
    
    return bestDir;
  }
  
  let bestDir = validDirs[0];
  let bestScore = Infinity;
  
  for (const dir of validDirs) {
    const deltas: Record<Direction, Position> = {
      up: { row: -1, col: 0 },
      down: { row: 1, col: 0 },
      left: { row: 0, col: -1 },
      right: { row: 0, col: 1 }
    };
    
    const delta = deltas[dir];
    const newPos = {
      row: from.row + delta.row,
      col: from.col + delta.col
    };
    
    const distToTarget = Math.abs(newPos.row - target.row) + Math.abs(newPos.col - target.col);
    
    let minEnemyDist = Infinity;
    for (const enemy of enemies) {
      const enemyDist = Math.abs(newPos.row - enemy.gridPos.row) + 
                       Math.abs(newPos.col - enemy.gridPos.col);
      minEnemyDist = Math.min(minEnemyDist, enemyDist);
    }
    
    let score = distToTarget;
    if (minEnemyDist < 4) {
      score += (4 - minEnemyDist) * 5;
    }
    
    if (Math.random() < 0.05) {
      score += Math.random() * 2;
    }
    
    if (score < bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  
  return bestDir;
}

export default function MoneyGrabGame({ 
  playerName, 
  companionName 
}: { 
  playerName: string; 
  companionName: string;
}) {
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
  
  const [enemies, setEnemies] = useState<Enemy[]>([
    { id: '1', gridPos: { row: 9, col: 9 }, dir: 'left', color: '#ef4444', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
    { id: '2', gridPos: { row: 9, col: 11 }, dir: 'right', color: '#ec4899', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
    { id: '3', gridPos: { row: 8, col: 10 }, dir: 'up', color: '#06b6d4', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
    { id: '4', gridPos: { row: 10, col: 10 }, dir: 'down', color: '#f97316', isLocked: false, lockedTarget: null, lockMoveCount: 0 }
  ]);
  
  const [gameStatus, setGameStatus] = useState<'playing' | 'paused' | 'gameover' | 'levelcomplete'>('playing');
  const [showLevelTransition, setShowLevelTransition] = useState(false);
  
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());
  const enemyUpdateRef = useRef<number>(0);

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
    
    const baseEnemies: Enemy[] = [
      { id: '1', gridPos: { row: 9, col: 9 }, dir: 'left', color: '#ef4444', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '2', gridPos: { row: 9, col: 11 }, dir: 'right', color: '#ec4899', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '3', gridPos: { row: 8, col: 10 }, dir: 'up', color: '#06b6d4', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '4', gridPos: { row: 10, col: 10 }, dir: 'down', color: '#f97316', isLocked: false, lockedTarget: null, lockMoveCount: 0 }
    ];
    
    const extraEnemies = Math.min(nextLevelNum, 4);
    for (let i = 0; i < extraEnemies; i++) {
      baseEnemies.push({
        id: `extra-${i}`,
        gridPos: { row: 5 + i * 2, col: 15 },
        dir: 'left',
        color: '#8b5cf6',
        isLocked: false,
        lockedTarget: null,
        lockMoveCount: 0
      });
    }
    
    setEnemies(baseEnemies);
    setLevelScore(0);
    
    setTimeout(() => {
      setShowLevelTransition(false);
      setGameStatus('playing');
    }, 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;
      
      const dirMap: Record<string, Direction> = {
        'ArrowUp': 'up', 'w': 'up',
        'ArrowDown': 'down', 's': 'down',
        'ArrowLeft': 'left', 'a': 'left',
        'ArrowRight': 'right', 'd': 'right'
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
          
          const newGridPos = pixelToGrid(newPixelPos);
          
          if (newGridPos.row !== newPlayer.gridPos.row || newGridPos.col !== newPlayer.gridPos.col) {
            if (!canMove(maze, newPlayer.gridPos, newPlayer.currentDir)) {
              newPlayer.pixelPos = gridToPixel(newPlayer.gridPos);
              newPlayer.currentDir = null;
              return newPlayer;
            }
            
            newPlayer.gridPos = newGridPos;
            
            if (newGridPos.row === exitPoint.position.row && newGridPos.col === exitPoint.position.col) {
              setTotalScore(prev => prev + newPlayer.score);
              setShowLevelTransition(true);
              setGameStatus('levelcomplete');
              setTimeout(loadNextLevel, 500);
              return newPlayer;
            }
            
            const cashIdx = cash.findIndex(f => 
              f.row === newGridPos.row && f.col === newGridPos.col
            );
            if (cashIdx !== -1) {
              setCash(prev => prev.filter((_, i) => i !== cashIdx));
              newPlayer.score += CASH_POINTS;
              setLevelScore(prev => prev + CASH_POINTS);
              
              newPlayer.isGrabbing = true;
              setTimeout(() => {
                setPlayer(p => ({ ...p, isGrabbing: false }));
              }, 200);
            }
            
            const powerUpIdx = powerUps.findIndex(p =>
              p.row === newGridPos.row && p.col === newGridPos.col
            );
            if (powerUpIdx !== -1) {
              setPowerUps(prev => prev.filter((_, i) => i !== powerUpIdx));
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
              const aiMove = getAIDirection(maze, newAI.gridPos, target, enemies, player.gridPos);
              if (aiMove) {
                newAI.currentDir = aiMove;
              }
            } else {
              const exitTarget = exitPoint.position;
              const aiMove = getAIDirection(maze, newAI.gridPos, exitTarget, enemies, player.gridPos);
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
          
          const newGridPos = pixelToGrid(newPixelPos);
          
          if (newGridPos.row !== newAI.gridPos.row || newGridPos.col !== newAI.gridPos.col) {
            if (!canMove(maze, newAI.gridPos, newAI.currentDir)) {
              newAI.pixelPos = gridToPixel(newAI.gridPos);
              newAI.currentDir = null;
              return newAI;
            }
            
            newAI.gridPos = newGridPos;
            
            if (newGridPos.row === exitPoint.position.row && newGridPos.col === exitPoint.position.col) {
              setShowLevelTransition(true);
              setGameStatus('levelcomplete');
              setTimeout(loadNextLevel, 500);
              return newAI;
            }
            
            const cashIdx = cash.findIndex(f => 
              f.row === newGridPos.row && f.col === newGridPos.col
            );
            if (cashIdx !== -1) {
              setCash(prev => prev.filter((_, i) => i !== cashIdx));
              newAI.score += CASH_POINTS;
              
              newAI.isGrabbing = true;
              setTimeout(() => {
                setAiPlayer(p => ({ ...p, isGrabbing: false }));
              }, 200);
            }
            
            const powerUpIdx = powerUps.findIndex(p =>
              p.row === newGridPos.row && p.col === newGridPos.col
            );
            if (powerUpIdx !== -1) {
              setPowerUps(prev => prev.filter((_, i) => i !== powerUpIdx));
              newAI.powerUpActive = true;
              newAI.powerUpExpiry = Date.now() + 10000;
              newAI.score += POWER_UP_POINTS;
              
              newAI.isGrabbing = true;
              setTimeout(() => {
                setAiPlayer(p => ({ ...p, isGrabbing: false }));
              }, 200);
            }
          }
          
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
            const dist1 = Math.abs(enemy.gridPos.row - player.gridPos.row) + 
                         Math.abs(enemy.gridPos.col - player.gridPos.col);
            const dist2 = Math.abs(enemy.gridPos.row - aiPlayer.gridPos.row) + 
                         Math.abs(enemy.gridPos.col - aiPlayer.gridPos.col);
            
            const nearestIsPlayer = dist1 < dist2;
            const nearestDist = Math.min(dist1, dist2);
            const targetPlayer = nearestIsPlayer ? player.gridPos : aiPlayer.gridPos;
            
            if (nearestDist <= 2 && !enemy.isLocked) {
              enemy.isLocked = true;
              enemy.lockedTarget = nearestIsPlayer ? 'player' : 'ai';
              enemy.lockMoveCount = 0;
            }
            
            if (enemy.isLocked) {
              const lockedTarget = enemy.lockedTarget === 'player' ? player.gridPos : aiPlayer.gridPos;
              
              const lockedDist = Math.abs(enemy.gridPos.row - lockedTarget.row) + 
                                Math.abs(enemy.gridPos.col - lockedTarget.col);
              
              if (lockedDist > 2) {
                enemy.lockMoveCount++;
                
                if (enemy.lockMoveCount >= 7) {
                  enemy.isLocked = false;
                  enemy.lockedTarget = null;
                  enemy.lockMoveCount = 0;
                }
              } else {
                enemy.lockMoveCount = 0;
              }
              
              const dirs: Direction[] = ['up', 'down', 'left', 'right'];
              const validDirs = dirs.filter(d => canMove(maze, enemy.gridPos, d));
              
              if (validDirs.length === 0) return enemy;
              
              let bestDir = validDirs[0];
              let bestDist = Infinity;
              
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
                
                const distToTarget = Math.abs(newPos.row - lockedTarget.row) +
                                    Math.abs(newPos.col - lockedTarget.col);
                
                if (distToTarget < bestDist) {
                  bestDist = distToTarget;
                  bestDir = dir;
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
            } else {
              const dirs: Direction[] = ['up', 'down', 'left', 'right'];
              const validDirs = dirs.filter(d => canMove(maze, enemy.gridPos, d));
              
              if (validDirs.length === 0) return enemy;
              
              let bestDir = validDirs[0];
              let bestDist = Infinity;
              
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
                
                const distToTarget = Math.abs(newPos.row - targetPlayer.row) +
                                    Math.abs(newPos.col - targetPlayer.col);
                
                if (distToTarget < bestDist) {
                  bestDist = distToTarget;
                  bestDir = dir;
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
            }
          }));
        }
        
        setPlayer(prev => {
          const newPlayer = { ...prev };
          for (const enemy of enemies) {
            if (enemy.gridPos.row === newPlayer.gridPos.row &&
                enemy.gridPos.col === newPlayer.gridPos.col) {
              if (!newPlayer.powerUpActive) {
                setGameStatus('gameover');
                return newPlayer;
              } else {
                newPlayer.score += 500;
                setLevelScore(s => s + 500);
              }
            }
          }
          return newPlayer;
        });
        
        setAiPlayer(prev => {
          const newAI = { ...prev };
          for (const enemy of enemies) {
            if (enemy.gridPos.row === newAI.gridPos.row &&
                enemy.gridPos.col === newAI.gridPos.col) {
              if (!newAI.powerUpActive) {
                setGameStatus('gameover');
                return newAI;
              } else {
                newAI.score += 500;
              }
            }
          }
          return newAI;
        });
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
    setEnemies([
      { id: '1', gridPos: { row: 9, col: 9 }, dir: 'left', color: '#ef4444', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '2', gridPos: { row: 9, col: 11 }, dir: 'right', color: '#ec4899', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '3', gridPos: { row: 8, col: 10 }, dir: 'up', color: '#06b6d4', isLocked: false, lockedTarget: null, lockMoveCount: 0 },
      { id: '4', gridPos: { row: 10, col: 10 }, dir: 'down', color: '#f97316', isLocked: false, lockedTarget: null, lockMoveCount: 0 }
    ]);
    
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
                    <circle r="13" fill="#10b981" opacity="0.4">
                      <animate attributeName="r" values="13;17;13" dur="0.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.6;0.4" dur="0.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#fbbf24" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {playerName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {player.isGrabbing ? '✊' : '✋'}
                  </text>
                </g>
                
                <g transform={`translate(${aiPlayer.pixelPos.x}, ${aiPlayer.pixelPos.y})`}>
                  {aiPlayer.powerUpActive && (
                    <circle r="13" fill="#10b981" opacity="0.4">
                      <animate attributeName="r" values="13;17;13" dur="0.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.4;0.6;0.4" dur="0.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  <text textAnchor="middle" y="-18" fontSize="10" fill="#3b82f6" fontWeight="bold" stroke="#000" strokeWidth="0.5">
                    {companionName}
                  </text>
                  <text textAnchor="middle" y="8" fontSize="22">
                    {aiPlayer.isGrabbing ? '👊' : '👋'}
                  </text>
                </g>
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
                <p className="mt-3"><strong>🎯 Mission:</strong> Team up to collect money!</p>
                <p><strong>✋ {playerName}:</strong> You control (yellow)</p>
                <p><strong>👋 {companionName}:</strong> Your companion (blue)</p>
                <p className="text-xs italic">Starts one tile below you</p>
                <p className="mt-2"><strong>💵 Cash:</strong> $100 per bill</p>
                <p><strong>💰 Power-up:</strong> $500 + invincibility</p>
                <p><strong>🔨 Hammers:</strong> Lock on within 2 tiles!</p>
                <p className="text-xs text-red-600 font-semibold mt-3">⚠️ Evade 7 moves to escape lock!</p>
                <p className="text-xs text-blue-600 mt-2">💡 Reach the exit 🚪 together!</p>
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