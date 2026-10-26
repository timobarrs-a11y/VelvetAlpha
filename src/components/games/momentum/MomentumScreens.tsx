// Menus and result screens for Momentum.
import type { NavigateFunction } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SKINS, saveSkinId, type LifetimeStats } from '../../../game/momentum/skins';
import { todayKey } from '../../../game/momentum/leaderboard';
import { themePresets, careerLevels, type CareerLevel } from '../../../game/momentum/config';
import type { ThemeColors, GameMode, CareerProgressRow } from '../../../game/momentum/types';

export type GameState = 'menu' | 'modeSelect' | 'careerLevelSelect' | 'themeSelect' | 'loading' | 'playing' | 'levelComplete' | 'gameOver' | 'careerFailed';

export interface ScreenProps {
  careerProgress: CareerProgressRow[];
  currentCareerLevel: CareerLevel | null;
  customTheme: string;
  finalTime: number;
  gameMode: GameMode;
  isTouchDevice: boolean;
  level: number;
  levelData: ThemeColors | null;
  lifetimeStats: LifetimeStats;
  loadingText: string;
  navigate: NavigateFunction;
  nextLevel: () => void;
  restart: () => void;
  retryLevel: () => void;
  runResult: { newBest: boolean; height: number; bestHeight: number; leaderboardKey: number };
  score: number;
  searchParams: URLSearchParams;
  selectTheme: (t: string) => void;
  setCurrentCareerLevel: (l: CareerLevel | null) => void;
  setCustomTheme: (t: string) => void;
  setGameMode: (m: GameMode) => void;
  setGameState: (s: GameState) => void;
  setSkinId: (id: string) => void;
  skinId: string;
  speedBonus: number;
  starsEarned: number;
  startCareerLevel: (l: CareerLevel) => void;
  startDaily: () => void;
  theme: string;
}

export function MenuScreen(p: ScreenProps) {
  const { careerProgress, isTouchDevice, lifetimeStats, navigate, searchParams, setGameState, setSkinId, skinId } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center">
      <div className="max-w-2xl w-full p-6">
        <button
          onClick={() => {
            const companionId = searchParams.get('companion');
            navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
          }}
          className="mb-8 flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Exit Game
        </button>

        <div className="text-center">
          <h1 className="text-5xl font-extralight tracking-[0.3em] text-white mb-1" style={{ textShadow: '0 0 60px rgba(255,255,255,0.2)' }}>MOMENTUM</h1>
          <p className="text-gray-500 text-xs tracking-[0.2em] mb-10">AI-GENERATED PLATFORMER</p>

          <div className="text-gray-400 text-sm mb-4 text-center space-y-3">
            <p>Auto-bounce up • Score while ascending</p>
            {isTouchDevice ? (
              <p className="text-white/80 text-sm">Drag to steer · Tap to boost</p>
            ) : (
            <div className="flex justify-center gap-3">
              <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">← A</span>
              <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">D →</span>
              <span className="px-4 py-2 bg-cyan-500/20 rounded-lg text-cyan-300 text-xs">SPACE Boost</span>
            </div>
            )}
            <p className="text-gray-600 text-xs">Climb fast to build momentum • Perfect at max momentum = OVERDRIVE</p>
          </div>

          <div className="mt-8">
            <p className="text-white/40 text-xs tracking-[0.2em] mb-3">BALL</p>
            <div className="flex flex-wrap justify-center gap-3">
              {SKINS.map(skin => {
                const unlocked = skin.isUnlocked(lifetimeStats, careerProgress.reduce((sum, p) => sum + (p.stars_earned || 0), 0));
                const selected = skin.id === skinId;
                return (
                  <button
                    key={skin.id}
                    disabled={!unlocked}
                    title={unlocked ? skin.name : `Locked: ${skin.requirement}`}
                    onClick={() => { setSkinId(skin.id); saveSkinId(skin.id); }}
                    className={`flex flex-col items-center gap-1 w-16 py-2 rounded-xl border transition-all ${selected ? 'border-white/60 bg-white/10' : 'border-white/10'} ${unlocked ? 'hover:bg-white/10' : 'opacity-40'}`}
                  >
                    <span
                      className="w-7 h-7 rounded-full"
                      style={{
                        background: skin.rainbow
                          ? 'conic-gradient(#ff5f6d, #ffc371, #7dffc4, #4cc9f0, #c77dff, #ff5f6d)'
                          : skin.fill || '#ffffff',
                        boxShadow: `0 0 12px ${skin.trail || 'rgba(255,255,255,0.6)'}`,
                      }}
                    />
                    <span className="text-[10px] text-white/70">{unlocked ? skin.name : '🔒'}</span>
                  </button>
                );
              })}
            </div>
            {(() => {
              const next = SKINS.find(sk => !sk.isUnlocked(lifetimeStats, careerProgress.reduce((sum, p) => sum + (p.stars_earned || 0), 0)));
              return next ? <p className="text-white/30 text-xs mt-3">Next unlock: {next.name} · {next.requirement}</p> : null;
            })()}
          </div>

          <button onClick={() => setGameState('modeSelect')} className="mt-6 px-14 py-4 bg-white/5 hover:bg-white/10 text-white/90 rounded-full transition-all duration-500 tracking-[0.15em] text-sm border border-white/10">
            BEGIN
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModeSelectScreen(p: ScreenProps) {
  const { lifetimeStats, setCurrentCareerLevel, setGameMode, setGameState, startDaily } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h2 className="text-3xl font-extralight text-white tracking-wider mb-8 text-center">Select Mode</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => {
              setGameMode('career');
              setGameState('careerLevelSelect');
            }}
            className="group p-8 bg-gradient-to-br from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 rounded-2xl transition-all duration-300 border border-orange-500/20 hover:border-orange-500/40 text-left"
          >
            <div className="text-4xl mb-3">⏱️</div>
            <h3 className="text-2xl font-light text-white mb-2">Career Mode</h3>
            <p className="text-white/50 text-sm mb-3">Time-based challenges with escalating difficulty</p>
            <div className="flex items-center gap-2 text-orange-400 text-xs">
              <span>10 Levels</span>
              <span>•</span>
              <span>Beat the clock</span>
              <span>•</span>
              <span>Earn stars</span>
            </div>
          </button>

          <button
            onClick={() => {
              setGameMode('freeplay');
              setCurrentCareerLevel(null);
              setGameState('themeSelect');
            }}
            className="group p-8 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 rounded-2xl transition-all duration-300 border border-cyan-500/20 hover:border-cyan-500/40 text-left"
          >
            <div className="text-4xl mb-3">🎨</div>
            <h3 className="text-2xl font-light text-white mb-2">Free Play</h3>
            <p className="text-white/50 text-sm mb-3">Endless progression with custom AI-generated themes</p>
            <div className="flex items-center gap-2 text-cyan-400 text-xs">
              <span>Infinite levels</span>
              <span>•</span>
              <span>No time limit</span>
              <span>•</span>
              <span>Relaxed</span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 -mt-2">
          <button
            onClick={startDaily}
            className="group p-8 bg-gradient-to-br from-pink-500/10 to-amber-500/10 hover:from-pink-500/20 hover:to-amber-500/20 rounded-2xl transition-all duration-300 border border-pink-500/20 hover:border-pink-500/40 text-left"
          >
            <div className="text-4xl mb-3">🌅</div>
            <h3 className="text-2xl font-light text-white mb-2">Daily Climb</h3>
            <p className="text-white/50 text-sm mb-3">Same level for everyone today. Race the leader's ghost.</p>
            <div className="flex items-center gap-2 text-pink-300 text-xs">
              <span>New every day</span>
              <span>•</span>
              <span>Leaderboard</span>
            </div>
          </button>

          <button
            onClick={() => {
              setGameMode('endless');
              setCurrentCareerLevel(null);
              setGameState('themeSelect');
            }}
            className="group p-8 bg-gradient-to-br from-red-500/10 to-orange-500/10 hover:from-red-500/20 hover:to-orange-500/20 rounded-2xl transition-all duration-300 border border-red-500/20 hover:border-red-500/40 text-left"
          >
            <div className="text-4xl mb-3">🌋</div>
            <h3 className="text-2xl font-light text-white mb-2">Endless</h3>
            <p className="text-white/50 text-sm mb-3">Climb forever. The lava keeps rising.</p>
            <div className="flex items-center gap-2 text-orange-300 text-xs">
              <span>Best: {lifetimeStats.bestEndlessHeight.toLocaleString()}m</span>
              <span>•</span>
              <span>Leaderboard</span>
            </div>
          </button>
        </div>

        <button
          onClick={() => setGameState('menu')}
          className="mx-auto block px-6 py-2 text-white/40 hover:text-white/60 transition-colors text-sm"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export function CareerSelectScreen(p: ScreenProps) {
  const { careerProgress, setGameState, startCareerLevel } = p;
  const maxUnlockedLevel = Math.max(
    1,
    ...careerProgress.filter(p => p.completed).map(p => p.level_number + 1)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-4xl w-full py-8">
        <h2 className="text-3xl font-extralight text-white tracking-wider mb-2 text-center">Career Mode</h2>
        <p className="text-white/40 text-sm text-center mb-8">Complete levels within the time limit to earn stars</p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          {careerLevels.map((careerLevel) => {
            const progress = careerProgress.find(p => p.level_number === careerLevel.number);
            const isLocked = careerLevel.number > maxUnlockedLevel;
            const stars = progress?.stars_earned || 0;

            return (
              <button
                key={careerLevel.number}
                onClick={() => !isLocked && startCareerLevel(careerLevel)}
                disabled={isLocked}
                className={`
                  group relative p-4 rounded-xl transition-all duration-300 text-left
                  ${isLocked
                    ? 'bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-40'
                    : progress?.completed
                      ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                      : 'bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] hover:border-white/20'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-white/90 font-bold text-lg">{careerLevel.number}</span>
                  {isLocked && <span className="text-white/30 text-xl">🔒</span>}
                </div>
                <h3 className="text-white/80 text-xs font-medium mb-1 leading-tight">{careerLevel.name}</h3>
                <p className="text-white/30 text-[10px] mb-2">{careerLevel.timeLimit}s limit</p>

                {progress?.completed && (
                  <div className="flex gap-0.5">
                    {[1, 2, 3].map(s => (
                      <span key={s} className={`text-sm ${s <= stars ? 'text-yellow-400' : 'text-white/10'}`}>★</span>
                    ))}
                  </div>
                )}

                {progress && !progress.completed && (
                  <p className="text-orange-400/60 text-[10px]">{progress.attempts} attempts</p>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setGameState('modeSelect')}
          className="mx-auto block px-6 py-2 text-white/40 hover:text-white/60 transition-colors text-sm"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export function ThemeSelectScreen(p: ScreenProps) {
  const { customTheme, level, selectTheme, setCustomTheme } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <p className="text-white/30 text-xs tracking-[0.2em] mb-1 text-center">LEVEL {level}</p>
        <h2 className="text-2xl font-extralight text-white tracking-wider mb-8 text-center">Choose Your World</h2>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {themePresets.map((t) => (
            <button key={t.name} onClick={() => selectTheme(t.name)} className="group p-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all duration-300 text-left border border-white/5 hover:border-white/10">
              <span className="text-xl block mb-1 opacity-80 group-hover:opacity-100">{t.icon}</span>
              <span className="text-white/90 text-xs block leading-tight">{t.name}</span>
              <span className="text-white/30 text-[10px]">{t.hint}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input type="text" value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Or describe your own world..." className="flex-1 px-4 py-3 bg-white/[0.03] rounded-xl text-white placeholder-white/20 outline-none focus:bg-white/[0.06] transition-all text-sm border border-white/5" onKeyDown={(e) => e.key === 'Enter' && customTheme && selectTheme(customTheme)} />
          <button onClick={() => customTheme && selectTheme(customTheme)} disabled={!customTheme} className="px-5 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 text-white rounded-xl transition-all text-sm">Create</button>
        </div>
      </div>
    </div>
  );
}

export function LoadingScreen(p: ScreenProps) {
  const { loadingText, theme } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border border-white/20 border-t-cyan-400 rounded-full animate-spin mb-8" />
      <p className="text-white/50 text-sm tracking-wider">{loadingText}</p>
      <p className="text-white/25 text-xs mt-2">{theme}</p>
    </div>
  );
}

export function LevelCompleteScreen(p: ScreenProps) {
  const { currentCareerLevel, finalTime, gameMode, level, levelData, navigate, nextLevel, retryLevel, runResult, score, searchParams, setGameState, speedBonus, starsEarned } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 flex items-center justify-center">
      <div className="max-w-md w-full text-center p-6">
        {gameMode === 'career' && currentCareerLevel ? (
          <>
            <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {currentCareerLevel.number}</p>
            <h2 className="text-3xl font-extralight text-white mb-1">{currentCareerLevel.name}</h2>
            <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>
            {runResult.newBest && <p className="text-yellow-300 text-sm -mt-4 mb-4">New best — your ghost will race you next time</p>}

            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <span key={s} className={`text-5xl ${s <= starsEarned ? 'text-yellow-400' : 'text-white/10'}`}>★</span>
              ))}
            </div>

            <div className="text-center mb-6 space-y-2">
              <p className="text-white/40 text-xs">TIME</p>
              <p className="text-white text-2xl font-light">{finalTime.toFixed(1)}s</p>
              {starsEarned === 3 && (
                <p className="text-yellow-400 text-sm font-medium">PERFECT RUN!</p>
              )}
              {starsEarned === 2 && (
                <p className="text-emerald-400 text-sm">Great time!</p>
              )}
              {speedBonus > 0 && (
                <p className="text-emerald-400 text-sm">+{speedBonus.toLocaleString()} TIME BONUS</p>
              )}
            </div>

            <p className="text-white/40 text-xs mb-1">TOTAL SCORE</p>
            <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>

            <div className="flex flex-col gap-3 justify-center">
              {currentCareerLevel.number < careerLevels.length && (
                <button onClick={nextLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
                  NEXT LEVEL
                </button>
              )}
              <button onClick={retryLevel} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RETRY</button>
              <button onClick={() => setGameState('careerLevelSelect')} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">LEVEL SELECT</button>
              <button onClick={() => {
                const companionId = searchParams.get('companion');
                navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
              }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
                EXIT GAME
              </button>
            </div>
          </>
        ) : gameMode === 'daily' ? (
          <>
            <p className="text-white/30 text-xs tracking-[0.2em] mb-1">DAILY CLIMB · {todayKey()}</p>
            <h2 className="text-3xl font-extralight text-white mb-1">{levelData?.levelName}</h2>
            <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>
            <p className="text-white/40 text-xs">TIME</p>
            <p className="text-white text-4xl font-light mb-1">{finalTime.toFixed(2)}s</p>
            {runResult.newBest && <p className="text-yellow-300 text-sm mb-4">New personal best!</p>}
            <div className="my-6">
              <LeaderboardPanel mode="daily" period={todayKey()} refreshKey={runResult.leaderboardKey} />
            </div>
            <div className="flex gap-3 justify-center">
              <button autoFocus onClick={retryLevel} className="px-12 py-4 bg-white/20 hover:bg-white/25 text-white rounded-full transition-all text-base font-medium border border-white/30 whitespace-nowrap">RETRY ↻</button>
              <button onClick={() => setGameState('modeSelect')} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">MODES</button>
            </div>
          </>
        ) : (
          <>
            <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {level}</p>
            <h2 className="text-3xl font-extralight text-white mb-1">{levelData?.levelName}</h2>
            <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>

            <div className="text-center mb-8 space-y-2">
              <p className="text-white/40 text-xs">TIME</p>
              <p className="text-white text-2xl font-light">{finalTime.toFixed(1)}s</p>
              {speedBonus > 0 && (
                <p className="text-emerald-400 text-sm">+{speedBonus.toLocaleString()} SPEED BONUS</p>
              )}
            </div>

            <p className="text-white/40 text-xs mb-1">TOTAL SCORE</p>
            <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>

            <div className="flex gap-4 justify-center">
              <button onClick={nextLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
                NEXT LEVEL
              </button>
              <button onClick={() => {
                const companionId = searchParams.get('companion');
                navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
              }} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
                EXIT GAME
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CareerFailedScreen(p: ScreenProps) {
  const { currentCareerLevel, navigate, retryLevel, searchParams, setGameState } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-rose-900 to-orange-950 flex items-center justify-center">
      <div className="max-w-md w-full text-center p-6">
        <div className="text-6xl mb-4">⏱️</div>
        <h2 className="text-3xl font-extralight text-white mb-1">TIME'S UP</h2>
        <p className="text-white/30 text-xs tracking-wider mb-8">
          {currentCareerLevel ? `${currentCareerLevel.name} • ${currentCareerLevel.timeLimit}s limit` : ''}
        </p>

        <p className="text-white/60 text-sm mb-10">You need to complete the level faster. Use boost strategically and take the shortest path!</p>

        <div className="flex flex-col gap-3 justify-center">
          {currentCareerLevel && (
            <button autoFocus onClick={retryLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
              TRY AGAIN
            </button>
          )}
          <button onClick={() => setGameState('careerLevelSelect')} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">LEVEL SELECT</button>
          <button onClick={() => {
            const companionId = searchParams.get('companion');
            navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
          }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
            EXIT GAME
          </button>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen(p: ScreenProps) {
  const { gameMode, level, levelData, navigate, restart, retryLevel, runResult, score, searchParams } = p;
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-rose-900 to-pink-950 flex items-center justify-center">
      <div className="max-w-md w-full text-center p-6">
        <h2 className="text-3xl font-extralight text-white mb-1">{gameMode === 'endless' ? 'SWALLOWED BY LAVA' : 'MOMENTUM LOST'}</h2>
        <p className="text-white/30 text-xs tracking-wider mb-8">
          {gameMode === 'endless' ? `Endless · ${levelData?.levelName}` : gameMode === 'daily' ? `Daily Climb · ${todayKey()}` : `Level ${level} · ${levelData?.levelName}`}
        </p>

        {gameMode === 'endless' ? (
          <>
            <p className="text-white/40 text-xs mb-1">HEIGHT</p>
            <p className="text-white text-5xl font-extralight mb-1">{runResult.height.toLocaleString()}m</p>
            <p className={`text-sm mb-6 ${runResult.newBest ? 'text-yellow-300' : 'text-white/40'}`}>
              {runResult.newBest ? 'New personal best!' : `Best: ${runResult.bestHeight.toLocaleString()}m`}
            </p>
            <div className="mb-8">
              <LeaderboardPanel mode="endless" period={todayKey()} refreshKey={runResult.leaderboardKey} />
            </div>
          </>
        ) : (
          <>
            <p className="text-white/40 text-xs mb-1">FINAL SCORE</p>
            <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>
          </>
        )}

        <div className="flex gap-4 justify-center">
          <button autoFocus onClick={retryLevel} className="px-12 py-4 bg-white/20 hover:bg-white/25 text-white rounded-full transition-all text-base font-medium border border-white/30 whitespace-nowrap">RETRY ↻</button>
          <button onClick={restart} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RESTART</button>
          <button onClick={() => {
            const companionId = searchParams.get('companion');
            navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
          }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
            EXIT GAME
          </button>
        </div>
      </div>
    </div>
  );
}
