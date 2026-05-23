-- ============================================================================
-- NavCloud Premium: Vector Search Migration
-- Enables semantic file search using pgvector for AI-powered file intelligence
-- ============================================================================

-- Enable the pgvector extension for embedding storage & similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- File Embeddings: Core table for semantic search
-- Stores AI-generated embeddings, summaries, and tags for every uploaded file
-- ============================================================================
CREATE TABLE file_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- File identity
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,              -- MIME type (application/pdf, image/png, etc.)
  file_path TEXT,                        -- Logical path within user's drive

  -- AI-generated content analysis
  summary TEXT,                          -- 1-sentence AI summary of file content
  tags TEXT[] DEFAULT '{}',              -- Semantic tags extracted by Gemini
  extracted_text TEXT,                   -- OCR / parsed text (for re-embedding)

  -- Vector embedding (768 dimensions for Gemini text-embedding-004)
  embedding vector(768),

  -- Flexible metadata JSONB for arbitrary attributes
  -- Example: { "signedBy": "Lawyer", "date": "2026-03", "category": "legal" }
  metadata JSONB DEFAULT '{}',

  -- Processing state
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  processed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for high-performance search
-- ============================================================================

-- HNSW index for fast approximate nearest neighbor (ANN) vector search
-- m=16: max connections per layer | ef_construction=64: build-time accuracy
CREATE INDEX idx_file_embeddings_vector
  ON file_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard B-tree indexes for filtering
CREATE INDEX idx_file_embeddings_user_id ON file_embeddings(user_id);
CREATE INDEX idx_file_embeddings_file_type ON file_embeddings(file_type);
CREATE INDEX idx_file_embeddings_status ON file_embeddings(processing_status);
CREATE INDEX idx_file_embeddings_created ON file_embeddings(created_at DESC);

-- GIN indexes for JSONB and array queries
CREATE INDEX idx_file_embeddings_tags ON file_embeddings USING GIN(tags);
CREATE INDEX idx_file_embeddings_metadata ON file_embeddings USING GIN(metadata);

-- Composite index for user-scoped searches
CREATE INDEX idx_file_embeddings_user_status
  ON file_embeddings(user_id, processing_status);

-- ============================================================================
-- RPC: Semantic file search
-- Finds files similar to a query embedding within a user's scope
-- ============================================================================
CREATE OR REPLACE FUNCTION search_files_semantic(
  query_embedding vector(768),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  filter_file_type TEXT DEFAULT NULL,
  filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
  file_name TEXT,
  file_type TEXT,
  file_path TEXT,
  summary TEXT,
  tags TEXT[],
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.file_id,
    fe.file_name,
    fe.file_type,
    fe.file_path,
    fe.summary,
    fe.tags,
    fe.metadata,
    (1 - (fe.embedding <=> query_embedding))::FLOAT AS similarity
  FROM file_embeddings fe
  WHERE fe.user_id = match_user_id
    AND fe.processing_status = 'completed'
    AND fe.embedding IS NOT NULL
    AND (1 - (fe.embedding <=> query_embedding)) > match_threshold
    AND (filter_file_type IS NULL OR fe.file_type = filter_file_type)
    AND (filter_tags IS NULL OR fe.tags && filter_tags)
  ORDER BY fe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- RPC: Search files by tags (non-vector, instant filtering)
-- ============================================================================
CREATE OR REPLACE FUNCTION search_files_by_tags(
  match_user_id UUID,
  search_tags TEXT[],
  match_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
  file_name TEXT,
  file_type TEXT,
  summary TEXT,
  tags TEXT[],
  metadata JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.id,
    fe.file_id,
    fe.file_name,
    fe.file_type,
    fe.summary,
    fe.tags,
    fe.metadata
  FROM file_embeddings fe
  WHERE fe.user_id = match_user_id
    AND fe.processing_status = 'completed'
    AND fe.tags && search_tags
  ORDER BY fe.updated_at DESC
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- Trigger: auto-update updated_at on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_file_embeddings_updated_at
  BEFORE UPDATE ON file_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
