import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { CheckersBoard } from '../CheckersBoard';
import { applyMove, checkWinner, createInitialBoard, getAllValidMoves } from '../../services/checkersGameLogic';
import type { BoardState, Move, Position } from '../../types/checkers';

type Color = 'red' | 'black';

interface GameState {
  board: BoardState;
  turn: Color;
  /** Moves played; the higher count wins when two copies disagree. */
  n: number;
  /** Bumped on "new game" so a reset beats any older game. */
  round: number;
}

const fresh = (round: number): GameState => ({ board: createInitialBoard(), turn: 'red', n: 0, round });
const newer = (a: GameState, b: GameState) => a.round > b.round || (a.round === b.round && a.n > b.n);
const storageKey = (conversationId: string) => `velvet.checkers.${conversationId}`;

function loadSaved(conversationId: string): GameState {
  try {
    const raw = localStorage.getItem(storageKey(conversationId));
    if (raw) return JSON.parse(raw) as GameState;
  } catch { /* storage blocked */ }
  return fresh(0);
}

/**
 * Checkers with a friend, live. Moves travel over a realtime broadcast channel
 * for the conversation; each side keeps a copy (saved locally) and the newest
 * copy wins, so a reload or a late join catches up from the other player.
 */
export function FriendCheckers({ conversationId, myId, peerId, peerName }: { conversationId: string; myId: string; peerId: string; peerName: string }) {
  // Fixed colours per pair, so both sides agree without asking: red moves first.
  const myColor: Color = myId < peerId ? 'red' : 'black';
  const [game, setGame] = useState<GameState>(() => loadSaved(conversationId));
  const [selected, setSelected] = useState<Position | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const gameRef = useRef(game);
  gameRef.current = game;

  const adopt = useCallback((incoming: GameState) => {
    if (!newer(incoming, gameRef.current)) return;
    setGame(incoming);
    setSelected(null);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storageKey(conversationId), JSON.stringify(game)); } catch { /* storage blocked */ }
  }, [conversationId, game]);

  useEffect(() => {
    const channel = supabase
      .channel(`checkers-${conversationId}`)
      .on('broadcast', { event: 'state' }, ({ payload }) => adopt(payload as GameState))
      // Someone (re)joined: send them our copy.
      .on('broadcast', { event: 'hello' }, () => {
        channel.send({ type: 'broadcast', event: 'state', payload: gameRef.current });
      });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.send({ type: 'broadcast', event: 'hello', payload: {} });
    });
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [conversationId, adopt]);

  const publish = (next: GameState) => {
    setGame(next);
    setSelected(null);
    channelRef.current?.send({ type: 'broadcast', event: 'state', payload: next });
  };

  const winner = checkWinner(game.board);
  const myTurn = !winner && game.turn === myColor;
  const options = myTurn ? getAllValidMoves(game.board, myColor) : [];
  const selectedMoves: Move[] = selected
    ? options.find(o => o.position.row === selected.row && o.position.col === selected.col)?.moves ?? []
    : [];

  const onSquareClick = (row: number, col: number) => {
    if (!myTurn) return;
    const move = selectedMoves.find(m => m.to.row === row && m.to.col === col);
    if (move) {
      publish({ ...game, board: applyMove(game.board, move), turn: myColor === 'red' ? 'black' : 'red', n: game.n + 1 });
      return;
    }
    const mine = options.some(o => o.position.row === row && o.position.col === col);
    setSelected(mine ? { row, col } : null);
  };

  const status = winner
    ? winner === myColor ? 'You won! 🎉' : `${peerName} won`
    : myTurn ? 'Your move' : `${peerName}'s move`;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-3">
      <div className="flex w-full items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-white/80">
          <span className={`h-3 w-3 rounded-full ${myColor === 'red' ? 'bg-red-500' : 'bg-gray-900 ring-1 ring-white/40'}`} />
          You're {myColor}
        </span>
        <span className={`font-semibold ${myTurn ? 'text-amber-300' : 'text-white/70'}`}>{status}</span>
        <button
          type="button"
          onClick={() => { if (game.n === 0 || winner || confirm('Start a new game?')) publish(fresh(game.round + 1)); }}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white"
          title="New game"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="w-full max-w-[320px]">
        <CheckersBoard
          board={game.board}
          validMoves={selectedMoves}
          selectedPosition={selected}
          onSquareClick={onSquareClick}
          // The board draws row 0 on top for 'black'; red starts on rows 5-7, so this keeps your pieces at the bottom.
          playerColor={myColor === 'red' ? 'black' : 'red'}
          isPlayerTurn={myTurn}
        />
      </div>
    </div>
  );
}
