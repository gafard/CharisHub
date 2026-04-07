-- ============================================================
-- CharisHub — Schéma de Backup & Sync Cloud
-- Extension du schéma existant pour sauvegarder les données locales
-- ============================================================

-- Enable UUID extension (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Note: Les commandes DROP TABLE ont été retirées par sécurité.
-- ============================================================

-- ============================================================
-- 1. user_sync_metadata — Métadonnées de sync par appareil
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  display_name TEXT,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  sync_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE user_sync_metadata IS 'Métadonnées de synchronisation par appareil';

CREATE INDEX IF NOT EXISTS idx_sync_device_id ON user_sync_metadata(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_last_sync ON user_sync_metadata(last_sync_at DESC);

ALTER TABLE user_sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sync metadata" ON user_sync_metadata
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sync metadata" ON user_sync_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sync metadata" ON user_sync_metadata
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 2. user_bible_highlights — Surlignages Bible
-- ============================================================
CREATE TABLE IF NOT EXISTS user_bible_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter INT NOT NULL,
  verse INT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'lsg',
  color TEXT NOT NULL DEFAULT 'yellow',
  verse_text TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_slug, chapter, verse, translation)
);

COMMENT ON TABLE user_bible_highlights IS 'Surlignages Bible par utilisateur';

CREATE INDEX IF NOT EXISTS idx_highlights_device ON user_bible_highlights(device_id);
CREATE INDEX IF NOT EXISTS idx_highlights_ref ON user_bible_highlights(book_slug, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_highlights_translation ON user_bible_highlights(translation);
CREATE INDEX IF NOT EXISTS idx_highlights_color ON user_bible_highlights(color);

ALTER TABLE user_bible_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own highlights" ON user_bible_highlights
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own highlights" ON user_bible_highlights
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own highlights" ON user_bible_highlights
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights" ON user_bible_highlights
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 3. user_bible_notes — Notes de versets/chapitres
-- ============================================================
CREATE TABLE IF NOT EXISTS user_bible_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter INT,
  verse INT,
  translation TEXT NOT NULL DEFAULT 'lsg',
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_bible_notes IS 'Notes Bible par utilisateur (chapitre ou verset spécifique)';
COMMENT ON COLUMN user_bible_notes.verse IS 'NULL si note de chapitre, numéro si note de verset';

CREATE INDEX IF NOT EXISTS idx_notes_device ON user_bible_notes(device_id);
CREATE INDEX IF NOT EXISTS idx_notes_ref ON user_bible_notes(book_slug, chapter, verse);

ALTER TABLE user_bible_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notes" ON user_bible_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON user_bible_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON user_bible_notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON user_bible_notes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 4. user_bible_bookmarks — Bookmarks Bible
-- ============================================================
CREATE TABLE IF NOT EXISTS user_bible_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter INT NOT NULL,
  translation TEXT NOT NULL DEFAULT 'lsg',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_slug, chapter, translation)
);

COMMENT ON TABLE user_bible_bookmarks IS 'Bookmarks Bible par utilisateur';

CREATE INDEX IF NOT EXISTS idx_bookmarks_device ON user_bible_bookmarks(device_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_ref ON user_bible_bookmarks(book_slug, chapter);

ALTER TABLE user_bible_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bookmarks" ON user_bible_bookmarks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON user_bible_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON user_bible_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 5. user_pepites — Trésors d'identité & Grâce
-- ============================================================
CREATE TABLE IF NOT EXISTS user_pepites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  reference TEXT NOT NULL,
  verse_text TEXT NOT NULL,
  note TEXT,
  pepite_type TEXT NOT NULL DEFAULT 'grace',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, reference, verse_text)
);

COMMENT ON TABLE user_pepites IS 'Pépites spirituelles (grâce, identité, promesses)';
COMMENT ON COLUMN user_pepites.pepite_type IS 'grace, identity, promise';

CREATE INDEX IF NOT EXISTS idx_pepites_device ON user_pepites(device_id);
CREATE INDEX IF NOT EXISTS idx_pepites_type ON user_pepites(pepite_type);
CREATE INDEX IF NOT EXISTS idx_pepites_created ON user_pepites(created_at DESC);

ALTER TABLE user_pepites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pepites" ON user_pepites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pepites" ON user_pepites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pepites" ON user_pepites
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pepites" ON user_pepites
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 6. user_reading_progress — Progression plans de lecture
-- ============================================================
CREATE TABLE IF NOT EXISTS user_reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  day_index INT NOT NULL,
  reading_index INT NOT NULL DEFAULT 0,
  book_slug TEXT NOT NULL,
  chapter INT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, day_index, reading_index)
);

COMMENT ON TABLE user_reading_progress IS 'Progression dans les plans de lecture';

CREATE INDEX IF NOT EXISTS idx_reading_progress_device ON user_reading_progress(device_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_plan ON user_reading_progress(plan_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_completed ON user_reading_progress(completed);

ALTER TABLE user_reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reading progress" ON user_reading_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reading progress" ON user_reading_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reading progress" ON user_reading_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reading progress" ON user_reading_progress
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 7. user_reading_streak — Série de lecture
-- ============================================================
CREATE TABLE IF NOT EXISTS user_reading_streak (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  current_streak INT NOT NULL DEFAULT 0,
  best_streak INT NOT NULL DEFAULT 0,
  last_read_date DATE,
  total_chapters INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

COMMENT ON TABLE user_reading_streak IS 'Série de lecture Bible consécutive';

CREATE INDEX IF NOT EXISTS idx_streak_device ON user_reading_streak(device_id);

ALTER TABLE user_reading_streak ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streak" ON user_reading_streak
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streak" ON user_reading_streak
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON user_reading_streak
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 8. user_prayer_sessions — Sessions de prière
-- ============================================================
CREATE TABLE IF NOT EXISTS user_prayer_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  session_date TIMESTAMPTZ NOT NULL,
  plan_id TEXT NOT NULL,
  day_index INT NOT NULL,
  reading_summary TEXT,
  book_name TEXT,
  chapters INT[],
  total_duration_sec INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_date, plan_id, day_index)
);

COMMENT ON TABLE user_prayer_sessions IS 'Sessions de prière guidées (PRIAM)';

CREATE INDEX IF NOT EXISTS idx_prayer_sessions_device ON user_prayer_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_prayer_sessions_date ON user_prayer_sessions(session_date DESC);

ALTER TABLE user_prayer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prayer sessions" ON user_prayer_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prayer sessions" ON user_prayer_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prayer sessions" ON user_prayer_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own prayer sessions" ON user_prayer_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 9. user_prayer_journal — Journal de prière
-- ============================================================
CREATE TABLE IF NOT EXISTS user_prayer_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  session_id UUID REFERENCES user_prayer_sessions(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL,
  step_label TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_prayer_journal IS 'Journal de prière (étapes PRIAM sauvegardées)';
COMMENT ON COLUMN user_prayer_journal.step_type IS 'adoration, repentance, gratitude, intercession, engagement';

CREATE INDEX IF NOT EXISTS idx_prayer_journal_device ON user_prayer_journal(device_id);
CREATE INDEX IF NOT EXISTS idx_prayer_journal_session ON user_prayer_journal(session_id);
CREATE INDEX IF NOT EXISTS idx_prayer_journal_type ON user_prayer_journal(step_type);
CREATE INDEX IF NOT EXISTS idx_prayer_journal_category ON user_prayer_journal(category);

ALTER TABLE user_prayer_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prayer journal" ON user_prayer_journal
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prayer journal" ON user_prayer_journal
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own prayer journal" ON user_prayer_journal
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own prayer journal" ON user_prayer_journal
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 10. user_study_tags — Tags & liens d'étude
-- ============================================================
CREATE TABLE IF NOT EXISTS user_study_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  chapter INT NOT NULL,
  verse INT,
  tag TEXT NOT NULL,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_slug, chapter, verse, tag)
);

COMMENT ON TABLE user_study_tags IS 'Tags personnalisés pour l''étude biblique';
COMMENT ON COLUMN user_study_tags.verse IS 'NULL si tag de chapitre';

CREATE INDEX IF NOT EXISTS idx_study_tags_device ON user_study_tags(device_id);
CREATE INDEX IF NOT EXISTS idx_study_tags_ref ON user_study_tags(book_slug, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_study_tags_tag ON user_study_tags(tag);

ALTER TABLE user_study_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own study tags" ON user_study_tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study tags" ON user_study_tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study tags" ON user_study_tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study tags" ON user_study_tags
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 11. user_data_exports — Historique des exports de données
-- ============================================================
CREATE TABLE IF NOT EXISTS user_data_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  export_type TEXT NOT NULL DEFAULT 'full',
  export_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_data_exports IS 'Historique des exports de données utilisateur';
COMMENT ON COLUMN user_data_exports.export_type IS 'full, highlights, notes, pepites, prayer, reading';

CREATE INDEX IF NOT EXISTS idx_data_exports_device ON user_data_exports(device_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_created ON user_data_exports(created_at DESC);

ALTER TABLE user_data_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exports" ON user_data_exports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exports" ON user_data_exports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- FONCTION: Mettre à jour updated_at automatiquement
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
CREATE TRIGGER trg_sync_metadata_updated
  BEFORE UPDATE ON user_sync_metadata
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_highlights_updated
  BEFORE UPDATE ON user_bible_highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notes_updated
  BEFORE UPDATE ON user_bible_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pepites_updated
  BEFORE UPDATE ON user_pepites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reading_progress_updated
  BEFORE UPDATE ON user_reading_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_streak_updated
  BEFORE UPDATE ON user_reading_streak
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_prayer_journal_updated
  BEFORE UPDATE ON user_prayer_journal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FIN DU SCHÉMA BACKUP & SYNC
-- ============================================================

-- ============================================================
-- 12. user_reading_reflections — Réflexions de lecture
-- ============================================================
CREATE TABLE IF NOT EXISTS user_reading_reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  device_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  day_index INT NOT NULL,
  reading_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  daily_prompts JSONB NOT NULL DEFAULT '{}',
  prayer_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_id, day_index, reading_id, chapter)
);

COMMENT ON TABLE user_reading_reflections IS 'Réflexions de lecture par chapitre et plan';

CREATE INDEX IF NOT EXISTS idx_reflections_device ON user_reading_reflections(device_id);
CREATE INDEX IF NOT EXISTS idx_reflections_plan ON user_reading_reflections(plan_id);
CREATE INDEX IF NOT EXISTS idx_reflections_updated ON user_reading_reflections(updated_at DESC);

ALTER TABLE user_reading_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reflections" ON user_reading_reflections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reflections" ON user_reading_reflections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reflections" ON user_reading_reflections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reflections" ON user_reading_reflections
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER trg_reflections_updated
  BEFORE UPDATE ON user_reading_reflections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FIN
-- ============================================================
