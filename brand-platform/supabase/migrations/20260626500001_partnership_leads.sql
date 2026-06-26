-- Phase 8: partnership lead capture from marketing site

CREATE TYPE partnership_lead_status AS ENUM (
  'new',
  'contacted',
  'signed_up'
);

CREATE TABLE partnership_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  message       TEXT,
  status        partnership_lead_status NOT NULL DEFAULT 'new',
  brand_id      UUID REFERENCES brands (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partnership_leads_email ON partnership_leads (lower(email));
CREATE INDEX idx_partnership_leads_status ON partnership_leads (status);
CREATE INDEX idx_partnership_leads_created_at ON partnership_leads (created_at DESC);

COMMENT ON TABLE partnership_leads IS
  'Inbound partnership interest from marketing site. Updated to signed_up when brand registers.';

ALTER TABLE partnership_leads ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — portal APIs use service role only.
