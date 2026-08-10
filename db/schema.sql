-- Run this once against your Vercel Postgres database before first deploy.
-- Easiest way: Vercel dashboard -> Storage -> your Postgres DB -> Query tab
-- -> paste this whole file -> Run. Or: psql "$POSTGRES_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS cards (
  id                SERIAL PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'complete'
  name              TEXT,
  role              TEXT,
  role_category     TEXT,      -- ai | backend | frontend | product | crypto | data | other
  builder_class     TEXT,
  rarity_key        TEXT,      -- common | rare | epic | legendary
  image_url         TEXT,      -- set on finalize, Vercel Blob public URL
  delete_token_hash TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_name_idx ON cards (lower(name));
CREATE INDEX IF NOT EXISTS cards_role_category_idx ON cards (role_category);
CREATE INDEX IF NOT EXISTS cards_status_idx ON cards (status);
CREATE INDEX IF NOT EXISTS cards_created_at_idx ON cards (created_at DESC);
