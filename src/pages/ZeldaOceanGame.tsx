import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Volume2, VolumeX, Anchor, Trophy,
  RotateCcw, Compass, Gem, Wind, Map,
} from 'lucide-react';
import { OceanEngine } from '../game/zelda-ocean/OceanEngine';
import { IslandEngine } from '../game/zelda-ocean/IslandEngine';
import { DungeonEngine } from '../game/zelda-ocean/DungeonEngine';
import { WorldMapOverlay } from '../game/zelda-ocean/WorldMapOverlay';
import { NpcDialogueModal } from '../game/zelda-ocean/NpcDialogueModal';
import { QuestJournalModal } from '../game/zelda-ocean/QuestJournalModal';
import { DungeonResultModal } from '../game/zelda-ocean/DungeonResultModal';
import { RPGHud } from '../game/zelda-ocean/RPGHud';
import { ISLANDS } from '../game/zelda-ocean/islandData';
import {
  loadRPGSave, saveRPGSave,
  loadIslandProgress, upsertIslandProgress,
  recordDungeonRun, loadQuestLog,
} from '../game/zelda-ocean/rpgDatabase';
import { saveOceanSession } from '../services/zeldaOceanDatabase';
import { supabase } from '../shared/supabase/client';
import type { ZeldaOceanCallbacks } from '../game/zelda-ocean/types';
import type { GameMode } from '../game/zelda-ocean/constants';
import type {
  RPGSave, IslandProgress, IslandDef, NpcDef, ChestDef,
  DungeonRunResult, ShopItem,
} from '../game/zelda-ocean/rpgTypes';

type GameLayer = 'OCEAN' | 'ISLAND' | 'DUNGEON';

interface OceanHUD {
  score: number;
  rupees: number;
  lives: number;
  mode: GameMode;
  gameOver: boolean;
  finalScore: number;
  finalRupees: number;
  showModeSelect: boolean;
  showRupeeFlash: number;
  hitFlash: boolean;
  highScore: number;
}

const DEFAULT_SAVE: RPGSave = {
  rupeeWallet: 10,
  maxHealth: 6,
  currentHealth: 6,
  hasSword: false,
  hasShield: false,
  hasHookshot: false,
  hasBow: false,
  discoveredIslands: [],
  totalEnemiesDefeated: 0,
  totalDungeonsCleared: 0,
};

const RUPEE_COLORS: Record<number, string> = {
  1: 'text-green-400',
  5: 'text-blue-400',
  20: 'text-red-400',
};

export function ZeldaOceanGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [layer, setLayer] = useState<GameLayer>('OCEAN');
  const [activeIsland, setActiveIsland] = useState<IslandDef | null>(null);
  const [rpgSave, setRpgSave] = useState<RPGSave>(DEFAULT_SAVE);
  const [islandProgress, setIslandProgress] = useState<IslandProgress[]>([]);
  const [questLog, setQuestLog] = useState<Record<string, { progress: number; status: string }>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showQuestJournal, setShowQuestJournal] = useState(false);
  const [activeNpc, setActiveNpc] = useState<NpcDef | null>(null);
  const [lastDungeonResult, setLastDungeonResult] = useState<DungeonRunResult | null>(null);

  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<OceanHUD>({
    score: 0, rupees: 0, lives: 3,
    mode: 'DEFAULT', gameOver: false, finalScore: 0, finalRupees: 0,
    showModeSelect: true, showRupeeFlash: 0, hitFlash: false, highScore: 0,
  });

  const oceanCanvasRef = useRef<HTMLCanvasElement>(null);
  const islandCanvasRef = useRef<HTMLCanvasElement>(null);
  const dungeonCanvasRef = useRef<HTMLCanvasElement>(null);

  const oceanEngineRef = useRef<OceanEngine | null>(null);
  const islandEngineRef = useRef<IslandEngine | null>(null);
  const dungeonEngineRef = useRef<DungeonEngine | null>(null);

  const rupeeFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const islandProgressRef = useRef<IslandProgress[]>([]);
  islandProgressRef.current = islandProgress;
  const rpgSaveRef = useRef<RPGSave>(DEFAULT_SAVE);
  rpgSaveRef.current = rpgSave;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const [save, progress, quests] = await Promise.all([
        loadRPGSave(user.id),
        loadIslandProgress(user.id),
        loadQuestLog(user.id),
      ]);
      setRpgSave(save);
      setIslandProgress(progress);
      setQuestLog(quests);
    })();
  }, []);

  const persistSave = useCallback(async (newSave: RPGSave) => {
    if (!userId) return;
    setRpgSave(newSave);
    await saveRPGSave(userId, newSave);
  }, [userId]);

  const persistIslandProgress = useCallback(async (p: IslandProgress) => {
    if (!userId) return;
    setIslandProgress(prev => {
      const idx = prev.findIndex(x => x.islandId === p.islandId);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
      return [...prev, p];
    });
    await upsertIslandProgress(userId, p);
  }, [userId]);

  const handleSaveOceanScore = useCallback(async (score: number, rupees: number, timePlayed: number) => {
    if (!userId) return;
    try {
      await saveOceanSession({ user_id: userId, score, rupees_collected: rupees, mode: 'GAME', lives_lost: 3, time_played: timePlayed, completed: false });
    } catch { /* silent */ }
  }, [userId]);

  useEffect(() => {
    if (layer !== 'OCEAN') return;
    const canvas = oceanCanvasRef.current;
    if (!canvas) return;

    const callbacks: ZeldaOceanCallbacks = {
      onScoreUpdate: ({ score, rupees, lives }) => {
        setHud(prev => ({ ...prev, score, rupees, lives }));
      },
      onGameOver: ({ finalScore, rupeesCollected, timePlayed }) => {
        setHud(prev => ({ ...prev, gameOver: true, finalScore, finalRupees: rupeesCollected }));
        handleSaveOceanScore(finalScore, rupeesCollected, timePlayed);
        const newSave = { ...rpgSaveRef.current, rupeeWallet: rpgSaveRef.current.rupeeWallet + rupeesCollected };
        persistSave(newSave);
      },
      onModeChange: (mode: GameMode) => {
        setHud(prev => ({ ...prev, mode }));
      },
      onRupeeCollect: (value: number) => {
        if (rupeeFlashTimer.current) clearTimeout(rupeeFlashTimer.current);
        setHud(prev => ({ ...prev, showRupeeFlash: value }));
        rupeeFlashTimer.current = setTimeout(() => setHud(prev => ({ ...prev, showRupeeFlash: 0 })), 900);
      },
      onHit: () => {
        if (hitFlashTimer.current) clearTimeout(hitFlashTimer.current);
        setHud(prev => ({ ...prev, hitFlash: true }));
        hitFlashTimer.current = setTimeout(() => setHud(prev => ({ ...prev, hitFlash: false })), 500);
      },
    };

    const engine = new OceanEngine(canvas, callbacks);
    oceanEngineRef.current = engine;

    return () => {
      engine.destroy();
      oceanEngineRef.current = null;
      if (rupeeFlashTimer.current) clearTimeout(rupeeFlashTimer.current);
      if (hitFlashTimer.current) clearTimeout(hitFlashTimer.current);
    };
  }, [layer, handleSaveOceanScore, persistSave]);

  useEffect(() => {
    if (layer !== 'ISLAND' || !activeIsland) return;
    const canvas = islandCanvasRef.current;
    if (!canvas) return;

    const existingProg = islandProgressRef.current.find(p => p.islandId === activeIsland.id);
    const openedChests = existingProg?.chestsOpened ?? [];
    const metNpcs = existingProg?.npcsMet ?? [];

    const engine = new IslandEngine(canvas, activeIsland, openedChests, metNpcs, {
      onExitIsland: () => {
        const finalMet = engine.getMetNpcs();
        const finalChests = engine.getOpenedChests();
        persistIslandProgress({
          islandId: activeIsland.id,
          dungeonCleared: existingProg?.dungeonCleared ?? false,
          chestsOpened: finalChests,
          npcsMet: finalMet,
          dungeonAttempts: existingProg?.dungeonAttempts ?? 0,
          firstVisitedAt: existingProg?.firstVisitedAt ?? new Date().toISOString(),
          clearedAt: existingProg?.clearedAt ?? null,
        });
        setLayer('OCEAN');
        setActiveIsland(null);
      },
      onEnterDungeon: () => {
        const finalMet = engine.getMetNpcs();
        const finalChests = engine.getOpenedChests();
        persistIslandProgress({
          islandId: activeIsland.id,
          dungeonCleared: existingProg?.dungeonCleared ?? false,
          chestsOpened: finalChests,
          npcsMet: finalMet,
          dungeonAttempts: (existingProg?.dungeonAttempts ?? 0) + 1,
          firstVisitedAt: existingProg?.firstVisitedAt ?? new Date().toISOString(),
          clearedAt: existingProg?.clearedAt ?? null,
        });
        setLayer('DUNGEON');
      },
      onNpcTalk: (npc: NpcDef) => setActiveNpc(npc),
      onChestOpen: (chest: ChestDef) => {
        applyChestReward(chest);
      },
      onHealthChange: (current, max) => {
        const newSave = { ...rpgSaveRef.current, currentHealth: current, maxHealth: max };
        persistSave(newSave);
      },
    });

    islandEngineRef.current = engine;

    if (!rpgSaveRef.current.discoveredIslands.includes(activeIsland.id)) {
      const newSave = { ...rpgSaveRef.current, discoveredIslands: [...rpgSaveRef.current.discoveredIslands, activeIsland.id] };
      persistSave(newSave);
    }

    return () => {
      engine.destroy();
      islandEngineRef.current = null;
    };
  }, [layer, activeIsland, persistSave, persistIslandProgress]);

  useEffect(() => {
    if (layer !== 'DUNGEON' || !activeIsland) return;
    const canvas = dungeonCanvasRef.current;
    if (!canvas) return;

    const existingProg = islandProgressRef.current.find(p => p.islandId === activeIsland.id);
    const openedChests = existingProg?.chestsOpened ?? [];
    const save = rpgSaveRef.current;

    const engine = new DungeonEngine(canvas, activeIsland, save.currentHealth, save.maxHealth, openedChests, save.hasSword, {
      onExit: () => setLayer('ISLAND'),
      onComplete: async (result: DungeonRunResult) => {
        setLastDungeonResult(result);

        if (result.completed) {
          const clearedProg: IslandProgress = {
            islandId: activeIsland.id,
            dungeonCleared: true,
            chestsOpened: engine.getOpenedChests(),
            npcsMet: existingProg?.npcsMet ?? [],
            dungeonAttempts: existingProg?.dungeonAttempts ?? 1,
            firstVisitedAt: existingProg?.firstVisitedAt ?? new Date().toISOString(),
            clearedAt: new Date().toISOString(),
          };
          persistIslandProgress(clearedProg);

          const newSave: RPGSave = { ...rpgSaveRef.current };
          newSave.rupeeWallet += result.rupeesFound;
          newSave.totalEnemiesDefeated += result.enemiesDefeated;
          newSave.totalDungeonsCleared += 1;
          if (result.itemFound === 'hookshot') newSave.hasHookshot = true;
          if (result.itemFound === 'bow') newSave.hasBow = true;
          if (result.itemFound === 'sword') newSave.hasSword = true;
          if (result.itemFound === 'shield') newSave.hasShield = true;
          if (result.itemFound === 'heart_piece') { newSave.maxHealth += 2; newSave.currentHealth = Math.min(newSave.currentHealth + 2, newSave.maxHealth); }
          persistSave(newSave);
        } else {
          const newSave = { ...rpgSaveRef.current, rupeeWallet: rpgSaveRef.current.rupeeWallet + result.rupeesFound, totalEnemiesDefeated: rpgSaveRef.current.totalEnemiesDefeated + result.enemiesDefeated };
          persistSave(newSave);
        }

        if (userId) {
          await recordDungeonRun(userId, activeIsland.id, result);
        }
      },
      onHealthChange: (current, max) => {
        const newSave = { ...rpgSaveRef.current, currentHealth: current, maxHealth: max };
        persistSave(newSave);
      },
      onEnemyKilled: (rupeesDrop: number) => {
        const newSave = { ...rpgSaveRef.current, rupeeWallet: rpgSaveRef.current.rupeeWallet + rupeesDrop };
        persistSave(newSave);
      },
      onChestOpen: (chest: ChestDef) => applyChestReward(chest),
    });

    dungeonEngineRef.current = engine;
    return () => {
      engine.destroy();
      dungeonEngineRef.current = null;
    };
  }, [layer, activeIsland, persistSave, persistIslandProgress, userId]);

  function applyChestReward(chest: ChestDef) {
    const save = rpgSaveRef.current;
    const newSave = { ...save };
    if (chest.contents === 'rupees_5') newSave.rupeeWallet += 5;
    else if (chest.contents === 'rupees_20') newSave.rupeeWallet += 20;
    else if (chest.contents === 'rupees_50') newSave.rupeeWallet += 50;
    else if (chest.contents === 'sword') newSave.hasSword = true;
    else if (chest.contents === 'shield') newSave.hasShield = true;
    else if (chest.contents === 'hookshot') newSave.hasHookshot = true;
    else if (chest.contents === 'bow') newSave.hasBow = true;
    else if (chest.contents === 'heart_piece') { newSave.maxHealth += 2; newSave.currentHealth = Math.min(save.currentHealth + 2, newSave.maxHealth); }
    persistSave(newSave);
  }

  const handleIslandSelect = useCallback((island: IslandDef) => {
    setShowWorldMap(false);
    setActiveIsland(island);
    setLayer('ISLAND');
  }, []);

  const handleNpcBuy = useCallback((item: ShopItem) => {
    const save = rpgSaveRef.current;
    if (save.rupeeWallet < item.cost) return;
    const newSave = { ...save, rupeeWallet: save.rupeeWallet - item.cost };
    if (item.type === 'sword') newSave.hasSword = true;
    else if (item.type === 'shield') newSave.hasShield = true;
    else if (item.type === 'hookshot') newSave.hasHookshot = true;
    else if (item.type === 'bow') newSave.hasBow = true;
    else if (item.type === 'health') newSave.currentHealth = Math.min(save.currentHealth + 2, save.maxHealth);
    persistSave(newSave);
  }, [persistSave]);

  const handleQuit = useCallback(() => {
    oceanEngineRef.current?.destroy();
    islandEngineRef.current?.destroy();
    dungeonEngineRef.current?.destroy();
    const companionId = searchParams.get('companion');
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  }, [navigate, searchParams]);

  const handleMute = useCallback(() => {
    const next = !muted;
    oceanEngineRef.current?.setMuted(next);
    setMuted(next);
  }, [muted]);

  const handleStartMode = useCallback((mode: 'EXPLORE' | 'GAME') => {
    setHud(prev => ({ ...prev, showModeSelect: false }));
    if (mode === 'GAME') oceanEngineRef.current?.startGame();
    else oceanEngineRef.current?.startExplore();
  }, []);

  const handleRestart = useCallback(() => {
    setHud(prev => ({ ...prev, gameOver: false, score: 0, rupees: 0, lives: 3, showModeSelect: false }));
    oceanEngineRef.current?.startGame();
  }, []);

  const isGameMode = hud.mode === 'GAME_STARTED';

  return (
    <div className="fixed inset-0 bg-[#0d1b2a] overflow-hidden select-none">
      <canvas
        ref={oceanCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: layer === 'OCEAN' ? 'block' : 'none' }}
      />
      <canvas
        ref={islandCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: layer === 'ISLAND' ? 'block' : 'none' }}
        width={window.innerWidth}
        height={window.innerHeight}
      />
      <canvas
        ref={dungeonCanvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: layer === 'DUNGEON' ? 'block' : 'none' }}
        width={window.innerWidth}
        height={window.innerHeight}
      />

      {hud.hitFlash && layer === 'OCEAN' && (
        <div className="absolute inset-0 bg-red-500/25 pointer-events-none z-10 animate-pulse" />
      )}

      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button
          onClick={handleQuit}
          className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-all text-sm border border-white/10 backdrop-blur-sm"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </button>
        {layer === 'OCEAN' && (
          <button
            onClick={handleMute}
            className="flex items-center justify-center w-9 h-9 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white rounded-lg transition-all border border-white/10 backdrop-blur-sm"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        )}
        {layer === 'OCEAN' && (
          <button
            onClick={() => setShowWorldMap(true)}
            className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-sky-300 hover:text-white px-3 py-2 rounded-lg transition-all text-sm border border-sky-400/20 hover:border-sky-400/50 backdrop-blur-sm"
          >
            <Map size={14} /> Chart
          </button>
        )}
      </div>

      {layer === 'OCEAN' && (
        <RPGHud
          save={rpgSave}
          onMapOpen={() => setShowWorldMap(true)}
          onJournalOpen={() => setShowQuestJournal(true)}
        />
      )}

      {layer === 'OCEAN' && isGameMode && !hud.gameOver && (
        <>
          <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-sky-400/20">
              <Anchor size={13} className="text-sky-400" />
              <span className="text-white text-sm font-mono tabular-nums font-bold">
                {Math.floor(hud.score).toString().padStart(6, '0')}
              </span>
            </div>
            <div className="flex items-center gap-1 bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-emerald-400/20">
              <Gem size={13} className="text-emerald-400" />
              <span className="text-emerald-300 text-sm font-mono tabular-nums font-bold">{hud.rupees}</span>
            </div>
            <div className="flex items-center gap-1 bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-red-400/20">
              {Array.from({ length: 3 }).map((_, i) => (
                <HeartIcon key={i} filled={i < hud.lives} />
              ))}
            </div>
          </div>

          {hud.showRupeeFlash > 0 && (
            <div className={`absolute top-28 right-4 z-40 text-xl font-bold ${RUPEE_COLORS[hud.showRupeeFlash] ?? 'text-white'} animate-bounce drop-shadow-lg`}>
              +{hud.showRupeeFlash} <Gem className="inline" size={16} />
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-4 opacity-40 hover:opacity-70 transition-opacity">
            <div className="text-white/80 text-xs text-center">
              <div className="flex gap-0.5 justify-center mb-0.5">
                {['W','A','S','D'].map(k => <KbdKey key={k}>{k}</KbdKey>)}
              </div>
              <span>Steer</span>
            </div>
          </div>
        </>
      )}

      {layer === 'OCEAN' && hud.mode === 'EXPLORE' && (
        <div className="absolute bottom-6 right-6 z-30">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-xl border border-sky-400/20 text-sky-300 text-xs">
            <Compass size={14} />
            <span>Free Exploration — Open Chart to sail to islands</span>
          </div>
        </div>
      )}

      {layer === 'OCEAN' && hud.showModeSelect && !hud.gameOver && (
        <ModeSelectOverlay onSelect={handleStartMode} onOpenMap={() => setShowWorldMap(true)} />
      )}

      {layer === 'OCEAN' && hud.gameOver && (
        <GameOverOverlay
          score={hud.finalScore}
          rupees={hud.finalRupees}
          highScore={hud.highScore}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
      )}

      {lastDungeonResult && layer === 'DUNGEON' && (
        <DungeonResultModal
          island={activeIsland!}
          result={lastDungeonResult}
          onRetry={() => {
            setLastDungeonResult(null);
            setLayer('DUNGEON');
          }}
          onLeave={() => {
            setLastDungeonResult(null);
            setLayer('ISLAND');
          }}
        />
      )}

      {showWorldMap && (
        <WorldMapOverlay
          save={rpgSave}
          islandProgress={islandProgress}
          onIslandSelect={handleIslandSelect}
          onClose={() => setShowWorldMap(false)}
        />
      )}

      {showQuestJournal && (
        <QuestJournalModal questLog={questLog} onClose={() => setShowQuestJournal(false)} />
      )}

      {activeNpc && (
        <NpcDialogueModal
          npc={activeNpc}
          save={rpgSave}
          onClose={() => setActiveNpc(null)}
          onBuy={handleNpcBuy}
        />
      )}
    </div>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#f87171' : 'none'} stroke={filled ? '#f87171' : '#6b7280'} strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-white/10 border border-white/20 text-white/70 text-xs px-1.5 py-0.5 rounded font-mono">
      {children}
    </span>
  );
}

function ModeSelectOverlay({ onSelect, onOpenMap }: { onSelect: (mode: 'EXPLORE' | 'GAME') => void; onOpenMap: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="text-center max-w-lg px-6">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-sky-400/50" />
          <Anchor className="text-sky-400" size={28} />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-sky-400/50" />
        </div>

        <h1 className="text-4xl font-bold text-white mb-1 tracking-tight">Wind & Waves</h1>
        <p className="text-sky-300/70 text-sm mb-8">A Wind Waker-inspired RPG adventure</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            onClick={() => onSelect('GAME')}
            className="group relative bg-gradient-to-br from-sky-600/80 to-blue-800/80 hover:from-sky-500/90 hover:to-blue-700/90 border border-sky-400/30 hover:border-sky-400/60 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-sky-500/20"
          >
            <Anchor className="text-sky-300 mb-2" size={20} />
            <h3 className="text-white font-bold text-base mb-1">Game Mode</h3>
            <p className="text-sky-200/60 text-xs leading-relaxed">Dodge ships, collect rupees. 3 lives.</p>
          </button>

          <button
            onClick={() => onSelect('EXPLORE')}
            className="group relative bg-gradient-to-br from-teal-700/70 to-cyan-900/70 hover:from-teal-600/80 hover:to-cyan-800/80 border border-teal-400/30 hover:border-teal-400/60 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-teal-500/20"
          >
            <Wind className="text-teal-300 mb-2" size={20} />
            <h3 className="text-white font-bold text-base mb-1">Explore</h3>
            <p className="text-teal-200/60 text-xs leading-relaxed">Free sail, no pressure.</p>
          </button>

          <button
            onClick={onOpenMap}
            className="group relative bg-gradient-to-br from-amber-800/70 to-orange-950/70 hover:from-amber-700/80 hover:to-orange-900/80 border border-amber-400/30 hover:border-amber-400/60 rounded-2xl p-4 text-left transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-amber-500/20"
          >
            <Map className="text-amber-300 mb-2" size={20} />
            <h3 className="text-white font-bold text-base mb-1">Islands</h3>
            <p className="text-amber-200/60 text-xs leading-relaxed">Explore islands & temples.</p>
          </button>
        </div>

        <p className="text-white/20 text-xs">
          Inspired by The Legend of Zelda: The Wind Waker
        </p>
      </div>
    </div>
  );
}

function GameOverOverlay({ score, rupees, highScore, onRestart, onQuit }: {
  score: number; rupees: number; highScore: number; onRestart: () => void; onQuit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="text-center max-w-sm px-6 w-full">
        <div className="bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-sky-500/30 rounded-3xl p-8 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-400/30 flex items-center justify-center">
              <Anchor className="text-sky-400" size={26} />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">Voyage Over</h2>
          <p className="text-sky-400/60 text-sm mb-6">Your ship has sunk...</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-white/40 text-xs mb-1 flex items-center gap-1"><Anchor size={10} /> Score</div>
              <div className="text-white text-xl font-bold font-mono">{score.toString().padStart(6, '0')}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
              <div className="text-white/40 text-xs mb-1 flex items-center gap-1"><Gem size={10} /> Rupees</div>
              <div className="text-emerald-400 text-xl font-bold font-mono">{rupees}</div>
            </div>
          </div>
          {highScore > 0 && score >= highScore && (
            <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 mb-4">
              <Trophy size={14} className="text-amber-400" />
              <span className="text-amber-300 text-sm font-semibold">New High Score!</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-all hover:scale-105"
            >
              <RotateCcw size={16} /> Sail Again
            </button>
            <button
              onClick={onQuit}
              className="flex-1 flex items-center justify-center gap-2 bg-white/8 hover:bg-white/12 text-white/80 hover:text-white font-medium py-3 rounded-xl transition-all border border-white/10"
            >
              <ArrowLeft size={16} /> Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
