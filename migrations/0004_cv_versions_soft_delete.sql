PRAGMA foreign_keys = ON;

-- Borrado suave: al "eliminar" una versión se libera el PDF de R2 y se
-- oculta de la lista, pero la fila se conserva porque download_links la
-- referencia (FK) y ahí vive el historial real de a quién se le envió esa
-- versión. Nunca se borra una versión activa: hay que activar otra primero.
ALTER TABLE cv_versions ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_cv_versions_deleted ON cv_versions(cv_type, deleted_at);
