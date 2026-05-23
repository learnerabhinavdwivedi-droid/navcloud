-- ============================================================================
-- NavCloud Premium: Live Folders (Smart Auto-Sorters)
-- AI-driven "Live Folders" that automatically pull files based on rules
-- ============================================================================

-- ============================================================================
-- Live Folders: rule-based auto-sorting containers
-- ============================================================================
CREATE TABLE live_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',

  -- Rule engine configuration
  -- rule_type determines how rule_config is interpreted
  rule_type TEXT NOT NULL
    CHECK (rule_type IN ('tag_match', 'content_match', 'type_match', 'date_range', 'composite')),

  -- JSONB rule definition examples:
  -- tag_match:     { "tags": ["tax", "legal"], "match": "any" }
  -- content_match: { "query": "invoice", "threshold": 0.75 }
  -- type_match:    { "types": ["application/pdf", "image/png"] }
  -- date_range:    { "from": "2026-01-01", "to": "2026-03-31" }
  -- composite:     { "operator": "AND", "rules": [<nested rules>] }
  rule_config JSONB NOT NULL,

  -- Cached metrics for instant dashboard rendering
  matched_files_count INT DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,

  -- Auto-sort toggle (users can pause evaluation)
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_live_folders_user_id ON live_folders(user_id);
CREATE INDEX idx_live_folders_active ON live_folders(user_id, is_active) WHERE is_active = true;

-- ============================================================================
-- Junction table: files matched to live folders
-- ============================================================================
CREATE TABLE live_folder_files (
  live_folder_id UUID NOT NULL REFERENCES live_folders(id) ON DELETE CASCADE,
  file_id UUID NOT NULL,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  match_score FLOAT,                     -- How well the file matched the rule
  PRIMARY KEY (live_folder_id, file_id)
);

CREATE INDEX idx_live_folder_files_file ON live_folder_files(file_id);

-- ============================================================================
-- RPC: Evaluate a live folder against all user files
-- Returns matching file_ids for a given folder's rules
-- ============================================================================
CREATE OR REPLACE FUNCTION evaluate_live_folder_tag_match(
  folder_id UUID,
  match_user_id UUID
)
RETURNS TABLE (
  file_id UUID,
  file_name TEXT,
  match_score FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  rule_tags TEXT[];
  rule_match TEXT;
  folder_rule JSONB;
BEGIN
  SELECT rule_config INTO folder_rule
  FROM live_folders
  WHERE id = folder_id AND user_id = match_user_id;

  IF folder_rule IS NULL THEN
    RETURN;
  END IF;

  rule_tags := ARRAY(SELECT jsonb_array_elements_text(folder_rule -> 'tags'));
  rule_match := COALESCE(folder_rule ->> 'match', 'any');

  IF rule_match = 'all' THEN
    RETURN QUERY
    SELECT
      fe.file_id,
      fe.file_name,
      1.0::FLOAT AS match_score
    FROM file_embeddings fe
    WHERE fe.user_id = match_user_id
      AND fe.processing_status = 'completed'
      AND fe.tags @> rule_tags;
  ELSE
    RETURN QUERY
    SELECT
      fe.file_id,
      fe.file_name,
      (
        SELECT COUNT(*)::FLOAT / array_length(rule_tags, 1)
        FROM unnest(rule_tags) AS rt(tag)
        WHERE rt.tag = ANY(fe.tags)
      ) AS match_score
    FROM file_embeddings fe
    WHERE fe.user_id = match_user_id
      AND fe.processing_status = 'completed'
      AND fe.tags && rule_tags;
  END IF;
END;
$$;

-- Trigger: auto-update updated_at
CREATE TRIGGER trg_live_folders_updated_at
  BEFORE UPDATE ON live_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
