-- ============================================================
-- CharisHub — Schéma Supabase Complet
-- Exécuter dans l'éditeur SQL du dashboard Supabase
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Note: Les commandes DROP TABLE ont été retirées par sécurité.
-- Pour réinitialiser, utiliser des migrations manuelles ou l'UI Supabase.
-- ============================================================

-- ============================================================
-- 1. charishub_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  group_type TEXT NOT NULL DEFAULT 'general',
  created_by_name TEXT NOT NULL DEFAULT 'Utilisateur',
  created_by_device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  call_provider TEXT,
  call_link TEXT,
  next_call_at TIMESTAMPTZ,
  members_count INT NOT NULL DEFAULT 0,
  admin_ids TEXT[] DEFAULT '{}',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  price INT NOT NULL DEFAULT 0,
  pass_code TEXT DEFAULT '',
  session_tasks TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'public'
);

COMMENT ON COLUMN charishub_groups.group_type IS 'general, prayer, study, support, formation';

CREATE INDEX IF NOT EXISTS idx_groups_created_at ON charishub_groups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_groups_created_by_device_id ON charishub_groups(created_by_device_id);

ALTER TABLE charishub_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Groups are publicly readable" ON charishub_groups;
CREATE POLICY "Groups are publicly readable" ON charishub_groups
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON charishub_groups;
CREATE POLICY "Authenticated users can insert groups" ON charishub_groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Creator can update their own group" ON charishub_groups;
CREATE POLICY "Creator can update their own group" ON charishub_groups
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. charishub_group_members
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  guest_id TEXT DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Utilisateur',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'approved',
  role TEXT DEFAULT 'member',
  UNIQUE(group_id, user_id)
);

COMMENT ON COLUMN charishub_group_members.status IS 'pending, approved, rejected';
COMMENT ON COLUMN charishub_group_members.role IS 'member, admin';

CREATE INDEX IF NOT EXISTS idx_members_group_id ON charishub_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_members_device_id ON charishub_group_members(device_id);

ALTER TABLE charishub_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members are publicly readable" ON charishub_group_members;
CREATE POLICY "Members are publicly readable" ON charishub_group_members
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can join groups" ON charishub_group_members;
CREATE POLICY "Authenticated users can join groups" ON charishub_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Creator/Admin can update member status" ON charishub_group_members;
CREATE POLICY "Creator/Admin can update member status" ON charishub_group_members
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM charishub_groups g 
    WHERE g.id = charishub_group_members.group_id 
    AND (g.user_id = auth.uid() OR auth.uid()::text = ANY(g.admin_ids))
  ));
DROP POLICY IF EXISTS "Users can delete their own membership" ON charishub_group_members;
CREATE POLICY "Users can delete their own membership" ON charishub_group_members
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. charishub_posts
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  author_name TEXT NOT NULL DEFAULT 'Utilisateur',
  author_device_id TEXT DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  guest_id TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT,
  group_id UUID REFERENCES charishub_groups(id) ON DELETE SET NULL,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'general',
  visibility TEXT NOT NULL DEFAULT 'public'
);

COMMENT ON COLUMN charishub_posts.kind IS 'general, prayer, help, announcement, content';

CREATE INDEX IF NOT EXISTS idx_posts_group_id ON charishub_posts(group_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON charishub_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_kind ON charishub_posts(kind);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON charishub_posts(visibility);

ALTER TABLE charishub_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public posts are readable by all" ON charishub_posts;
CREATE POLICY "Public posts are readable by all" ON charishub_posts
  FOR SELECT USING (visibility = 'public');
DROP POLICY IF EXISTS "Authenticated users can create posts" ON charishub_posts;
CREATE POLICY "Authenticated users can create posts" ON charishub_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Author can update their own post" ON charishub_posts;
CREATE POLICY "Author can update their own post" ON charishub_posts
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Author can delete their own post" ON charishub_posts;
CREATE POLICY "Author can delete their own post" ON charishub_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. charishub_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES charishub_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  author_name TEXT NOT NULL DEFAULT 'Utilisateur',
  author_device_id TEXT DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  guest_id TEXT DEFAULT '',
  content TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON charishub_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON charishub_comments(created_at DESC);

ALTER TABLE charishub_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are publicly readable" ON charishub_comments;
CREATE POLICY "Comments are publicly readable" ON charishub_comments
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create comments" ON charishub_comments;
CREATE POLICY "Authenticated users can create comments" ON charishub_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Author can delete their own comment" ON charishub_comments;
CREATE POLICY "Author can delete their own comment" ON charishub_comments
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. community_stories
-- ============================================================
CREATE TABLE IF NOT EXISTS community_stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  author_name TEXT NOT NULL DEFAULT 'Utilisateur',
  author_device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  verse_reference TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  image_url TEXT,
  kind TEXT NOT NULL DEFAULT 'verse',
  config JSONB
);

COMMENT ON COLUMN community_stories.kind IS 'verse, text, image';

CREATE INDEX IF NOT EXISTS idx_stories_created_at ON community_stories(created_at DESC);

ALTER TABLE community_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stories are publicly readable" ON community_stories;
CREATE POLICY "Stories are publicly readable" ON community_stories
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create stories" ON community_stories;
CREATE POLICY "Authenticated users can create stories" ON community_stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5b. charishub_testimonials
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_testimonials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL DEFAULT 'Utilisateur',
  author_device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  category TEXT NOT NULL DEFAULT 'grace',
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  thumbnail_url TEXT,
  duration_sec INT,
  visibility TEXT NOT NULL DEFAULT 'group',
  status TEXT NOT NULL DEFAULT 'published',
  amens_count INT NOT NULL DEFAULT 0,
  gloires_count INT NOT NULL DEFAULT 0,
  prayers_count INT NOT NULL DEFAULT 0,
  CONSTRAINT testimonial_category_check CHECK (
    category IN ('guerison', 'provision', 'delivrance', 'transformation', 'grace', 'famille', 'priere')
  ),
  CONSTRAINT testimonial_media_type_check CHECK (
    media_type IS NULL OR media_type IN ('audio', 'video')
  ),
  CONSTRAINT testimonial_visibility_check CHECK (
    visibility IN ('group', 'public', 'private')
  ),
  CONSTRAINT testimonial_status_check CHECK (
    status IN ('published', 'reported', 'hidden')
  ),
  CONSTRAINT testimonial_content_or_media_check CHECK (
    NULLIF(BTRIM(COALESCE(content, '')), '') IS NOT NULL OR media_url IS NOT NULL
  )
);

ALTER TABLE charishub_testimonials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE charishub_testimonials ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE charishub_testimonials ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'group';
ALTER TABLE charishub_testimonials ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS charishub_testimonials_category_check;
ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS testimonial_category_check;
ALTER TABLE charishub_testimonials ADD CONSTRAINT testimonial_category_check CHECK (
  category IN ('guerison', 'provision', 'delivrance', 'transformation', 'grace', 'famille', 'priere')
);

ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS charishub_testimonials_media_type_check;
ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS testimonial_media_type_check;
ALTER TABLE charishub_testimonials ADD CONSTRAINT testimonial_media_type_check CHECK (
  media_type IS NULL OR media_type IN ('audio', 'video')
);

ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS testimonial_visibility_check;
ALTER TABLE charishub_testimonials ADD CONSTRAINT testimonial_visibility_check CHECK (
  visibility IN ('group', 'public', 'private')
);

ALTER TABLE charishub_testimonials DROP CONSTRAINT IF EXISTS testimonial_status_check;
ALTER TABLE charishub_testimonials ADD CONSTRAINT testimonial_status_check CHECK (
  status IN ('published', 'reported', 'hidden')
);

CREATE INDEX IF NOT EXISTS idx_testimonials_group_id ON charishub_testimonials(group_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON charishub_testimonials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_status ON charishub_testimonials(status);
CREATE INDEX IF NOT EXISTS idx_testimonials_visibility ON charishub_testimonials(visibility);

ALTER TABLE charishub_testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testimonials are readable" ON charishub_testimonials;
CREATE POLICY "Testimonials are readable" ON charishub_testimonials
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Anyone can create testimonials" ON charishub_testimonials;
CREATE POLICY "Anyone can create testimonials" ON charishub_testimonials
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Authors can update their own testimonials" ON charishub_testimonials;
CREATE POLICY "Authors can update their own testimonials" ON charishub_testimonials
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 5c. charishub_testimonial_reactions
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_testimonial_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  testimonial_id UUID NOT NULL REFERENCES charishub_testimonials(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('amens', 'gloires', 'prayers')),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT testimonial_reaction_actor_check CHECK (
    user_id IS NOT NULL OR NULLIF(BTRIM(COALESCE(device_id, '')), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_testimonial_reactions_testimonial_id
  ON charishub_testimonial_reactions(testimonial_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_testimonial_reactions_unique_user
  ON charishub_testimonial_reactions(testimonial_id, reaction, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_testimonial_reactions_unique_device
  ON charishub_testimonial_reactions(testimonial_id, reaction, device_id)
  WHERE user_id IS NULL AND device_id IS NOT NULL;

ALTER TABLE charishub_testimonial_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Testimonial reactions are readable" ON charishub_testimonial_reactions;
CREATE POLICY "Testimonial reactions are readable" ON charishub_testimonial_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can react to testimonials" ON charishub_testimonial_reactions;
CREATE POLICY "Anyone can react to testimonials" ON charishub_testimonial_reactions
  FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION increment_testimonial_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reaction = 'amens' THEN
    UPDATE charishub_testimonials
    SET amens_count = amens_count + 1
    WHERE id = NEW.testimonial_id;
  ELSIF NEW.reaction = 'gloires' THEN
    UPDATE charishub_testimonials
    SET gloires_count = gloires_count + 1
    WHERE id = NEW.testimonial_id;
  ELSIF NEW.reaction = 'prayers' THEN
    UPDATE charishub_testimonials
    SET prayers_count = prayers_count + 1
    WHERE id = NEW.testimonial_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_testimonial_reaction ON charishub_testimonial_reactions;
CREATE TRIGGER trg_increment_testimonial_reaction
AFTER INSERT ON charishub_testimonial_reactions
FOR EACH ROW
EXECUTE FUNCTION increment_testimonial_reaction_count();

-- ============================================================
-- 6. moderation_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  target_type TEXT NOT NULL DEFAULT 'post',
  target_id UUID NOT NULL,
  reason TEXT NOT NULL DEFAULT 'other',
  message TEXT,
  reporter_user_id TEXT,
  reporter_device_id TEXT,
  status TEXT NOT NULL DEFAULT 'open'
);

COMMENT ON COLUMN moderation_reports.reason IS 'spam, harassment, illegal, other';

ALTER TABLE moderation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can report" ON moderation_reports;
CREATE POLICY "Anyone can report" ON moderation_reports
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view reports" ON moderation_reports;
CREATE POLICY "Admins can view reports" ON moderation_reports
  FOR SELECT USING (true);

-- ============================================================
-- 7. push_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  subscription_json JSONB,
  locale TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_device_id ON push_subscriptions(device_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON push_subscriptions;
CREATE POLICY "Anyone can subscribe" ON push_subscriptions
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated users can update their signature" ON push_subscriptions;
CREATE POLICY "Authenticated users can update their signature" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Anyone can unsubscribe" ON push_subscriptions;
CREATE POLICY "Anyone can unsubscribe" ON push_subscriptions
  FOR DELETE USING (true);

-- ============================================================
-- 8. charishub_group_calls
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_group_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN charishub_group_calls.status IS 'ringing, active, ended';

CREATE INDEX IF NOT EXISTS idx_calls_group_id ON charishub_group_calls(group_id);
CREATE INDEX IF NOT EXISTS idx_calls_status ON charishub_group_calls(status);

ALTER TABLE charishub_group_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calls are publicly readable" ON charishub_group_calls;
CREATE POLICY "Calls are publicly readable" ON charishub_group_calls
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can start calls" ON charishub_group_calls;
CREATE POLICY "Authenticated users can start calls" ON charishub_group_calls
  FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator can end calls" ON charishub_group_calls;
CREATE POLICY "Creator can end calls" ON charishub_group_calls
  FOR UPDATE USING (auth.uid() = created_by);

-- ============================================================
-- 9. charishub_group_call_invites
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_group_call_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES charishub_group_calls(id) ON DELETE CASCADE,
  group_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  state TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_id, device_id)
);

COMMENT ON COLUMN charishub_group_call_invites.state IS 'pending, accept, decline, miss';

CREATE INDEX IF NOT EXISTS idx_invites_call_id ON charishub_group_call_invites(call_id);
CREATE INDEX IF NOT EXISTS idx_invites_device_id ON charishub_group_call_invites(device_id);

ALTER TABLE charishub_group_call_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Invites are publicly readable" ON charishub_group_call_invites;
CREATE POLICY "Invites are publicly readable" ON charishub_group_call_invites
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can respond to invites" ON charishub_group_call_invites;
CREATE POLICY "Anyone can respond to invites" ON charishub_group_call_invites
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update invites" ON charishub_group_call_invites;
CREATE POLICY "Anyone can update invites" ON charishub_group_call_invites
  FOR UPDATE USING (true);

-- ============================================================
-- 10. community_group_call_presence
-- ============================================================
CREATE TABLE IF NOT EXISTS community_group_call_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  user_id UUID REFERENCES auth.users(id),
  guest_id TEXT DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Utilisateur',
  audio_enabled BOOLEAN NOT NULL DEFAULT true,
  video_enabled BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  shared_bible_ref TEXT,
  shared_bible_content TEXT,
  prayer_flow_open BOOLEAN DEFAULT false,
  prayer_flow_step_index INT DEFAULT 0,
  UNIQUE(group_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_group_id ON community_group_call_presence(group_id);

ALTER TABLE community_group_call_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Presence is publicly readable" ON community_group_call_presence;
CREATE POLICY "Presence is publicly readable" ON community_group_call_presence
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can update presence" ON community_group_call_presence;
CREATE POLICY "Authenticated users can update presence" ON community_group_call_presence
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can delete their own presence" ON community_group_call_presence;
CREATE POLICY "Authenticated users can delete their own presence" ON community_group_call_presence
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 11. community_group_call_events
-- ============================================================
CREATE TABLE IF NOT EXISTS community_group_call_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  group_id TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  guest_id TEXT DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Invite',
  event_type TEXT NOT NULL,
  payload JSONB
);

COMMENT ON COLUMN community_group_call_events.event_type IS 'join, leave, mute, unmute, video_on, video_off, mode_audio, mode_video, error';

CREATE INDEX IF NOT EXISTS idx_events_group_id ON community_group_call_events(group_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON community_group_call_events(created_at DESC);

ALTER TABLE community_group_call_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can log events" ON community_group_call_events;
CREATE POLICY "Authenticated users can log events" ON community_group_call_events
  FOR INSERT WITH CHECK (true); -- On laisse loggable s'il y a un user_id, ou on restreint si besoin
DROP POLICY IF EXISTS "Events are publicly readable" ON community_group_call_events;
CREATE POLICY "Events are publicly readable" ON community_group_call_events
  FOR SELECT USING (true);

-- ============================================================
-- 12. charishub_group_challenges
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_group_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_group_id ON charishub_group_challenges(group_id);

ALTER TABLE charishub_group_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Challenges are publicly readable" ON charishub_group_challenges;
CREATE POLICY "Challenges are publicly readable" ON charishub_group_challenges
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can create challenges" ON charishub_group_challenges;
CREATE POLICY "Anyone can create challenges" ON charishub_group_challenges
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 13. charishub_post_likes
-- ============================================================
CREATE TABLE IF NOT EXISTS charishub_post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES charishub_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id),
    CONSTRAINT one_id_required CHECK (user_id IS NOT NULL OR device_id IS NOT NULL)
);

ALTER TABLE charishub_post_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Likes are publicly readable" ON charishub_post_likes;
CREATE POLICY "Likes are publicly readable" ON charishub_post_likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can toggle their own likes" ON charishub_post_likes;
CREATE POLICY "Authenticated users can toggle their own likes" ON charishub_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Authenticated users can delete their own likes" ON charishub_post_likes;
CREATE POLICY "Authenticated users can delete their own likes" ON charishub_post_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 14. community_call_summaries
-- ============================================================
CREATE TABLE IF NOT EXISTS community_call_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES charishub_group_calls(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    key_points TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    version INT DEFAULT 1
);

ALTER TABLE community_call_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Summaries are readable by group members" ON community_call_summaries;
CREATE POLICY "Summaries are readable by group members" ON community_call_summaries
  FOR SELECT USING (true); -- Simplifié pour l'instant

-- ============================================================
-- FONCTION: Fonction pour supprimer un groupe et ses dépendances
-- ============================================================
CREATE OR REPLACE FUNCTION delete_group_with_cascade(p_group_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Supprimer les membres
  DELETE FROM charishub_group_members WHERE group_id = p_group_id;
  -- Supprimer les posts du groupe
  DELETE FROM charishub_posts WHERE group_id = p_group_id;
  -- Supprimer les challenges
  DELETE FROM charishub_group_challenges WHERE group_id = p_group_id;
  -- Supprimer le groupe
  DELETE FROM charishub_groups WHERE id = p_group_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FONCTION: Incrémenter le compteur de membres
-- ============================================================
CREATE OR REPLACE FUNCTION increment_member_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE charishub_groups
  SET members_count = members_count + 1
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_members
AFTER INSERT ON charishub_group_members
FOR EACH ROW
EXECUTE FUNCTION increment_member_count();

-- ============================================================
-- FONCTION: Décrémenter le compteur de membres
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_member_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE charishub_groups
  SET members_count = GREATEST(0, members_count - 1)
  WHERE id = OLD.group_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_decrement_members
AFTER DELETE ON charishub_group_members
FOR EACH ROW
EXECUTE FUNCTION decrement_member_count();

-- ============================================================
-- FONCTION: Incrémenter comments_count
-- ============================================================
CREATE OR REPLACE FUNCTION increment_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE charishub_posts
  SET comments_count = comments_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_comments
AFTER INSERT ON charishub_comments
FOR EACH ROW
EXECUTE FUNCTION increment_comment_count();

-- ============================================================
-- FONCTION: toggle_like
-- ============================================================
CREATE OR REPLACE FUNCTION toggle_like(p_post_id UUID, p_device_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_liked BOOLEAN;
    v_likes_count INT;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM charishub_post_likes WHERE post_id = p_post_id AND user_id = v_user_id) INTO v_liked;
    ELSE
        SELECT EXISTS (SELECT 1 FROM charishub_post_likes WHERE post_id = p_post_id AND device_id = p_device_id AND user_id IS NULL) INTO v_liked;
    END IF;

    IF v_liked THEN
        IF v_user_id IS NOT NULL THEN
            DELETE FROM charishub_post_likes WHERE post_id = p_post_id AND user_id = v_user_id;
        ELSE
            DELETE FROM charishub_post_likes WHERE post_id = p_post_id AND device_id = p_device_id AND user_id IS NULL;
        END IF;
        
        UPDATE charishub_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id
        RETURNING likes_count INTO v_likes_count;
    ELSE
        INSERT INTO charishub_post_likes (post_id, user_id, device_id)
        VALUES (p_post_id, v_user_id, p_device_id);
        
        UPDATE charishub_posts SET likes_count = likes_count + 1 WHERE id = p_post_id
        RETURNING likes_count INTO v_likes_count;
    END IF;

    RETURN jsonb_build_object('liked', NOT v_liked, 'likes_count', v_likes_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FONCTION: link_device_to_user
-- ============================================================
CREATE OR REPLACE FUNCTION link_device_to_user(p_device_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non authentifié'; END IF;

  UPDATE charishub_groups SET user_id = v_user_id WHERE created_by_device_id = p_device_id AND user_id IS NULL;
  UPDATE charishub_group_members SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE charishub_posts SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  UPDATE charishub_comments SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  UPDATE community_stories SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  UPDATE charishub_testimonials SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  UPDATE push_subscriptions SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;

  UPDATE user_sync_metadata SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_bible_highlights SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_bible_notes SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_bible_bookmarks SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_pepites SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_reading_progress SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_reading_streak SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_prayer_sessions SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_prayer_journal SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_study_tags SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_data_exports SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  UPDATE user_reading_reflections SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Storage Buckets (à créer manuellement dans le dashboard)
-- ============================================================
-- 1. community-media (public)
-- 2. stories (public)
--
-- SQL pour les créer automatiquement:
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Policy pour community-media
CREATE POLICY "Authenticated users can upload to community-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'community-media' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view community-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-media');

CREATE POLICY "Authenticated users can delete from community-media"
ON storage.objects FOR DELETE
USING (bucket_id = 'community-media' AND auth.uid() = owner);

-- Policy pour stories
CREATE POLICY "Authenticated users can upload stories"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'stories' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view stories"
ON storage.objects FOR SELECT
USING (bucket_id = 'stories');

CREATE POLICY "Authenticated users can delete stories"
ON storage.objects FOR DELETE
USING (bucket_id = 'stories' AND auth.uid() = owner);

-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================
