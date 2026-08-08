PRAGMA foreign_keys = ON;

-- Borrador único del CV estructurado (sustituye al localStorage del navegador).
CREATE TABLE IF NOT EXISTS cv_content (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Historial: cada publicación deja el modelo exacto que generó ese PDF.
CREATE TABLE IF NOT EXISTS cv_content_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  content_json TEXT NOT NULL,
  r2_key TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cv_content_versions_created ON cv_content_versions(created_at);
