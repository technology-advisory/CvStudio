PRAGMA foreign_keys = ON;

ALTER TABLE download_links ADD COLUMN recipient_email TEXT;
ALTER TABLE download_links ADD COLUMN recipient_name TEXT;
ALTER TABLE download_links ADD COLUMN email_subject TEXT;
ALTER TABLE download_links ADD COLUMN sent_at TEXT;

CREATE TABLE IF NOT EXISTS download_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  downloaded_at TEXT NOT NULL,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  FOREIGN KEY (link_id) REFERENCES download_links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_download_events_link_id ON download_events(link_id);
CREATE INDEX IF NOT EXISTS idx_download_events_downloaded_at ON download_events(downloaded_at);
CREATE INDEX IF NOT EXISTS idx_download_links_sent_at ON download_links(sent_at);
