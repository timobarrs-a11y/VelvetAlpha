import type { BoardState, Move, Position } from '../types/checkers';
import {
  getAllValidMoves,
  applyMove,
  getPieceColor,
  isKing,
  checkWinner
} from './checkersGameLogic';

export type Difficulty = 'easy' | 'medium' | 'hard';

export function calculateBestMove(
  board: BoardState,
  aiColor: 'red' | 'black',
  difficulty: Difficulty = 'medium'
): { position: Position; move: Move } | null {
  const depth = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 4 : 6;

  const allMoves = getAllValidMoves(board, aiColor);
  if (allMoves.length === 0) return null;

  let bestScore = -Infinity;
  let bestPosition: Position | null = null;
  let bestMove: Move | null = null;

  for (const { position, moves } of allMoves) {
    for (const move of moves) {
      const newBoard = applyMove(board, move);
      const score = minimax(
        newBoard,
        depth - 1,
        false,
        aiColor,
        -Infinity,
        Infinity
      );

      if (score > bestScore) {
        bestScore = score;
        bestPosition = position;
        bestMove = move;
      }
    }
  }

  if (bestPosition && bestMove) {
    return { position: bestPosition, move: bestMove };
  }

  const randomOption = allMoves[Math.floor(Math.random() * allMoves.length)];
  const randomMove = randomOption.moves[Math.floor(Math.random() * randomOption.moves.length)];
  return { position: randomOption.position, move: randomMove };
}

function minimax(
  board: BoardState,
  depth: number,
  isMaximizing: boolean,
  aiColor: 'red' | 'black',
  alpha: number,
  beta: number
): number {
  const winner = checkWinner(board);
  if (winner === aiColor) return 1000 + depth;
  if (winner && winner !== aiColor) return -1000 - depth;
  if (depth === 0) return evaluateBoard(board, aiColor);

  const currentColor = isMaximizing ? aiColor : (aiColor === 'red' ? 'black' : 'red');
  const allMoves = getAllValidMoves(board, currentColor);

  if (allMoves.length === 0) {
    return isMaximizing ? -1000 - depth : 1000 + depth;
  }

  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const { moves } of allMoves) {
      for (const move of moves) {
        const newBoard = applyMove(board, move);
        const score = minimax(newBoard, depth - 1, false, aiColor, alpha, beta);
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const { moves } of allMoves) {
      for (const move of moves) {
        const newBoard = applyMove(board, move);
        const score = minimax(newBoard, depth - 1, true, aiColor, alpha, beta);
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
    }
    return minScore;
  }
}

function evaluateBoard(board: BoardState, aiColor: 'red' | 'black'): number {
  let score = 0;
  const opponentColor = aiColor === 'red' ? 'black' : 'red';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;

      const color = getPieceColor(piece);
      const king = isKing(piece);
      const multiplier = color === aiColor ? 1 : -1;

      score += multiplier * (king ? 5 : 3);

      if (color === aiColor) {
        score += multiplier * (aiColor === 'red' ? (7 - row) * 0.1 : row * 0.1);
      }

      const controlCenter = Math.abs(3.5 - row) + Math.abs(3.5 - col);
      score += multiplier * (7 - controlCenter) * 0.05;
    }
  }

  return score;
}
