import { useState } from 'react';
import { authService } from '../../services/authService';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/** "Continue with Google", for the login and sign-up pages, with an "or" divider above the email form. */
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await authService.signInWithGoogle();
    } catch (err: any) {
      onError(err.message || 'We could not reach Google. Please try again.');
      setBusy(false);
    }
  };
  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 rounded-xl py-3 text-sm font-semibold text-gray-800 bg-white hover:bg-gray-100 transition-colors disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <div className="flex items-center gap-3 mt-6 text-xs text-ink-muted">
        <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
        or use email
        <span className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
      </div>
    </div>
  );
}
