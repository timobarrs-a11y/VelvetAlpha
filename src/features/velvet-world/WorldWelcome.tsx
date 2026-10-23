import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { useTutorialDirector } from '../../context/TutorialDirectorContext';
import { claimDefaultPlot, getMyPlot } from '../../services/worldService';
import { townSlot } from './art/streetArt';
import { MoveInPanel } from './MoveInSheet';

// Never interrupt sign-up, onboarding, a game, or the town itself (it has its own move-in screen).
const QUIET_PREFIXES = [
  '/splash', '/login', '/signin', '/signup', '/onboarding', '/atlas-onboarding', '/coach-avatar', '/user-questionnaire',
  '/create-user-avatar', '/intent-select', '/companion-path', '/expert-', '/questionnaire', '/create-additional-companion',
  '/analyzing', '/voice-selection', '/create-companion-avatar', '/pricing', '/coach-ready', '/who-to-talk',
  '/environment-setup', '/world', '/velvet-house', '/admin',
];
const CHECKED_KEY = 'velvetWorldWelcomeChecked';

/**
 * The first time someone is in the app without a house, explain Velvet World and help them
 * move in. "Not now" still gives them a starter house, so everyone is part of the town.
 */
export function WorldWelcomeMount() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { isOnboarding } = useTutorialDirector();
  const [open, setOpen] = useState(false);
  const checking = useRef(false);

  useEffect(() => {
    if (!user || isOnboarding || open || checking.current) return;
    if (QUIET_PREFIXES.some((p) => pathname.startsWith(p))) return;
    let seen = false;
    try { seen = sessionStorage.getItem(CHECKED_KEY) === user.id; } catch { /* storage blocked */ }
    if (seen) return;
    checking.current = true;
    const timer = setTimeout(() => {
      getMyPlot()
        .then((plot) => {
          try { sessionStorage.setItem(CHECKED_KEY, user.id); } catch { /* storage blocked */ }
          if (!plot) setOpen(true);
        })
        .catch(() => {})
        .finally(() => { checking.current = false; });
    }, 1500);
    return () => { clearTimeout(timer); checking.current = false; };
  }, [user, pathname, isOnboarding, open]);

  if (!open) return null;
  return <WorldWelcome onClose={() => setOpen(false)} />;
}

type Step = 'intro' | 'pick' | 'done';

function WorldWelcome({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('intro');
  const [address, setAddress] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { dialogRef.current?.focus(); }, [step]);

  const finish = async () => {
    const plot = await getMyPlot().catch(() => null);
    setAddress(plot ? townSlot(plot.slot_index).address : null);
    setStep('done');
  };

  const notNow = async () => {
    setSkipping(true);
    await claimDefaultPlot().catch(() => {});
    setSkipping(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-welcome-title"
        tabIndex={-1}
        className="relative max-h-[92vh] w-full max-w-xl overflow-auto rounded-t-3xl border border-white/10 bg-[#14111c] p-6 text-white shadow-2xl outline-none sm:rounded-3xl"
      >
        {step !== 'done' && (
          <button type="button" onClick={notNow} disabled={skipping} aria-label="Not now" className="absolute right-4 top-4 rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}

        {step === 'intro' && (
          <div className="grid gap-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-pink-300/80">New: Velvet World</p>
            <h2 id="world-welcome-title" className="text-2xl font-extrabold leading-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
              You get a house in town
            </h2>
            <ul className="grid gap-3 text-[14.5px] leading-snug text-white/75">
              <li><b className="text-white">Everyone in Velvet lives here.</b> Your house sits on a real street with a billboard out front: your name, a goal you choose to share, and your medals.</li>
              <li><b className="text-white">New neighbors every day.</b> Tap a billboard to meet someone and add them as a friend.</li>
              <li><b className="text-white">Houses grow with you.</b> Bigger houses come with membership, and five can only be earned with medals.</li>
              <li><b className="text-white">It's also your home in Velvet House.</b> The town sees the outside. In the game, you go inside and play with your companion.</li>
            </ul>
            <p className="text-[13px] text-white/45">Takes about 20 seconds. You can change everything later.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => setStep('pick')} className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3 font-bold text-white hover:shadow-xl">
                Pick my house
              </button>
              <button type="button" onClick={notNow} disabled={skipping} className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/70 hover:border-white/30 hover:text-white disabled:opacity-50">
                {skipping ? 'One sec…' : 'Not now'}
              </button>
            </div>
            <p className="text-[12px] text-white/35">If you skip, we'll give you a starter house so you're still part of the town.</p>
          </div>
        )}

        {step === 'pick' && (
          <div className="grid gap-4">
            <h2 id="world-welcome-title" className="text-xl font-extrabold" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
              Pick your house
            </h2>
            <MoveInPanel compact onMoved={finish} />
          </div>
        )}

        {step === 'done' && (
          <div className="grid gap-4 text-center">
            <h2 id="world-welcome-title" className="text-2xl font-extrabold" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
              Welcome home
            </h2>
            <p className="text-white/70">{address ? <>You live at <b className="text-white">{address}</b>.</> : 'You have a house in town.'} Your neighbors change every day.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={() => { onClose(); navigate('/world'); }} className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3 font-bold text-white">
                See my street
              </button>
              <button type="button" onClick={onClose} className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white/70 hover:text-white">
                Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
