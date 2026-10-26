import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookieConsent');
    if (!cookieConsent) {
      setShowConsent(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShowConsent(false);
  };

  const handleReject = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    localStorage.setItem('cookieConsentDate', new Date().toISOString());
    setShowConsent(false);
  };

  if (!showConsent) return null;

  // A small card just under the top bar: the chat box and the chat tray
  // along the bottom stay fully visible and usable while it waits.
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="pointer-events-none fixed inset-x-0 top-[calc(4.25rem+env(safe-area-inset-top))] z-[60] flex justify-center px-3 sm:top-[calc(4.75rem+env(safe-area-inset-top))] [@media(max-height:500px)]:top-[calc(3.25rem+env(safe-area-inset-top))]"
    >
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-[#f5cfe0] bg-[#fff7fa]/95 px-3 py-2 text-[#2a1424] shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur">
        <p className="min-w-0 flex-1 text-[11.5px] leading-snug sm:text-xs">
          We use cookies to improve Velvet and personalise it for you.{' '}
          <a href="/privacy" className="font-semibold text-pink-600 underline hover:text-pink-700">
            Learn more
          </a>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleReject}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#2a1424]/70 transition-colors hover:bg-[#2a1424]/5"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="flex items-center gap-1 rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-pink-600"
          >
            <Check className="h-3.5 w-3.5" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
