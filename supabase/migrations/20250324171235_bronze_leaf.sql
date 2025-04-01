/*
  # Initial Schema Setup for Faction Manager

  1. New Tables
    - `factions`: Basic faction information and settings
    - `faction_members`: Member relationships and roles
    - `fines`: Fine tracking system
    - `meetings`: Meeting scheduling
    - `meeting_attendance`: Meeting RSVP tracking
    - `subscriptions`: Update preferences
    - `radio_settings`: Radio configuration
    - `polls`: Voting system
    - `poll_votes`: Vote tracking

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access
*/

-- Factions table
CREATE TABLE IF NOT EXISTS factions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  prefix text DEFAULT '!',
  timezone text DEFAULT 'UTC',
  appearance jsonb DEFAULT '{"color": "#0099ff"}'::jsonb,
  discord_guild_id text UNIQUE NOT NULL,
  admin_role_id text,
  fine_role_id text,
  meeting_channel_id text,
  radio_channel_id text,
  voting_channel_id text,
  fine_log_channel_id text
);

-- Faction members table
CREATE TABLE IF NOT EXISTS faction_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('LEADER', 'OFFICER', 'MEMBER')),
  joined_at timestamptz DEFAULT now(),
  phone text,
  twitter text,
  profile_photo_url text,
  UNIQUE(faction_id, discord_user_id)
);

-- Fines table
CREATE TABLE IF NOT EXISTS fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE,
  issued_to_user_id text NOT NULL,
  issued_by_user_id text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now(),
  paid boolean DEFAULT false
);

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  scheduled_for timestamptz NOT NULL,
  created_by_user_id text NOT NULL,
  is_emergency boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  notify_roles jsonb DEFAULT '[]'::jsonb
);

-- Meeting attendance table
CREATE TABLE IF NOT EXISTS meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('ATTENDING', 'DECLINED', 'MAYBE')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(meeting_id, discord_user_id)
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  updates_enabled boolean DEFAULT true,
  notification_channel text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(faction_id, discord_user_id)
);

-- Radio settings table
CREATE TABLE IF NOT EXISTS radio_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE UNIQUE,
  frequency text NOT NULL,
  format text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faction_id uuid REFERENCES factions(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id text NOT NULL,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Poll votes table
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  discord_user_id text NOT NULL,
  option_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, discord_user_id)
);

-- Enable RLS
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE faction_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Faction members can view their faction"
  ON factions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM faction_members
      WHERE faction_members.faction_id = factions.id
      AND faction_members.discord_user_id = (auth.jwt() ->> 'discord_user_id')
    )
  );

CREATE POLICY "Officers can update faction settings"
  ON factions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM faction_members
      WHERE faction_members.faction_id = factions.id
      AND faction_members.discord_user_id = (auth.jwt() ->> 'discord_user_id')
      AND faction_members.role IN ('LEADER', 'OFFICER')
    )
  );

-- Member policies
CREATE POLICY "Members can view their own faction members"
  ON faction_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM faction_members AS fm
      WHERE fm.faction_id = faction_members.faction_id
      AND fm.discord_user_id = (auth.jwt() ->> 'discord_user_id')
    )
  );

-- Fine policies
CREATE POLICY "Members can view fines in their faction"
  ON fines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM faction_members
      WHERE faction_members.faction_id = fines.faction_id
      AND faction_members.discord_user_id = (auth.jwt() ->> 'discord_user_id')
    )
  );

-- Meeting policies
CREATE POLICY "Members can view meetings in their faction"
  ON meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM faction_members
      WHERE faction_members.faction_id = meetings.faction_id
      AND faction_members.discord_user_id = (auth.jwt() ->> 'discord_user_id')
    )
  );

-- Poll policies
CREATE POLICY "Members can view polls in their faction"
  ON polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM faction_members
      WHERE faction_members.faction_id = polls.faction_id
      AND faction_members.discord_user_id = (auth.jwt() ->> 'discord_user_id')
    )
  );