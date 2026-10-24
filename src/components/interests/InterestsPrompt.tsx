import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

/** Shown in place of features that need interests (Daily Feed, Your Lens, V3 home). */
export function InterestsPrompt({ feature }: { feature: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-pink-400/25 bg-pink-500/10">
          <Sparkles className="h-8 w-8 text-pink-300" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-white">Pick your interests</h2>
        <p className="mb-6 text-sm text-white/60">
          {feature} is built around what you're into. Choose a few interests and it fills up with things picked for you.
        </p>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-pink-500"
        >
          Choose interests
        </button>
      </div>
    </div>
  );
}
