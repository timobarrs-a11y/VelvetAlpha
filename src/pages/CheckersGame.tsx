import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckersBoard } from '../components/CheckersBoard';
import { Home, RotateCcw, Settings } from 'lucide-react';
import type { BoardState, Position, Move, GameStatus } from '../types/checkers';
import type { TrashTalkPersonality, GameEvent } from '../services/checkersTrashTalk';
import {
  createInitialBoard,
  getValidMoves,
  applyMove,
  checkWinner,
  getPieceColor,
  isKing as checkIsKing,
  mustCaptureExists
} from '../services/checkersGameLogic';
import { calculateBestMove, type Difficulty } from '../services/checkersAI';
import { generateTrashTalk } from '../services/checkersTrashTalk';
import { createGame, updateGame, saveMove, getActiveGame } from '../services/checkersDatabase';
import { supabase } from '../services/supabase';

export function CheckersGame() {
  const navigate = useNavigate();
  const [gameId, setGameId] = useState<string | null>(null);
  const [board, setBoard] = useState<BoardState>(createInitialBoard());
  const [currentTurn, setCurrentTurn] = useState<'red' | 'black'>('red');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [playerColor, setPlayerColor] = useState<'red' | 'black'>('red');
  const [aiColor, setAiColor] = useState<'red' | 'black'>('black');
  const [gameStatus, setGameStatus] = useState<GameStatus>('active');
  const [moveCount, setMoveCount] = useState(0);
  const [aiPersonality, setAiPersonality] = useState<TrashTalkPersonality>('confident');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [trashTalk, setTrashTalk] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [redPieces, setRedPieces] = useState(12);
  const [blackPieces, setBlackPieces] = useState(12);

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    updatePieceCounts();
  }, [board]);

  useEffect(() => {
    if (gameStatus === 'active' && currentTurn === aiColor) {
      const timer = setTimeout(() => {
        makeAIMove();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentTurn, gameStatus, aiColor]);

  async function initializeGame() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      navigate('/');
      return;
    }

    const existingGame = await getActiveGame(user.id);

    if (existingGame) {
      setGameId(existingGame.id);
      setBoard(existingGame.board_state);
      setCurrentTurn(existingGame.current_turn);
      setPlayerColor(existingGame.player_color);
      setAiColor(existingGame.ai_color);
      setGameStatus(existingGame.game_status);
      setMoveCount(existingGame.move_count);
      setAiPersonality(existingGame.ai_personality as TrashTalkPersonality);
    } else {
      await startNewGame();
    }

    setIsInitializing(false);
  }

  async function startNewGame() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newBoard = createInitialBoard();
    const color = Math.random() > 0.5 ? 'red' : 'black';

    const game = await createGame(user.id, color, aiPersonality);

    if (game) {
      setGameId(game.id);
      setBoard(newBoard);
      setCurrentTurn('red');
      setPlayerColor(color);
      setAiColor(color === 'red' ? 'black' : 'red');
      setGameStatus('active');
      setMoveCount(0);
      setSelectedPosition(null);
      setValidMoves([]);

      const talk = await generateTrashTalk(aiPersonality, 'game_start', {
        playerScore: 12,
        aiScore: 12,
        moveCount: 0
      });
      setTrashTalk(talk);
    }
  }

  function updatePieceCounts() {
    let red = 0;
    let black = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const color = getPieceColor(piece);
          if (color === 'red') red++;
          else if (color === 'black') black++;
        }
      }
    }
    setRedPieces(red);
    setBlackPieces(black);
  }

  function handleSquareClick(row: number, col: number) {
    if (gameStatus !== 'active' || currentTurn !== playerColor) return;

    const piece = board[row][col];
    const clickedColor = getPieceColor(piece);

    if (selectedPosition) {
      const move = validMoves.find(m => m.to.row === row && m.to.col === col);
      if (move) {
        executeMove(move);
        return;
      }
    }

    if (clickedColor === playerColor) {
      const mustCapture = mustCaptureExists(board, playerColor);
      const moves = getValidMoves(board, { row, col }, mustCapture);
      setSelectedPosition({ row, col });
      setValidMoves(moves);
    } else {
      setSelectedPosition(null);
      setValidMoves([]);
    }
  }

  async function executeMove(move: Move) {
    const newBoard = applyMove(board, move);
    const newMoveCount = moveCount + 1;
    const becameKing = checkIsKing(newBoard[move.to.row][move.to.col]) &&
                       !checkIsKing(board[move.from.row][move.from.col]);

    setBoard(newBoard);
    setMoveCount(newMoveCount);
    setSelectedPosition(null);
    setValidMoves([]);

    if (gameId) {
      await saveMove(
        gameId,
        newMoveCount,
        currentTurn,
        move.from,
        move.to,
        move.captures,
        becameKing,
        newBoard
      );
    }

    if (currentTurn === playerColor) {
      if (move.captures.length > 1) {
        const talk = await generateTrashTalk(aiPersonality, 'player_multi_capture', {
          playerScore: redPieces,
          aiScore: blackPieces,
          moveCount: newMoveCount,
          wasMultiCapture: true
        });
        setTrashTalk(talk);
      } else if (move.captures.length === 1) {
        const talk = await generateTrashTalk(aiPersonality, 'player_capture', {
          playerScore: redPieces,
          aiScore: blackPieces,
          moveCount: newMoveCount
        });
        setTrashTalk(talk);
      } else if (becameKing) {
        const talk = await generateTrashTalk(aiPersonality, 'player_king', {
          playerScore: redPieces,
          aiScore: blackPieces,
          moveCount: newMoveCount
        });
        setTrashTalk(talk);
      }
    }

    const winner = checkWinner(newBoard);
    if (winner) {
      handleGameEnd(winner);
      return;
    }

    setCurrentTurn(currentTurn === 'red' ? 'black' : 'red');
  }

  async function makeAIMove() {
    const bestMove = calculateBestMove(board, aiColor, difficulty);

    if (!bestMove) {
      handleGameEnd(playerColor);
      return;
    }

    await executeMove(bestMove.move);

    if (bestMove.move.captures.length > 1) {
      const talk = await generateTrashTalk(aiPersonality, 'ai_multi_capture', {
        playerScore: redPieces,
        aiScore: blackPieces,
        moveCount: moveCount + 1,
        wasMultiCapture: true
      });
      setTrashTalk(talk);
    } else if (bestMove.move.captures.length === 1) {
      const talk = await generateTrashTalk(aiPersonality, 'ai_capture', {
        playerScore: redPieces,
        aiScore: blackPieces,
        moveCount: moveCount + 1
      });
      setTrashTalk(talk);
    }
  }

  async function handleGameEnd(winner: 'red' | 'black') {
    const playerWon = winner === playerColor;
    const status: GameStatus = playerWon ? 'won' : 'lost';

    setGameStatus(status);

    if (gameId) {
      await updateGame(gameId, { game_status: status });
    }

    const event: GameEvent = playerWon ? 'player_won' : 'ai_won';
    const talk = await generateTrashTalk(aiPersonality, event, {
      playerScore: redPieces,
      aiScore: blackPieces,
      moveCount
    });
    setTrashTalk(talk);
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-800">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>

          <h1 className="text-4xl font-bold text-gray-800">Checkers</h1>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CheckersBoard
              board={board}
              validMoves={validMoves}
              selectedPosition={selectedPosition}
              onSquareClick={handleSquareClick}
              playerColor={playerColor}
              isPlayerTurn={currentTurn === playerColor && gameStatus === 'active'}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">Game Info</h2>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">You:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${
                      playerColor === 'red'
                        ? 'bg-gradient-to-br from-red-500 to-red-700'
                        : 'bg-gradient-to-br from-gray-800 to-black'
                    }`} />
                    <span className="font-semibold">
                      {playerColor === 'red' ? redPieces : blackPieces} pieces
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">AI:</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full ${
                      aiColor === 'red'
                        ? 'bg-gradient-to-br from-red-500 to-red-700'
                        : 'bg-gradient-to-br from-gray-800 to-black'
                    }`} />
                    <span className="font-semibold">
                      {aiColor === 'red' ? redPieces : blackPieces} pieces
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Turn:</span>
                    <span className="font-semibold">
                      {currentTurn === playerColor ? 'Your turn' : 'AI thinking...'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Moves:</span>
                  <span className="font-semibold">{moveCount}</span>
                </div>
              </div>

              {gameStatus !== 'active' && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white text-center">
                  <p className="text-2xl font-bold">
                    {gameStatus === 'won' ? 'You Won!' : 'AI Won!'}
                  </p>
                </div>
              )}
            </div>

            {trashTalk && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg shadow-lg p-4 text-white"
              >
                <p className="text-sm font-semibold mb-1">AI says:</p>
                <p className="italic">"{trashTalk}"</p>
              </motion.div>
            )}

            <button
              onClick={startNewGame}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-semibold"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-white rounded-lg shadow-lg p-6 space-y-4 overflow-hidden"
                >
                  <h3 className="text-lg font-bold">Settings</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Difficulty
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Personality
                    </label>
                    <select
                      value={aiPersonality}
                      onChange={(e) => setAiPersonality(e.target.value as TrashTalkPersonality)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="confident">Confident</option>
                      <option value="cocky">Cocky</option>
                      <option value="friendly">Friendly</option>
                      <option value="sarcastic">Sarcastic</option>
                      <option value="silent">Silent</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
