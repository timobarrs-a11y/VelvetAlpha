import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, MailOpen, PenLine, Send, X } from 'lucide-react';
import {
  getMyMail, markAllMailRead, markLetterRead, sendTownLetter, type TownLetter,
} from '../../services/townMailService';

interface Props {
  /** Your own user id, for "just me" test letters. */
  myId: string;
  /** What the letter is addressed to ("To: ..."). */
  myName: string;
  /** Admins can write letters. Everyone else can only read. */
  canSend: boolean;
  onClose: () => void;
  /** Called with the new unread count whenever it changes, so the mailbox light follows. */
  onUnreadChange: (count: number) => void;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const PAPER = '#FBF3DF';
const INK = '#4A3B2A';
const LINE = 'rgba(120,90,50,0.16)';

/** A letter on stationery: To and the date across the top, the words on lined paper, From at the bottom right. */
function LetterView({ letter, myName, onBack }: { letter: TownLetter; myName: string; onBack: () => void }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      aria-label={letter.subject || 'A letter'}
      className="mx-3 mb-3 rounded-2xl shadow-lg"
      style={{ background: PAPER, color: INK, border: '1px solid rgba(120,90,50,0.25)', fontFamily: "'Lora', Georgia, serif" }}
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 text-[12.5px]" style={{ color: 'rgba(74,59,42,0.7)' }}>
        <span>To: <b style={{ color: INK }}>{myName}</b></span>
        <span className="text-right">{fullDate(letter.created_at)}</span>
      </div>
      {letter.subject && <h3 className="px-5 pt-3 text-[16px] font-bold leading-snug">{letter.subject}</h3>}
      <div
        className="mt-2 px-5 text-[14.5px] whitespace-pre-wrap break-words"
        style={{ lineHeight: '28px', backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 27px, ${LINE} 27px, ${LINE} 28px)`, minHeight: 168 }}
      >
        {`Dear ${myName},\n\n${letter.body}`}
      </div>
      <p className="px-5 pb-4 pt-3 text-right text-[13.5px]" style={{ color: 'rgba(74,59,42,0.8)' }}>
        From: <b style={{ color: INK }}>{letter.sender_label}</b>
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mx-5 mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
        style={{ background: 'rgba(74,59,42,0.1)', color: INK, fontFamily: 'inherit' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to the mailbox
      </button>
    </motion.article>
  );
}

/** The mailbox: a queue of one-way letters. You can read them; there is no reply. */
export function MailboxSheet({ myId, myName, canSend, onClose, onUnreadChange }: Props) {
  const [letters, setLetters] = useState<TownLetter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);

  const unreadOf = (list: TownLetter[]) => list.filter((l) => !l.read_at).length;

  const load = useCallback(async () => {
    try {
      const list = await getMyMail();
      setLetters(list);
      onUnreadChange(unreadOf(list));
    } catch {
      setError('Your mailbox is not available right now.');
      setLetters([]);
    }
  }, [onUnreadChange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openLetter = (letter: TownLetter) => {
    setOpenId(letter.id);
    if (!letter.read_at) {
      const now = new Date().toISOString();
      setLetters((cur) => {
        const next = (cur ?? []).map((l) => (l.id === letter.id ? { ...l, read_at: now } : l));
        onUnreadChange(unreadOf(next));
        return next;
      });
      markLetterRead(letter.id).catch(() => load());
    }
  };

  const readAll = () => {
    const now = new Date().toISOString();
    setLetters((cur) => (cur ?? []).map((l) => (l.read_at ? l : { ...l, read_at: now })));
    onUnreadChange(0);
    markAllMailRead().catch(() => load());
  };

  const unread = letters ? unreadOf(letters) : 0;
  const reading = letters?.find((l) => l.id === openId) ?? null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(14,11,24,0.55)' }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-label="Your mailbox"
        className="w-full max-w-md max-h-[82vh] flex flex-col rounded-3xl border border-white/12 text-white shadow-2xl"
        style={{ background: 'rgba(24,19,34,0.96)', backdropFilter: 'blur(18px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,214,120,0.14)', border: '1px solid rgba(255,214,120,0.3)' }}>
            <Mail className="w-[18px] h-[18px] text-amber-200" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-tight">Your mailbox</h2>
            <p className="text-[12px] text-white/50">{unread > 0 ? `${unread} unread` : 'Nothing new'}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close mailbox" className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/8">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {reading ? (
            <LetterView letter={reading} myName={myName} onBack={() => setOpenId(null)} />
          ) : (<>
          {letters === null && <p className="px-3 py-8 text-center text-sm text-white/50">Checking the mailbox…</p>}
          {error && <p className="px-3 py-8 text-center text-sm text-white/50">{error}</p>}
          {letters && !error && letters.length === 0 && (
            <div className="px-4 py-10 text-center">
              <MailOpen className="w-8 h-8 mx-auto mb-3 text-white/30" />
              <p className="text-sm text-white/70">No letters yet.</p>
              <p className="mt-1 text-[12.5px] text-white/45">When Velvet writes to you, it will be waiting here and the mailbox will light up.</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {(letters ?? []).map((l) => {
              return (
                <li key={l.id} className="rounded-2xl border" style={{ borderColor: l.read_at ? 'rgba(255,255,255,0.07)' : 'rgba(255,214,120,0.35)', background: l.read_at ? 'rgba(255,255,255,0.025)' : 'rgba(255,214,120,0.06)' }}>
                  <button type="button" onClick={() => openLetter(l)} className="w-full flex items-center gap-3 px-3.5 py-3 text-left">
                    {l.read_at ? <MailOpen className="w-4 h-4 text-white/35 flex-shrink-0" /> : <Mail className="w-4 h-4 text-amber-200 flex-shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[13.5px] ${l.read_at ? 'text-white/70' : 'font-semibold text-white'}`}>{l.subject || 'A letter for you'}</span>
                      <span className="block truncate text-[11.5px] text-white/40">From {l.sender_label}</span>
                    </span>
                    <span className="text-[11px] text-white/40 flex-shrink-0">{when(l.created_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          </>)}
        </div>

        <footer className="flex items-center gap-2 px-4 py-3 border-t border-white/8">
          {unread > 0 && !reading && (
            <button type="button" onClick={readAll} className="px-3 py-1.5 rounded-full text-[12px] text-white/70 border border-white/12 hover:text-white hover:bg-white/6">
              Mark all read
            </button>
          )}
          {canSend && (
            <button type="button" onClick={() => setWriting((w) => !w)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white" style={{ background: 'rgba(240,106,155,0.2)', border: '1px solid rgba(240,106,155,0.4)' }}>
              <PenLine className="w-3.5 h-3.5" /> {writing ? 'Close' : 'Write a letter'}
            </button>
          )}
        </footer>

        {canSend && writing && <LetterComposer myId={myId} onSent={load} />}
      </section>
    </div>
  );
}

function LetterComposer({ myId, onSent }: { myId: string; onSent: () => void }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'everyone' | 'me'>('me');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const send = async () => {
    if (!body.trim() || busy) return;
    if (audience === 'everyone' && !window.confirm('Send this letter to everyone with a house? This cannot be undone.')) return;
    setBusy(true);
    setNote(null);
    try {
      const n = await sendTownLetter(subject.trim(), body.trim(), audience === 'me' ? [myId] : undefined);
      setNote(`Sent ${n} ${n === 1 ? 'letter' : 'letters'}.`);
      setSubject('');
      setBody('');
      onSent();
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-white/8">
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={120}
        placeholder="Subject"
        aria-label="Letter subject"
        className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/30"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        rows={4}
        placeholder="Write your letter. Members can read it but cannot reply."
        aria-label="Letter"
        className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-[13px] text-white placeholder:text-white/35 outline-none focus:border-white/30 resize-none"
      />
      <div className="flex items-center gap-2">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value as 'everyone' | 'me')}
          aria-label="Who gets this letter"
          className="rounded-xl bg-white/6 border border-white/10 px-2.5 py-2 text-[12.5px] text-white outline-none"
        >
          <option value="me">Just me (test)</option>
          <option value="everyone">Everyone with a house</option>
        </select>
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(120deg,#f472b6,#c084fc)' }}
        >
          <Send className="w-3.5 h-3.5" /> {busy ? 'Sending…' : 'Send'}
        </button>
      </div>
      {note && <p className="text-[12px] text-white/60" role="status">{note}</p>}
    </div>
  );
}
