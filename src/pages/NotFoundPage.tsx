import { useNavigate } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Signed-in users go back to their home (RootRedirect figures out where);
  // signed-out users go to the public welcome screen.
  const homePath = user ? '/' : '/welcome';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)' }}
    >
      <div className="text-center max-w-md">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center ring-2 ring-white/10 bg-white/5">
            <Heart className="w-7 h-7 text-pink-400" fill="currentColor" />
          </div>
        </div>

        <p className="text-6xl font-black text-white/90 mb-2 tracking-tight">404</p>
        <h1 className="text-xl font-bold text-white mb-2">This page wandered off</h1>
        <p className="text-blue-200/60 text-sm mb-8">
          The page you're looking for doesn't exist or may have moved. Let's get you back.
        </p>

        <button
          onClick={() => navigate(homePath, { replace: true })}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-all"
          style={{
            background: 'rgba(244,63,107,0.14)',
            border: '1px solid rgba(244,63,107,0.35)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,107,0.24)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,107,0.14)';
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </button>
      </div>
    </div>
  );
}

export default NotFoundPage;
