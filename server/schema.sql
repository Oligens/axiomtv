-- ============================================================
-- Axiom TV — Schéma PostgreSQL (Neon)
-- Exécuté de manière idempotente au démarrage du serveur.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  username     TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  bio          TEXT DEFAULT '',
  avatar_url   TEXT,
  banner_url   TEXT,
  about_text   TEXT DEFAULT '',
  charter      TEXT DEFAULT '',
  tier         TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','agwestream_pass','pro','gold')),
  verified     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('welcome','live','earning','info')),
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                SERIAL PRIMARY KEY,
  subscriber_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_username  TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, creator_username)
);

CREATE TABLE IF NOT EXISTS transactions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('subscription','tip','gift','ppv','withdrawal')),
  amount     NUMERIC(10,2) NOT NULL,
  gateway    TEXT,
  label      TEXT DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);
-- Compatibilité bases existantes (avant l'ajout de 'gift') :
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_kind_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_kind_check CHECK (kind IN ('subscription','tip','gift','ppv','withdrawal'));

CREATE TABLE IF NOT EXISTS payment_methods (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway    TEXT NOT NULL,
  label      TEXT NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creator_links (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL CHECK (char_length(url) <= 2048),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agwestream_videos (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  prompt      TEXT DEFAULT '',
  category    TEXT DEFAULT 'agwestream',
  duration_sec INTEGER DEFAULT 0,
  resolution  TEXT DEFAULT '720p',
  status      TEXT DEFAULT 'online',
  speakers    JSONB DEFAULT '[]',
  views       INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agwe_user ON agwestream_videos(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  video_id   INTEGER NOT NULL REFERENCES agwestream_videos(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 2 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gifts (
  id          SERIAL PRIMARY KEY,
  sender_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id    INTEGER REFERENCES agwestream_videos(id) ON DELETE SET NULL,
  gift_type   TEXT NOT NULL DEFAULT 'spark',
  amount      NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gifts_receiver ON gifts(receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_quotas (
  user_id                INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  videos_generated_today INTEGER NOT NULL DEFAULT 0,
  last_video_date        DATE
);
