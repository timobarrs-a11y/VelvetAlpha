import { motion } from 'framer-motion';
import type { GameState, Position } from '../types/pacman';
import { Ghost, Cherry, Zap, Heart } from 'lucide-react';

interface PacmanBoardProps {
  gameState: GameState;
}

export function PacmanBoard({ gameState }: PacmanBoardProps) {
  const { maze, player1, player2, enemies, fruits, powerUps } = gameState;

  const getCellContent = (row: number, col: number) => {
    if (player1.position.row === row && player1.position.col === col) {
      return (
        <motion.div
          key="player1"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-full h-full rounded-full ${
            player1.powerUpActive
              ? 'bg-gradient-to-br from-yellow-300 via-yellow-400 to-orange-400 shadow-lg shadow-yellow-400'
              : 'bg-gradient-to-br from-yellow-400 to-yellow-600'
          } flex items-center justify-center text-2xl font-bold`}
        >
          1
        </motion.div>
      );
    }

    if (player2 && player2.position.row === row && player2.position.col === col) {
      return (
        <motion.div
          key="player2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={`w-full h-full rounded-full ${
            player2.powerUpActive
              ? 'bg-gradient-to-br from-blue-300 via-blue-400 to-cyan-400 shadow-lg shadow-blue-400'
              : 'bg-gradient-to-br from-blue-400 to-blue-600'
          } flex items-center justify-center text-2xl font-bold text-white`}
        >
          2
        </motion.div>
      );
    }

    const enemy = enemies.find(e => e.position.row === row && e.position.col === col);
    if (enemy) {
      const enemyColors = {
        blinky: 'from-red-500 to-red-700',
        pinky: 'from-pink-500 to-pink-700',
        inky: 'from-cyan-500 to-cyan-700',
        clyde: 'from-orange-500 to-orange-700'
      };

      return (
        <motion.div
          key={enemy.id}
          animate={{
            x: [0, -2, 2, -2, 2, 0],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: 'loop'
          }}
          className={`w-full h-full bg-gradient-to-br ${enemyColors[enemy.type]} rounded-t-full flex items-center justify-center`}
        >
          <Ghost className="w-4 h-4 text-white" />
        </motion.div>
      );
    }

    const hasFruit = fruits.some(f => f.row === row && f.col === col);
    if (hasFruit) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-full h-full flex items-center justify-center"
        >
          <Cherry className="w-3 h-3 text-red-500" />
        </motion.div>
      );
    }

    const hasPowerUp = powerUps.some(p => p.row === row && p.col === col);
    if (hasPowerUp) {
      return (
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-full h-full flex items-center justify-center"
        >
          <Zap className="w-4 h-4 text-yellow-400" fill="currentColor" />
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="relative">
      <div
        className="grid gap-0 bg-gray-900 p-2 rounded-lg shadow-2xl"
        style={{
          gridTemplateColumns: `repeat(${maze[0].length}, minmax(0, 1fr))`,
          aspectRatio: `${maze[0].length} / ${maze.length}`
        }}
      >
        {maze.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                aspect-square flex items-center justify-center relative
                ${cell === 'wall'
                  ? 'bg-blue-600 border border-blue-500'
                  : 'bg-gray-800'
                }
              `}
              style={{
                width: '100%',
                height: '100%'
              }}
            >
              {getCellContent(rowIndex, colIndex)}
            </div>
          ))
        )}
      </div>

      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-xs font-bold">
            1
          </div>
          <div>
            <div className="text-xs text-gray-400">Score</div>
            <div className="text-lg font-bold">{player1.score}</div>
          </div>
          <div className="flex gap-1 ml-2">
            {Array.from({ length: player1.lives }).map((_, i) => (
              <Heart key={i} className="w-4 h-4 text-red-500" fill="currentColor" />
            ))}
          </div>
        </div>
      </div>

      {player2 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div>
              <div className="text-xs text-gray-400">Score</div>
              <div className="text-lg font-bold">{player2.score}</div>
            </div>
            <div className="flex gap-1 ml-2">
              {Array.from({ length: player2.lives }).map((_, i) => (
                <Heart key={i} className="w-4 h-4 text-blue-500" fill="currentColor" />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-6 py-3 rounded-lg">
        <div className="text-center">
          <div className="text-xs text-gray-400">Time Remaining</div>
          <div className="text-2xl font-bold">{Math.floor(gameState.timeRemaining / 60)}:{String(gameState.timeRemaining % 60).padStart(2, '0')}</div>
        </div>
      </div>
    </div>
  );
}
