-- ============================================================================
-- NavCloud Premium: Usage-Based Billing (Stripe Metered)
-- Tracks storage consumption and AI credit usage for per-unit billing
-- ============================================================================

-- ============================================================================
-- Billing accounts: 1:1 with users, linked to Stripe
-- ============================================================================
CREATE TABLE billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,                  -- Active price object

  -- Plan tier
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro', 'enterprise')),

  -- Usage counters (denormalized for fast dashboard reads)
  storage_bytes_used BIGINT DEFAULT 0,
  storage_bytes_limit BIGINT DEFAULT 53687091200,  -- 50 GB default (free)
  ai_credits_used INT DEFAULT 0,
  ai_credits_limit INT DEFAULT 50,       -- Monthly AI credit cap (free tier)

  -- Billing cycle
  billing_cycle_start TIMESTAMPTZ,
  billing_cycle_end TIMESTAMPTZ,

  -- Status
  subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled', 'trialing')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_accounts_stripe_customer ON billing_accounts(stripe_customer_id);
CREATE INDEX idx_billing_accounts_plan ON billing_accounts(plan);

-- ============================================================================
-- Usage events: immutable audit log of all billable actions
-- ============================================================================
CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Event classification
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'storage_upload',
      'storage_delete',
      'ai_tag',
      'ai_search',
      'ai_summary',
      'ai_embed',
      'preview_generate'
    )),

  -- Quantity and unit
  quantity BIGINT NOT NULL,
  unit TEXT NOT NULL
    CHECK (unit IN ('bytes', 'credits', 'queries', 'operations')),

  -- Stripe reporting reference
  stripe_usage_record_id TEXT,
  reported_to_stripe BOOLEAN DEFAULT false,

  -- Event context
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioned-ready indexes for high-volume event streams
CREATE INDEX idx_usage_events_user_created ON usage_events(user_id, created_at DESC);
CREATE INDEX idx_usage_events_type ON usage_events(event_type, created_at DESC);
CREATE INDEX idx_usage_events_unreported
  ON usage_events(user_id, reported_to_stripe)
  WHERE reported_to_stripe = false;

-- ============================================================================
-- Plan limits: centralized plan configuration
-- ============================================================================
CREATE TABLE plan_limits (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free', 'pro', 'enterprise')),
  max_storage_bytes BIGINT NOT NULL,
  max_ai_credits_monthly INT NOT NULL,
  max_created_courses INT NOT NULL,
  max_active_enrollments INT NOT NULL,
  max_file_size_bytes BIGINT NOT NULL,   -- Per-file upload limit
  features JSONB DEFAULT '{}'            -- Feature flags per plan
);

-- Seed default plan limits
INSERT INTO plan_limits (plan, max_storage_bytes, max_ai_credits_monthly, max_created_courses, max_active_enrollments, max_file_size_bytes, features) VALUES
  ('free',       53687091200,   50,   2,   5,   104857600,  '{"semantic_search": true, "live_folders": false, "chunked_uploads": false}'),
  ('pro',        536870912000,  500,  20,  100, 2147483648, '{"semantic_search": true, "live_folders": true, "chunked_uploads": true}'),
  ('enterprise', 5368709120000, -1,   -1,  -1,  10737418240, '{"semantic_search": true, "live_folders": true, "chunked_uploads": true, "custom_models": true}');

-- ============================================================================
-- RPC: Get user billing dashboard data
-- ============================================================================
CREATE OR REPLACE FUNCTION get_billing_dashboard(
  target_user_id UUID
)
RETURNS TABLE (
  plan TEXT,
  storage_bytes_used BIGINT,
  storage_bytes_limit BIGINT,
  ai_credits_used INT,
  ai_credits_limit INT,
  subscription_status TEXT,
  storage_usage_percent FLOAT,
  ai_usage_percent FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.plan,
    ba.storage_bytes_used,
    ba.storage_bytes_limit,
    ba.ai_credits_used,
    ba.ai_credits_limit,
    ba.subscription_status,
    CASE
      WHEN ba.storage_bytes_limit > 0
      THEN (ba.storage_bytes_used::FLOAT / ba.storage_bytes_limit * 100)
      ELSE 0
    END AS storage_usage_percent,
    CASE
      WHEN ba.ai_credits_limit > 0
      THEN (ba.ai_credits_used::FLOAT / ba.ai_credits_limit * 100)
      ELSE 0
    END AS ai_usage_percent
  FROM billing_accounts ba
  WHERE ba.user_id = target_user_id;
END;
$$;

-- Trigger: auto-update updated_at
CREATE TRIGGER trg_billing_accounts_updated_at
  BEFORE UPDATE ON billing_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
