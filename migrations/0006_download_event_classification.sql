ALTER TABLE download_events ADD COLUMN asn INTEGER;
ALTER TABLE download_events ADD COLUMN as_organization TEXT;
ALTER TABLE download_events ADD COLUMN classification TEXT NOT NULL DEFAULT 'UNDETERMINED';
ALTER TABLE download_events ADD COLUMN classification_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_download_events_classification ON download_events(classification);
