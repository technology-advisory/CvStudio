CREATE TABLE IF NOT EXISTS mail_templates (
  template_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO mail_templates (template_key, name, description, subject, message, updated_at) VALUES
(
  'selection',
  'Proceso de selección',
  'Directa, profesional y orientada a recruiters.',
  'Miguel Ángel Carriazo · Perfil profesional y experiencia',
  'Gracias por tu interés en mi perfil.

A través del enlace incluido en este mensaje podrás consultar mi vida profesional completa, con información actualizada sobre mi experiencia en arquitectura de soluciones, infraestructura, ciberseguridad, gobierno tecnológico, continuidad, cloud y liderazgo de equipos y servicios críticos.

El acceso es personal y temporal. Quedo a tu disposición para ampliar cualquier aspecto de mi trayectoria o comentar el posible encaje con la posición.',
  CURRENT_TIMESTAMP
),
(
  'executive',
  'Perfil ejecutivo',
  'Más sénior y centrada en gobierno y liderazgo.',
  'Miguel Ángel Carriazo · Trayectoria en Arquitectura, Infraestructura y Ciberseguridad',
  'Te facilito acceso temporal a mi vida profesional completa, desarrollada durante más de 25 años en entornos tecnológicos críticos, regulados, híbridos y cloud.

El documento recoge mi experiencia en gobierno de arquitectura, infraestructura, ciberseguridad, continuidad de negocio, gestión de riesgos, cumplimiento, operaciones IT, liderazgo y transformación tecnológica.

También incluye los proyectos y productos profesionales que desarrollo dentro del ecosistema OpenTrust Group. Estaré encantado de ampliar cualquier información que resulte relevante.',
  CURRENT_TIMESTAMP
);
