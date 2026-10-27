import { supabase } from '../../shared/supabase/client';

const FUNCTION_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

/** Where the user is: their hour for the greeting, their date and offset for scheduling. */
function localContext() {
  const now = new Date();
  return {
    localHour: now.getHours(),
    localDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    tzOffset: now.getTimezoneOffset(),
  };
}

/** One call to the atlas-onboarding function, as the signed-in user. */
export async function callAtlas(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const response = await fetch(`${FUNCTION_BASE}/atlas-onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...localContext(), ...body }),
  });
  if (!response.ok) throw new Error(`atlas-onboarding ${body.phase}: ${response.status}`);
  return response.json();
}
