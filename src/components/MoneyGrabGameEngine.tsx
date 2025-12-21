import { useState, useEffect, useCallback } from 'react';

const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 19;
const TILE_SIZE = 30;
const MOVE_SPEED = 3;

type Position = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right' | null;
type GameStatus = 'playing' | 'paused' | 'gameover' | 'level-transition';

interface MoneyGrabGameEngineProps {
  playerName: string;
  companionName: string;
  onGameComplete?: (finalScore: number, level: number) => void;
}

interface Player {
  pos: Position;
  pixelPos: Position;
  dir: Direction;
  nextDir: Direction;
  score: number;
  isGrabbing: boolean;
}

interface Enemy {
  pos: Position;
  pixelPos: Position;
  dir: Direction;
  isLocked: boolean;
  lockedTarget: 'player' | 'ai' | null;
  escapeCounter: number;
}

interface PowerUp {
  pos: Position;
  active: boolean;
}

const MAZE_TEMPLATES = [
  [
    '#####################',
    '#...................#',
    '#.###.#######.###.#.#',
    '#...#.........#...#.#',
    '#.#.#.###.###.#.###.#',
    '#.#...#.....#...#...#',
    '#.#####.###.#####.###',
    '#.......#.#.......#.#',
    '#.#####.#.#.#####.#.#',
    '#.#...#...#.#...#...#',
    '#.#.#.#####.#.#.###.#',
    '#...#.......#.#.....#',
    '#####.#####.#.#######',
    '#.....#...#.#.......#',
    '#.#####.#.#.#######.#',
    '#.#.....#...#.......#',
    '#.#.#######.#.#####.#',
    '#...........#.......#',
    '#####################'
  ],
  [
    '#####################',
    '#...................#',
    '#.#####.###.#####.#.#',
    '#.....#.#.#.#.....#.#',
    '#####.#.#.#.#.#####.#',
    '#...#...#...#...#...#',
    '#.#.#########.#.#.###',
    '#.#...........#.#...#',
    '#.###########.#.###.#',
    '#.............#.....#',
    '#.#########.#######.#',
    '#.#.......#.#.......#',
    '#.#.#####.#.#.#####.#',
    '#...#...#...#.#...#.#',
    '#####.#.#####.#.#.#.#',
    '#.....#.......#.#...#',
    '#.###########.#.###.#',
    '#.............#.....#',
    '#####################'
  ],
  [
    '#####################',
    '#...................#',
    '#.###.#.#####.#.###.#',
    '#.#...#.......#...#.#',
    '#.#.###.#####.###.#.#',
    '#.#.#.........#.#.#.#',
    '#.#.#.#######.#.#.#.#',
    '#...#.#.....#.#...#.#',
    '###.#.#.###.#.#.###.#',
    '#...#...#.#...#.....#',
    '#.#######.#######.###',
    '#.#.............#...#',
    '#.#.###########.###.#',
    '#...#.........#.....#',
    '#####.#######.#####.#',
    '#.....#.....#.......#',
    '#.#####.###.#######.#',
    '#.......#...........#',
    '#####################'
  ],
  [
    '#####################',
    '#...................#',
    '#.#######.#.#######.#',
    '#.......#.#.#.......#',
    '#######.#.#.#.#######',
    '#.......#.#.#.......#',
    '#.#######.#.#######.#',
    '#.#.......#.......#.#',
    '#.#.#############.#.#',
    '#...#...........#...#',
    '#.###.#########.###.#',
    '#.#...#.......#...#.#',
    '#.#.###.#####.###.#.#',
    '#.#.#...#...#...#.#.#',
    '#.#.#.###.#.###.#.#.#',
    '#...#.....#.....#...#',
    '#.#####.#####.#####.#',
    '#.......#.#.........#',
    '#####################'
  ]
];

const EXIT_SIDES = ['right', 'up', 'down', 'left'] as const;

export function MoneyGrabGameEngine({
  playerName,
  companionName,
  onGameComplete
}: MoneyGrabGameEngineProps) {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [maze, setMaze] = useState<string[]>([]);
  const [cash, setCash] = useState<Set<string>>(new Set());
  const [powerUps, setPowerUps] = useState<PowerUp[]>([]);
  const [exitPos, setExitPos] = useState<Position>({ x: 0, y: 0 });
  const [player, setPlayer] = useState<Player>({
    pos: { x: 1, y: 1 },
    pixelPos: { x: 30, y: 30 },
    dir: null,
    nextDir: null,
    score: 0,
    isGrabbing: false
  });
  const [aiPlayer, setAiPlayer] = useState<Player>({
    pos: { x: 19, y: 1 },
    pixelPos: { x: 570, y: 30 },
    dir: null,
    nextDir: null,
    score: 0,
    isGrabbing: false
  });
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [invincible, setInvincible] = useState(false);
  const [invincibleTimer, setInvincibleTimer] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const generateMaze = useCallback((level: number) => {
    const templateIndex = (level - 1) % MAZE_TEMPLATES.length;
    const template = MAZE_TEMPLATES[templateIndex];

    const exitSide = EXIT_SIDES[(level - 1) % EXIT_SIDES.length];
    let exitPosition: Position;

    switch (exitSide) {
      case 'right':
        exitPosition = { x: MAZE_WIDTH - 2, y: Math.floor(MAZE_HEIGHT / 2) };
        break;
      case 'up':
        exitPosition = { x: Math.floor(MAZE_WIDTH / 2), y: 1 };
        break;
      case 'down':
        exitPosition = { x: Math.floor(MAZE_WIDTH / 2), y: MAZE_HEIGHT - 2 };
        break;
      case 'left':
        exitPosition = { x: 1, y: Math.floor(MAZE_HEIGHT / 2) };
        break;
    }

    const modifiedMaze = template.map((row, y) =>
      row.split('').map((cell, x) => {
        if (x === exitPosition.x && y === exitPosition.y) return 'E';
        return cell;
      }).join('')
    );

    setMaze(modifiedMaze);
    setExitPos(exitPosition);

    const cashSet = new Set<string>();
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        if (modifiedMaze[y][x] === '.') {
          if (!((x === 1 && y === 1) || (x === 19 && y === 1))) {
            cashSet.add(`${x},${y}`);
          }
        }
      }
    }
    setCash(cashSet);

    const corners: PowerUp[] = [
      { pos: { x: 1, y: 1 }, active: true },
      { pos: { x: MAZE_WIDTH - 2, y: 1 }, active: true },
      { pos: { x: 1, y: MAZE_HEIGHT - 2 }, active: true },
      { pos: { x: MAZE_WIDTH - 2, y: MAZE_HEIGHT - 2 }, active: true }
    ];
    setPowerUps(corners);

    const numEnemies = Math.min(2 + Math.floor(level / 2), 6);
    const newEnemies: Enemy[] = [];
    for (let i = 0; i < numEnemies; i++) {
      const enemyPos = { x: 10, y: 9 + i };
      newEnemies.push({
        pos: enemyPos,
        pixelPos: { x: enemyPos.x * TILE_SIZE, y: enemyPos.y * TILE_SIZE },
        dir: null,
        isLocked: false,
        lockedTarget: null,
        escapeCounter: 0
      });
    }
    setEnemies(newEnemies);
  }, []);

  useEffect(() => {
    generateMaze(currentLevel);
    setPlayer({
      pos: { x: 1, y: 1 },
      pixelPos: { x: 30, y: 30 },
      dir: null,
      nextDir: null,
      score: 0,
      isGrabbing: false
    });
    setAiPlayer({
      pos: { x: 19, y: 1 },
      pixelPos: { x: 570, y: 30 },
      dir: null,
      nextDir: null,
      score: 0,
      isGrabbing: false
    });
    setInvincible(false);
    setInvincibleTimer(0);
  }, [currentLevel, generateMaze]);

  const canMove = useCallback((pos: Position, dir: Direction, mazeData: string[]): boolean => {
    if (!dir) return false;
    const { x, y } = pos;
    let newX = x, newY = y;

    switch (dir) {
      case 'up': newY--; break;
      case 'down': newY++; break;
      case 'left': newX--; break;
      case 'right': newX++; break;
    }

    if (newY < 0 || newY >= MAZE_HEIGHT || newX < 0 || newX >= MAZE_WIDTH) return false;
    return mazeData[newY][newX] !== '#';
  }, []);

  const getDistance = useCallback((pos1: Position, pos2: Position): number => {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
  }, []);

  const findPath = useCallback((start: Position, target: Position, mazeData: string[]): Direction | null => {
    const directions: Direction[] = ['up', 'down', 'left', 'right'];
    let bestDir: Direction | null = null;
    let bestDist = Infinity;

    for (const dir of directions) {
      if (!canMove(start, dir, mazeData)) continue;

      let newPos = { ...start };
      switch (dir) {
        case 'up': newPos.y--; break;
        case 'down': newPos.y++; break;
        case 'left': newPos.x--; break;
        case 'right': newPos.x++; break;
      }

      const dist = getDistance(newPos, target);
      if (dist < bestDist) {
        bestDist = dist;
        bestDir = dir;
      }
    }

    return bestDir;
  }, [canMove, getDistance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStatus !== 'playing') return;

      const keyMap: Record<string, Direction> = {
        'ArrowUp': 'up',
        'ArrowDown': 'down',
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'w': 'up',
        's': 'down',
        'a': 'left',
        'd': 'right'
      };

      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        setPlayer(prev => ({ ...prev, nextDir: dir }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus !== 'playing' || maze.length === 0) return;

    const gameLoop = setInterval(() => {
      setPlayer(prev => {
        const centerX = prev.pixelPos.x + TILE_SIZE / 2;
        const centerY = prev.pixelPos.y + TILE_SIZE / 2;
        const gridX = Math.round(centerX / TILE_SIZE);
        const gridY = Math.round(centerY / TILE_SIZE);
        const isAligned =
          Math.abs(prev.pixelPos.x - gridX * TILE_SIZE) < MOVE_SPEED &&
          Math.abs(prev.pixelPos.y - gridY * TILE_SIZE) < MOVE_SPEED;

        let newDir = prev.dir;
        if (isAligned && prev.nextDir && canMove({ x: gridX, y: gridY }, prev.nextDir, maze)) {
          newDir = prev.nextDir;
        }

        if (!newDir || !canMove({ x: gridX, y: gridY }, newDir, maze)) {
          return { ...prev, dir: null, pos: { x: gridX, y: gridY }, pixelPos: { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE } };
        }

        let newPixelPos = { ...prev.pixelPos };
        switch (newDir) {
          case 'up': newPixelPos.y -= MOVE_SPEED; break;
          case 'down': newPixelPos.y += MOVE_SPEED; break;
          case 'left': newPixelPos.x -= MOVE_SPEED; break;
          case 'right': newPixelPos.x += MOVE_SPEED; break;
        }

        const newCenterX = newPixelPos.x + TILE_SIZE / 2;
        const newCenterY = newPixelPos.y + TILE_SIZE / 2;
        const newGridX = Math.round(newCenterX / TILE_SIZE);
        const newGridY = Math.round(newCenterY / TILE_SIZE);

        return {
          ...prev,
          pixelPos: newPixelPos,
          pos: { x: newGridX, y: newGridY },
          dir: newDir
        };
      });

      setAiPlayer(prev => {
        const centerX = prev.pixelPos.x + TILE_SIZE / 2;
        const centerY = prev.pixelPos.y + TILE_SIZE / 2;
        const gridX = Math.round(centerX / TILE_SIZE);
        const gridY = Math.round(centerY / TILE_SIZE);
        const isAligned =
          Math.abs(prev.pixelPos.x - gridX * TILE_SIZE) < MOVE_SPEED &&
          Math.abs(prev.pixelPos.y - gridY * TILE_SIZE) < MOVE_SPEED;

        let newDir = prev.dir;
        if (isAligned) {
          const cashArray = Array.from(cash).map(key => {
            const [x, y] = key.split(',').map(Number);
            return { x, y };
          });

          if (cashArray.length > 0) {
            cashArray.sort((a, b) =>
              getDistance({ x: gridX, y: gridY }, a) - getDistance({ x: gridX, y: gridY }, b)
            );
            newDir = findPath({ x: gridX, y: gridY }, cashArray[0], maze);
          }
        }

        if (!newDir || !canMove({ x: gridX, y: gridY }, newDir, maze)) {
          return { ...prev, dir: null, pos: { x: gridX, y: gridY }, pixelPos: { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE } };
        }

        let newPixelPos = { ...prev.pixelPos };
        switch (newDir) {
          case 'up': newPixelPos.y -= MOVE_SPEED; break;
          case 'down': newPixelPos.y += MOVE_SPEED; break;
          case 'left': newPixelPos.x -= MOVE_SPEED; break;
          case 'right': newPixelPos.x += MOVE_SPEED; break;
        }

        const newCenterX = newPixelPos.x + TILE_SIZE / 2;
        const newCenterY = newPixelPos.y + TILE_SIZE / 2;
        const newGridX = Math.round(newCenterX / TILE_SIZE);
        const newGridY = Math.round(newCenterY / TILE_SIZE);

        return {
          ...prev,
          pixelPos: newPixelPos,
          pos: { x: newGridX, y: newGridY },
          dir: newDir
        };
      });
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameStatus, maze, cash, canMove, findPath, getDistance]);

  useEffect(() => {
    if (gameStatus !== 'playing' || maze.length === 0) return;

    const enemySpeed = Math.max(80, 200 - (currentLevel - 1) * 20);

    const enemyLoop = setInterval(() => {
      setEnemies(prev => prev.map(enemy => {
        const distToPlayer = getDistance(enemy.pos, player.pos);
        const distToAi = getDistance(enemy.pos, aiPlayer.pos);

        let target = distToPlayer < distToAi ? player.pos : aiPlayer.pos;
        let targetType: 'player' | 'ai' = distToPlayer < distToAi ? 'player' : 'ai';

        let newEnemy = { ...enemy };

        if (!enemy.isLocked && Math.min(distToPlayer, distToAi) <= 2) {
          newEnemy.isLocked = true;
          newEnemy.lockedTarget = targetType;
          newEnemy.escapeCounter = 0;
        }

        if (enemy.isLocked) {
          target = enemy.lockedTarget === 'player' ? player.pos : aiPlayer.pos;
          const currentDist = getDistance(enemy.pos, target);

          if (currentDist > 2) {
            newEnemy.escapeCounter++;
            if (newEnemy.escapeCounter >= 7) {
              newEnemy.isLocked = false;
              newEnemy.lockedTarget = null;
              newEnemy.escapeCounter = 0;
            }
          } else {
            newEnemy.escapeCounter = 0;
          }
        }

        const newDir = findPath(enemy.pos, target, maze);
        if (!newDir) return enemy;

        let newPos = { ...enemy.pos };
        switch (newDir) {
          case 'up': newPos.y--; break;
          case 'down': newPos.y++; break;
          case 'left': newPos.x--; break;
          case 'right': newPos.x++; break;
        }

        return {
          ...newEnemy,
          pos: newPos,
          pixelPos: { x: newPos.x * TILE_SIZE, y: newPos.y * TILE_SIZE },
          dir: newDir
        };
      }));
    }, enemySpeed);

    return () => clearInterval(enemyLoop);
  }, [gameStatus, maze, player.pos, aiPlayer.pos, currentLevel, findPath, getDistance]);

  useEffect(() => {
    if (gameStatus !== 'playing') return;

    const checkCollisions = () => {
      setCash(prev => {
        const newCash = new Set(prev);
        const playerKey = `${player.pos.x},${player.pos.y}`;
        if (newCash.has(playerKey)) {
          newCash.delete(playerKey);
          setPlayer(p => ({ ...p, score: p.score + 100, isGrabbing: true }));
          setTimeout(() => setPlayer(p => ({ ...p, isGrabbing: false })), 200);
        }

        const aiKey = `${aiPlayer.pos.x},${aiPlayer.pos.y}`;
        if (newCash.has(aiKey)) {
          newCash.delete(aiKey);
          setAiPlayer(p => ({ ...p, score: p.score + 100, isGrabbing: true }));
          setTimeout(() => setAiPlayer(p => ({ ...p, isGrabbing: false })), 200);
        }

        return newCash;
      });

      setPowerUps(prev => prev.map(pu => {
        if (pu.active &&
            ((pu.pos.x === player.pos.x && pu.pos.y === player.pos.y) ||
             (pu.pos.x === aiPlayer.pos.x && pu.pos.y === aiPlayer.pos.y))) {
          setInvincible(true);
          setInvincibleTimer(10);
          const scorer = pu.pos.x === player.pos.x && pu.pos.y === player.pos.y ? 'player' : 'ai';
          if (scorer === 'player') {
            setPlayer(p => ({ ...p, score: p.score + 500, isGrabbing: true }));
            setTimeout(() => setPlayer(p => ({ ...p, isGrabbing: false })), 200);
          } else {
            setAiPlayer(p => ({ ...p, score: p.score + 500, isGrabbing: true }));
            setTimeout(() => setAiPlayer(p => ({ ...p, isGrabbing: false })), 200);
          }
          return { ...pu, active: false };
        }
        return pu;
      }));

      if (player.pos.x === exitPos.x && player.pos.y === exitPos.y &&
          aiPlayer.pos.x === exitPos.x && aiPlayer.pos.y === exitPos.y &&
          cash.size === 0) {
        setTotalScore(prev => prev + player.score + aiPlayer.score);
        setGameStatus('level-transition');
        setTimeout(() => {
          setCurrentLevel(prev => prev + 1);
          setGameStatus('playing');
        }, 2000);
      }

      if (!invincible) {
        for (const enemy of enemies) {
          if ((enemy.pos.x === player.pos.x && enemy.pos.y === player.pos.y) ||
              (enemy.pos.x === aiPlayer.pos.x && enemy.pos.y === aiPlayer.pos.y)) {
            setGameStatus('gameover');
            onGameComplete?.(totalScore + player.score + aiPlayer.score, currentLevel);
            return;
          }
        }
      }
    };

    const interval = setInterval(checkCollisions, 50);
    return () => clearInterval(interval);
  }, [gameStatus, player.pos, aiPlayer.pos, exitPos, cash, enemies, invincible, totalScore, currentLevel, onGameComplete]);

  useEffect(() => {
    if (!invincible || invincibleTimer <= 0) return;

    const timer = setInterval(() => {
      setInvincibleTimer(prev => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          setInvincible(false);
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [invincible, invincibleTimer]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center justify-between w-full max-w-4xl px-4">
        <div className="text-white">
          <div className="text-xl font-bold">✋ {playerName}</div>
          <div className="text-2xl font-mono">${player.score}</div>
        </div>
        <div className="text-center text-white">
          <div className="text-3xl font-bold">Level {currentLevel}</div>
          <div className="text-lg">Cash Left: {cash.size}</div>
          {invincible && <div className="text-yellow-400 font-bold">⚡ INVINCIBLE: {invincibleTimer}s</div>}
        </div>
        <div className="text-white text-right">
          <div className="text-xl font-bold">👋 {companionName}</div>
          <div className="text-2xl font-mono">${aiPlayer.score}</div>
        </div>
      </div>

      <svg
        width={MAZE_WIDTH * TILE_SIZE}
        height={MAZE_HEIGHT * TILE_SIZE}
        className="border-4 border-white shadow-2xl"
        style={{ backgroundColor: '#1a1a2e' }}
      >
        {maze.map((row, y) =>
          row.split('').map((cell, x) => {
            if (cell === '#') {
              return (
                <rect
                  key={`wall-${x}-${y}`}
                  x={x * TILE_SIZE}
                  y={y * TILE_SIZE}
                  width={TILE_SIZE}
                  height={TILE_SIZE}
                  fill="#4a5568"
                  stroke="#2d3748"
                  strokeWidth="1"
                />
              );
            }
            if (cell === 'E') {
              return (
                <g key={`exit-${x}-${y}`}>
                  <rect
                    x={x * TILE_SIZE}
                    y={y * TILE_SIZE}
                    width={TILE_SIZE}
                    height={TILE_SIZE}
                    fill="#10b981"
                    opacity="0.3"
                  />
                  <text
                    x={x * TILE_SIZE + TILE_SIZE / 2}
                    y={y * TILE_SIZE + TILE_SIZE / 2 + 6}
                    textAnchor="middle"
                    fontSize="20"
                  >
                    🚪
                  </text>
                </g>
              );
            }
            return null;
          })
        )}

        {Array.from(cash).map(key => {
          const [x, y] = key.split(',').map(Number);
          return (
            <text
              key={`cash-${key}`}
              x={x * TILE_SIZE + TILE_SIZE / 2}
              y={y * TILE_SIZE + TILE_SIZE / 2 + 4}
              textAnchor="middle"
              fontSize="12"
              fill="#10b981"
            >
              💵
            </text>
          );
        })}

        {powerUps.map((pu, i) =>
          pu.active && (
            <g key={`powerup-${i}`}>
              <circle
                cx={pu.pos.x * TILE_SIZE + TILE_SIZE / 2}
                cy={pu.pos.y * TILE_SIZE + TILE_SIZE / 2}
                r="12"
                fill="#fbbf24"
                opacity="0.3"
              >
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1s" repeatCount="indefinite" />
              </circle>
              <text
                x={pu.pos.x * TILE_SIZE + TILE_SIZE / 2}
                y={pu.pos.y * TILE_SIZE + TILE_SIZE / 2 + 6}
                textAnchor="middle"
                fontSize="18"
              >
                ⚡
              </text>
            </g>
          )
        )}

        {enemies.map((enemy, i) => (
          <g key={`enemy-${i}`}>
            <circle
              cx={enemy.pixelPos.x + TILE_SIZE / 2}
              cy={enemy.pixelPos.y + TILE_SIZE / 2}
              r="14"
              fill={invincible ? '#60a5fa' : '#ef4444'}
              opacity="0.5"
            />
            <text
              x={enemy.pixelPos.x + TILE_SIZE / 2}
              y={enemy.pixelPos.y + TILE_SIZE / 2 + 6}
              textAnchor="middle"
              fontSize="18"
            >
              🔨
            </text>
            {enemy.isLocked && (
              <circle
                cx={enemy.pixelPos.x + TILE_SIZE / 2}
                cy={enemy.pixelPos.y + TILE_SIZE / 2}
                r="18"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
              >
                <animate attributeName="r" values="18;22;18" dur="0.5s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        ))}

        <g>
          <circle
            cx={player.pixelPos.x + TILE_SIZE / 2}
            cy={player.pixelPos.y + TILE_SIZE / 2}
            r="14"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="3"
          />
          <text
            x={player.pixelPos.x + TILE_SIZE / 2}
            y={player.pixelPos.y + TILE_SIZE / 2 + 6}
            textAnchor="middle"
            fontSize="18"
          >
            {player.isGrabbing ? '✊' : '✋'}
          </text>
        </g>

        <g>
          <circle
            cx={aiPlayer.pixelPos.x + TILE_SIZE / 2}
            cy={aiPlayer.pixelPos.y + TILE_SIZE / 2}
            r="14"
            fill="#60a5fa"
            stroke="#3b82f6"
            strokeWidth="3"
          />
          <text
            x={aiPlayer.pixelPos.x + TILE_SIZE / 2}
            y={aiPlayer.pixelPos.y + TILE_SIZE / 2 + 6}
            textAnchor="middle"
            fontSize="18"
          >
            {aiPlayer.isGrabbing ? '✊' : '👋'}
          </text>
        </g>
      </svg>

      <div className="text-white text-center">
        <div className="text-sm">Use Arrow Keys or WASD to move</div>
        <div className="text-xs text-gray-400">Collect all cash and reach the exit together!</div>
      </div>

      {gameStatus === 'level-transition' && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center animate-bounce">
            <div className="text-6xl mb-4">🎉</div>
            <div className="text-3xl font-bold mb-2">Level {currentLevel - 1} Complete!</div>
            <div className="text-xl text-gray-600">Get ready for Level {currentLevel}...</div>
          </div>
        </div>
      )}

      {gameStatus === 'gameover' && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-12 text-center max-w-md">
            <div className="text-6xl mb-4">💀</div>
            <div className="text-4xl font-bold mb-6">Game Over!</div>
            <div className="space-y-4 text-left mb-8">
              <div className="flex justify-between text-xl">
                <span>✋ {playerName}:</span>
                <span className="font-mono font-bold">${player.score}</span>
              </div>
              <div className="flex justify-between text-xl">
                <span>👋 {companionName}:</span>
                <span className="font-mono font-bold">${aiPlayer.score}</span>
              </div>
              <div className="flex justify-between text-xl border-t-2 pt-2">
                <span>Previous Levels:</span>
                <span className="font-mono font-bold">${totalScore}</span>
              </div>
              <div className="flex justify-between text-2xl border-t-4 pt-2 font-bold">
                <span>Total:</span>
                <span className="font-mono text-green-600">${totalScore + player.score + aiPlayer.score}</span>
              </div>
              <div className="text-center text-gray-600 text-lg pt-2">
                Made it to Level {currentLevel}
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentLevel(1);
                setTotalScore(0);
                setGameStatus('playing');
                generateMaze(1);
              }}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
