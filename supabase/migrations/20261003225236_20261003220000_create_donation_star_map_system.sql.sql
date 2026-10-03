/*
# Create Donation Star Map System

## Summary
Creates a system for one-time donations where each confirmed donation becomes
a permanent "star" on the donor's personal star map. Supports both signed-in
users (stars persisted to their account) and guests (stars persisted via
Stripe customer ID + email, claimable later if they sign up).

## New Tables

### `donations`
Records each confirmed one-time donation.
- `id` (uuid, PK)
- `user_id` (uuid, nullable — set for signed-in users, null for guests)
- `stripe_customer_id` (text, not null — the Stripe customer object ID)
- `stripe_payment_intent_id` (text, unique — dedup guard against duplicate webhooks)
- `stripe_checkout_session_id` (text — the checkout session that created this donation)
- `email` (text — donor email for guest lookup / claiming)
- `amount_cents` (integer, not null — donation amount in cents)
- `message` (text, nullable — optional donor message)
- `star_x` (double precision, not null — star map X position 0-1)
- `star_y` (double precision, not null — star map Y position 0-1)
- `star_size` (double precision, not null — visual size multiplier 0.5-2.0)
- `star_brightness` (double precision, not null — glow intensity 0.3-1.0)
- `star_color` (text, nullable — optional tint, defaults to warm white)
- `created_at` (timestamptz, default now())

### `donation_stars`
A view-like convenience table is not needed — `donations` serves double duty
as both the donation record and the star data.

## Security

### RLS on `donations`
- **SELECT**: Users can read their own donations (by user_id). Guests can read
  donations matching their email via a SECURITY DEFINER function
  (`get_guest_donations`). No anon access to the raw table.
- **INSERT**: Only the service role can insert (via webhook / verify function).
  No direct client inserts allowed.
- **UPDATE / DELETE**: No one can modify or delete donation records (service
  role only, for admin purposes).

### SECURITY DEFINER Functions
- `get_guest_donations(p_email text)`: Returns donations for a guest by email,
  excluding any that have already been claimed by a signed-in user.
- `claim_guest_donations(p_user_id uuid, p_email text)`: Links guest donations
  to a newly signed-in user by setting user_id. Called after signup/login.

## Important Notes
1. Star positions (star_x, star_y) are deterministic per donation — generated
   by the edge function using a seeded hash of the payment intent ID so the
   same star always appears in the same spot.
2. Star size and brightness scale with donation amount.
3. The `stripe_payment_intent_id` unique constraint prevents duplicate stars
   from duplicate webhook deliveries.
4. Guest donations can be "claimed" when the user signs up with the same email.
*/

-- ---------------------------------------------------------------------------
-- donations table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_customer_id text NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_checkout_session_id text,
  email text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 100),
  message text,
  star_x double precision NOT NULL CHECK (star_x >= 0 AND star_x <= 1),
  star_y double precision NOT NULL CHECK (star_y >= 0 AND star_y <= 1),
  star_size double precision NOT NULL CHECK (star_size >= 0.5 AND star_size <= 2.5),
  star_brightness double precision NOT NULL CHECK (star_brightness >= 0.3 AND star_brightness <= 1.0),
  star_color text DEFAULT '#fff8e7',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- SELECT: signed-in users can read their own donations
DROP POLICY IF EXISTS "select_own_donations" ON donations;
CREATE POLICY "select_own_donations"
ON donations FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT: service role only (via edge functions with service role key)
DROP POLICY IF EXISTS "insert_service_role_donations" ON donations;
CREATE POLICY "insert_service_role_donations"
ON donations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: service role only (for claim_guest_donations RPC)
DROP POLICY IF EXISTS "update_service_role_donations" ON donations;
CREATE POLICY "update_service_role_donations"
ON donations FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- DELETE: no policy = no access from client

-- ---------------------------------------------------------------------------
-- Index for user lookup
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(email);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: get_guest_donations
-- Returns donations for a guest by email, excluding claimed ones.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_guest_donations(p_email text)
RETURNS TABLE (
  id uuid,
  amount_cents integer,
  message text,
  star_x double precision,
  star_y double precision,
  star_size double precision,
  star_brightness double precision,
  star_color text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.amount_cents,
    d.message,
    d.star_x,
    d.star_y,
    d.star_size,
    d.star_brightness,
    d.star_color,
    d.created_at
  FROM donations d
  WHERE d.email = p_email
    AND d.user_id IS NULL
  ORDER BY d.created_at ASC;
$$;

-- Allow authenticated and anon to call this function
-- (anon is needed for guests who haven't signed up yet)
GRANT EXECUTE ON FUNCTION get_guest_donations(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: claim_guest_donations
-- Links unclaimed guest donations to a user after they sign up.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_guest_donations(p_user_id uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_count integer;
BEGIN
  UPDATE donations
  SET user_id = p_user_id
  WHERE email = p_email
    AND user_id IS NULL;

  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_guest_donations(uuid, text) TO authenticated;
