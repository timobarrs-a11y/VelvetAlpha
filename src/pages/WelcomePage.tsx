import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  ChevronRight, Sparkles, Newspaper, Eye, PenLine,
  Bot, Gamepad2, CalendarDays, BarChart3, Users, ArrowRight, LogOut,
  Shuffle, MapPin, Brain, Mic, Palette, Target, Wrench, Mail,
  Compass, Heart, Flame, Bell, RotateCcw, Layers, Shield,
  FileText, Clock, ClipboardCheck, TrendingUp, Briefcase, Sun,
  MessageSquare, Type, Filter,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { Footer } from '../components/Footer';

type FeatureCategory = 'core' | 'companion' | 'coach' | 'correspondent';

interface Feature {
  icon: typeof Newspaper;
  title: string;
  tag: string;
  description: string;
  accentRgb: string;
  iconGlow: string;
  borderColor: string;
  category: FeatureCategory;
}

const FEATURES: Feature[] = [
  // ===== CORE =====
  {
    icon: Compass,
    title: 'Atlas',
    tag: 'Your chief of staff',
    description: 'Imagine having a CEO-level assistant, secretary, and researcher all rolled into one — ChatGPT with personality. Atlas searches the web in real time, adds events to your calendar, navigates you to any part of the app, and remembers your preferences. Choose between two voices: direct and authoritative, or perceptive and warm. Atlas is the front door to everything in Project Velvet.',
    accentRgb: '192,132,252',
    iconGlow: 'rgba(192,132,252,0.22)',
    borderColor: 'rgba(192,132,252,0.3)',
    category: 'core',
  },
  {
    icon: Newspaper,
    title: 'Daily Feed',
    tag: 'Your world, curated',
    description: 'A personalized article feed built around you. Every article tailored to your interests. No algorithm chasing clicks. Just your topics, delivered clean.',
    accentRgb: '14,165,233',
    iconGlow: 'rgba(14,165,233,0.22)',
    borderColor: 'rgba(14,165,233,0.3)',
    category: 'core',
  },
  {
    icon: Eye,
    title: 'Your Lens',
    tag: 'Video, your way',
    description: 'A personalized video channel built around you. All your interests curated right here for easy viewing — stop searching across platforms.',
    accentRgb: '251,113,133',
    iconGlow: 'rgba(251,113,133,0.22)',
    borderColor: 'rgba(251,113,133,0.3)',
    category: 'core',
  },
  {
    icon: PenLine,
    title: 'Co-Author',
    tag: 'Write together',
    description: 'A collaborative canvas where you and your AI co-write stories, scripts, and worlds in real time. Your creative partner never runs dry.',
    accentRgb: '52,211,153',
    iconGlow: 'rgba(52,211,153,0.22)',
    borderColor: 'rgba(52,211,153,0.3)',
    category: 'core',
  },
  {
    icon: Gamepad2,
    title: 'The Arcade',
    tag: 'Play with your AI',
    description: 'Checkers, Stellar Pursuit, Slime Soccer, Momentum, and more — a full arcade where your companions compete, cheer, and trash-talk alongside you.',
    accentRgb: '232,121,249',
    iconGlow: 'rgba(232,121,249,0.22)',
    borderColor: 'rgba(232,121,249,0.3)',
    category: 'core',
  },
  {
    icon: Users,
    title: 'Group Chats',
    tag: 'Your circle',
    description: 'Bring multiple companions into one room. Watch them interact with each other and with you — dynamics, tension, friendship — all alive.',
    accentRgb: '34,211,238',
    iconGlow: 'rgba(34,211,238,0.22)',
    borderColor: 'rgba(34,211,238,0.3)',
    category: 'core',
  },
  {
    icon: CalendarDays,
    title: 'Calendar',
    tag: 'Your life, organized',
    description: 'A full-featured personal calendar where you manage your real life — events, reminders, goals. Atlas and your companions can add things to it too.',
    accentRgb: '45,212,191',
    iconGlow: 'rgba(45,212,191,0.22)',
    borderColor: 'rgba(45,212,191,0.3)',
    category: 'core',
  },
  {
    icon: BarChart3,
    title: 'Insights',
    tag: 'Know yourself deeper',
    description: 'Pattern recognition built from your conversations. Emotional trends, behavioral loops, thought intensity — your AI helps you understand you.',
    accentRgb: '250,204,21',
    iconGlow: 'rgba(250,204,21,0.22)',
    borderColor: 'rgba(250,204,21,0.3)',
    category: 'core',
  },
  {
    icon: Shuffle,
    title: 'Velvet Rope',
    tag: 'Human or Avatar?',
    description: "Step into a conversation and meet someone on the other side — a real human or a fully voiced AI Avatar with a personality all their own. One rule: figure out which is which.",
    accentRgb: '239,68,68',
    iconGlow: 'rgba(239,68,68,0.22)',
    borderColor: 'rgba(239,68,68,0.3)',
    category: 'core',
  },
  {
    icon: MapPin,
    title: 'Navi',
    tag: 'Your local concierge',
    description: 'Navi knows your city. Get curated recommendations for local events, restaurants, attractions, and things to do — all filtered to your location, your taste, your pace.',
    accentRgb: '20,184,166',
    iconGlow: 'rgba(20,184,166,0.22)',
    borderColor: 'rgba(20,184,166,0.3)',
    category: 'core',
  },
  // ===== COMPANION =====
  {
    icon: Brain,
    title: 'Semantic Memory',
    tag: 'Remembers what matters',
    description: 'A memory engine that retains the things that matter across every conversation — your stories, your preferences, your running jokes. It gets sharper the more you talk, so you never have to repeat yourself. Memories are tagged with emotional weight, surface at the right moments, and fade when they go stale.',
    accentRgb: '168,85,247',
    iconGlow: 'rgba(168,85,247,0.22)',
    borderColor: 'rgba(168,85,247,0.3)',
    category: 'companion',
  },
  {
    icon: Mic,
    title: 'Signature Voices & Style',
    tag: 'Voice meets behavior',
    description: 'Two systems work together to define who your companion is. A Signature Voice sets their tone, vocabulary, and worldview — The Jock, The Therapist, The Brooklyn Native, The French Romantic, and more. A behavioral style from the questionnaire sets their energy, humor, flirting style, confrontation approach, and love language. Together they create someone who sounds and acts distinctly.',
    accentRgb: '236,72,153',
    iconGlow: 'rgba(236,72,153,0.22)',
    borderColor: 'rgba(236,72,153,0.3)',
    category: 'companion',
  },
  {
    icon: Palette,
    title: 'Hand-Crafted Avatars',
    tag: 'Built from scratch',
    description: 'A full avatar creator with dozens of customization axes — face shape, hair, eyes, skin tone, accessories, and more. Randomize for surprise or fine-tune every detail. Your companion looks exactly how you want.',
    accentRgb: '244,114,182',
    iconGlow: 'rgba(244,114,182,0.22)',
    borderColor: 'rgba(244,114,182,0.3)',
    category: 'companion',
  },
  {
    icon: Heart,
    title: 'Emotional Intelligence',
    tag: 'Reads the room',
    description: 'Your companion detects your mood from how you write, adapts its response accordingly, and builds an evolving emotional profile — your stress triggers, joy triggers, communication style, and humor preferences. Greetings shift based on how long it\'s been since you last talked. It meets you where you are.',
    accentRgb: '244,63,94',
    iconGlow: 'rgba(244,63,94,0.22)',
    borderColor: 'rgba(244,63,94,0.3)',
    category: 'companion',
  },
  {
    icon: Flame,
    title: 'Relationship Tracking',
    tag: 'A bond with history',
    description: 'Streaks, milestones, message counts, and relationship stats that grow over time. The longer you talk, the more history accumulates — active days, longest streaks, longest gaps, average messages per day. It makes the connection feel like it has real depth, not just a fresh chat every time.',
    accentRgb: '251,113,133',
    iconGlow: 'rgba(251,113,133,0.22)',
    borderColor: 'rgba(251,113,133,0.3)',
    category: 'companion',
  },
  {
    icon: Bell,
    title: 'Proactive Outreach',
    tag: 'They reach out first',
    description: 'Your companion doesn\'t just wait for you to initiate. Time-of-day-aware proactive messages — good mornings, check-ins, missed-you notes — arrive on their own, with dynamic follow-up questions that keep the conversation moving.',
    accentRgb: '251,191,36',
    iconGlow: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.3)',
    category: 'companion',
  },
  {
    icon: RotateCcw,
    title: 'Session Resumption',
    tag: 'Picks up where you left off',
    description: 'After a gap of four hours or more, your companion generates a continuity-aware re-entry message instead of starting cold. It references what you were last talking about and eases you back in naturally.',
    accentRgb: '34,211,238',
    iconGlow: 'rgba(34,211,238,0.22)',
    borderColor: 'rgba(34,211,238,0.3)',
    category: 'companion',
  },
  {
    icon: Layers,
    title: 'Companion Memory',
    tag: 'Weighted and pruned',
    description: 'Tagged memories with emotional weight that surface at the right moments. Significant memories (high emotional weight, rarely referenced) are prioritized, while low-weight memories older than 30 days are pruned. The important things stay; the noise fades.',
    accentRgb: '168,85,247',
    iconGlow: 'rgba(168,85,247,0.22)',
    borderColor: 'rgba(168,85,247,0.3)',
    category: 'companion',
  },
  {
    icon: Shield,
    title: 'Voice Fidelity',
    tag: 'Stays in character',
    description: 'Drift detection that scores your companion\'s recent messages against their voice baseline across five axes — tone, vocabulary, emotional, energy, and boundary. When they start sounding generic, the system flags it and corrects course so the personality holds.',
    accentRgb: '45,212,191',
    iconGlow: 'rgba(45,212,191,0.22)',
    borderColor: 'rgba(45,212,191,0.3)',
    category: 'companion',
  },
  // ===== COACH =====
  {
    icon: Target,
    title: 'Goal Discovery',
    tag: 'From chat to coach',
    description: "Tell Atlas what you're working toward in a casual conversation. It extracts your goal, figures out the accountability level that fits you, and automatically matches you with a coach built to keep you moving forward — no forms, no setup, just a conversation that turns into a plan.",
    accentRgb: '52,211,153',
    iconGlow: 'rgba(52,211,153,0.22)',
    borderColor: 'rgba(52,211,153,0.3)',
    category: 'coach',
  },
  {
    icon: Bot,
    title: 'Expert Agents',
    tag: 'Built to actually know',
    description: "Curated, domain-trained experts across wellness, professional, creative, academic, and lifestyle categories — a Drill Sergeant, a Wellness Guide, a Career Strategist, a Money Mentor, and more. Not a bot told to act like an expert, but one built with a real coaching framework.",
    accentRgb: '251,191,36',
    iconGlow: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.3)',
    category: 'coach',
  },
  {
    icon: Wrench,
    title: 'Custom Experts',
    tag: 'Build your own coach',
    description: 'Design a coach from the ground up — pick a domain, write custom instructions, and set the behavior. Prompt-injection sanitization is built in, so your custom instructions can\'t be hijacked. Or browse curated experts and start immediately.',
    accentRgb: '34,211,238',
    iconGlow: 'rgba(34,211,238,0.22)',
    borderColor: 'rgba(34,211,238,0.3)',
    category: 'coach',
  },
  {
    icon: FileText,
    title: 'Expert Questionnaire',
    tag: 'Tune the personality',
    description: 'A guided six-step flow to customize your coach — energy preference, communication style, support style, conversation depth, and name. Your coach is matched to a curated expert persona and linked to a custom avatar.',
    accentRgb: '14,165,233',
    iconGlow: 'rgba(14,165,233,0.22)',
    borderColor: 'rgba(14,165,233,0.3)',
    category: 'coach',
  },
  {
    icon: Clock,
    title: 'Accountability & Check-ins',
    tag: 'Cadence that fits you',
    description: 'Choose proactive, structured, or responsive check-in styles with gentle, moderate, or firm accountability. Your coach follows through on the cadence you set — a scheduled check-in system ensures you hear from them regularly, not just when you reach out.',
    accentRgb: '251,113,133',
    iconGlow: 'rgba(251,113,133,0.22)',
    borderColor: 'rgba(251,113,133,0.3)',
    category: 'coach',
  },
  {
    icon: ClipboardCheck,
    title: 'Commitment Tracking',
    tag: 'Follows up without judgment',
    description: 'A commitment queue with automated overdue sweeps and scheduled callbacks. When you say you\'ll do something by Friday and don\'t, your coach follows up — not with guilt, but with a non-judgmental nudge to get back on track.',
    accentRgb: '52,211,153',
    iconGlow: 'rgba(52,211,153,0.22)',
    borderColor: 'rgba(52,211,153,0.3)',
    category: 'coach',
  },
  {
    icon: TrendingUp,
    title: 'Goal Tracking',
    tag: 'Progress you can see',
    description: 'Typed goals — health, reading, creative, habit, deadline — with target values, current progress, start and target dates, and a status lifecycle from active to completed. Habits count consecutive days. Deadlines show days remaining or overdue.',
    accentRgb: '250,204,21',
    iconGlow: 'rgba(250,204,21,0.22)',
    borderColor: 'rgba(250,204,21,0.3)',
    category: 'coach',
  },
  {
    icon: Briefcase,
    title: 'Daily Schedule',
    tag: 'Knows your day',
    description: 'Your coach knows your work type, work hours, commute times, school pickups, and recurring appointments. Check-ins and suggestions fit your actual day, not a generic template.',
    accentRgb: '20,184,166',
    iconGlow: 'rgba(20,184,166,0.22)',
    borderColor: 'rgba(20,184,166,0.3)',
    category: 'coach',
  },
  {
    icon: Sun,
    title: 'Morning Brief',
    tag: 'Start your day informed',
    description: 'A once-daily aggregation of your calendar events, open goals, commitments (with due/overdue/missed status), and news headlines — delivered as a single brief so you start your day with a full picture.',
    accentRgb: '251,191,36',
    iconGlow: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.3)',
    category: 'coach',
  },
  // ===== CORRESPONDENT =====
  {
    icon: Mail,
    title: 'Auto-Provisioned Dispatches',
    tag: 'Assigned from your interests',
    description: 'Correspondents are automatically matched to you based on your interests during onboarding — no manual setup. Into sports, tech, and politics? You get a sports writer, a science writer, and a politics writer without lifting a finger. They sync and reconcile as your interests change.',
    accentRgb: '251,113,133',
    iconGlow: 'rgba(251,113,133,0.22)',
    borderColor: 'rgba(251,113,133,0.3)',
    category: 'correspondent',
  },
  {
    icon: Mic,
    title: 'Distinctive Voices',
    tag: 'A writer with a beat',
    description: 'Seven correspondents, each with a unique voice personality and a specific beat. The Sideline writes sports with heart. The Field cuts through political spin. The Signal decodes science. The Ledger reads the numbers. The Pulse covers health. The Insider works pop culture. The Arcade lives gaming.',
    accentRgb: '251,191,36',
    iconGlow: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.3)',
    category: 'correspondent',
  },
  {
    icon: Newspaper,
    title: 'Real News, Real Takes',
    tag: 'Grounded in actual events',
    description: 'Dispatches are grounded in real scraped articles filtered to your interests — not generated filler. Each correspondent reads what\'s actually happening, forms a take, and writes it in a voice that makes you want to read the news again.',
    accentRgb: '14,165,233',
    iconGlow: 'rgba(14,165,233,0.22)',
    borderColor: 'rgba(14,165,233,0.3)',
    category: 'correspondent',
  },
  {
    icon: MessageSquare,
    title: 'Article Discussion',
    tag: 'Talk about what you read',
    description: 'Paste any article and discuss it with your correspondent in their voice. Grounding guardrails prevent hallucinated headlines or fabricated sources — the conversation stays anchored to the actual text you shared.',
    accentRgb: '34,211,238',
    iconGlow: 'rgba(34,211,238,0.22)',
    borderColor: 'rgba(34,211,238,0.3)',
    category: 'correspondent',
  },
  {
    icon: Type,
    title: 'Writing Craft',
    tag: 'Not generated at you',
    description: 'Every dispatch follows a structured writing loop — hook, riff, pull-in, ground — that makes the news feel like it was written for you specifically. Anti-hallucination rules ensure your correspondent never invents headlines, quotes, or statistics.',
    accentRgb: '232,121,249',
    iconGlow: 'rgba(232,121,249,0.22)',
    borderColor: 'rgba(232,121,249,0.3)',
    category: 'correspondent',
  },
  {
    icon: Filter,
    title: 'Voice-Scoped Categories',
    tag: 'Persona shapes the take',
    description: 'Eight voice archetypes are mapped to news topics, keywords, and preferred sources — so a sports correspondent engages with sports news differently than a science correspondent engages with science. The personality filter shapes how each persona processes the news it\'s given.',
    accentRgb: '168,85,247',
    iconGlow: 'rgba(168,85,247,0.22)',
    borderColor: 'rgba(168,85,247,0.3)',
    category: 'correspondent',
  },
  {
    icon: Sun,
    title: 'Morning Brief Integration',
    tag: 'News comes to you',
    description: 'Your correspondents\' latest dispatches surface in your daily morning brief alongside your calendar and goals — so the news comes to you instead of you chasing it across a dozen tabs.',
    accentRgb: '251,191,36',
    iconGlow: 'rgba(251,191,36,0.22)',
    borderColor: 'rgba(251,191,36,0.3)',
    category: 'correspondent',
  },
];

const CATEGORY_TABS: { id: FeatureCategory; label: string; accent: string }[] = [
  { id: 'core', label: 'Core', accent: '192,132,252' },
  { id: 'companion', label: 'Companion', accent: '168,85,247' },
  { id: 'coach', label: 'Coach', accent: '52,211,153' },
  { id: 'correspondent', label: 'Correspondent', accent: '251,113,133' },
];

const PARTICLES = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  duration: Math.random() * 10 + 6,
  delay: Math.random() * 8,
  opacity: Math.random() * 0.4 + 0.08,
  isShooting: i < 5,
}));

const ORBS = [
  { x: '-5%', y: '-15%', w: 720, h: 720, color: 'rgba(192,132,252,0.14)', blur: 140, dur: 28 },
  { x: '60%', y: '5%', w: 580, h: 580, color: 'rgba(14,165,233,0.12)', blur: 120, dur: 34 },
  { x: '20%', y: '55%', w: 660, h: 440, color: 'rgba(244,114,182,0.10)', blur: 130, dur: 40 },
  { x: '-15%', y: '65%', w: 480, h: 480, color: 'rgba(52,211,153,0.08)', blur: 110, dur: 32 },
  { x: '75%', y: '70%', w: 520, h: 520, color: 'rgba(232,121,249,0.10)', blur: 120, dur: 38 },
];

export function WelcomePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isEntering, setIsEntering] = useState(false);
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<FeatureCategory>('core');
  const featuresRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const orb0Y = useTransform(scrollY, [0, 1000], [0, -120]);
  const orb1Y = useTransform(scrollY, [0, 1000], [0, -80]);
  const orb2Y = useTransform(scrollY, [0, 1000], [0, 60]);

  const filteredFeatures = useMemo(
    () => FEATURES.filter(f => f.category === activeCategory),
    [activeCategory],
  );

  const mainFeature = filteredFeatures[0];
  const gridFeatures = filteredFeatures.slice(1);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/splash', { replace: true });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate('/splash', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    setVisibleFeatures([]);
  }, [activeCategory]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleFeatures(prev => [...new Set([...prev, index])]);
          }
        });
      },
      { threshold: 0.08 },
    );
    const cards = featuresRef.current?.querySelectorAll('[data-index]');
    cards?.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [activeCategory, filteredFeatures]);

  const handleEnter = async () => {
    setIsEntering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ welcome_seen: true })
          .eq('id', user.id);
      }
    } catch {}
    setTimeout(() => {
      navigate('/user-questionnaire', { replace: true });
    }, 600);
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div ref={containerRef} className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--ds-bg-page)', backgroundColor: 'var(--ds-bg-base)' }}>

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.028]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
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
        <span className="text-white text-sm font-bold tracking-[0.18em] uppercase" style={{ letterSpacing: '0.18em' }}>
          Project <span style={{ color: '#c084fc' }}>Velvet</span>
        </span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-400 text-xs font-medium transition-all duration-200 hover:text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#f43f5e,#fb7185)' }}
          >
            {userInitial}
          </div>
          <LogOut className="w-3 h-3" />
        </button>
      </div>

      {/* Ambient orbs with parallax */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          style={{ y: orb0Y }}
          className="absolute"
          animate={{ x: ['0%', '3%', '0%'], y: ['0%', '2%', '0%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[0].x, top: ORBS[0].y, width: ORBS[0].w, height: ORBS[0].h, borderRadius: '50%', background: ORBS[0].color, filter: `blur(${ORBS[0].blur}px)` }} />
        </motion.div>
        <motion.div
          style={{ y: orb1Y }}
          animate={{ x: ['0%', '-2%', '0%'] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[1].x, top: ORBS[1].y, width: ORBS[1].w, height: ORBS[1].h, borderRadius: '50%', background: ORBS[1].color, filter: `blur(${ORBS[1].blur}px)` }} />
        </motion.div>
        <motion.div
          style={{ y: orb2Y }}
          animate={{ x: ['0%', '1.5%', '0%'] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[2].x, top: ORBS[2].y, width: ORBS[2].w, height: ORBS[2].h, borderRadius: '50%', background: ORBS[2].color, filter: `blur(${ORBS[2].blur}px)` }} />
        </motion.div>
        <div style={{ position: 'absolute', left: ORBS[3].x, top: ORBS[3].y, width: ORBS[3].w, height: ORBS[3].h, borderRadius: '50%', background: ORBS[3].color, filter: `blur(${ORBS[3].blur}px)` }} />
        <div style={{ position: 'absolute', left: ORBS[4].x, top: ORBS[4].y, width: ORBS[4].w, height: ORBS[4].h, borderRadius: '50%', background: ORBS[4].color, filter: `blur(${ORBS[4].blur}px)` }} />
      </div>

      {/* Particles + shooting stars */}
      {PARTICLES.map(p =>
        p.isShooting ? (
          <motion.div
            key={p.id}
            className="absolute pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: '80px',
              height: '1px',
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)',
              rotate: '30deg',
              opacity: 0,
            }}
            animate={{ opacity: [0, 0.7, 0], x: [0, 120], y: [0, 70] }}
            transition={{ duration: 1.2, delay: p.delay * 4, repeat: Infinity, repeatDelay: Math.random() * 18 + 10, ease: 'easeOut' }}
          />
        ) : (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white pointer-events-none"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, opacity: p.opacity }}
            animate={{ opacity: [p.opacity, p.opacity * 2.8, p.opacity], scale: [1, 1.6, 1] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        )
      )}

      <AnimatePresence>
        {isEntering && (
          <motion.div
            className="fixed inset-0 z-[60]"
            style={{ background: '#060d1f' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-8">

        {/* Hero */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          {/* Early access pill with shimmer */}
          <motion.div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-10 overflow-hidden relative cursor-default select-none"
            style={{
              background: 'rgba(192,132,252,0.08)',
              border: '1px solid rgba(192,132,252,0.28)',
              backdropFilter: 'blur(16px)',
            }}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.4, delay: 1.2, repeat: Infinity, repeatDelay: 4 }}
            />
            <Sparkles className="w-3 h-3" style={{ color: '#c084fc' }} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#c084fc' }}>Now in Early Access</span>
          </motion.div>

          {/* Hero headline */}
          <motion.h1
            className="mb-7 leading-none"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.75 }}
          >
            <span
              className="block text-white"
              style={{
                fontSize: 'clamp(64px, 10vw, 108px)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              Project
            </span>
            <span
              className="block relative"
              style={{
                fontSize: 'clamp(64px, 10vw, 108px)',
                fontWeight: 200,
                letterSpacing: '0.12em',
                lineHeight: 1.05,
              }}
            >
              <span
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ filter: 'blur(60px)', opacity: 0.45 }}
                aria-hidden
              >
                <span
                  className="text-transparent bg-clip-text"
                  style={{
                    fontSize: 'clamp(64px, 10vw, 108px)',
                    fontWeight: 200,
                    letterSpacing: '0.12em',
                    background: 'linear-gradient(135deg,#c084fc,#f472b6,#c084fc)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Velvet
                </span>
              </span>
              <motion.span
                style={{
                  background: 'linear-gradient(135deg,#c084fc 0%,#f472b6 50%,#c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              >
                Velvet
              </motion.span>
            </span>
          </motion.h1>

          <motion.p
            className="text-gray-300 max-w-2xl mx-auto font-light mb-10"
            style={{ fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.6 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            Your World, Projected.
          </motion.p>
        </motion.div>

        {/* CTA Stage */}
        <motion.div
          className="relative rounded-3xl p-10 text-center overflow-hidden mb-16"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.65 }}
        >
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-60%)',
              width: 480,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(244,63,94,0.12) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.04] via-transparent to-sky-500/[0.04] pointer-events-none rounded-3xl" />

          <div className="relative z-10">
            <div
              className="font-black text-white mb-4 tracking-tight"
              style={{ fontSize: 'clamp(32px, 5vw, 50px)', lineHeight: 1.1 }}
            >
              Your world starts now.
            </div>

            {user ? (
              <>
                <p className="text-gray-400 text-base mb-8 max-w-md mx-auto leading-relaxed">
                  First, a few quick questions so we can personalize everything. Then Atlas will learn what you're working toward and build your world around you.
                </p>

                <motion.button
                  onClick={handleEnter}
                  disabled={isEntering}
                  whileTap={{ scale: 0.97 }}
                  className="group relative inline-flex items-center gap-3 px-9 py-4 rounded-2xl text-white font-bold text-lg overflow-hidden disabled:opacity-70"
                  style={{
                    background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                    boxShadow: '0 4px 32px rgba(244,63,94,0.35)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 44px rgba(244,63,94,0.55)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 32px rgba(244,63,94,0.35)'; }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)' }}
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '200%' }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                  />
                  <span className="relative z-10">Enter Project Velvet</span>
                  <motion.div
                    className="relative z-10"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </motion.div>
                </motion.button>

                <p className="text-gray-600 text-xs mt-5">
                  Joined by early members across 40+ countries
                </p>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-base mb-2 max-w-md mx-auto">
                  Join thousands already living inside Project Velvet.
                </p>
                <p className="text-gray-600 text-sm mb-8">Start with 15 free messages — no credit card required.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-sm mx-auto">
                  <motion.button
                    onClick={() => navigate('/signup')}
                    whileTap={{ scale: 0.97 }}
                    className="group relative flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-white font-bold text-base overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg,#f43f5e,#fb7185)',
                      boxShadow: '0 4px 28px rgba(244,63,94,0.32)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 40px rgba(244,63,94,0.52)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 28px rgba(244,63,94,0.32)'; }}
                  >
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)' }}
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '200%' }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                    <span className="relative z-10">Create Account</span>
                    <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
                  </motion.button>
                  <motion.button
                    onClick={() => navigate('/login')}
                    whileTap={{ scale: 0.97 }}
                    className="flex-1 px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1.5px solid rgba(255,255,255,0.15)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    Enter Project Velvet
                  </motion.button>
                </div>
                <p className="text-gray-600 text-xs mt-5">Joined by early members across 40+ countries</p>
              </>
            )}
          </div>
        </motion.div>

        {/* Features section — segmented control + pyramid layout */}
        <div className="mb-16">
          {/* Section header */}
          <motion.div
            className="mb-6 flex items-center gap-4"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="w-1 h-8 rounded-full" style={{ background: 'rgba(192,132,252,0.6)' }} />
            <div>
              <h2 className="text-white text-xl font-bold tracking-tight">What's Inside</h2>
              <p className="text-gray-500 text-xs">Explore by relationship type</p>
            </div>
            <div className="flex-1 h-px ml-2" style={{ background: 'linear-gradient(to right, rgba(192,132,252,0.2), transparent)' }} />
          </motion.div>

          {/* Segmented control */}
          <div className="flex flex-wrap gap-2 mb-8">
            {CATEGORY_TABS.map(tab => {
              const isActive = activeCategory === tab.id;
              const count = FEATURES.filter(f => f.category === tab.id).length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
                  style={{
                    background: isActive ? `rgba(${tab.accent},0.12)` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? `rgba(${tab.accent},0.35)` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? `rgb(${tab.accent})` : 'rgb(156,163,175)',
                    boxShadow: isActive ? `0 0 20px rgba(${tab.accent},0.1)` : 'none',
                  }}
                >
                  {tab.label}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: isActive ? `rgba(${tab.accent},0.2)` : 'rgba(255,255,255,0.06)',
                      color: isActive ? `rgb(${tab.accent})` : 'rgb(107,114,128)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Pyramid: main tile + grid */}
          <div ref={featuresRef} key={activeCategory}>
            {mainFeature && (() => {
              const MainIcon = mainFeature.icon;
              const isMainVisible = visibleFeatures.includes(0);
              const isMainHovered = hoveredCard === 0;
              return (
                <motion.div
                  key={`main-${mainFeature.title}`}
                  data-index={0}
                  onMouseEnter={() => setHoveredCard(0)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className="rounded-3xl p-7 flex items-start gap-5 cursor-default relative overflow-hidden mb-5"
                  initial={{ opacity: 0, y: 30 }}
                  animate={isMainVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                  transition={{ duration: 0.6 }}
                  style={{
                    background: isMainHovered
                      ? `linear-gradient(135deg, rgba(${mainFeature.accentRgb},0.1), rgba(255,255,255,0.02))`
                      : `linear-gradient(135deg, rgba(${mainFeature.accentRgb},0.06), rgba(255,255,255,0.02))`,
                    border: `1px solid rgba(${mainFeature.accentRgb},${isMainHovered ? 0.3 : 0.18})`,
                    borderTop: `2px solid rgba(${mainFeature.accentRgb},${isMainHovered ? 0.7 : 0.45})`,
                    boxShadow: isMainHovered
                      ? `0 12px 50px rgba(${mainFeature.accentRgb},0.16), 0 0 0 1px rgba(${mainFeature.accentRgb},0.14)`
                      : `0 0 40px rgba(${mainFeature.accentRgb},0.06)`,
                    transform: isMainHovered ? 'translateY(-3px)' : 'translateY(0)',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(14px)',
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none opacity-[0.018]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                      backgroundSize: '120px',
                    }}
                  />
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 relative z-10"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, rgba(${mainFeature.accentRgb},0.4), rgba(${mainFeature.accentRgb},0.12))`,
                      border: `1px solid rgba(${mainFeature.accentRgb},0.35)`,
                      boxShadow: isMainHovered ? `0 0 24px rgba(${mainFeature.accentRgb},0.3)` : 'none',
                      transition: 'box-shadow 0.3s ease',
                    }}
                  >
                    <MainIcon className="w-7 h-7" style={{ color: `rgb(${mainFeature.accentRgb})` }} />
                  </div>
                  <div className="flex-1 relative z-10">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-white font-bold text-lg tracking-tight">{mainFeature.title}</h3>
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{
                          color: `rgb(${mainFeature.accentRgb})`,
                          background: `rgba(${mainFeature.accentRgb},0.12)`,
                          border: `1px solid rgba(${mainFeature.accentRgb},0.25)`,
                        }}
                      >
                        {mainFeature.tag}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">{mainFeature.description}</p>
                  </div>
                </motion.div>
              );
            })()}

            {/* Grid tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gridFeatures.map((feature, i) => {
                const Icon = feature.icon;
                const idx = i + 1;
                const isVisible = visibleFeatures.includes(idx);
                const isHovered = hoveredCard === idx;
                const colOffset = (i % 3) * 18;
                return (
                  <motion.div
                    key={feature.title}
                    data-index={idx}
                    onMouseEnter={() => setHoveredCard(idx)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className="rounded-2xl p-5 flex flex-col gap-3 cursor-default relative overflow-hidden"
                    initial={{ opacity: 0, y: 28 + colOffset }}
                    animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 + colOffset }}
                    transition={{ duration: 0.55, delay: (i % 3) * 0.09 }}
                    style={{
                      background: isHovered
                        ? `rgba(${feature.accentRgb},0.07)`
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isHovered ? feature.borderColor : 'rgba(255,255,255,0.08)'}`,
                      borderTop: `2px solid rgba(${feature.accentRgb},${isHovered ? 0.65 : 0.28})`,
                      boxShadow: isHovered ? `0 8px 40px rgba(${feature.accentRgb},0.14), 0 0 0 1px rgba(${feature.accentRgb},0.12)` : 'none',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      transition: 'all 0.3s ease',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div
                      className="absolute inset-0 pointer-events-none opacity-[0.018]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                        backgroundSize: '120px',
                      }}
                    />
                    <div className="flex items-start justify-between gap-2 relative z-10">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `radial-gradient(circle at 35% 35%, rgba(${feature.accentRgb},0.35), rgba(${feature.accentRgb},0.1))`,
                          border: `1px solid rgba(${feature.accentRgb},0.3)`,
                          boxShadow: isHovered ? `0 0 20px rgba(${feature.accentRgb},0.25)` : 'none',
                          transition: 'box-shadow 0.3s ease',
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: `rgb(${feature.accentRgb})` }} />
                      </div>
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
                        style={{
                          color: `rgb(${feature.accentRgb})`,
                          background: `rgba(${feature.accentRgb},0.1)`,
                          border: `1px solid rgba(${feature.accentRgb},0.2)`,
                        }}
                      >
                        {feature.tag}
                      </span>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-white font-bold text-base mb-1.5 tracking-tight">{feature.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        <motion.p
          className="text-center text-gray-700 text-xs mb-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          By continuing you agree to our Terms of Service and Privacy Policy.
        </motion.p>
      </div>

      <Footer />
    </div>
  );
}
