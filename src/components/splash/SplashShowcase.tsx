import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Target, Newspaper, Users, UserPlus, PenLine, Gamepad2,
  Search, CalendarCheck, Check, Circle, Hash, Medal, Sparkles, Play,
  type LucideIcon,
} from 'lucide-react';

// The hero "slides": one mock screen per thing you can do in Velvet. They
// auto-advance, pause on hover, and can be picked from the tab rail.

type Slide = {
  id: string;
  icon: LucideIcon;
  label: string;
  title: string;
  caption: string;
  accent: string;
  Screen: () => ReactNode;
};

const SLIDE_MS = 6000;

// Children of a slide fade up one after another.
const item = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.15 + i * 0.22, duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
});

function Bubble({ from, children, accent }: { from: 'me' | 'them'; children: ReactNode; accent: string }) {
  const me = from === 'me';
  return (
    <div className={`flex ${me ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed ${me ? 'rounded-br-md' : 'rounded-bl-md'}`}
        style={
          me
            ? { background: `rgba(${accent},0.2)`, border: `1px solid rgba(${accent},0.22)`, color: '#f0eeff' }
            : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#d4d0f0' }
        }
      >
        {children}
      </div>
    </div>
  );
}

function Chip({ icon: Icon, children, accent }: { icon: LucideIcon; children: ReactNode; accent: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
      style={{ background: `rgba(${accent},0.1)`, border: `1px solid rgba(${accent},0.22)`, color: `rgb(${accent})` }}
    >
      <Icon className="w-3 h-3" />
      {children}
    </span>
  );
}

function Initials({ name, hue }: { name: string; hue: number }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue + 40} 70% 45%))` }}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function AtlasScreen() {
  const a = '192,132,252';
  return (
    <div className="flex flex-col gap-3">
      <motion.div {...item(0)}>
        <Bubble from="me" accent={a}>Find a 10K in Chicago this spring and put it on my calendar.</Bubble>
      </motion.div>
      <motion.div {...item(1)}>
        <Bubble from="them" accent={a}>
          Found three. The Lakefront 10K on April 12 lines up best with your training plan, so I added it.
          Want me to remind you to register this Friday?
        </Bubble>
      </motion.div>
      <motion.div {...item(2)} className="flex flex-wrap gap-2">
        <Chip icon={Search} accent={a}>Searched the web</Chip>
        <Chip icon={CalendarCheck} accent="52,211,153">Added Apr 12 · 8:00 AM</Chip>
      </motion.div>
      <motion.div {...item(3)}>
        <Bubble from="me" accent={a}>Yes please. And find a running group near me.</Bubble>
      </motion.div>
    </div>
  );
}

function CoachScreen() {
  const a = '52,211,153';
  const steps = [
    { done: true, text: 'Tue · 4 mi easy' },
    { done: true, text: 'Thu · intervals' },
    { done: false, text: 'Sat · 5K tempo', due: 'tomorrow' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        {...item(0)}
        className="rounded-2xl p-3.5"
        style={{ background: `rgba(${a},0.07)`, border: `1px solid rgba(${a},0.2)` }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-white text-[13px] font-semibold">Run a half marathon</p>
            <p className="text-[11px]" style={{ color: 'rgba(202,197,240,0.6)' }}>with Coach Maya · week 5 of 12</p>
          </div>
          <span className="text-[13px] font-bold" style={{ color: `rgb(${a})` }}>42%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, rgb(${a}), #2dd4bf)` }}
            initial={{ width: 0 }}
            animate={{ width: '42%' }}
            transition={{ delay: 0.5, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </motion.div>
      <motion.div {...item(1)}>
        <Bubble from="them" accent={a}>Two runs down this week. Is tomorrow&apos;s 5K still on, or should we move it?</Bubble>
      </motion.div>
      <motion.div {...item(2)} className="flex flex-col gap-1.5">
        {steps.map(s => (
          <div key={s.text} className="flex items-center gap-2.5 text-[12px]">
            {s.done
              ? <Check className="w-3.5 h-3.5" style={{ color: `rgb(${a})` }} />
              : <Circle className="w-3.5 h-3.5 text-amber-300" />}
            <span className={s.done ? 'text-gray-400 line-through decoration-white/20' : 'text-white'}>{s.text}</span>
            {s.due && <span className="ml-auto text-[10px] font-semibold text-amber-300">due {s.due}</span>}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

function FeedScreen() {
  const stories = [
    { tag: 'AI & ML', accent: '192,132,252', title: 'The small models quietly running your phone', min: 4 },
    { tag: 'Basketball', accent: '251,146,60', title: 'Why the corner three became the most valuable shot', min: 6 },
    { tag: 'Lo-fi', accent: '45,212,191', title: 'Bedroom producers on the albums that shaped them', min: 5 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        {...item(0)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11.5px]"
        style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', color: '#fde68a' }}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Good morning. 3 events today, 1 check-in due, and 12 new stories for you.
      </motion.div>
      {stories.map((s, i) => (
        <motion.div
          key={s.title}
          {...item(i + 1)}
          className="flex items-center gap-3 p-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-12 h-12 rounded-lg flex-shrink-0"
            style={{ background: `linear-gradient(135deg, rgba(${s.accent},0.45), rgba(${s.accent},0.12))` }}
          />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `rgb(${s.accent})` }}>{s.tag}</span>
            <p className="text-white text-[12.5px] font-medium leading-snug truncate">{s.title}</p>
            <p className="text-[10.5px] text-gray-500">{s.min} min read</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function HouseScreen() {
  const a = '56,189,248';
  const msgs = [
    { name: 'Jules', hue: 330, text: 'anyone up for Slime Soccer tonight?' },
    { name: 'Dre', hue: 200, text: "I'm in after 9 🎮" },
    { name: 'Sam', hue: 140, text: 'same. loser picks the next game' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <motion.div {...item(0)} className="flex items-center justify-between">
        <div>
          <p className="text-white text-[14px] font-semibold">Gaming Lounge</p>
          <p className="text-[11px]" style={{ color: 'rgba(202,197,240,0.6)' }}>Matched from your interests</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {[330, 200, 140, 40].map(h => (
              <div key={h} className="w-6 h-6 rounded-full border-2" style={{ borderColor: '#14122a', background: `hsl(${h} 70% 55%)` }} />
            ))}
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />4 here now
          </span>
        </div>
      </motion.div>
      <motion.div {...item(1)} className="flex gap-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] text-white" style={{ background: `rgba(${a},0.14)`, border: `1px solid rgba(${a},0.3)` }}>
          <Hash className="w-3 h-3" />general
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] text-gray-400" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Hash className="w-3 h-3" />looking-for-group
          <span className="px-1.5 rounded-full text-[9.5px] font-bold text-white" style={{ background: '#f43f6b' }}>2</span>
        </span>
      </motion.div>
      {msgs.map((m, i) => (
        <motion.div key={m.name} {...item(i + 2)} className="flex items-start gap-2.5">
          <Initials name={m.name} hue={m.hue} />
          <div>
            <p className="text-[11px] font-semibold text-white">{m.name}</p>
            <p className="text-[12.5px] text-gray-300">{m.text}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function PeopleScreen() {
  const a = '244,114,182';
  const people = [
    { name: 'Priya', hue: 280, where: 'Chicago', shared: ['Running', 'Jazz', 'Startups'], following: false },
    { name: 'Marcus', hue: 190, where: 'Atlanta', shared: ['Anime', 'Hip-Hop'], following: true },
    { name: 'Lena', hue: 30, where: 'Austin', shared: ['Cooking', 'Hiking', 'Podcasts'], following: false },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <motion.p {...item(0)} className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: `rgb(${a})` }}>
        People who share your interests
      </motion.p>
      {people.map((p, i) => (
        <motion.div
          key={p.name}
          {...item(i + 1)}
          className="flex items-center gap-3 p-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Initials name={p.name} hue={p.hue} />
          <div className="min-w-0 flex-1">
            <p className="text-white text-[12.5px] font-semibold">{p.name} <span className="font-normal text-gray-500">· {p.where}</span></p>
            <div className="flex flex-wrap gap-1 mt-1">
              {p.shared.map(s => (
                <span key={s} className="px-1.5 py-0.5 rounded-md text-[10px]" style={{ background: `rgba(${a},0.1)`, color: '#fbcfe8' }}>{s}</span>
              ))}
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0"
            style={p.following
              ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#cac5f0' }
              : { background: `rgba(${a},0.18)`, border: `1px solid rgba(${a},0.35)`, color: '#fff' }}
          >
            {p.following ? <Check className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
            {p.following ? 'Following' : 'Follow'}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function CoAuthorScreen() {
  const a = '52,211,153';
  return (
    <div className="flex flex-col gap-3">
      <motion.div {...item(0)}>
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-gray-500 font-semibold">Chapter 3</p>
        <p className="text-white text-[15px] font-semibold" style={{ fontFamily: "'Lora', Georgia, serif" }}>The Letter</p>
      </motion.div>
      <motion.p {...item(1)} className="text-[12.5px] leading-relaxed text-gray-300" style={{ fontFamily: "'Lora', Georgia, serif" }}>
        The envelope had been under the door for three days before Nora finally opened it. Her name was written
        in handwriting she hadn&apos;t seen since the summer everything changed.
      </motion.p>
      <motion.div
        {...item(2)}
        className="rounded-xl p-3"
        style={{ background: `rgba(${a},0.07)`, border: `1px dashed rgba(${a},0.35)` }}
      >
        <p className="text-[10.5px] font-semibold mb-1 flex items-center gap-1" style={{ color: `rgb(${a})` }}>
          <PenLine className="w-3 h-3" /> Co-Author suggests
        </p>
        <p className="text-[12.5px] leading-relaxed italic text-gray-200" style={{ fontFamily: "'Lora', Georgia, serif" }}>
          Inside was a single photograph, and on the back, an address she was never supposed to find.
        </p>
        <div className="flex gap-2 mt-2.5">
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white" style={{ background: `rgba(${a},0.25)` }}>Keep it</span>
          <span className="px-2.5 py-1 rounded-lg text-[11px] text-gray-400" style={{ background: 'rgba(255,255,255,0.05)' }}>Try another</span>
        </div>
      </motion.div>
    </div>
  );
}

function ArcadeScreen() {
  const games = [
    { name: 'Checkers', hue: 350 },
    { name: 'Momentum', hue: 265 },
    { name: 'Slime Soccer', hue: 145 },
    { name: 'Stellar Pursuit', hue: 210 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {games.map((g, i) => (
          <motion.div
            key={g.name}
            {...item(i * 0.6)}
            className="relative rounded-xl p-3 h-[76px] flex flex-col justify-end overflow-hidden"
            style={{ background: `linear-gradient(140deg, hsl(${g.hue} 70% 45% / 0.55), hsl(${g.hue + 30} 70% 30% / 0.25))`, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Play className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-white/60" />
            <p className="text-white text-[12.5px] font-semibold">{g.name}</p>
          </motion.div>
        ))}
      </div>
      <motion.div
        {...item(3)}
        className="flex items-center gap-3 p-3 rounded-xl"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(251,191,36,0.18)' }}>
          <Medal className="w-4 h-4 text-amber-300" />
        </div>
        <div>
          <p className="text-amber-200 text-[12px] font-semibold">Medal unlocked: First Win</p>
          <p className="text-[11px] text-gray-400">It&apos;s on your profile for your friends to see.</p>
        </div>
      </motion.div>
    </div>
  );
}

const SLIDES: Slide[] = [
  { id: 'atlas', icon: Compass, label: 'Atlas', title: 'Atlas', caption: 'Your assistant. Searches, plans, and books it on your calendar.', accent: '192,132,252', Screen: AtlasScreen },
  { id: 'coach', icon: Target, label: 'Coaches', title: 'Your coach', caption: 'Turns a goal into a plan, then checks in so you follow through.', accent: '52,211,153', Screen: CoachScreen },
  { id: 'feed', icon: Newspaper, label: 'Daily Feed', title: 'Today', caption: 'Your morning brief and stories picked for what you care about.', accent: '251,191,36', Screen: FeedScreen },
  { id: 'house', icon: Users, label: 'Community', title: 'The House', caption: 'Spaces with live rooms, already matched to your interests.', accent: '56,189,248', Screen: HouseScreen },
  { id: 'people', icon: UserPlus, label: 'Meet people', title: 'Discover', caption: 'Real people who are into the same things you are.', accent: '244,114,182', Screen: PeopleScreen },
  { id: 'coauthor', icon: PenLine, label: 'Co-Author', title: 'Co-Author', caption: 'Write stories, scripts, and worlds with a partner who never runs dry.', accent: '52,211,153', Screen: CoAuthorScreen },
  { id: 'arcade', icon: Gamepad2, label: 'Arcade', title: 'The Arcade', caption: 'Quick games, medals to earn, and something to do together.', accent: '251,146,60', Screen: ArcadeScreen },
];

export function SplashShowcase({ lite, still }: { lite: boolean; still: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[index];
  const autoplay = !still && !paused;

  useEffect(() => {
    if (!autoplay) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [autoplay, index]);

  const Icon = slide.icon;

  return (
    <div
      className="w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Device frame */}
      <div
        className="relative rounded-[28px] p-[1px]"
        style={{
          background: `linear-gradient(160deg, rgba(${slide.accent},0.45), rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.03))`,
          boxShadow: `0 40px 120px -40px rgba(${slide.accent},0.45), 0 30px 80px -30px rgba(0,0,0,0.8)`,
          transition: 'background 0.6s ease, box-shadow 0.6s ease',
        }}
      >
        <div
          className="rounded-[27px] overflow-hidden"
          style={{ background: 'rgba(16,14,34,0.92)', backdropFilter: lite ? undefined : 'blur(24px)' }}
        >
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: `rgba(${slide.accent},0.16)`, border: `1px solid rgba(${slide.accent},0.3)` }}
            >
              <Icon className="w-4 h-4" style={{ color: `rgb(${slide.accent})` }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="min-w-0"
              >
                <p className="text-white text-[13px] font-semibold leading-tight">{slide.title}</p>
                <p className="text-[11px] truncate" style={{ color: 'rgba(202,197,240,0.55)' }}>{slide.caption}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative px-5 py-5 h-[370px] sm:h-[330px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
              >
                <slide.Screen />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tab rail */}
      <div className="mt-5 flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Preview a feature">
        {SLIDES.map((s, i) => {
          const active = i === index;
          const TabIcon = s.icon;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => setIndex(i)}
              className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={{
                background: active ? `rgba(${s.accent},0.12)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? `rgba(${s.accent},0.35)` : 'rgba(255,255,255,0.08)'}`,
                color: active ? '#fff' : 'rgba(202,197,240,0.6)',
              }}
            >
              <TabIcon className="w-3.5 h-3.5" style={{ color: active ? `rgb(${s.accent})` : undefined }} />
              {s.label}
              {active && autoplay && (
                <motion.span
                  key={`${s.id}-progress`}
                  className="absolute left-0 bottom-0 h-[2px]"
                  style={{ background: `rgb(${s.accent})` }}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: SLIDE_MS / 1000, ease: 'linear' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
