-- ============================================================
-- Migration: Lien entre device_id et user_id (Supabase Auth)
-- Cet objet permet de rattacher les données créées en mode "invité"
-- à un compte utilisateur réel lors de la première connexion.
-- ============================================================

CREATE OR REPLACE FUNCTION link_device_to_user(p_device_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- 1. Groupes
  UPDATE charishub_groups SET user_id = v_user_id WHERE created_by_device_id = p_device_id AND user_id IS NULL;
  
  -- 2. Membres de groupes
  UPDATE charishub_group_members SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;
  
  -- 3. Posts
  UPDATE charishub_posts SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  
  -- 4. Commentaires
  UPDATE charishub_comments SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  
  -- 5. Stories
  UPDATE community_stories SET user_id = v_user_id WHERE author_device_id = p_device_id AND user_id IS NULL;
  
  -- 6. Souscriptions Push
  UPDATE push_subscriptions SET user_id = v_user_id WHERE device_id = p_device_id AND user_id IS NULL;

  -- 7. Données de Backup & Sync
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
