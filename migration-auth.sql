-- ============================================================
-- MIGRATION : Système de Comptes (Supabase Auth + Profiles)
-- À exécuter dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Table des profils (liée à auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pour profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON profiles;
CREATE POLICY "Profiles are readable by authenticated users" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Mise à jour des tables existantes pour inclure user_id
-- Utilisation de DO blocks pour l'idempotence des colonnes

DO $migration$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'charishub_groups' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE charishub_groups ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'charishub_group_members' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE charishub_group_members ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'charishub_posts' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE charishub_posts ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'charishub_comments' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE charishub_comments ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'community_stories' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE community_stories ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'push_subscriptions' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE push_subscriptions ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'community_group_call_presence' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE community_group_call_presence ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'community_group_call_events' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE community_group_call_events ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  -- Tables User Data (Bible, Prayer, etc.)
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_bible_highlights' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_bible_highlights ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_bible_notes' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_bible_notes ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_bible_bookmarks' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_bible_bookmarks ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_pepites' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_pepites ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_reading_progress' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_reading_progress ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_reading_streak' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_reading_streak ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_prayer_sessions' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_prayer_sessions ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'user_prayer_journal' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_prayer_journal ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'public' AND TABLE_NAME = 'user_sync_metadata' AND COLUMN_NAME = 'user_id') THEN
    ALTER TABLE user_sync_metadata ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $migration$;

-- 3. Activation du RLS sur toutes les tables communautaires
ALTER TABLE charishub_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE charishub_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE charishub_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE charishub_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_group_call_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_group_call_events ENABLE ROW LEVEL SECURITY;

-- Activation RLS pour User Data
ALTER TABLE user_bible_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bible_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bible_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pepites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reading_streak ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prayer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_prayer_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sync_metadata ENABLE ROW LEVEL SECURITY;

-- 4. Politiques RLS (Basées sur user_id et authentification)

-- ==========================================
-- TABLE: charishub_groups
-- ==========================================
DROP POLICY IF EXISTS "Public groups are readable" ON charishub_groups;
DROP POLICY IF EXISTS "Groups are readable by authenticated users" ON charishub_groups;
CREATE POLICY "Groups are readable by everyone" ON charishub_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create groups" ON charishub_groups;
CREATE POLICY "Authenticated users can create groups" ON charishub_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creator can update their own group" ON charishub_groups;
CREATE POLICY "Creator can update their own group" ON charishub_groups
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- TABLE: charishub_group_members
-- ==========================================
DROP POLICY IF EXISTS "Group members are readable by authenticated users" ON charishub_group_members;
CREATE POLICY "Group members are readable by everyone" ON charishub_group_members
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can join groups" ON charishub_group_members;
CREATE POLICY "Authenticated users can join groups" ON charishub_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave their own memberships" ON charishub_group_members;
CREATE POLICY "Users can leave their own memberships" ON charishub_group_members
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: charishub_posts
-- ==========================================
DROP POLICY IF EXISTS "Posts are readable" ON charishub_posts;
DROP POLICY IF EXISTS "Posts are readable by authenticated users" ON charishub_posts;
CREATE POLICY "Posts are readable by everyone" ON charishub_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors can create their own posts" ON charishub_posts;
CREATE POLICY "Authors can create their own posts" ON charishub_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Author can update their own post" ON charishub_posts;
CREATE POLICY "Author can update their own post" ON charishub_posts
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Author can delete their own post" ON charishub_posts;
CREATE POLICY "Author can delete their own post" ON charishub_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: charishub_comments
-- ==========================================
DROP POLICY IF EXISTS "Comments are readable by authenticated users" ON charishub_comments;
CREATE POLICY "Comments are readable by everyone" ON charishub_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors can create their own comments" ON charishub_comments;
CREATE POLICY "Authors can create their own comments" ON charishub_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can update their own comments" ON charishub_comments;
CREATE POLICY "Authors can update their own comments" ON charishub_comments
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete their own comments" ON charishub_comments;
CREATE POLICY "Authors can delete their own comments" ON charishub_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: community_stories
-- ==========================================
DROP POLICY IF EXISTS "Stories are readable by authenticated users" ON community_stories;
CREATE POLICY "Stories are readable by everyone" ON community_stories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors can create their own stories" ON community_stories;
CREATE POLICY "Authors can create their own stories" ON community_stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete their own stories" ON community_stories;
CREATE POLICY "Authors can delete their own stories" ON community_stories
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: community_group_call_presence
-- ==========================================
DROP POLICY IF EXISTS "Presence is readable by authenticated users" ON community_group_call_presence;
CREATE POLICY "Presence is readable by everyone" ON community_group_call_presence
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can upsert their own presence" ON community_group_call_presence;
CREATE POLICY "Users can upsert their own presence" ON community_group_call_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own presence" ON community_group_call_presence;
CREATE POLICY "Users can update their own presence" ON community_group_call_presence
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own presence" ON community_group_call_presence;
CREATE POLICY "Users can delete their own presence" ON community_group_call_presence
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- TABLE: community_group_call_events
-- ==========================================
DROP POLICY IF EXISTS "Events are readable by authenticated users" ON community_group_call_events;
CREATE POLICY "Events are readable by everyone" ON community_group_call_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can log their own events" ON community_group_call_events;
CREATE POLICY "Users can log their own events" ON community_group_call_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- TABLE: push_subscriptions
-- ==========================================
DROP POLICY IF EXISTS "Subscriptions are readable by authenticated users" ON push_subscriptions;
CREATE POLICY "Subscriptions are readable by authenticated users" ON push_subscriptions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON push_subscriptions
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- TABLES: USER DATA (Bible, Prayer, Progress)
-- ==========================================
DROP POLICY IF EXISTS "Users can manage their highlights" ON user_bible_highlights;
CREATE POLICY "Users can manage their highlights" ON user_bible_highlights
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their notes" ON user_bible_notes;
CREATE POLICY "Users can manage their notes" ON user_bible_notes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their bookmarks" ON user_bible_bookmarks;
CREATE POLICY "Users can manage their bookmarks" ON user_bible_bookmarks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their pepites" ON user_pepites;
CREATE POLICY "Users can manage their pepites" ON user_pepites
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their progress" ON user_reading_progress;
CREATE POLICY "Users can manage their progress" ON user_reading_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their streak" ON user_reading_streak;
CREATE POLICY "Users can manage their streak" ON user_reading_streak
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their prayer sessions" ON user_prayer_sessions;
CREATE POLICY "Users can manage their prayer sessions" ON user_prayer_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their prayer journal" ON user_prayer_journal;
CREATE POLICY "Users can manage their prayer journal" ON user_prayer_journal
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their sync metadata" ON user_sync_metadata;
CREATE POLICY "Users can manage their sync metadata" ON user_sync_metadata
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Trigger pour créer un profil automatique lors du signup (Idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Utilisateur'),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Index de performance pour les nouvelles colonnes user_id
CREATE INDEX IF NOT EXISTS idx_charishub_groups_user_id ON charishub_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_charishub_group_members_user_id ON charishub_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_charishub_posts_user_id ON charishub_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_charishub_comments_user_id ON charishub_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_stories_user_id ON community_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_call_presence_user_id ON community_group_call_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_group_call_events_user_id ON community_group_call_events(user_id);

-- Index de performance pour les tables User Data
CREATE INDEX IF NOT EXISTS idx_user_bible_highlights_user_id ON user_bible_highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bible_notes_user_id ON user_bible_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bible_bookmarks_user_id ON user_bible_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pepites_user_id ON user_pepites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reading_progress_user_id ON user_reading_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reading_streak_user_id ON user_reading_streak(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prayer_sessions_user_id ON user_prayer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_prayer_journal_user_id ON user_prayer_journal(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sync_metadata_user_id ON user_sync_metadata(user_id);
