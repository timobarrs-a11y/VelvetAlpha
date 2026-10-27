import { Sparkles } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { YourFeed } from '../components/social/YourFeed';

export default function ProgressFeedPage() {
  return (
    <PageShell
      width="md"
      header={
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" />
            <h1 className="text-lg font-bold text-white">Your Feed</h1>
          </div>
        </div>
      }
    >
      <YourFeed />
    </PageShell>
  );
}
