import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { BoardState, Position, Move, PieceType } from '../types/checkers';
import { Crown } from 'lucide-react';
import type { PieceAnimation } from '../services/checkersAnimationEngine';

interface CheckersBoardProps {
  board: BoardState;
  validMoves: Move[];
  selectedPosition: Position | null;
  onSquareClick: (row: number, col: number) => void;
  playerColor: 'red' | 'black';
  isPlayerTurn: boolean;
  activeAnimations?: PieceAnimation[];
  onAnimationComplete?: (animation: PieceAnimation) => void;
}

export function CheckersBoard({
  board,
  validMoves,
  selectedPosition,
  onSquareClick,
  playerColor,
  isPlayerTurn,
  activeAnimations = [],
  onAnimationComplete
}: CheckersBoardProps) {
  const [animatingPieces, setAnimatingPieces] = useState<Set<string>>(new Set());

  useEffect(() => {
    activeAnimations.forEach(anim => {
      const key = `${anim.fromPos.row}-${anim.fromPos.col}`;
      setAnimatingPieces(prev => new Set(prev).add(key));

      const timer = setTimeout(() => {
        setAnimatingPieces(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
        onAnimationComplete?.(anim);
      }, anim.duration);

      return () => clearTimeout(timer);
    });
  }, [activeAnimations, onAnimationComplete]);

  const isValidMoveTarget = (row: number, col: number): boolean => {
    return validMoves.some(move => move.to.row === row && move.to.col === col);
  };

  const isSelected = (row: number, col: number): boolean => {
    return selectedPosition !== null &&
           selectedPosition.row === row &&
           selectedPosition.col === col;
  };

  const getPieceColor = (piece: PieceType): string => {
    if (!piece) return '';
    return piece.includes('red') ? 'red' : 'black';
  };

  const isKing = (piece: PieceType): boolean => {
    return piece?.includes('king') || false;
  };

  const isAnimatingPiece = (row: number, col: number): boolean => {
    return animatingPieces.has(`${row}-${col}`);
  };

  const displayBoard = playerColor === 'black' ? board : [...board].reverse();
  const getActualRow = (displayRow: number) =>
    playerColor === 'black' ? displayRow : 7 - displayRow;

  return (
    <div className="relative w-full" style={{ aspectRatio: '1' }}>
      <div className="absolute inset-0 grid grid-cols-8 gap-0 border-4 border-gray-800 rounded-lg overflow-hidden shadow-2xl">
        {displayBoard.map((row, displayRowIndex) => (
          row.map((piece, col) => {
            const actualRow = getActualRow(displayRowIndex);
            const isLight = (actualRow + col) % 2 === 0;
            const selected = isSelected(actualRow, col);
            const validTarget = isValidMoveTarget(actualRow, col);
            const pieceColor = getPieceColor(piece);
            const king = isKing(piece);

            return (
              <motion.div
                key={`${actualRow}-${col}`}
                onClick={() => onSquareClick(actualRow, col)}
                className={`
                  aspect-square flex items-center justify-center relative
                  ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                  ${!isLight && isPlayerTurn ? 'cursor-pointer hover:bg-amber-700' : ''}
                  ${selected ? 'ring-4 ring-yellow-400 ring-inset' : ''}
                  ${validTarget ? 'ring-4 ring-green-400 ring-inset' : ''}
                `}
                whileHover={!isLight && isPlayerTurn ? { scale: 1.02 } : {}}
              >
                {validTarget && (
                  <motion.div
                    className="absolute inset-0 bg-green-400 opacity-30"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  />
                )}

                {piece && !isAnimatingPiece(actualRow, col) && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`
                      w-[70%] h-[70%] rounded-full shadow-lg
                      flex items-center justify-center relative
                      ${pieceColor === 'red'
                        ? 'bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-900'
                        : 'bg-gradient-to-br from-gray-800 to-black border-4 border-gray-950'
                      }
                    `}
                  >
                    {king && (
                      <Crown
                        className={`w-1/2 h-1/2 ${
                          pieceColor === 'red' ? 'text-yellow-300' : 'text-yellow-400'
                        }`}
                        fill="currentColor"
                      />
                    )}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white opacity-20" />
                  </motion.div>
                )}
              </motion.div>
            );
          })
        ))}
      </div>

      <AnimatePresence>
        {activeAnimations.map((animation, idx) => {
          const startFrame = animation.frames[0];
          const endFrame = animation.frames[animation.frames.length - 1];

          return (
            <motion.div
              key={`anim-${idx}-${animation.fromPos.row}-${animation.fromPos.col}`}
              className="absolute pointer-events-none"
              style={{
                width: '12.5%',
                height: '12.5%',
                left: `${startFrame.gridCol * 12.5}%`,
                top: `${startFrame.gridRow * 12.5}%`,
                transformOrigin: '50% 50%',
              }}
              animate={{
                left: `${endFrame.gridCol * 12.5}%`,
                top: `${endFrame.gridRow * 12.5}%`,
                rotate: endFrame.rotation,
                scale: endFrame.scale,
                opacity: endFrame.opacity,
              }}
              transition={{ duration: animation.duration / 1000, ease: 'linear' }}
              onAnimationComplete={() => onAnimationComplete?.(animation)}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`
                  w-[70%] h-[70%] rounded-full shadow-lg
                  flex items-center justify-center relative
                  ${board[animation.fromPos.row]?.[animation.fromPos.col]?.includes('red')
                    ? 'bg-gradient-to-br from-red-500 to-red-700 border-4 border-red-900'
                    : 'bg-gradient-to-br from-gray-800 to-black border-4 border-gray-950'
                  }
                `}>
                  {board[animation.fromPos.row]?.[animation.fromPos.col]?.includes('king') && (
                    <Crown
                      className={`w-1/2 h-1/2 ${
                        board[animation.fromPos.row]?.[animation.fromPos.col]?.includes('red')
                          ? 'text-yellow-300'
                          : 'text-yellow-400'
                      }`}
                      fill="currentColor"
                    />
                  )}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white opacity-20" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {!isPlayerTurn && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center rounded-lg">
          <div className="bg-white px-6 py-3 rounded-lg shadow-xl">
            <p className="text-gray-900 font-semibold">AI is thinking...</p>
          </div>
        </div>
      )}
    </div>
  );
}
