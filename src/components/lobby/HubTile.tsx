import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

export type HubTileSize = 'large' | 'medium' | 'small' | 'wide';

export interface HubTileProps {
  label: string;
  desc: string;
  subDesc?: string;
  icon: LucideIcon;
  /** Feature accent (hex). Variant B tints the tile with it; both variants use it for the loading splash. */
  accent: string;
  /** Legacy solid background used by variant A (the current design). */
  solidBg: string;
  /** Variant-A light tile (dark text on a pale background). */
  light?: boolean;
  size?: HubTileSize;
  locked?: boolean;
  /** Small counter in the top-right corner. */
  count?: number;
  /** Tag rendered under the description (e.g. "AI Agent"). */
  tag?: ReactNode;
  onClick: () => void;
  delay?: number;
  className?: string;
}

/**
 * Feature entry tile for the Velvet Lobby hub.
 * Variant A renders the saturated solid tile the lobby ships with today;
 * variant B renders an accent-tinted glass tile on the shared surface.
 */
export function HubTile({
  label, desc, subDesc, icon: Icon, accent, solidBg, light, size = 'small',
  locked, count, tag, onClick, delay = 0, className = '',
}: HubTileProps) {
  const style = {
    '--ds-tile-accent': accent,
    '--ds-tile-solid': solidBg,
  } as React.CSSProperties;

  const pad = size === 'large' || size === 'medium' ? 'p-6' : size === 'wide' ? 'p-5' : 'p-4';
  const minH = size === 'large' || size === 'medium' ? 140 : size === 'wide' ? 90 : 100;
  const iconBox = size === 'small' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'small' ? 'w-4 h-4' : 'w-5 h-5';

  const inline = size === 'small' || size === 'wide';

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      data-tone={light ? 'light' : undefined}
      data-interactive
      className={`ds-tile ds-focus group w-full ${pad} ${locked ? 'opacity-60' : ''} ${className}`}
      style={{ ...style, minHeight: minH }}
      aria-label={label}
    >
      {inline ? (
        <>
          <div className={`flex items-center gap-3 ${size === 'small' ? 'mb-2' : ''}`}>
            <span className={`ds-tile-icon ${iconBox}`}><Icon className={iconSize} /></span>
            <div className="min-w-0">
              <h3 className={`ds-tile-title ${size === 'wide' ? 'text-base' : 'text-sm'}`}>{label}</h3>
              {size === 'wide' && <p className="ds-tile-desc text-sm mt-0.5">{desc}</p>}
            </div>
          </div>
          {size === 'small' && <p className="ds-tile-desc text-xs leading-relaxed pl-0.5">{desc}</p>}
        </>
      ) : (
        <>
          <div className="flex items-start gap-4">
            <span className={`ds-tile-icon ${iconBox}`}><Icon className={iconSize} /></span>
            <div className="min-w-0">
              <h3 className="ds-tile-title text-lg">{label}</h3>
              <p className="ds-tile-desc text-sm mt-0.5">{desc}</p>
            </div>
          </div>
          {subDesc && <p className="ds-tile-desc text-sm leading-relaxed mt-4 opacity-80">{subDesc}</p>}
        </>
      )}

      {tag && <div className="mt-2">{tag}</div>}

      {typeof count === 'number' && count > 0 && (
        <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.20)', color: 'var(--ds-tile-fg, #fff)' }}>
          {count}
        </span>
      )}
    </motion.button>
  );
}
