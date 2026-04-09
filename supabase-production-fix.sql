-- ============================================================
-- SQL Fix for CharisHub Production (Supabase)
-- Execute this in the SQL Editor of your Supabase dashboard.
-- ============================================================

-- 1. Missing RPC: link_device_to_user
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
  UPDATE push_subscriptions SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;

  -- Metadata & Bible Data
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

-- 2. Missing Table: charishub_post_likes (needed for toggle_like)
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

-- 3. Missing RPC: toggle_like
CREATE OR REPLACE FUNCTION toggle_like(p_post_id UUID, p_device_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_liked BOOLEAN;
    v_likes_count INT;
BEGIN
    v_user_id := auth.uid();

    -- Check if already liked by this user or device (if guest)
    IF v_user_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM charishub_post_likes WHERE post_id = p_post_id AND user_id = v_user_id) INTO v_liked;
    ELSE
        SELECT EXISTS (SELECT 1 FROM charishub_post_likes WHERE post_id = p_post_id AND device_id = p_device_id AND user_id IS NULL) INTO v_liked;
    END IF;

    IF v_liked THEN
        -- Unlike
        IF v_user_id IS NOT NULL THEN
            DELETE FROM charishub_post_likes WHERE post_id = p_post_id AND user_id = v_user_id;
        ELSE
            DELETE FROM charishub_post_likes WHERE post_id = p_post_id AND device_id = p_device_id AND user_id IS NULL;
        END IF;
        
        UPDATE charishub_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_post_id
        RETURNING likes_count INTO v_likes_count;
    ELSE
        -- Like
        INSERT INTO charishub_post_likes (post_id, user_id, device_id)
        VALUES (p_post_id, v_user_id, p_device_id);
        
        UPDATE charishub_posts SET likes_count = likes_count + 1 WHERE id = p_post_id
        RETURNING likes_count INTO v_likes_count;
    END IF;

    RETURN jsonb_build_object('liked', NOT v_liked, 'likes_count', v_likes_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Missing Table: community_call_summaries
CREATE TABLE IF NOT EXISTS community_call_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES charishub_group_calls(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES charishub_groups(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    key_points TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    version INT DEFAULT 1
);

-- 5. Fix Constraints: community_group_call_presence
ALTER TABLE community_group_call_presence DROP CONSTRAINT IF EXISTS community_group_call_presence_group_id_user_id_key;
ALTER TABLE community_group_call_presence DROP CONSTRAINT IF EXISTS community_group_call_presence_group_id_device_id_key;
ALTER TABLE community_group_call_presence ADD CONSTRAINT community_group_call_presence_group_id_device_id_key UNIQUE(group_id, device_id);

-- 6. Add missing user_id columns to backup tables on production if needed
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_study_tags' AND column_name='user_id') THEN
        ALTER TABLE user_study_tags ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_data_exports' AND column_name='user_id') THEN
        ALTER TABLE user_data_exports ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='charishub_group_call_invites' AND column_name='user_id') THEN
        ALTER TABLE charishub_group_call_invites ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;
