import { lazy, Suspense } from 'react';
import { useAvatarEditor } from '../stores/avatarEditorStore';

// The editor (the avatar creator and its renderers, about 150 KB) loads the first time someone opens it.
const AvatarEditorModal = lazy(() => import('./AvatarEditorModal').then((m) => ({ default: m.AvatarEditorModal })));

// Mounted once (in the Router). Opens whenever something calls useAvatarEditor().open:
// a face in the sidebar, a chat, or your own avatar in the toolbar.
export function AvatarEditorHost() {
  const target = useAvatarEditor((s) => s.target);
  const close = useAvatarEditor((s) => s.close);
  if (!target) return null;
  return (
    <Suspense fallback={null}>
      <AvatarEditorModal key={target.kind === 'user' ? 'user' : target.id} target={target} onClose={close} />
    </Suspense>
  );
}
