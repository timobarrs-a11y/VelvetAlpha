import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Sparkles, ShieldCheck, BadgeCheck, Flag,
  Compass, CalendarDays, MapPin, Target, ClipboardCheck, TrendingUp,
  Users, UserPlus, PenLine, Newspaper, Home, MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanions } from '../services/companionService';
import { SplashShowcase } from '../components/splash/SplashShowcase';
import { VelvetHomeSection } from '../components/splash/VelvetHomeSection';

const DISPLAY_FONT = "'Bricolage Grotesque', 'Space Grotesk', system-ui, sans-serif";

const ORBS = [
  { x: '-10%', y: '-12%', w: 760, h: 760, color: 'rgba(192,132,252,0.16)', blur: 150 },
  { x: '55%', y: '-6%', w: 620, h: 620, color: 'rgba(244,63,107,0.12)', blur: 140 },
  { x: '30%', y: '38%', w: 700, h: 520, color: 'rgba(56,189,248,0.08)', blur: 150 },
];

type Pillar = {
  id: string;
  kicker: string;
  title: string;
  blurb: string;
  accent: string;
  items: { icon: LucideIcon; name: string; text: string }[];
};

const PILLARS: Pillar[] = [
  {
    id: 'do',
    kicker: 'Get things done',
    title: 'An assistant that actually does the thing.',
    blurb: 'Ask in plain words. Atlas searches, plans, and puts it on your calendar.',
    accent: '192,132,252',
    items: [
      { icon: Compass, name: 'Atlas', text: 'Searches the web in real time, manages your calendar, remembers what you like, and takes you anywhere in the app.' },
      { icon: CalendarDays, name: 'Calendar & Morning Brief', text: 'Your events, goals, and headlines in one brief before your day starts.' },
      { icon: MapPin, name: 'Navi', text: 'Local events, restaurants, and things to do, filtered to your city and taste.' },
    ],
  },
  {
    id: 'grow',
    kicker: 'Grow',
    title: 'Coaches that keep you moving.',
    blurb: 'Tell Atlas what you are working toward. You leave with a plan and someone in your corner.',
    accent: '52,211,153',
    items: [
      { icon: Target, name: 'Coaches', text: 'Domain-trained coaches for fitness, career, money, creativity, and more, matched to your goal.' },
      { icon: ClipboardCheck, name: 'Check-ins', text: 'Gentle, moderate, or firm. Your coach follows up on what you said you would do.' },
      { icon: TrendingUp, name: 'Goals & Insights', text: 'See your progress, streaks, and the patterns behind them.' },
    ],
  },
  {
    id: 'connect',
    kicker: 'Connect',
    title: 'Real people who get it.',
    blurb: 'Velvet already knows what you are into, so it puts you where your crowd is.',
    accent: '56,189,248',
    items: [
      { icon: Users, name: 'Community Board', text: 'Spaces with live rooms and posts, matched to your interests from day one.' },
      { icon: UserPlus, name: 'Meet people', text: 'Find members who share your interests and goals. Follow, message, and start a crew.' },
      { icon: MessageCircle, name: 'Statuses & Your Feed', text: 'Post what you are up to. Friends like and comment, and your wins show up alongside.' },
    ],
  },
  {
    id: 'live',
    kicker: 'Live & create',
    title: 'A home of your own, and things worth making.',
    blurb: 'A house in town, a life inside it, a feed worth reading, and stories worth writing.',
    accent: '251,146,60',
    items: [
      { icon: Home, name: 'Velvet House & Velvet Sims', text: 'Your house on a real street in town, and the cozy life sim that happens inside it.' },
      { icon: Newspaper, name: 'Daily Feed & Lens', text: 'Articles and videos on your topics only. No chasing clicks.' },
      { icon: PenLine, name: 'Co-Author', text: 'Write stories, scripts, and worlds together on a shared canvas.' },
    ],
  },
];

const STEPS = [
  { n: '01', title: 'Tell us what you are into', text: 'A few quick questions about your interests, your goals, and how you like to be supported.' },
  { n: '02', title: 'Meet Atlas', text: 'Atlas turns what you are working toward into a plan and matches you with the right coach.' },
  { n: '03', title: 'Move in', text: 'Pick your house in town and walk into spaces with people who are into the same things. Say hi.' },
];

const SPACES = [
  { emoji: '🎮', name: 'Gaming Lounge', line: 'Best plays, worst fails.' },
  { emoji: '🏀', name: 'Sports Talk', line: 'Hot takes welcome.' },
  { emoji: '💪', name: 'Fitness & Motivation', line: 'Find people to train with.' },
  { emoji: '🎬', name: 'Movies, Music & Pop Culture', line: 'What are you watching?' },
  { emoji: '💼', name: 'Career & Money', line: 'Moves, raises, side hustles.' },
  { emoji: '🍳', name: 'Cooking & Recipes', line: 'Share what you made.' },
  { emoji: '📚', name: 'Books & Writing', line: 'Reading lists and first drafts.' },
  { emoji: '✈️', name: 'Travel & Adventure', line: 'Where to next?' },
];

const INTERESTS = [
  'Running', 'Anime', 'Hip-Hop', 'Startups', 'Cooking', 'Photography', 'Jazz', 'Board Games',
  'AI & ML', 'Hiking', 'Basketball', 'Lo-fi', 'Podcasts', 'Yoga', 'Manga', 'Travel',
  'Programming', 'Stand-up Comedy', 'Fitness', 'Writing', 'Gaming', 'Science', 'Fashion', 'R&B',
];

const TRUST = [
  { icon: ShieldCheck, title: 'Private by design', text: 'Your conversations are encrypted. Export or delete everything anytime from Settings.' },
  { icon: BadgeCheck, title: 'AI is always labeled', text: 'Bots in the community wear a badge, so you always know when you are talking to a person.' },
  { icon: Flag, title: 'Spaces that stay kind', text: 'Moderation, reporting, and blocking are built in. Crews can lock their doors.' },
];

function Eyebrow({ children, accent = '192,132,252' }: { children: ReactNode; accent?: string }) {
  return (
    <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4" style={{ color: `rgb(${accent})` }}>
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2
      className="text-white"
      style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 'clamp(32px, 4.6vw, 52px)', letterSpacing: '-0.035em', lineHeight: 1.04 }}
    >
      {children}
    </h2>
  );
}

function InterestRow({ items, reverse, still }: { items: string[]; reverse?: boolean; still: boolean }) {
  const chips = (keyPrefix: string) =>
    items.map(i => (
      <span
        key={`${keyPrefix}-${i}`}
        className="flex-shrink-0 px-4 py-2 rounded-full text-sm text-gray-300 whitespace-nowrap"
        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {i}
      </span>
    ));
  if (still) return <div className="flex flex-wrap justify-center gap-2.5">{chips('a')}</div>;
  return (
    <div className="overflow-hidden" style={{ maskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
      <motion.div
        className="flex gap-2.5 w-max"
        animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
      >
        {chips('a')}
        {chips('b')}
      </motion.div>
    </div>
  );
}

export function SplashPage() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const reduceMotion = useReducedMotion() ?? false;

  const lite = useMemo(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches,
    []
  );
  const still = reduceMotion;
  const orbBlur = (b: number) => (lite ? Math.min(b, 40) : b);
  const rise = (delay = 0) =>
    still
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
        const user = await Promise.race([
          supabase.auth.getUser().then(r => r.data.user),
          timeout,
        ]);
        if (user) {
          const companions = await getCompanions(user.id);
          if (companions.length === 0 && sessionStorage.getItem('currentCompanionId') && sessionStorage.getItem('matchAnswers')) {
            navigate('/voice-selection', { replace: true });
            return;
          }
          navigate('/lobby', { replace: true });
          return;
        }
        setIsChecking(false);
      } catch {
        setIsChecking(false);
      }
    };
    checkUserStatus();
  }, [navigate]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--ds-bg-base)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500" />
      </div>
    );
  }

  const primaryCta = (label: string) => (
    <motion.button
      onClick={() => navigate('/signup')}
      whileTap={{ scale: 0.97 }}
      className="group relative inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl text-white font-semibold text-base overflow-hidden"
      style={{
        background: 'linear-gradient(135deg,#a855f7,#ec4899)',
        boxShadow: '0 10px 40px -10px rgba(236,72,153,0.6), inset 0 1px 0 rgba(255,255,255,0.25)',
      }}
    >
      <span className="relative z-10">{label}</span>
      <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
    </motion.button>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white" style={{ background: 'var(--ds-bg-page)', backgroundColor: 'var(--ds-bg-base)' }}>

      {/* Grain */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '160px',
        }}
      />

      {/* Aurora */}
      <div className="absolute inset-x-0 top-0 h-[1400px] pointer-events-none overflow-hidden">
        {ORBS.map((o, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: o.x, top: o.y, width: o.w, height: o.h, borderRadius: '50%', background: o.color, filter: `blur(${orbBlur(o.blur)}px)` }}
            animate={still || lite ? undefined : { x: [0, i % 2 ? -40 : 40, 0], y: [0, 24, 0] }}
            transition={{ duration: 26 + i * 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Nav */}
      <header
        className="fixed top-0 inset-x-0 z-50"
        style={{
          background: lite ? 'rgba(12,11,24,0.92)' : 'rgba(12,11,24,0.6)',
          backdropFilter: lite ? undefined : 'blur(20px) saturate(140%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-6xl mx-auto h-14 px-5 flex items-center justify-between gap-4">
          <span className="text-sm font-bold tracking-[0.18em] uppercase">
            Project <span style={{ color: '#c084fc' }}>Velvet</span>
          </span>
          <nav className="hidden md:flex items-center gap-7 text-sm text-gray-400">
            <button onClick={() => scrollTo('inside')} className="hover:text-white transition-colors">What's inside</button>
            <button onClick={() => scrollTo('home')} className="hover:text-white transition-colors">Velvet House</button>
            <button onClick={() => scrollTo('community')} className="hover:text-white transition-colors">Community Board</button>
            <button onClick={() => scrollTo('how')} className="hover:text-white transition-colors">How it works</button>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="px-3.5 py-1.5 rounded-full text-sm text-gray-300 hover:text-white transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)' }}
            >
              Join free
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-5 pt-28 md:pt-36 pb-20 grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-12 items-center">
          <motion.div
            initial={still ? false : { opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 text-center lg:text-left"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
              style={{ background: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.28)' }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: '#c084fc' }} />
              <span className="text-xs font-semibold tracking-wide" style={{ color: '#d8b4fe' }}>Now in early access</span>
            </div>

            <h1
              style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 'clamp(42px, 5.2vw, 70px)', letterSpacing: '-0.045em', lineHeight: 0.98 }}
            >
              <span className="block lg:whitespace-nowrap">Reach your goals.</span>
              <span
                className="block pb-2 lg:whitespace-nowrap"
                style={{
                  background: 'linear-gradient(120deg,#f472b6 0%,#c084fc 45%,#818cf8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Find your crowd.
              </span>
            </h1>

            <p className="mt-6 text-gray-300 max-w-xl mx-auto lg:mx-0" style={{ fontSize: 'clamp(17px, 1.6vw, 20px)', lineHeight: 1.6 }}>
              Atlas gets things done and your coaches keep you on track. Catch up on a daily feed made for your interests,
              share wins with friends and a community of people into the same things, then take a break with games you
              can play together.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {primaryCta('Create your free account')}
              <button
                onClick={() => scrollTo('inside')}
                className="inline-flex items-center justify-center px-7 py-4 rounded-2xl font-semibold text-base text-gray-200 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                See what's inside
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">Free to start. No credit card required.</p>
          </motion.div>

          <motion.div
            initial={still ? false : { opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="min-w-0 w-full max-w-[520px] mx-auto"
          >
            <SplashShowcase lite={lite} still={still} />
          </motion.div>
        </section>

        {/* Interests marquee */}
        <section className="pb-24">
          <motion.p {...rise()} className="text-center text-sm text-gray-500 mb-6">
            Whatever you are into, there are people here who are into it too.
          </motion.p>
          <div className="flex flex-col gap-3">
            <InterestRow items={INTERESTS.slice(0, 12)} still={still} />
            <InterestRow items={INTERESTS.slice(12)} reverse still={still} />
          </div>
        </section>

        {/* What's inside */}
        <section id="inside" className="max-w-6xl mx-auto px-5 pb-28 scroll-mt-20">
          <motion.div {...rise()} className="max-w-2xl mb-12">
            <Eyebrow>What's inside</Eyebrow>
            <SectionTitle>Everything you need to grow, and people to grow with.</SectionTitle>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {PILLARS.map((p, pi) => (
              <motion.article
                key={p.id}
                {...rise(still ? 0 : (pi % 2) * 0.1)}
                className="relative rounded-[24px] p-7 md:p-8 overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, rgba(${p.accent},0.09), rgba(255,255,255,0.02) 55%)`,
                  border: `1px solid rgba(${p.accent},0.18)`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, rgba(${p.accent},0.22), transparent 70%)` }}
                />
                <p className="relative text-[11px] font-bold tracking-[0.2em] uppercase mb-3" style={{ color: `rgb(${p.accent})` }}>{p.kicker}</p>
                <h3 className="relative text-white text-2xl font-bold tracking-tight mb-2" style={{ fontFamily: DISPLAY_FONT, letterSpacing: '-0.02em' }}>{p.title}</h3>
                <p className="relative text-gray-400 text-[15px] leading-relaxed mb-6">{p.blurb}</p>
                <ul className="relative flex flex-col gap-4">
                  {p.items.map(({ icon: Icon, name, text }) => (
                    <li key={name} className="flex gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `rgba(${p.accent},0.12)`, border: `1px solid rgba(${p.accent},0.25)` }}
                      >
                        <Icon className="w-[18px] h-[18px]" style={{ color: `rgb(${p.accent})` }} />
                      </div>
                      <div>
                        <p className="text-white text-[15px] font-semibold">{name}</p>
                        <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </section>

        <VelvetHomeSection rise={rise} />

        {/* Community */}
        <section id="community" className="relative scroll-mt-20 py-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(56,189,248,0.04) 30%, rgba(244,114,182,0.04) 70%, transparent)' }}>
          <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[1fr_1.15fr] gap-12 items-center">
            <motion.div {...rise()}>
              <Eyebrow accent="56,189,248">The Community Board</Eyebrow>
              <SectionTitle>Pull up a chair. Your spaces are already waiting.</SectionTitle>
              <p className="mt-5 text-gray-300 text-lg leading-relaxed max-w-lg">
                Your interests place you in the right spaces from day one. Each one has live rooms, a board for longer posts,
                and a list of who is around right now. Like someone? Follow them, send a message, or start a crew together.
              </p>
              <ul className="mt-7 flex flex-col gap-3 text-gray-300">
                {[
                  'Live rooms and boards in every space',
                  'Crews: smaller, private groups inside a space',
                  'Find members by shared interests and goals',
                  'Medals and a progress feed to cheer each other on',
                ].map(t => (
                  <li key={t} className="flex items-center gap-3 text-[15px]">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#38bdf8' }} />
                    {t}
                  </li>
                ))}
              </ul>
            </motion.div>

            <div className="grid grid-cols-2 gap-3">
              {SPACES.map((s, i) => (
                <motion.div
                  key={s.name}
                  {...rise(still ? 0 : (i % 4) * 0.06)}
                  className="rounded-2xl p-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="text-2xl mb-2" aria-hidden>{s.emoji}</div>
                  <p className="text-white text-[15px] font-semibold leading-snug">{s.name}</p>
                  <p className="text-gray-500 text-sm">{s.line}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="max-w-6xl mx-auto px-5 py-24 scroll-mt-20">
          <motion.div {...rise()} className="max-w-2xl mb-12">
            <Eyebrow accent="244,114,182">How it works</Eyebrow>
            <SectionTitle>Up and running in a few minutes.</SectionTitle>
          </motion.div>
          <ol className="grid md:grid-cols-3 gap-5">
            {STEPS.map((s, i) => (
              <motion.li
                key={s.n}
                {...rise(still ? 0 : i * 0.1)}
                className="rounded-[22px] p-7"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p
                  className="mb-5"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontWeight: 800,
                    fontSize: 44,
                    lineHeight: 1,
                    letterSpacing: '-0.04em',
                    background: 'linear-gradient(135deg,#f472b6,#c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {s.n}
                </p>
                <h3 className="text-white text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-gray-400 text-[15px] leading-relaxed">{s.text}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section className="max-w-6xl mx-auto px-5 pb-24">
          <div className="grid md:grid-cols-3 gap-4">
            {TRUST.map(({ icon: Icon, title, text }, i) => (
              <motion.div
                key={title}
                {...rise(still ? 0 : i * 0.08)}
                className="flex gap-4 rounded-2xl p-5"
                style={{ background: 'rgba(52,211,153,0.035)', border: '1px solid rgba(52,211,153,0.14)' }}
              >
                <Icon className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white text-[15px] font-semibold mb-1">{title}</p>
                  <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 text-center text-gray-600 text-xs max-w-xl mx-auto">
            Coaches are AI, not licensed professionals. They offer support and guidance but are not a substitute for medical,
            mental health, financial, or other professional care.
          </p>
        </section>

        {/* Final CTA */}
        <section className="max-w-6xl mx-auto px-5 pb-20">
          <motion.div
            {...rise()}
            className="relative rounded-[32px] px-6 py-16 md:py-20 text-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.12) 50%, rgba(56,189,248,0.1))',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 0%, rgba(255,255,255,0.08), transparent 70%)' }}
            />
            <div className="relative">
              <h2
                className="text-white max-w-3xl mx-auto"
                style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 'clamp(34px, 5vw, 60px)', letterSpacing: '-0.04em', lineHeight: 1.02 }}
              >
                Your next chapter starts with hello.
              </h2>
              <p className="mt-5 text-gray-300 text-lg max-w-xl mx-auto">
                Set a goal, meet your coach, and find your crowd. It takes a few minutes and costs nothing to start.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                {primaryCta('Join Project Velvet')}
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center px-7 py-4 rounded-2xl font-semibold text-base text-gray-200 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                  I already have an account
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <p className="text-sm font-bold tracking-[0.18em] uppercase">
              Project <span style={{ color: '#c084fc' }}>Velvet</span>
            </p>
            <p className="text-gray-600 text-xs mt-1">© {new Date().getFullYear()} Project Velvet. All rights reserved.</p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-500">
            {[
              { label: 'About', to: '/about' },
              { label: 'Changelog', to: '/changelog' },
              { label: 'Support us', to: '/support' },
              { label: 'Terms', to: '/terms' },
              { label: 'Privacy', to: '/privacy' },
            ].map(l => (
              <button key={l.to} onClick={() => navigate(l.to)} className="hover:text-white transition-colors">{l.label}</button>
            ))}
          </nav>
        </div>
        <p className="text-center text-gray-700 text-xs pb-8 px-5">
          By creating an account you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline hover:text-gray-500">Terms of Service</button>
          {' '}and{' '}
          <button onClick={() => navigate('/privacy')} className="underline hover:text-gray-500">Privacy Policy</button>.
        </p>
      </footer>
    </div>
  );
}
