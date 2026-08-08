PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS cv_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_type TEXT NOT NULL DEFAULT 'full',
  version TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  previous_version_id INTEGER,
  FOREIGN KEY (previous_version_id) REFERENCES cv_versions(id)
);

CREATE INDEX IF NOT EXISTS idx_cv_versions_type_active
  ON cv_versions(cv_type, is_active);

CREATE TABLE IF NOT EXISTS download_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,
  cv_version_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','USED','EXPIRED','REVOKED')),
  used_at TEXT,
  revoked_at TEXT,
  max_downloads INTEGER NOT NULL DEFAULT 1 CHECK (max_downloads >= 1),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  FOREIGN KEY (cv_version_id) REFERENCES cv_versions(id)
);

CREATE INDEX IF NOT EXISTS idx_download_links_status ON download_links(status);
CREATE INDEX IF NOT EXISTS idx_download_links_expiry ON download_links(expires_at);
