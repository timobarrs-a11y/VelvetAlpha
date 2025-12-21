import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, RotateCcw, Play, Pause, Settings } from 'lucide-react';
import { PacmanBoard } from '../components/PacmanBoard';
import type { GameState } from '../types/pacman';
import {
  createInitialGameState,
  movePlayer,
  moveEnemies,
  updatePowerUps,
  checkGameOver,
  getAIMove
} from '../services/pacmanGameLogic';
import { createGame, updateGameState } from '../services/pacmanDatabase';
import { supabase } from '../services/supabase';

export function PacmanGame() {
  const navigate = useNavigate();
  const [gameId, setGameId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>(createInitialGameState('vs-ai'));
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [gameMode, setGameMode] = useState<'solo' | 'vs-ai'>('vs-ai');
  const [showSettings, setShowSettings] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const gameLoopRef = useRef<number>();
  const enemyLoopRef = useRef<number>();
  const aiLoopRef = useRef<number>();
  const timerRef = useRef<number>();
  const lastUpdateRef = useRef<number>(Date.now());

  useEffect(() => {
    initializeGame();
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (enemyLoopRef.current) clearInterval(enemyLoopRef.current);
      if (aiLoopRef.current) clearInterval(aiLoopRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (gameState.gameStatus === 'active') {
      window.addEventListener('keydown', handleKeyPress);
      startGameLoops();
      return () => {
        window.removeEventListener('keydown', handleKeyPress);
        stopGameLoops();
      };
    }
  }, [gameState.gameStatus]);

  async function initializeGame() {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      navigate('/');
      return;
    }

    const initialState = createInitialGameState(gameMode);
    setGameState(initialState);

    const game = await createGame(user.id, initialState, gameMode, difficulty);
    if (game) {
      setGameId(game.id);
    }

    setIsInitializing(false);
  }

  function startGameLoops() {
    enemyLoopRef.current = window.setInterval(() => {
      setGameState(prevState => {
        if (prevState.gameStatus !== 'active') return prevState;
        const withEnemies = moveEnemies(prevState, difficulty);
        const withPowerUps = updatePowerUps(withEnemies);
        return checkGameOver(withPowerUps);
      });
    }, 300);

    if (gameMode === 'vs-ai') {
      aiLoopRef.current = window.setInterval(() => {
        setGameState(prevState => {
          if (prevState.gameStatus !== 'active') return prevState;
          const aiMove = getAIMove(prevState);
          if (aiMove) {
            return movePlayer(prevState, 2, aiMove);
          }
          return prevState;
        });
      }, 200);
    }

    timerRef.current = window.setInterval(() => {
      setGameState(prevState => {
        if (prevState.gameStatus !== 'active') return prevState;
        return {
          ...prevState,
          timeRemaining: Math.max(0, prevState.timeRemaining - 1)
        };
      });
    }, 1000);
  }

  function stopGameLoops() {
    if (enemyLoopRef.current) clearInterval(enemyLoopRef.current);
    if (aiLoopRef.current) clearInterval(aiLoopRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }

    setGameState(prevState => {
      if (prevState.gameStatus !== 'active') return prevState;

      let direction: 'up' | 'down' | 'left' | 'right' | null = null;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          direction = 'up';
          break;
        case 'ArrowDown':
        case 's':
          direction = 'down';
          break;
        case 'ArrowLeft':
        case 'a':
          direction = 'left';
          break;
        case 'ArrowRight':
        case 'd':
          direction = 'right';
          break;
      }

      if (direction) {
        return movePlayer(prevState, 1, direction);
      }

      return prevState;
    });
  }, []);

  useEffect(() => {
    if (gameId && gameState.gameStatus === 'finished') {
      updateGameState(gameId, gameState);
    }
  }, [gameState.gameStatus, gameId]);

  async function startNewGame() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    stopGameLoops();

    const newState = createInitialGameState(gameMode);
    setGameState(newState);

    const game = await createGame(user.id, newState, gameMode, difficulty);
    if (game) {
      setGameId(game.id);
    }
  }

  function togglePause() {
    setGameState(prev => ({
      ...prev,
      gameStatus: prev.gameStatus === 'active' ? 'paused' : 'active'
    }));
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-2xl font-bold text-white">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/lobby')}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>

          <h1 className="text-4xl font-bold text-white">💰 Money Grab 💰</h1>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <PacmanBoard gameState={gameState} />
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">How To Play</h2>
              <div className="space-y-2 text-sm text-gray-600">
                <p><kbd className="px-2 py-1 bg-gray-200 rounded">↑ ↓ ← →</kbd> or <kbd className="px-2 py-1 bg-gray-200 rounded">WASD</kbd> to move</p>
                <p className="mt-4"><strong>💵 Collect cash:</strong> $100 per bill</p>
                <p><strong>💰 Power-ups:</strong> Grab hammers for $500</p>
                <p><strong>🔨 Avoid hammers:</strong> Lose $200 if hit!</p>
                <p><strong>❤️ Lives:</strong> Lose a life when hit by hammer</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={togglePause}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-semibold"
              >
                {gameState.gameStatus === 'paused' ? (
                  <>
                    <Play className="w-5 h-5" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5" />
                    Pause
                  </>
                )}
              </button>

              <button
                onClick={startNewGame}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all font-semibold"
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
                      Difficulty
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  <p className="text-xs text-gray-500 italic">
                    Restart the game for changes to take effect
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {gameState.gameStatus === 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            >
              <h2 className="text-3xl font-bold text-center mb-4">
                {gameState.winner === 'player1' ? '🎉 You Won!' :
                 gameState.winner === 'player2' ? '😢 AI Won!' :
                 '🤝 Tie Game!'}
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-emerald-200 rounded-lg border-2 border-green-400">
                  <span className="font-semibold">Your Cash:</span>
                  <span className="text-2xl font-bold text-green-700">${gameState.player1.score}</span>
                </div>

                {gameState.player2 && (
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-100 to-cyan-200 rounded-lg border-2 border-blue-400">
                    <span className="font-semibold">AI Cash:</span>
                    <span className="text-2xl font-bold text-blue-700">${gameState.player2.score}</span>
                  </div>
                )}
              </div>

              <button
                onClick={startNewGame}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-bold text-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
