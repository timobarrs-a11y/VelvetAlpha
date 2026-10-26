import { motion } from 'framer-motion';
import { Home, Sofa, Target, Medal, UserPlus, DoorOpen, type LucideIcon } from 'lucide-react';

// Splash section for Velvet House (your house in town, seen from outside) and
// Velvet Sims (the life sim inside it), and the loop that ties them together.

const DISPLAY_FONT = "'Bricolage Grotesque', 'Space Grotesk', system-ui, sans-serif";

const OUTSIDE = [
  'A house on a real street, with your own address.',
  'A billboard out front: your name, a goal you choose to share, and your top medals.',
  'New neighbors every day. Tap a billboard to meet someone and add them as a friend.',
  'Five dream houses are never for sale. Lighthouse, Observatory, Treehouse, Windmill and Castle are earned with medals.',
];

const INSIDE = [
  'A cozy life sim inside that same house, from the basement to the yard.',
  'Decorate and arrange every room: furniture, wallpaper, floors.',
  'Cook, work out, garden, keep up with the bills, and have friends over.',
  'Your housemate is a character you can talk to like a real person. They remember what you say and react to what you do.',
];

const LOOP: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Target, title: 'Show up', text: 'Keep your commitments and hit your goals with your coach.' },
  { icon: Medal, title: 'Earn medals', text: 'They land on your billboard and unlock dream houses.' },
  { icon: UserPlus, title: 'Meet neighbors', text: 'Your billboard is how the town meets you. Neighbors become friends.' },
  { icon: DoorOpen, title: 'Go inside', text: 'Tap Look inside and you are home in Velvet Sims, the place to unwind.' },
];

function StreetArt() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto" role="img" aria-label="A house in town at dusk with a billboard out front">
      <defs>
        <linearGradient id="vh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e1b4b" />
          <stop offset="1" stopColor="#7c3a6b" />
        </linearGradient>
        <radialGradient id="vh-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="url(#vh-sky)" />
      {[[40, 30], [120, 18], [300, 26], [350, 50], [210, 40]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#fff" opacity="0.7" />
      ))}
      <circle cx="330" cy="40" r="14" fill="#fef3c7" opacity="0.9" />
      {/* neighbors */}
      <path d="M0 150 L30 125 L60 150 Z" fill="#3b2a5c" />
      <rect x="6" y="150" width="48" height="40" fill="#2e2350" />
      <path d="M330 148 L365 120 L400 148 Z" fill="#3b2a5c" />
      <rect x="336" y="148" width="64" height="42" fill="#2e2350" />
      {/* lawn and street */}
      <rect y="185" width="400" height="35" fill="#1f3a2e" />
      <rect y="203" width="400" height="17" fill="#26213f" />
      <rect x="20" y="210" width="40" height="3" fill="#fbbf24" opacity="0.5" />
      <rect x="180" y="210" width="40" height="3" fill="#fbbf24" opacity="0.5" />
      <rect x="340" y="210" width="40" height="3" fill="#fbbf24" opacity="0.5" />
      {/* your house */}
      <path d="M120 120 L190 70 L260 120 Z" fill="#f472b6" />
      <path d="M120 120 L190 70 L260 120" fill="none" stroke="#fbcfe8" strokeWidth="2" opacity="0.5" />
      <rect x="132" y="120" width="116" height="68" fill="#fdf2f8" />
      <rect x="226" y="80" width="12" height="26" fill="#be185d" />
      <circle cx="160" cy="146" r="22" fill="url(#vh-glow)" />
      <circle cx="220" cy="146" r="22" fill="url(#vh-glow)" />
      <rect x="148" y="134" width="24" height="22" rx="2" fill="#fcd34d" />
      <rect x="208" y="134" width="24" height="22" rx="2" fill="#fcd34d" />
      <path d="M160 134 V156 M148 145 H172 M220 134 V156 M208 145 H232" stroke="#fdf2f8" strokeWidth="2" />
      <rect x="181" y="152" width="18" height="36" rx="2" fill="#7c3aed" />
      <circle cx="195" cy="171" r="1.6" fill="#fde68a" />
      {/* billboard */}
      <rect x="282" y="160" width="4" height="28" fill="#4b4370" />
      <rect x="318" y="160" width="4" height="28" fill="#4b4370" />
      <rect x="270" y="112" width="64" height="50" rx="5" fill="#14122a" stroke="#c084fc" strokeWidth="1.5" />
      <rect x="278" y="120" width="34" height="5" rx="2" fill="#f0eeff" />
      <rect x="278" y="130" width="46" height="3" rx="1.5" fill="#9990cc" />
      <rect x="278" y="136" width="38" height="3" rx="1.5" fill="#9990cc" />
      <circle cx="283" cy="152" r="4" fill="#fbbf24" />
      <circle cx="294" cy="152" r="4" fill="#34d399" />
      <circle cx="305" cy="152" r="4" fill="#38bdf8" />
      {/* tree */}
      <rect x="92" y="160" width="5" height="28" fill="#5b3a29" />
      <circle cx="94" cy="150" r="17" fill="#2f855a" />
      <circle cx="104" cy="142" r="11" fill="#38a169" />
    </svg>
  );
}

function RoomArt() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto" role="img" aria-label="A cozy room inside the house with a sofa, plant and lamp">
      <defs>
        <radialGradient id="vs-lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="220" fill="#191530" />
      {/* walls */}
      <path d="M200 20 L60 90 L60 160 L200 90 Z" fill="#3b2f63" />
      <path d="M200 20 L340 90 L340 160 L200 90 Z" fill="#4a3b78" />
      {/* floor */}
      <path d="M200 90 L60 160 L200 215 L340 160 Z" fill="#a16207" />
      <path d="M200 90 L60 160 L200 215 L340 160 Z" fill="#000" opacity="0.18" />
      <path d="M130 125 L270 195 M165 107 L305 177 M95 142 L235 212" stroke="#78350f" strokeWidth="1" opacity="0.6" />
      {/* rug */}
      <path d="M200 125 L135 157 L200 188 L265 157 Z" fill="#db2777" opacity="0.8" />
      {/* window */}
      <path d="M250 55 L300 80 L300 115 L250 90 Z" fill="#60a5fa" opacity="0.7" />
      <path d="M275 67 L275 102 M250 72 L300 97" stroke="#4a3b78" strokeWidth="2" />
      {/* picture */}
      <path d="M110 80 L145 63 L145 88 L110 105 Z" fill="#fbbf24" opacity="0.85" />
      {/* sofa */}
      <path d="M95 150 L150 123 L185 140 L130 168 Z" fill="#7c3aed" />
      <path d="M95 150 L95 135 L150 108 L150 123 Z" fill="#6d28d9" />
      <path d="M130 168 L130 176 L185 148 L185 140 Z" fill="#5b21b6" />
      <path d="M95 150 L130 168 L130 176 L95 158 Z" fill="#4c1d95" />
      {/* plant */}
      <path d="M290 150 L300 145 L310 150 L310 165 L300 170 L290 165 Z" fill="#b45309" />
      <circle cx="300" cy="135" r="13" fill="#16a34a" />
      <circle cx="292" cy="128" r="8" fill="#22c55e" />
      {/* lamp */}
      <circle cx="235" cy="95" r="45" fill="url(#vs-lamp)" />
      <rect x="233" y="98" width="4" height="50" fill="#e5e7eb" />
      <path d="M222 98 L248 98 L242 82 L228 82 Z" fill="#fde68a" />
      {/* housemate */}
      <circle cx="205" cy="128" r="8" fill="#f9a8d4" />
      <rect x="198" y="136" width="14" height="22" rx="6" fill="#38bdf8" />
      {/* chat bubble */}
      <rect x="215" y="102" width="56" height="18" rx="9" fill="#f0eeff" />
      <circle cx="230" cy="111" r="2" fill="#7c3aed" />
      <circle cx="240" cy="111" r="2" fill="#7c3aed" />
      <circle cx="250" cy="111" r="2" fill="#7c3aed" />
    </svg>
  );
}

function SideCard({
  icon: Icon, kicker, name, line, accent, art, points, rise,
}: {
  icon: LucideIcon; kicker: string; name: string; line: string; accent: string;
  art: React.ReactNode; points: string[]; rise: Record<string, unknown>;
}) {
  return (
    <motion.article
      {...rise}
      className="rounded-[24px] overflow-hidden flex flex-col"
      style={{ background: `linear-gradient(170deg, rgba(${accent},0.08), rgba(255,255,255,0.02) 50%)`, border: `1px solid rgba(${accent},0.2)` }}
    >
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{art}</div>
      <div className="p-7">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `rgba(${accent},0.14)`, border: `1px solid rgba(${accent},0.3)` }}>
            <Icon className="w-[18px] h-[18px]" style={{ color: `rgb(${accent})` }} />
          </div>
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: `rgb(${accent})` }}>{kicker}</p>
        </div>
        <h3 className="text-white text-2xl font-bold mb-1.5" style={{ fontFamily: DISPLAY_FONT, letterSpacing: '-0.02em' }}>{name}</h3>
        <p className="text-gray-300 text-[15px] mb-5">{line}</p>
        <ul className="flex flex-col gap-2.5">
          {points.map(p => (
            <li key={p} className="flex gap-3 text-sm text-gray-400 leading-relaxed">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2" style={{ background: `rgb(${accent})` }} />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}

export function VelvetHomeSection({ rise }: { rise: (delay?: number) => Record<string, unknown> }) {
  return (
    <section id="home" className="max-w-6xl mx-auto px-5 pb-28 scroll-mt-20">
      <motion.div {...rise()} className="max-w-3xl mb-12">
        <p className="text-[11px] font-bold tracking-[0.22em] uppercase mb-4" style={{ color: 'rgb(251,146,60)' }}>
          Velvet House &amp; Velvet Sims
        </p>
        <h2
          className="text-white"
          style={{ fontFamily: DISPLAY_FONT, fontWeight: 800, fontSize: 'clamp(32px, 4.6vw, 52px)', letterSpacing: '-0.035em', lineHeight: 1.04 }}
        >
          Your house in town. Your life inside it.
        </h2>
        <p className="mt-5 text-gray-300 text-lg leading-relaxed">
          Every member gets a home. The town sees the outside, where your progress shows. Velvet Sims is the inside,
          where you unwind. One house, two ways to live in it.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-5">
        <SideCard
          icon={Home}
          kicker="The outside"
          name="Velvet House"
          line="Your place on a real street, where the town gets to know you."
          accent="244,114,182"
          art={<StreetArt />}
          points={OUTSIDE}
          rise={rise()}
        />
        <SideCard
          icon={Sofa}
          kicker="The inside"
          name="Velvet Sims"
          line="The life sim behind your front door."
          accent="251,146,60"
          art={<RoomArt />}
          points={INSIDE}
          rise={rise(0.1)}
        />
      </div>

      <motion.div
        {...rise()}
        className="mt-5 rounded-[24px] p-6 md:p-8"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <p className="text-white text-lg font-semibold mb-1">How they feed each other</p>
        <p className="text-gray-400 text-sm mb-6">Grow in Velvet and your house shows it. Come home and Velvet Sims is waiting.</p>
        <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {LOOP.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-gray-500">{i + 1}</span>
                <Icon className="w-4 h-4 text-amber-300" />
                <p className="text-white text-[15px] font-semibold">{title}</p>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </motion.div>
    </section>
  );
}
