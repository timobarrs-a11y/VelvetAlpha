import { motion } from 'framer-motion';
import type { GameState, Position } from '../types/pacman';
import { Hand, DollarSign, Hammer, Heart } from 'lucide-react';

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
          animate={{ scale: 1, rotate: player1.powerUpActive ? [0, -10, 10, -10, 10, 0] : 0 }}
          transition={{ rotate: { duration: 0.5, repeat: player1.powerUpActive ? Infinity : 0 } }}
          className="w-full h-full flex items-center justify-center"
        >
          <div className={`${player1.powerUpActive ? 'text-green-400' : 'text-yellow-300'}`}>
            <Hand className="w-6 h-6 drop-shadow-lg" fill="currentColor" strokeWidth={1} />
          </div>
        </motion.div>
      );
    }

    if (player2 && player2.position.row === row && player2.position.col === col) {
      return (
        <motion.div
          key="player2"
          initial={{ scale: 0 }}
          animate={{ scale: 1, rotate: player2.powerUpActive ? [0, -10, 10, -10, 10, 0] : 0 }}
          transition={{ rotate: { duration: 0.5, repeat: player2.powerUpActive ? Infinity : 0 } }}
          className="w-full h-full flex items-center justify-center"
        >
          <div className={`${player2.powerUpActive ? 'text-green-400' : 'text-blue-300'}`}>
            <Hand className="w-6 h-6 drop-shadow-lg" fill="currentColor" strokeWidth={1} />
          </div>
        </motion.div>
      );
    }

    const enemy = enemies.find(e => e.position.row === row && e.position.col === col);
    if (enemy) {
      const enemyColors = {
        blinky: 'text-red-600',
        pinky: 'text-pink-600',
        inky: 'text-cyan-600',
        clyde: 'text-orange-600'
      };

      return (
        <motion.div
          key={enemy.id}
          animate={{
            rotate: [0, -15, 15, -15, 15, 0],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: 'loop'
          }}
          className="w-full h-full flex items-center justify-center"
        >
          <Hammer className={`w-6 h-6 drop-shadow-lg ${enemyColors[enemy.type]}`} strokeWidth={2.5} />
        </motion.div>
      );
    }

    const hasFruit = fruits.some(f => f.row === row && f.col === col);
    if (hasFruit) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-full h-full flex items-center justify-center"
        >
          <DollarSign className="w-5 h-5 text-green-500 font-bold drop-shadow-md" strokeWidth={3} />
        </motion.div>
      );
    }

    const hasPowerUp = powerUps.some(p => p.row === row && p.col === col);
    if (hasPowerUp) {
      return (
        <motion.div
          animate={{ rotate: 360, scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-full h-full flex items-center justify-center"
        >
          <div className="text-2xl font-bold text-yellow-400 drop-shadow-lg">💰</div>
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

      <div className="absolute top-4 left-4 bg-black bg-opacity-90 text-white px-4 py-2 rounded-lg shadow-xl border-2 border-yellow-400">
        <div className="flex items-center gap-2">
          <Hand className="w-6 h-6 text-yellow-300" fill="currentColor" />
          <div>
            <div className="text-xs text-gray-400">Your Cash</div>
            <div className="text-lg font-bold text-green-400">${player1.score}</div>
          </div>
          <div className="flex gap-1 ml-2">
            {Array.from({ length: player1.lives }).map((_, i) => (
              <Heart key={i} className="w-4 h-4 text-red-500" fill="currentColor" />
            ))}
          </div>
        </div>
      </div>

      {player2 && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-90 text-white px-4 py-2 rounded-lg shadow-xl border-2 border-blue-400">
          <div className="flex items-center gap-2">
            <Hand className="w-6 h-6 text-blue-300" fill="currentColor" />
            <div>
              <div className="text-xs text-gray-400">AI Cash</div>
              <div className="text-lg font-bold text-green-400">${player2.score}</div>
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
