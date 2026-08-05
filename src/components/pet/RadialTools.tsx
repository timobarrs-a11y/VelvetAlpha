import React, { useState, useEffect, useRef } from 'react';

// Anchor: lower-right corner
const ANCHOR_RX = 34; // px from right edge to button center
const ANCHOR_BY = 34; // px from bottom edge to button center

function FishIcon({ size = 52, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={animate ? { animation: 'fishSwim 2.2s ease-in-out infinite' } : undefined}>
      {/* tail fin */}
      <path d="M8 26 L2 16 L2 36 Z" fill="#f97316" opacity="0.85"/>
      {/* body */}
      <ellipse cx="28" cy="26" rx="18" ry="11" fill="#fb923c"/>
      {/* belly sheen */}
      <ellipse cx="27" cy="28.5" rx="13" ry="6.5" fill="#fed7aa" opacity="0.55"/>
      {/* top fin */}
      <path d="M20 15 Q26 10 34 15" stroke="#ea580c" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      {/* scales */}
      <path d="M22 22 Q25 19 28 22" stroke="#ea580c" strokeWidth="1.2" fill="none" opacity="0.6"/>
      <path d="M28 22 Q31 19 34 22" stroke="#ea580c" strokeWidth="1.2" fill="none" opacity="0.6"/>
      <path d="M25 27 Q28 24 31 27" stroke="#ea580c" strokeWidth="1.2" fill="none" opacity="0.6"/>
      {/* eye */}
      <circle cx="40" cy="24" r="3.5" fill="white"/>
      <circle cx="40.8" cy="24" r="2" fill="#1e293b"/>
      <circle cx="41.5" cy="22.8" r="0.7" fill="white" opacity="0.9"/>
      {/* mouth */}
      <path d="M46 26 Q47.5 27.5 46 29" stroke="#c2410c" strokeWidth="1.3" fill="none" strokeLinecap="round"/>
      {/* pectoral fin */}
      <path d="M32 28 Q36 33 30 35" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function BrushIcon({ size = 52, animate = false, glowing = false }: { size?: number; animate?: boolean; glowing?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={animate ? { animation: 'bristleShake 1.8s ease-in-out infinite' } : undefined}>
      {/* handle — wooden */}
      <rect x="8" y="20" width="30" height="12" rx="5" fill="#a16207"/>
      <rect x="8" y="20" width="30" height="6" rx="4" fill="#ca8a04" opacity="0.6"/>
      {/* handle grip lines */}
      <line x1="16" y1="21" x2="16" y2="31" stroke="#78350f" strokeWidth="1.2" opacity="0.5"/>
      <line x1="22" y1="21" x2="22" y2="31" stroke="#78350f" strokeWidth="1.2" opacity="0.5"/>
      <line x1="28" y1="21" x2="28" y2="31" stroke="#78350f" strokeWidth="1.2" opacity="0.5"/>
      {/* bristle base */}
      <rect x="36" y="18" width="8" height="16" rx="2" fill="#d97706"/>
      {/* bristles */}
      {[38, 40, 42].map(x => (
        <React.Fragment key={x}>
          <line x1={x} y1="34" x2={x - 0.5} y2={glowing ? "44" : "43"} stroke={glowing ? "#c084fc" : "#fbbf24"} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1={x} y1="34" x2={x + 0.5} y2={glowing ? "44" : "43"} stroke={glowing ? "#a855f7" : "#f59e0b"} strokeWidth="1.2" strokeLinecap="round"/>
        </React.Fragment>
      ))}
      <line x1="37" y1="34" x2="36.5" y2="43" stroke={glowing ? "#c084fc" : "#fbbf24"} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="43" y1="34" x2="43.5" y2="43" stroke={glowing ? "#c084fc" : "#fbbf24"} strokeWidth="1.3" strokeLinecap="round"/>
      {/* sparkle when glowing */}
      {glowing && <>
        <circle cx="46" cy="16" r="2" fill="#e879f9" opacity="0.9"/>
        <circle cx="34" cy="12" r="1.5" fill="#a855f7" opacity="0.7"/>
        <circle cx="49" cy="28" r="1.2" fill="#c084fc" opacity="0.8"/>
      </>}
    </svg>
  );
}

interface RadialToolsProps {
  catPosRef: React.MutableRefObject<any>;
  onFed: () => void;
  onStroke: () => void;
}

export function RadialTools({ catPosRef, onFed, onStroke }: RadialToolsProps) {
  const [open, setOpen] = useState(false);
  const [foodPos, setFoodPos] = useState<{ x: number; y: number } | null>(null);
  const [brushPos, setBrushPos] = useState<{ x: number; y: number } | null>(null);
  const [foodDragging, setFoodDragging] = useState(false);
  const [brushDragging, setBrushDragging] = useState(false);
  const [brushNear, setBrushNear] = useState(false);
  const [foodNear, setFoodNear] = useState(false);
  const [eaten, setEaten] = useState(false);
  const foodOff = useRef({ x: 0, y: 0 }), brushOff = useRef({ x: 0, y: 0 });
  const brushDist = useRef(0), brushLastX = useRef(0);

  // Compute anchor position in viewport coords
  const getAnchor = () => ({
    x: window.innerWidth - ANCHOR_RX,
    y: window.innerHeight - ANCHOR_BY,
  });

  useEffect(() => {
    if (!foodDragging) return;
    const mv = (e: PointerEvent) => {
      setFoodPos({ x: e.clientX - foodOff.current.x, y: e.clientY - foodOff.current.y });
      const c = catPosRef.current;
      setFoodNear(Math.hypot(e.clientX - c.cx, e.clientY - c.cy) < 110 && c.surface !== 'air');
    };
    const up = (e: PointerEvent) => {
      setFoodDragging(false);
      setFoodNear(false);
      const c = catPosRef.current;
      if (Math.hypot(e.clientX - c.cx, e.clientY - c.cy) < 110 && c.surface !== 'air') {
        setEaten(true); onFed(); setTimeout(() => { setFoodPos(null); setEaten(false); }, 2800);
      } else setFoodPos(null);
    };
    window.addEventListener('pointermove', mv as EventListener);
    window.addEventListener('pointerup', up as EventListener);
    return () => { window.removeEventListener('pointermove', mv as EventListener); window.removeEventListener('pointerup', up as EventListener); };
  }, [foodDragging]);

  useEffect(() => {
    if (!brushDragging) return;
    const mv = (e: PointerEvent) => {
      setBrushPos({ x: e.clientX - brushOff.current.x, y: e.clientY - brushOff.current.y });
      const c = catPosRef.current;
      const near = Math.hypot(e.clientX - c.cx, e.clientY - c.cy) < 115 && c.surface === 'floor';
      setBrushNear(near);
      if (near) {
        brushDist.current += Math.abs(e.clientX - brushLastX.current);
        if (brushDist.current >= 42) { brushDist.current = 0; onStroke(); }
      }
      brushLastX.current = e.clientX;
    };
    const up = () => { setBrushDragging(false); setBrushNear(false); brushDist.current = 0; setBrushPos(null); };
    window.addEventListener('pointermove', mv as EventListener);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv as EventListener); window.removeEventListener('pointerup', up); };
  }, [brushDragging]);

  const tools = [
    { key: 'food', angle: -100, dist: 82 },
    { key: 'brush', angle: -155, dist: 82 },
  ];

  return (
    <>
      <style>{`
        @keyframes fanIn {
          0%   { opacity: 0; transform: scale(.25) }
          100% { opacity: 1; transform: scale(1) }
        }
        @keyframes fishSwim {
          0%,100% { transform: translateY(0) rotate(-3deg) }
          35%     { transform: translateY(-3px) rotate(2deg) }
          65%     { transform: translateY(2px) rotate(-2deg) }
        }
        @keyframes bristleShake {
          0%,100% { transform: rotate(0deg) }
          25%     { transform: rotate(-4deg) }
          75%     { transform: rotate(4deg) }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 14px rgba(168,85,247,.5) }
          50%     { box-shadow: 0 0 28px rgba(192,132,252,.85) }
        }
        @keyframes nearPulse {
          0%,100% { transform: scale(1) }
          50%     { transform: scale(1.08) }
        }
        .fan-item { animation: fanIn .22s cubic-bezier(.34,1.56,.64,1) forwards; }
      `}</style>

      {/* Toggle button — lower right */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          right: ANCHOR_RX - 22,
          bottom: ANCHOR_BY - 22,
          zIndex: 76,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: open
            ? 'linear-gradient(135deg,#f97316,#ec4899)'
            : 'rgba(15,15,20,.72)',
          border: `1.5px solid ${open ? 'rgba(251,146,60,.4)' : 'rgba(255,255,255,.14)'}`,
          boxShadow: open
            ? '0 0 22px rgba(249,115,22,.55), 0 4px 12px rgba(0,0,0,.45)'
            : '0 2px 10px rgba(0,0,0,.5)',
          cursor: 'pointer',
          fontSize: 20,
          transition: 'all .22s cubic-bezier(.34,1.56,.64,1)',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        🐾
      </button>

      {open && tools.map((t, i) => {
        const anchor = getAnchor();
        const rad = t.angle * Math.PI / 180;
        const tx = anchor.x + Math.cos(rad) * t.dist;
        const ty = anchor.y + Math.sin(rad) * t.dist;

        const isF = t.key === 'food';
        const isDrag = isF ? foodDragging : brushDragging;
        const cur = isF ? foodPos : brushPos;
        const near = isF ? foodNear : brushNear;

        const dx = cur ? cur.x : tx - 26;
        const dy = cur ? cur.y : ty - 26;

        if (isF && eaten) return null;

        const label = isF
          ? (near ? 'drop here!' : 'drag to feed')
          : (brushNear ? 'brushing! ↔' : 'drag to groom');

        return (
          <div
            key={t.key}
            className={cur ? '' : 'fan-item'}
            style={{
              animationDelay: `${i * .065}s`,
              position: 'fixed',
              left: dx,
              top: dy,
              zIndex: 78,
              cursor: isDrag ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
              transition: cur ? 'none' : 'filter .15s',
              animation: near && !cur ? 'nearPulse .6s ease-in-out infinite' : (cur ? 'none' : undefined),
            }}
            onPointerDown={e => {
              e.preventDefault();
              if (isF) {
                foodOff.current = { x: e.clientX - (cur ? cur.x : tx - 26), y: e.clientY - (cur ? cur.y : ty - 26) };
                setFoodDragging(true);
                setFoodPos({ x: e.clientX - foodOff.current.x, y: e.clientY - foodOff.current.y });
              } else {
                brushLastX.current = e.clientX;
                brushDist.current = 0;
                brushOff.current = { x: e.clientX - (cur ? cur.x : tx - 26), y: e.clientY - (cur ? cur.y : ty - 26) };
                setBrushDragging(true);
                setBrushPos({ x: e.clientX - brushOff.current.x, y: e.clientY - brushOff.current.y });
              }
            }}
          >
            {/* Glass card */}
            <div style={{
              background: near
                ? 'rgba(88,28,135,.28)'
                : 'rgba(10,10,18,.68)',
              border: `1.5px solid ${near ? 'rgba(192,132,252,.55)' : 'rgba(255,255,255,.14)'}`,
              borderRadius: 18,
              padding: '10px 12px 7px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              minWidth: 64,
              boxShadow: near
                ? '0 0 20px rgba(168,85,247,.5), 0 4px 16px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08)'
                : isDrag
                  ? '0 8px 24px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)'
                  : '0 4px 14px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)',
              transition: 'box-shadow .18s, border-color .18s, background .18s',
            }}>
              {/* Icon */}
              <div style={{
                filter: near
                  ? 'drop-shadow(0 0 8px rgba(192,132,252,.9))'
                  : isDrag
                    ? 'drop-shadow(0 4px 10px rgba(0,0,0,.6))'
                    : 'drop-shadow(0 2px 4px rgba(0,0,0,.5))',
                transition: 'filter .15s',
              }}>
                {isF
                  ? <FishIcon size={46} animate={!isDrag} />
                  : <BrushIcon size={46} animate={!isDrag} glowing={brushNear} />
                }
              </div>
              {/* Label */}
              <span style={{
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '.4px',
                textTransform: 'uppercase',
                color: near ? 'rgba(216,180,254,.95)' : 'rgba(255,255,255,.38)',
                whiteSpace: 'nowrap',
                transition: 'color .15s',
              }}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
