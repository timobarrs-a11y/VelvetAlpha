import { supabase } from '../shared/supabase/client';

export interface DonationStar {
  id: string;
  amount_cents: number;
  message: string | null;
  star_x: number;
  star_y: number;
  star_size: number;
  star_brightness: number;
  star_color: string;
  created_at: string;
}

export interface VerifyDonationResult {
  verified: boolean;
  star: DonationStar | null;
  duplicate: boolean;
}

export const PRESET_AMOUNTS = [
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' },
  { cents: 2000, label: '$20' },
  { cents: 5000, label: '$50' },
  { cents: 7500, label: '$75' },
  { cents: 10000, label: '$100' },
];

export async function createDonationSession(amountCents: number, message?: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-donation-session`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ amountCents, message }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to start donation checkout');
  }

  const { url } = await response.json();
  return url;
}

export async function verifyDonation(sessionId: string): Promise<VerifyDonationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-donation`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to verify donation');
  }

  return await response.json();
}

export async function fetchUserDonations(): Promise<DonationStar[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('donations')
    .select('id, amount_cents, message, star_x, star_y, star_size, star_brightness, star_color, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching user donations:', error);
    return [];
  }

  return data ?? [];
}

export async function fetchGuestDonations(email: string): Promise<DonationStar[]> {
  const { data, error } = await supabase.rpc('get_guest_donations', { p_email: email });

  if (error) {
    console.error('Error fetching guest donations:', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    amount_cents: row.amount_cents as number,
    message: row.message as string | null,
    star_x: row.star_x as number,
    star_y: row.star_y as number,
    star_size: row.star_size as number,
    star_brightness: row.star_brightness as number,
    star_color: row.star_color as string,
    created_at: row.created_at as string,
  }));
}
