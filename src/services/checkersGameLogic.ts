import type { BoardState, PieceType, Position, Move } from '../types/checkers';

export function createInitialBoard(): BoardState {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'black';
      }
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'red';
      }
    }
  }

  return board;
}

export function getPieceColor(piece: PieceType): 'red' | 'black' | null {
  if (!piece) return null;
  return piece.includes('red') ? 'red' : 'black';
}

export function isKing(piece: PieceType): boolean {
  return piece?.includes('king') || false;
}

export function getValidMoves(
  board: BoardState,
  position: Position,
  mustCapture: boolean = false
): Move[] {
  const piece = board[position.row][position.col];
  if (!piece) return [];

  const color = getPieceColor(piece);
  const king = isKing(piece);
  const moves: Move[] = [];

  const captureMoves = getCaptureMoves(board, position, piece, king, color!);

  if (mustCapture || captureMoves.length > 0) {
    return captureMoves;
  }

  const directions = king
    ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
    : color === 'red'
      ? [[-1, -1], [-1, 1]]
      : [[1, -1], [1, 1]];

  for (const [dRow, dCol] of directions) {
    const newRow = position.row + dRow;
    const newCol = position.col + dCol;

    if (isValidPosition(newRow, newCol) && !board[newRow][newCol]) {
      moves.push({
        from: position,
        to: { row: newRow, col: newCol },
        captures: []
      });
    }
  }

  return moves;
}

function getCaptureMoves(
  board: BoardState,
  position: Position,
  piece: PieceType,
  king: boolean,
  color: 'red' | 'black'
): Move[] {
  const captures: Move[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dRow, dCol] of directions) {
    if (!king && color === 'red' && dRow > 0) continue;
    if (!king && color === 'black' && dRow < 0) continue;

    const midRow = position.row + dRow;
    const midCol = position.col + dCol;
    const endRow = position.row + 2 * dRow;
    const endCol = position.col + 2 * dCol;

    if (!isValidPosition(midRow, midCol) || !isValidPosition(endRow, endCol)) {
      continue;
    }

    const midPiece = board[midRow][midCol];
    const endPiece = board[endRow][endCol];

    if (midPiece && getPieceColor(midPiece) !== color && !endPiece) {
      const newBoard = applyMove(board, {
        from: position,
        to: { row: endRow, col: endCol },
        captures: [{ row: midRow, col: midCol }]
      });

      const furtherCaptures = getCaptureMoves(
        newBoard,
        { row: endRow, col: endCol },
        piece,
        king || shouldBecomeKing({ row: endRow, col: endCol }, color),
        color
      );

      if (furtherCaptures.length > 0) {
        for (const further of furtherCaptures) {
          captures.push({
            from: position,
            to: further.to,
            captures: [{ row: midRow, col: midCol }, ...further.captures]
          });
        }
      } else {
        captures.push({
          from: position,
          to: { row: endRow, col: endCol },
          captures: [{ row: midRow, col: midCol }]
        });
      }
    }
  }

  return captures;
}

export function getAllValidMoves(
  board: BoardState,
  color: 'red' | 'black'
): { position: Position; moves: Move[] }[] {
  const allMoves: { position: Position; moves: Move[] }[] = [];
  let hasCaptures = false;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && getPieceColor(piece) === color) {
        const position = { row, col };
        const moves = getValidMoves(board, position, false);

        if (moves.length > 0) {
          if (moves[0].captures.length > 0) {
            hasCaptures = true;
          }
          allMoves.push({ position, moves });
        }
      }
    }
  }

  if (hasCaptures) {
    return allMoves
      .map(({ position, moves }) => ({
        position,
        moves: moves.filter(m => m.captures.length > 0)
      }))
      .filter(({ moves }) => moves.length > 0);
  }

  return allMoves;
}

export function applyMove(board: BoardState, move: Move): BoardState {
  const newBoard = board.map(row => [...row]);
  const piece = newBoard[move.from.row][move.from.col];

  newBoard[move.from.row][move.from.col] = null;

  for (const capture of move.captures) {
    newBoard[capture.row][capture.col] = null;
  }

  let finalPiece = piece;
  if (shouldBecomeKing(move.to, getPieceColor(piece)!)) {
    finalPiece = (getPieceColor(piece) + '-king') as PieceType;
  }

  newBoard[move.to.row][move.to.col] = finalPiece;

  return newBoard;
}

function shouldBecomeKing(position: Position, color: 'red' | 'black'): boolean {
  return (color === 'red' && position.row === 0) ||
         (color === 'black' && position.row === 7);
}

function isValidPosition(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function checkWinner(board: BoardState): 'red' | 'black' | 'draw' | null {
  let redPieces = 0;
  let blackPieces = 0;
  let redHasMoves = false;
  let blackHasMoves = false;

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece) {
        const color = getPieceColor(piece);
        if (color === 'red') {
          redPieces++;
          if (!redHasMoves) {
            const moves = getValidMoves(board, { row, col }, false);
            if (moves.length > 0) redHasMoves = true;
          }
        } else {
          blackPieces++;
          if (!blackHasMoves) {
            const moves = getValidMoves(board, { row, col }, false);
            if (moves.length > 0) blackHasMoves = true;
          }
        }
      }
    }
  }

  if (redPieces === 0 || !redHasMoves) return 'black';
  if (blackPieces === 0 || !blackHasMoves) return 'red';

  return null;
}

export function mustCaptureExists(board: BoardState, color: 'red' | 'black'): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && getPieceColor(piece) === color) {
        const moves = getValidMoves(board, { row, col }, false);
        if (moves.length > 0 && moves[0].captures.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}
