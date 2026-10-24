import { useEffect, useState } from 'react';
import { newsService } from '../services/newsService';

/** null while checking; false when the member hasn't picked any interests yet. */
export function useHasInterests(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    newsService.getUserAllInterests()
      .then(list => { if (!cancelled) setHas(list.length > 0); })
      .catch(() => { if (!cancelled) setHas(true); }); // don't block on a failed check
    return () => { cancelled = true; };
  }, []);
  return has;
}
