import { motion } from 'framer-motion';
import type { BoardState, Position, Move, PieceType } from '../types/checkers';
import { Crown } from 'lucide-react';

interface CheckersBoardProps {
  board: BoardState;
  validMoves: Move[];
  selectedPosition: Position | null;
  onSquareClick: (row: number, col: number) => void;
  playerColor: 'red' | 'black';
  isPlayerTurn: boolean;
}

export function CheckersBoard({
  board,
  validMoves,
  selectedPosition,
  onSquareClick,
  playerColor,
  isPlayerTurn
}: CheckersBoardProps) {
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

  const displayBoard = playerColor === 'black' ? board : [...board].reverse();
  const getActualRow = (displayRow: number) =>
    playerColor === 'black' ? displayRow : 7 - displayRow;

  return (
    <div className="relative">
      <div className="grid grid-cols-8 gap-0 border-4 border-gray-800 rounded-lg overflow-hidden shadow-2xl">
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

                {piece && (
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
