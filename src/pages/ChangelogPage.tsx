import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  ArrowUp,
  Wrench,
  Palette,
  Gamepad2,
  Server,
  Pin,
  GitCommit,
  ChevronDown,
} from 'lucide-react';
import { Footer } from '../components/Footer';
import { fetchChangelog, markEntryRead } from '../services/changelogService';
import type { ChangelogEntryWithRead, ChangelogCategory } from '../types/changelog';
import { CATEGORY_META } from '../types/changelog';

const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  'arrow-up': ArrowUp,
  wrench: Wrench,
  palette: Palette,
  'gamepad-2': Gamepad2,
  server: Server,
};

const FILTERS: { key: ChangelogCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'feature', label: 'Features' },
  { key: 'game', label: 'Game' },
  { key: 'improvement', label: 'Improvements' },
  { key: 'fix', label: 'Fixes' },
  { key: 'design', label: 'Design' },
  { key: 'infra', label: 'Infra' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function renderBody(body: string): string[] {
  return body.split('\n\n').filter(Boolean);
}

export default function ChangelogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<ChangelogEntryWithRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChangelogCategory | 'all'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchChangelog();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleExpand = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          const entry = entries.find((e) => e.id === id);
          if (entry && !entry.is_read) {
            markEntryRead(id);
            setEntries((prev2) =>
              prev2.map((e) => (e.id === id ? { ...e, is_read: true } : e))
            );
          }
        }
        return next;
      });
    },
    [entries]
  );

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.category === filter);
  const pinned = filtered.filter((e) => e.is_pinned);
  const regular = filtered.filter((e) => !e.is_pinned);
  const unreadCount = entries.filter((e) => !e.is_read).length;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background:
          'linear-gradient(170deg, #060d1f 0%, #0a1326 35%, #0a1628 65%, #071020 100%)',
      }}
    >
      {/* Grain texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
        }}
      />

      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-10%',
          left: '30%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.10) 0%, transparent 65%)',
          filter: 'blur(120px)',
        }}
      />

      {/* Sticky top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6"
        style={{
          background: 'rgba(7,9,15,0.72)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <button
          onClick={() => navigate('/')}
          className="text-white text-sm font-bold tracking-[0.18em] uppercase"
          style={{ letterSpacing: '0.18em' }}
        >
          Project <span style={{ color: '#3b82f6' }}>Velvet</span>
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-400 text-xs font-medium transition-all duration-200 hover:text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back</span>
        </button>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-28 pb-8">
        {/* Hero */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.3)',
              }}
            >
              <GitCommit className="w-5 h-5" style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <h1
                className="text-white"
                style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}
              >
                Changelog
              </h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Everything we ship, in the open.
                {unreadCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-blue-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    {unreadCount} new
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200"
                  style={{
                    background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#60a5fa' : 'rgba(255,255,255,0.5)',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-6 animate-pulse"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="h-4 w-24 rounded bg-white/10 mb-3" />
                <div className="h-5 w-3/4 rounded bg-white/8 mb-2" />
                <div className="h-3 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-sm">No entries in this category yet.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div
              className="absolute left-4 top-0 bottom-0 w-px"
              style={{ background: 'linear-gradient(to bottom, rgba(59,130,246,0.3), rgba(59,130,246,0.05))' }}
            />

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {[...pinned, ...regular].map((entry, i) => {
                  const meta = CATEGORY_META[entry.category];
                  const Icon = CATEGORY_ICONS[meta.icon] || Sparkles;
                  const isExpanded = expanded.has(entry.id);
                  const paragraphs = renderBody(entry.body);

                  return (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.05, duration: 0.35 }}
                      className="relative pl-12"
                    >
                      {/* Timeline dot */}
                      <div
                        className="absolute left-0 top-6 w-8 h-8 rounded-full flex items-center justify-center"
                        style={{
                          background: `${meta.color}15`,
                          border: `1.5px solid ${meta.color}50`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                      </div>

                      {/* Card */}
                      <button
                        onClick={() => toggleExpand(entry.id)}
                        className="w-full text-left rounded-2xl p-5 transition-all duration-200 group"
                        style={{
                          background: isExpanded
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${
                            isExpanded ? `${meta.color}30` : 'rgba(255,255,255,0.06)'
                          }`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isExpanded) e.currentTarget.style.borderColor = `${meta.color}25`;
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                        }}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: `${meta.color}15`, color: meta.color }}
                            >
                              {meta.label}
                            </span>
                            {!entry.is_read && (
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            )}
                            {entry.is_pinned && (
                              <Pin className="w-3 h-3 text-amber-400" fill="currentColor" />
                            )}
                          </div>
                          <span className="text-xs text-white/30 flex-shrink-0">
                            {relativeTime(entry.published_at)}
                          </span>
                        </div>

                        {/* Title */}
                        <h3
                          className="text-white font-bold mb-1.5 leading-snug"
                          style={{ fontSize: 'clamp(15px, 2vw, 17px)' }}
                        >
                          {entry.title}
                        </h3>

                        {/* Preview / full body */}
                        <div className="overflow-hidden">
                          {isExpanded ? (
                            <div className="space-y-2.5 mt-3">
                              {paragraphs.map((p, pi) => (
                                <p
                                  key={pi}
                                  className="text-gray-300 font-light leading-relaxed"
                                  style={{ fontSize: '14px', lineHeight: 1.7 }}
                                >
                                  {p}
                                </p>
                              ))}
                              {/* Tags */}
                              {entry.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                  {entry.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="text-[10px] font-mono px-2 py-0.5 rounded-md text-white/40"
                                      style={{ background: 'rgba(255,255,255,0.04)' }}
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-white/25 mt-3 pt-2 border-t border-white/5">
                                {formatDate(entry.published_at)}
                              </div>
                            </div>
                          ) : (
                            <p
                              className="text-gray-400 font-light leading-relaxed line-clamp-2"
                              style={{ fontSize: '13px', lineHeight: 1.6 }}
                            >
                              {paragraphs[0]}
                            </p>
                          )}
                        </div>

                        {/* Expand indicator */}
                        <div className="flex items-center justify-center mt-3">
                          <ChevronDown
                            className="w-4 h-4 text-white/20 transition-transform duration-200"
                            style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                          />
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Footer note */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-gray-600 text-xs font-mono">
            Built in the open. Updated as we ship.
          </p>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
