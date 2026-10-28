import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { Button } from '../shared/ui';
import { TERMS_VERSION } from '../shared/auth/termsVersion';

/** One-time stop for people who arrived with Google, who skip the sign-up form where the Terms are accepted. */
export function AcceptTermsPage() {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const accept = async () => {
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('accept_terms', { p_terms_version: TERMS_VERSION });
    const result = data as { success?: boolean } | null;
    if (rpcError || !result?.success) {
      setError('We could not save that. Please try again.');
      setBusy(false);
      return;
    }
    navigate('/lobby', { replace: true });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--ds-bg-page)' }}>
      <div className="max-w-md w-full rounded-3xl p-8" style={{ background: 'var(--ds-surface-3)', border: '1px solid var(--ds-border-strong)' }}>
        <div className="flex justify-center mb-3">
          <Heart className="w-8 h-8 text-pink-400" fill="currentColor" />
        </div>
        <h1 className="text-2xl font-bold text-white font-display text-center mb-1">One last thing</h1>
        <p className="text-ink-secondary text-sm text-center mb-6">
          Velvet is for people 18 and over. Next we'll ask for your birthday, and first we need your OK on our terms.
        </p>

        {error && <p className="text-red-300 text-sm mb-4 text-center">{error}</p>}

        <label className="flex items-start gap-3 mb-3 text-sm text-ink-secondary cursor-pointer">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-1" />
          <span>I accept the <Link to="/terms" target="_blank" className="underline text-pink-300">Terms of Service</Link> (version {TERMS_VERSION}).</span>
        </label>
        <label className="flex items-start gap-3 mb-6 text-sm text-ink-secondary cursor-pointer">
          <input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} className="mt-1" />
          <span>I accept the <Link to="/privacy" target="_blank" className="underline text-pink-300">Privacy Policy</Link>.</span>
        </label>

        <Button onClick={accept} disabled={!terms || !privacy || busy} isLoading={busy} fullWidth size="lg">Continue</Button>
        <button type="button" onClick={signOut} className="mt-4 w-full text-center text-xs text-gray-500 hover:text-white transition-colors">
          Not now, sign out
        </button>
      </div>
    </div>
  );
}
