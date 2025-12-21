import type { GameState, Position, Player, Enemy, CellType } from '../types/pacman';

const MAZE_WIDTH = 19;
const MAZE_HEIGHT = 15;
const INITIAL_TIME = 180;
const FRUIT_POINTS = 10;
const POWER_UP_DURATION = 10000;
const ENEMY_POINTS = 50;

export function createInitialGameState(mode: 'solo' | 'vs-ai' = 'vs-ai'): GameState {
  const maze = generateMaze();
  const fruits = placeFruits(maze);
  const powerUps = placePowerUps(maze);

  return {
    maze,
    player1: {
      position: { row: MAZE_HEIGHT - 2, col: 1 },
      score: 0,
      lives: 3,
      powerUpActive: false,
      powerUpExpiry: 0
    },
    player2: mode === 'vs-ai' ? {
      position: { row: 1, col: MAZE_WIDTH - 2 },
      score: 0,
      lives: 3,
      powerUpActive: false,
      powerUpExpiry: 0
    } : null,
    enemies: createEnemies(),
    fruits,
    powerUps,
    timeRemaining: INITIAL_TIME,
    gameStatus: 'active',
    winner: null
  };
}

function generateMaze(): CellType[][] {
  const maze: CellType[][] = Array(MAZE_HEIGHT).fill(null).map(() =>
    Array(MAZE_WIDTH).fill('empty' as CellType)
  );

  for (let row = 0; row < MAZE_HEIGHT; row++) {
    for (let col = 0; col < MAZE_WIDTH; col++) {
      if (row === 0 || row === MAZE_HEIGHT - 1 || col === 0 || col === MAZE_WIDTH - 1) {
        maze[row][col] = 'wall';
      }
    }
  }

  const wallPatterns = [
    { r: 2, c: 2, w: 3, h: 3 },
    { r: 2, c: MAZE_WIDTH - 5, w: 3, h: 3 },
    { r: MAZE_HEIGHT - 5, c: 2, w: 3, h: 3 },
    { r: MAZE_HEIGHT - 5, c: MAZE_WIDTH - 5, w: 3, h: 3 },
    { r: Math.floor(MAZE_HEIGHT / 2) - 1, c: Math.floor(MAZE_WIDTH / 2) - 2, w: 5, h: 3 },
    { r: 2, c: Math.floor(MAZE_WIDTH / 2) - 1, w: 3, h: 5 },
    { r: MAZE_HEIGHT - 7, c: Math.floor(MAZE_WIDTH / 2) - 1, w: 3, h: 5 },
    { r: Math.floor(MAZE_HEIGHT / 2) - 1, c: 6, w: 2, h: 3 },
    { r: Math.floor(MAZE_HEIGHT / 2) - 1, c: MAZE_WIDTH - 8, w: 2, h: 3 }
  ];

  for (const pattern of wallPatterns) {
    for (let r = 0; r < pattern.h; r++) {
      for (let c = 0; c < pattern.w; c++) {
        const row = pattern.r + r;
        const col = pattern.c + c;
        if (row > 0 && row < MAZE_HEIGHT - 1 && col > 0 && col < MAZE_WIDTH - 1) {
          maze[row][col] = 'wall';
        }
      }
    }
  }

  return maze;
}

function placeFruits(maze: CellType[][]): Position[] {
  const fruits: Position[] = [];

  for (let row = 1; row < MAZE_HEIGHT - 1; row++) {
    for (let col = 1; col < MAZE_WIDTH - 1; col++) {
      if (maze[row][col] === 'empty' && Math.random() < 0.3) {
        fruits.push({ row, col });
      }
    }
  }

  return fruits;
}

function placePowerUps(maze: CellType[][]): Position[] {
  const powerUps: Position[] = [];
  const positions = [
    { row: 1, col: 1 },
    { row: 1, col: MAZE_WIDTH - 2 },
    { row: MAZE_HEIGHT - 2, col: 1 },
    { row: MAZE_HEIGHT - 2, col: MAZE_WIDTH - 2 }
  ];

  for (const pos of positions) {
    if (maze[pos.row][pos.col] === 'empty') {
      powerUps.push(pos);
    }
  }

  return powerUps;
}

function createEnemies(): Enemy[] {
  return [
    {
      id: 'blinky',
      position: { row: Math.floor(MAZE_HEIGHT / 2), col: Math.floor(MAZE_WIDTH / 2) - 1 },
      direction: 'left',
      type: 'blinky'
    },
    {
      id: 'pinky',
      position: { row: Math.floor(MAZE_HEIGHT / 2), col: Math.floor(MAZE_WIDTH / 2) + 1 },
      direction: 'right',
      type: 'pinky'
    },
    {
      id: 'inky',
      position: { row: Math.floor(MAZE_HEIGHT / 2) - 1, col: Math.floor(MAZE_WIDTH / 2) },
      direction: 'up',
      type: 'inky'
    },
    {
      id: 'clyde',
      position: { row: Math.floor(MAZE_HEIGHT / 2) + 1, col: Math.floor(MAZE_WIDTH / 2) },
      direction: 'down',
      type: 'clyde'
    }
  ];
}

export function canMove(maze: CellType[][], from: Position, direction: 'up' | 'down' | 'left' | 'right'): boolean {
  const to = getNextPosition(from, direction);

  if (to.row < 0 || to.row >= MAZE_HEIGHT || to.col < 0 || to.col >= MAZE_WIDTH) {
    return false;
  }

  return maze[to.row][to.col] !== 'wall';
}

export function getNextPosition(pos: Position, direction: 'up' | 'down' | 'left' | 'right'): Position {
  const deltas = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
  };

  const delta = deltas[direction];
  return {
    row: pos.row + delta.row,
    col: pos.col + delta.col
  };
}

export function movePlayer(
  state: GameState,
  playerNum: 1 | 2,
  direction: 'up' | 'down' | 'left' | 'right'
): GameState {
  const player = playerNum === 1 ? state.player1 : state.player2;
  if (!player) return state;

  if (!canMove(state.maze, player.position, direction)) {
    return state;
  }

  const newPosition = getNextPosition(player.position, direction);
  const newState = { ...state };

  const fruitIndex = newState.fruits.findIndex(
    f => f.row === newPosition.row && f.col === newPosition.col
  );
  if (fruitIndex !== -1) {
    newState.fruits = newState.fruits.filter((_, i) => i !== fruitIndex);
    player.score += FRUIT_POINTS;
  }

  const powerUpIndex = newState.powerUps.findIndex(
    p => p.row === newPosition.row && p.col === newPosition.col
  );
  if (powerUpIndex !== -1) {
    newState.powerUps = newState.powerUps.filter((_, i) => i !== powerUpIndex);
    player.powerUpActive = true;
    player.powerUpExpiry = Date.now() + POWER_UP_DURATION;
  }

  player.position = newPosition;

  return checkCollisions(newState, playerNum);
}

function checkCollisions(state: GameState, playerNum: 1 | 2): GameState {
  const player = playerNum === 1 ? state.player1 : state.player2;
  if (!player) return state;

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    if (enemy.position.row === player.position.row &&
        enemy.position.col === player.position.col) {

      if (player.powerUpActive) {
        player.score += ENEMY_POINTS;
        const centerPos = {
          row: Math.floor(MAZE_HEIGHT / 2),
          col: Math.floor(MAZE_WIDTH / 2)
        };
        enemy.position = centerPos;
      } else {
        player.lives -= 1;
        if (player.lives > 0) {
          player.position = playerNum === 1
            ? { row: MAZE_HEIGHT - 2, col: 1 }
            : { row: 1, col: MAZE_WIDTH - 2 };
        }
      }
    }
  }

  return state;
}

export function moveEnemies(state: GameState, difficulty: 'easy' | 'medium' | 'hard'): GameState {
  const newState = { ...state };
  const speed = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.6 : 1;

  if (Math.random() > speed) return state;

  for (const enemy of newState.enemies) {
    const possibleDirections: ('up' | 'down' | 'left' | 'right')[] = [];

    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      if (canMove(state.maze, enemy.position, dir)) {
        possibleDirections.push(dir);
      }
    }

    if (possibleDirections.length === 0) continue;

    let chosenDirection: 'up' | 'down' | 'left' | 'right';

    if (Math.random() < (difficulty === 'hard' ? 0.6 : difficulty === 'medium' ? 0.3 : 0.1)) {
      chosenDirection = chaseNearestPlayer(enemy.position, state, possibleDirections);
    } else {
      chosenDirection = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
    }

    enemy.direction = chosenDirection;
    enemy.position = getNextPosition(enemy.position, chosenDirection);
  }

  return checkAllCollisions(newState);
}

function chaseNearestPlayer(
  enemyPos: Position,
  state: GameState,
  validDirections: ('up' | 'down' | 'left' | 'right')[]
): 'up' | 'down' | 'left' | 'right' {
  let targetPos = state.player1.position;

  if (state.player2) {
    const dist1 = Math.abs(enemyPos.row - state.player1.position.row) +
                  Math.abs(enemyPos.col - state.player1.position.col);
    const dist2 = Math.abs(enemyPos.row - state.player2.position.row) +
                  Math.abs(enemyPos.col - state.player2.position.col);

    if (dist2 < dist1) {
      targetPos = state.player2.position;
    }
  }

  let bestDir = validDirections[0];
  let bestDist = Infinity;

  for (const dir of validDirections) {
    const nextPos = getNextPosition(enemyPos, dir);
    const dist = Math.abs(nextPos.row - targetPos.row) + Math.abs(nextPos.col - targetPos.col);

    if (dist < bestDist) {
      bestDist = dist;
      bestDir = dir;
    }
  }

  return bestDir;
}

function checkAllCollisions(state: GameState): GameState {
  let newState = { ...state };
  newState = checkCollisions(newState, 1);
  if (newState.player2) {
    newState = checkCollisions(newState, 2);
  }
  return newState;
}

export function updatePowerUps(state: GameState): GameState {
  const now = Date.now();
  const newState = { ...state };

  if (newState.player1.powerUpActive && now > newState.player1.powerUpExpiry) {
    newState.player1.powerUpActive = false;
  }

  if (newState.player2?.powerUpActive && now > newState.player2.powerUpExpiry) {
    newState.player2.powerUpActive = false;
  }

  return newState;
}

export function checkGameOver(state: GameState): GameState {
  const newState = { ...state };

  if (newState.player1.lives <= 0 && (!newState.player2 || newState.player2.lives <= 0)) {
    newState.gameStatus = 'finished';
    newState.winner = 'tie';
  } else if (newState.player1.lives <= 0) {
    newState.gameStatus = 'finished';
    newState.winner = 'player2';
  } else if (newState.player2 && newState.player2.lives <= 0) {
    newState.gameStatus = 'finished';
    newState.winner = 'player1';
  } else if (newState.timeRemaining <= 0 || newState.fruits.length === 0) {
    newState.gameStatus = 'finished';
    if (newState.player2) {
      newState.winner = newState.player1.score > newState.player2.score
        ? 'player1'
        : newState.player2.score > newState.player1.score
          ? 'player2'
          : 'tie';
    } else {
      newState.winner = 'player1';
    }
  }

  return newState;
}

export function getAIMove(state: GameState): 'up' | 'down' | 'left' | 'right' | null {
  if (!state.player2) return null;

  const targetFruit = findNearestFruit(state.player2.position, state.fruits);
  if (!targetFruit) {
    const directions: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];
    for (const dir of directions) {
      if (canMove(state.maze, state.player2.position, dir)) {
        return dir;
      }
    }
    return null;
  }

  const validMoves: ('up' | 'down' | 'left' | 'right')[] = [];
  for (const dir of ['up', 'down', 'left', 'right'] as const) {
    if (canMove(state.maze, state.player2.position, dir)) {
      validMoves.push(dir);
    }
  }

  if (validMoves.length === 0) return null;

  let bestDir = validMoves[0];
  let bestDist = Infinity;

  for (const dir of validMoves) {
    const nextPos = getNextPosition(state.player2.position, dir);
    const dist = Math.abs(nextPos.row - targetFruit.row) + Math.abs(nextPos.col - targetFruit.col);

    if (dist < bestDist) {
      bestDist = dist;
      bestDir = dir;
    }
  }

  return bestDir;
}

function findNearestFruit(pos: Position, fruits: Position[]): Position | null {
  if (fruits.length === 0) return null;

  let nearest = fruits[0];
  let minDist = Math.abs(pos.row - nearest.row) + Math.abs(pos.col - nearest.col);

  for (const fruit of fruits) {
    const dist = Math.abs(pos.row - fruit.row) + Math.abs(pos.col - fruit.col);
    if (dist < minDist) {
      minDist = dist;
      nearest = fruit;
    }
  }

  return nearest;
}
