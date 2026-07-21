import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckersBoard } from '../components/CheckersBoard';
import { GameChatBox } from '../components/GameChatBox';
import { Home, RotateCcw, Settings, Undo2 } from 'lucide-react';
import type { BoardState, Position, Move, GameStatus } from '../types/checkers';
import type { TrashTalkPersonality } from '../services/checkersTrashTalk';
import type { Message } from '../types';
import type { PieceAnimation } from '../services/checkersAnimationEngine';
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
import { ChatService } from '../services/chatService';
import { createGame, updateGame, saveMove, getActiveGame } from '../services/checkersDatabase';
import { supabase } from '../shared/supabase/client';
import { CheckersCommentaryService } from '../services/checkersCommentary';
import { checkersAnimationEngine } from '../services/checkersAnimationEngine';

export function CheckersGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [redPieces, setRedPieces] = useState(12);
  const [blackPieces, setBlackPieces] = useState(12);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [companionId, setCompanionId] = useState<string | null>(null);
  const [companionName, setCompanionName] = useState('AI');
  const [movesSinceCapture, setMovesSinceCapture] = useState(0);
  const [boardHistory, setBoardHistory] = useState<{ board: BoardState; turn: 'red' | 'black' }[]>([]);
  const [activeAnimations, setActiveAnimations] = useState<PieceAnimation[]>([]);
  const boardRef = useRef<BoardState>(board);

  useEffect(() => {
    initializeGame();
  }, []);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

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

    const companionParam = searchParams.get('companion');
    let companion = null;

    if (companionParam) {
      const { data: paramCompanion } = await supabase
        .from('companions')
        .select('*')
        .eq('id', companionParam)
        .eq('user_id', user.id)
        .maybeSingle();
      companion = paramCompanion;
    }

    if (!companion) {
      const { data: recentCompanions } = await supabase
        .from('companions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      companion = recentCompanions?.[0] || null;
    }

    if (companion) {
      setCompanionId(companion.id);
      setCompanionName(companion.custom_name || 'AI');

      const greeting = CheckersCommentaryService.getComment('game_start');
      const initialMessage: Message = {
        id: 'initial',
        content: greeting,
        sender: 'ai',
        timestamp: Date.now()
      };
      setMessages([initialMessage]);
    }

    const existingGame = await getActiveGame(user.id);

    if (existingGame) {
      setGameId(existingGame.id);
      setBoard(existingGame.board_state);
      boardRef.current = existingGame.board_state;
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
      boardRef.current = newBoard;
      setCurrentTurn('red');
      setPlayerColor(color);
      setAiColor(color === 'red' ? 'black' : 'red');
      setGameStatus('active');
      setMoveCount(0);
      setSelectedPosition(null);
      setValidMoves([]);
      setMovesSinceCapture(0);
      setBoardHistory([]);

      const startMessage: Message = {
        id: `start-${Date.now()}`,
        content: "alright, new game! let's do this 💪",
        sender: 'ai',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, startMessage]);
    }
  }

  async function handleSendMessage(content: string) {
    if (!companionId || isTyping) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      content,
      sender: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);

    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    setIsTyping(true);

    try {
      const inGameMessage = `We're playing checkers right now. ${content}`;
      let response: string;

      const userProfile = await ChatService.getUserProfile();
      if (userProfile) {
        const result = await ChatService.sendMessageWithSignals(
          inGameMessage,
          companionId,
          userProfile
        );
        response = result.assistantMessage;
      } else {
        response = await ChatService.sendMessage(inGameMessage, companionId);
      }

      await new Promise(resolve => setTimeout(resolve, Math.min(response.length * 15, 3000)));

      setIsTyping(false);

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        content: response,
        sender: 'ai',
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
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
    if (activeAnimations.length > 0) return;

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

  function undoLastMove() {
    if (boardHistory.length < 2 || gameStatus !== 'active') return;
    const prevState = boardHistory[boardHistory.length - 2];
    setBoard(prevState.board);
    boardRef.current = prevState.board;
    setCurrentTurn(prevState.turn);
    setMoveCount(m => Math.max(0, m - 2));
    setBoardHistory(h => h.slice(0, -2));
    setSelectedPosition(null);
    setValidMoves([]);
    const comment: Message = {
      id: `undo-${Date.now()}`,
      content: "take-backs, huh? fine, I'll let that one slide",
      sender: 'ai',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, comment]);
  }

  async function executeMove(move: Move) {
    const sourceBoard = boardRef.current;
    const mover = currentTurn;
    const newBoard = applyMove(sourceBoard, move);
    const newMoveCount = moveCount + 1;
    const becameKing = checkIsKing(newBoard[move.to.row][move.to.col]) &&
                       !checkIsKing(sourceBoard[move.from.row][move.from.col]);

    setBoardHistory(h => [...h, { board: newBoard, turn: mover === 'red' ? 'black' : 'red' }]);

    const newMovesSinceCapture = move.captures.length > 0 ? 0 : movesSinceCapture + 1;
    setMovesSinceCapture(newMovesSinceCapture);

    // Generate piece animation
    const animations: PieceAnimation[] = [];
    const animationType = move.captures.length > 0 ? 'fly' : (Math.random() > 0.5 ? 'walk' : 'flip');
    const moveAnimation = animationType === 'walk'
      ? checkersAnimationEngine.generateWalkAnimation(move.from, move.to)
      : animationType === 'fly'
      ? checkersAnimationEngine.generateFlyAnimation(move.from, move.to)
      : checkersAnimationEngine.generateFlipAnimation(move.from, move.to);

    animations.push(moveAnimation);

    // Add capture animations
    for (const capturePos of move.captures) {
      animations.push(checkersAnimationEngine.generateCaptureAnimation(capturePos));
    }

    // Add king animation if piece became king
    if (becameKing) {
      animations.push(checkersAnimationEngine.generateBounceAnimation(move.to));
    }

    setActiveAnimations(animations);

    // Persist move before committing board state
    if (gameId) {
      await saveMove(
        gameId,
        newMoveCount,
        mover,
        move.from,
        move.to,
        move.captures,
        becameKing,
        newBoard
      );
    }

    // Commit board state after animations complete, then advance turn
    await new Promise<void>(resolve => {
      setTimeout(() => {
        boardRef.current = newBoard;
        setBoard(newBoard);
        setMoveCount(newMoveCount);
        setSelectedPosition(null);
        setValidMoves([]);
        setActiveAnimations([]);
        resolve();
      }, Math.max(...animations.map(a => a.duration)) + 200);
    });

    // Commentary for player moves
    if (mover === playerColor) {
      let red = 0, black = 0;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = newBoard[row][col];
          if (piece) {
            const color = getPieceColor(piece);
            if (color === 'red') red++;
            else if (color === 'black') black++;
          }
        }
      }
      const pieceDifference = red - black;
      const commentEvent = CheckersCommentaryService.analyzePlayerMove(
        move.captures.length,
        becameKing,
        playerColor === 'red' ? pieceDifference : -pieceDifference
      );

      if (commentEvent) {
        const commentText = CheckersCommentaryService.getComment(commentEvent, newMoveCount);
        if (commentText) {
          const comment: Message = {
            id: `comment-${Date.now()}`,
            content: commentText,
            sender: 'ai',
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, comment]);
        }
      }
    }

    if (newMovesSinceCapture >= 40) {
      handleDraw();
      return;
    }

    const winner = checkWinner(newBoard);
    if (winner === 'red' || winner === 'black') {
      handleGameEnd(winner);
      return;
    }

    setCurrentTurn(mover === 'red' ? 'black' : 'red');
  }

  async function makeAIMove() {
    const sourceBoard = boardRef.current;
    const bestMove = calculateBestMove(sourceBoard, aiColor, difficulty);

    if (!bestMove) {
      handleGameEnd(playerColor);
      return;
    }

    const becameKing = checkIsKing(sourceBoard[bestMove.move.to.row][bestMove.move.to.col]) &&
                       !checkIsKing(sourceBoard[bestMove.move.from.row][bestMove.move.from.col]);

    await executeMove(bestMove.move);

    const commentEvent = CheckersCommentaryService.analyzeAIMove(
      bestMove.move.captures.length,
      becameKing,
      moveCount + 1
    );

    if (commentEvent) {
      const commentText = CheckersCommentaryService.getComment(commentEvent, moveCount + 1);
      if (commentText) {
        const comment: Message = {
          id: `ai-comment-${Date.now()}`,
          content: commentText,
          sender: 'ai',
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, comment]);
      }
    }
  }

  async function handleGameEnd(winner: 'red' | 'black') {
    const playerWon = winner === playerColor;
    const status: GameStatus = playerWon ? 'won' : 'lost';

    setGameStatus(status);

    if (gameId) {
      await updateGame(gameId, { game_status: status });
    }

    const endComment = CheckersCommentaryService.getGameEndComment(playerWon, moveCount);
    const endMessage: Message = {
      id: `end-${Date.now()}`,
      content: endComment,
      sender: 'ai',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, endMessage]);
  }

  async function handleDraw() {
    setGameStatus('draw');

    if (gameId) {
      await updateGame(gameId, { game_status: 'draw' });
    }

    const drawMessage: Message = {
      id: `draw-${Date.now()}`,
      content: "40 moves without a capture... looks like we're both too good for each other. It's a draw!",
      sender: 'ai',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, drawMessage]);
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
            onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Home className="w-5 h-5" />
            <span>Exit Game</span>
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
              activeAnimations={activeAnimations}
              onAnimationComplete={() => {}}
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
                <div className={`mt-4 p-4 rounded-lg text-white text-center ${
                  gameStatus === 'draw'
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                    : 'bg-gradient-to-r from-blue-500 to-teal-600'
                }`}>
                  <p className="text-2xl font-bold">
                    {gameStatus === 'won' ? 'You Won!' : gameStatus === 'draw' ? 'Draw!' : 'AI Won!'}
                  </p>
                  {gameStatus === 'draw' && (
                    <p className="text-sm mt-1 opacity-80">40 moves without a capture</p>
                  )}
                </div>
              )}
            </div>

            <GameChatBox
              messages={messages}
              onSendMessage={handleSendMessage}
              isTyping={isTyping}
              disabled={gameStatus !== 'active'}
              companionName={companionName}
            />

            <div className="flex gap-3">
              <button
                onClick={undoLastMove}
                disabled={boardHistory.length < 2 || gameStatus !== 'active' || currentTurn === aiColor}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all font-semibold disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200"
              >
                <Undo2 className="w-5 h-5" />
                Undo
              </button>
              <button
                onClick={startNewGame}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-semibold"
              >
                <RotateCcw className="w-5 h-5" />
                New Game
              </button>
            </div>

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
