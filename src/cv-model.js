/**
 * Modelo de contenido del CV.
 *
 * El CV deja de ser HTML editable y pasa a ser datos. La maquetación vive en
 * cv-render.js y no es editable desde el navegador: por eso no se puede romper.
 *
 * Formato de texto admitido en cualquier campo: **negrita**. Nada más.
 * Todo lo demás se escapa al renderizar.
 */

export const CV_MODEL_VERSION = 1;

export const DEFAULT_CV_MODEL = {
  version: CV_MODEL_VERSION,
  meta: {
    brandLead: "OpenTrust Group",
    brandTail: "Confianza digital · Arquitectura · Infraestructura · Ciberseguridad · GRC",
    name: "Miguel Ángel Carriazo Álvarez",
    role: "Arquitecto de Infraestructura y Ciberseguridad",
    contact: [
      "macarriazo@opentrust.group",
      "Madrid, España",
      "linkedin.com/in/macarriazo",
      "opentrust.group"
    ],
    footer:
      "**OPENTRUST GROUP** · Arquitectura · Infraestructura · Ciberseguridad · GRC · opentrust.group · macarriazo@opentrust.group",
    pdfFileName: "CV_Miguel_Angel_Carriazo.pdf"
  },
  claim: [
    "Especialista en marcos regulatorios y de cumplimiento (ENS · ISO 27001 · ISO 42001 · ISO 22301 · NIS2 · GDPR)",
    "Resiliencia · Security by Design · Entornos Híbridos y Multicloud"
  ],
  summary: [
    "Arquitecto de Infraestructura y Ciberseguridad con más de 25 años de experiencia en el diseño, gobierno y evolución de entornos tecnológicos críticos, híbridos y cloud, combinando dirección de equipos técnicos con responsabilidad individual como referente único de ciberseguridad en entornos de alta exigencia.",
    "Especializado en arquitectura resiliente, Security by Design y modelos de gobierno alineados con ENS, ISO 27001, NIS2, ISO/IEC 22301 (continuidad de negocio) e ISO/IEC 42001 (gestión de inteligencia artificial).",
    "Perfil híbrido técnico–estratégico, con experiencia liderando operaciones IT, definiendo arquitecturas complejas y asegurando cumplimiento normativo en organizaciones de alta exigencia.",
    "Especialización transversal en marcos regulatorios de ciberseguridad y continuidad (ENS, ISO 27001, NIS2, ISO 22301, ISO 42001, GDPR), aplicados tanto desde el gobierno y la auditoría como desde el diseño de arquitectura técnica."
  ],
  focus: {
    title: "Foco en:",
    items: [
      "Resiliencia operativa y continuidad de negocio (BCP/DRP)",
      "Gobierno de la ciberseguridad y gestión del riesgo",
      "Arquitecturas híbridas y multicloud seguras",
      "Integración de IA bajo modelos de control y cumplimiento"
    ]
  },
  closing: "Capacidad demostrada para alinear tecnología, seguridad y negocio.",
  sections: [
    {
      id: "experiencia",
      title: "Experiencia profesional",
      type: "experience",
      jobs: [
        {
          company: "Experis (ManpowerGroup), S.L.U.",
          place: "Madrid, España",
          dates: "mayo 2026 — junio 2026",
          subrole:
            "Arquitecto de Soluciones de Infraestructura y Ciberseguridad · Proyectos para IBM (Banca regulada)",
          intro:
            "Participación, a través de IBM, en un proyecto estratégico de arquitectura de seguridad para Banca Regulada, contribuyendo al diseño, evaluación e implantación de soluciones de ciberseguridad en un entorno bancario altamente regulado.",
          meta: "Responsabilidades principales:",
          bullets: [
            "Diseño de arquitecturas de seguridad para entornos cloud, on-premise e híbridos.",
            "Definición y revisión de diseños de arquitectura de alto nivel (HLD – High Level Design) y bajo nivel (LLD – Low Level Design), garantizando su alineación con los requisitos funcionales y de seguridad.",
            "Modelado de arquitecturas mediante C4 Model (Context, Container, Component y Deployment).",
            "Análisis y validación técnica de soluciones desde la perspectiva de la ciberseguridad.",
            "Definición de controles de seguridad y apoyo en la gestión de riesgos tecnológicos.",
            "Colaboración con equipos de Arquitectura, Infraestructura, Desarrollo, Riesgo, Compliance y Negocio.",
            "Coordinación con proveedores tecnológicos y seguimiento de la implantación de las soluciones.",
            "Participación en comités de arquitectura y seguridad para la evaluación y aprobación de iniciativas.",
            "Acompañamiento de las iniciativas durante todo su ciclo de vida, desde el diseño hasta la puesta en producción."
          ],
          tag: "Proyecto finalizado",
          roles: []
        },
        {
          company: "Grupo Lefebvre – El Derecho",
          place: "Madrid, España",
          dates: "marzo 2002 — diciembre 2025",
          meta: "Continuidad por sucesión empresarial dentro del mismo grupo: El Derecho Editores → Grupo Editorial Quantor → Corporación Empresarial El Derecho → Grupo Editorial El Derecho → Lefebvre-El Derecho, S.A.",
          bullets: [],
          roles: [
            {
              title: "Infrastructure Architect & Security Manager",
              dates: "2023 — 2025",
              bullets: [
                "Gobierno de la arquitectura tecnológica corporativa y definición de la estrategia global de ciberseguridad, alineada con los objetivos de negocio y regulatorios.",
                "Diseño y validación de modelos de arquitectura híbrida (on-premises / cloud) e integración transversal de **Security by Design** en infraestructura, plataformas y desarrollo, asegurando resiliencia, seguridad y escalabilidad.",
                "Supervisión y control del cumplimiento de ENS, ISO 27001, NIS2, GDPR e ISO/IEC 42001, actuando como referente técnico ante auditorías técnicas, regulatorias y financieras.",
                "Gobierno y validación de la arquitectura de red corporativa (segmentación, microsegmentación, routing, firewalls y accesos seguros) y de las capacidades de detección y respuesta (**EDR, SIEM**, gestión de vulnerabilidades).",
                "Responsable único de ciberseguridad, ejerciendo de referente técnico para proveedores y fabricantes estratégicos (NTT, Telefónica, IBM, Microsoft) y para otros departamentos técnicos, y coordinando al SOC de la matriz (Lefebvre, Francia) con Lefebvre España.",
                "Validación técnica y de seguridad de proyectos críticos antes de producción, y definición de procedimientos técnicos y de respuesta a incidentes.",
                "Interlocución directa con CIO y dirección en decisiones estratégicas de arquitectura, riesgo e infraestructura."
              ]
            },
            {
              title: "IT Operations Manager & Security",
              dates: "2002 — 2023",
              bullets: [
                "Dirección de un equipo de un mínimo de 10 personas en el área de IT Operations, con responsabilidad sobre disponibilidad, rendimiento, seguridad y continuidad del servicio, liderando infraestructuras críticas y asegurando SLAs y soporte al negocio.",
                "Gobierno de la operación diaria y coordinación de equipos y proveedores tecnológicos; implantación de procesos ITSM (incidentes, problemas y cambios) y responsable de **Change Management** en infraestructura y seguridad.",
                "Gestión de incidentes críticos (**Major Incidents**) y análisis RCA, y diseño y evolución de la arquitectura tecnológica corporativa.",
                "Administración avanzada de entornos Microsoft (Windows Server, Active Directory, Azure), gestión de virtualización y alta disponibilidad, y administración de bases de datos (SQL Server y MySQL) en entornos críticos.",
                "Responsabilidad sobre la red corporativa (VLANs, routing, firewalls, accesos) y diseño y ejecución de planes de continuidad (**BCP/DRP**).",
                "Liderazgo de la migración a Office 365 y consolidación del Active Directory europeo (transformación digital del puesto de trabajo)."
              ]
            }
          ]
        },
        {
          company: "Leader Line, S.A.",
          place: "Madrid, España",
          dates: "1999 — 2001",
          subrole: "Administrador de Sistemas / Técnico de Infraestructura",
          meta: "Servicios prestados para IECISA – Informática El Corte Inglés.",
          bullets: [
            "Administración de sistemas UNIX y Windows NT en entornos corporativos.",
            "Soporte a plataformas de correo y servicios críticos.",
            "Participación activa en proyectos de migración tecnológica entre entornos UNIX y Windows NT.",
            "Gestión de comunicaciones entre delegaciones y servicios centrales.",
            "Elaboración de documentación técnica y procedimientos operativos."
          ],
          roles: []
        }
      ]
    },
    {
      id: "logros",
      title: "Logros destacados",
      type: "bullets",
      bullets: [
        "Diseño, evolución y gobierno integral de la infraestructura corporativa desde 2002, garantizando alta disponibilidad, seguridad y escalabilidad del negocio.",
        "Implementación y operación de clústeres **Hyper-V** multinodo en alta disponibilidad, soportando cargas críticas de producción.",
        "Diseño e implementación de clúster **VMware** en el datacenter de NTT, dando soporte a servicios críticos de cliente.",
        "Diseño e implantación de arquitecturas **HA/DR** para SQL Server y MySQL, asegurando continuidad de servicio y resiliencia operativa.",
        "Definición e implantación de la plataforma de backup y recuperación ante desastres con **Veeam Backup & Replication**, incluyendo estrategias avanzadas de DR.",
        "Optimización y gobierno del almacenamiento **Dell Unity**, mejorando rendimiento y eficiencia operativa.",
        "Ejecución de migraciones complejas de datacenter, con impacto mínimo en el negocio y sin interrupciones relevantes del servicio.",
        "Diseño e implementación de estrategias de recuperación ante desastres multi-datacenter, alineadas con planes de continuidad (**BCP/DRP**).",
        "Definición e implantación de políticas corporativas de cifrado y protección de endpoints mediante **BitLocker**, alineadas con ENS e ISO 27001.",
        "Implantación de cifrado en tránsito, en reposo y en memoria para credenciales corporativas a nivel de aplicación, en cumplimiento del Esquema Nacional de Seguridad (ENS).",
        "Obtención, auditoría y mantenimiento de **ISO 27001** y **ENS (categoría media)** como responsable directo de la seguridad.",
        "Diseño e implantación de arquitectura de **balanceo de carga corporativo** con **WAF por aplicación**, protegiendo servicios críticos y mejorando la seguridad y disponibilidad.",
        "Administración, hardening y operación de sistemas Linux y Windows Server en entornos críticos.",
        "Coordinación técnica con proveedores de hosting en el diseño y despliegue de plataformas de acceso de clientes.",
        "Planificación y ejecución de migraciones completas entre proveedores de hosting, garantizando continuidad de servicio e integridad de datos.",
        "Liderazgo del equipo de Operaciones IT y Seguridad, manteniendo un alto nivel de madurez tecnológica y de ciberseguridad."
      ]
    },
    {
      id: "competencias",
      title: "Competencias técnicas",
      type: "groups",
      groups: [
        {
          title: "Arquitectura & Infraestructura",
          intro: "",
          bullets: [
            "Arquitectura de soluciones para cliente: documentación de diseño de alto y bajo nivel (**HLD/LLD**), definición de arquitecturas de infraestructura y ciberseguridad, y evaluación de cumplimiento normativo en proyectos de transformación tecnológica.",
            "Diseño y gobierno de infraestructuras corporativas críticas, orientadas a alta disponibilidad, resiliencia y continuidad de negocio.",
            "Entornos Microsoft Enterprise: Windows Server, Active Directory (DNS, DHCP), con hardening y modelos de seguridad avanzados.",
            "Virtualización y alta disponibilidad: **Hyper-V**, Failover Clustering y VMware en entornos corporativos y de hosting, desde el diseño de arquitectura hasta la operación.",
            "Bases de datos: diseño y operación de **SQL Server y MySQL** en arquitecturas **HA/DR**.",
            "Almacenamiento y continuidad: **Dell Unity** y estrategias de Disaster Recovery.",
            "Automatización operativa: PowerShell, Python y Bash.",
            "Arquitecturas híbridas y multicloud (**Azure, Google Cloud y AWS**), con foco en diseño, operación, seguridad y gobierno de entornos cloud empresariales."
          ]
        },
        {
          title: "Redes y Seguridad Perimetral",
          intro: "",
          bullets: [
            "Gobierno y operación de redes corporativas: VLANs, routing y alta disponibilidad.",
            "Firewalls y seguridad perimetral: **Fortinet FortiGate** y **SonicWall NSA 4600/4700**, **SMA 500v** y **Cloud Secure Edge (CSE)**, con hardening, mantenimiento, actualizaciones y gestión de políticas de extremo a extremo.",
            "Acceso seguro: VPN IPSec, SSL VPN y modelos de acceso seguro (**ZTNA**).",
            "Protección de red: IDS/IPS, filtrado web y políticas de seguridad.",
            "Balanceo de carga: **KEMP, F5 y NGINX**.",
            "Diseño e implementación de arquitecturas **Zero Trust**.",
            "Coordinación de la respuesta ante ciberataques en capa de red junto a SOC y equipos técnicos."
          ]
        },
        {
          title: "Ciberseguridad & Compliance",
          intro: "Gobierno de la ciberseguridad y gestión del riesgo alineado con negocio.",
          bullets: [
            "Cumplimiento normativo: **ENS, ISO 27001, NIS2, GDPR, ISO/IEC 42001 e ISO/IEC 22301**.",
            "**Security by Design** y hardening de sistemas.",
            "Gestión de identidades y accesos (**IAM**): control de privilegios y segregación de funciones.",
            "Protección de aplicaciones: **WAF** y mitigación de riesgos OWASP.",
            "Monitorización y respuesta: **SIEM, EDR** y coordinación con SOC.",
            "Observabilidad: PRTG y Nagios.",
            "Auditoría técnica, de seguridad y financiera, orientada a mejora continua.",
            "Hardening de sistemas operativos, bases de datos y plataformas de aplicación (Windows Server, Linux, IIS, Apache, NGINX, Tomcat, SQL Server, MySQL…) (CCN-CERT).",
            "Gestión de plataformas colaborativas: **SharePoint** on-premise y cloud, y planificación y ejecución de migraciones de sistemas en fin de vida (**EOL**), mitigando riesgos de obsolescencia tecnológica."
          ]
        }
      ]
    },
    {
      id: "certificaciones",
      title: "Certificaciones profesionales",
      type: "certs",
      columns: [
        [
          {
            title: "Gobierno, Ciberseguridad y Cumplimiento",
            items: [
              {
                text: "Capacitación en el Esquema Nacional de Seguridad (ENS) – CCN-CERT",
                sub: [
                  "Esquema Nacional de Seguridad (RD 311/2022, de 3 de mayo)",
                  "Aproximación práctica al Esquema Nacional de Seguridad",
                  "Auditorías en el ENS",
                  "Análisis y Gestión de Riesgos de los Sistemas de Información",
                  "µCeENS",
                  "Gestión de Incidentes de Ciberseguridad",
                  "Ingeniería Social. Descifrando el arte del engaño"
                ]
              },
              { text: "ISO/IEC 27001 Lead Auditor", sub: [] },
              { text: "ISO/IEC 27001 Lead Implementer", sub: [] },
              { text: "ISO/IEC 22301 – Continuidad de Negocio · Internal Auditor", sub: [] },
              { text: "ISO/IEC 42001 – Gestión de Inteligencia Artificial · Internal Auditor", sub: [] },
              { text: "ISO/IEC 42001 – Gestión de Inteligencia Artificial · Lead Auditor", sub: [] },
              { text: "Lead Cybersecurity Professional", sub: [] }
            ]
          }
        ],
        [
          {
            title: "Seguridad Técnica",
            items: [
              { text: "Ethical Hacking Professional", sub: [] },
              { text: "Certified Red Team Operations Management (CRTOM)", sub: [] },
              { text: "Certified Ransomware Protection Officer (CRPO)", sub: [] }
            ]
          },
          {
            title: "Inteligencia Artificial y Gestión del Riesgo",
            items: [
              { text: "AI Governance Professional Certification (AIGPC™)", sub: [] },
              { text: "AI Risk Manager Professional Certification (AIRMPC™)", sub: [] },
              { text: "Generative AI Professional Certification (GAIPC™)", sub: [] },
              { text: "Certified LLM Security Expert (CLLMSE)", sub: [] }
            ]
          },
          {
            title: "Cloud, Redes y DevOps",
            items: [
              { text: "Google Cloud Certified – Associate Cloud Engineer", sub: [] },
              { text: "Google Cloud Cybersecurity Certificate", sub: [] },
              { text: "Multicloud Network Associate (Aviatrix)", sub: [] },
              { text: "Fortinet Certified Associate in Cybersecurity", sub: [] },
              { text: "SonicWall CSE Advanced Accreditation", sub: [] },
              { text: "Google Cloud Skill Badges (Networking, Security, Terraform, Load Balancing, App Dev)", sub: [] },
              { text: "DevOps Advanced Professional", sub: [] },
              { text: "Agile Leader Professional", sub: [] },
              { text: "Microsoft – Migrate & Modernize (Azure, Copilot, SQL Migration, App Modernization)", sub: [] }
            ]
          }
        ]
      ]
    },
    {
      id: "formacion",
      title: "Formación académica, idiomas y recomendaciones",
      type: "blocks",
      blocks: [
        {
          title: "Formación académica",
          text: "Técnico Superior en Desarrollo de Productos Electrónicos — IES Ángel Corella (1997 – 1999).",
          bullets: []
        },
        {
          title: "Idiomas",
          text: "",
          bullets: [
            "Español: nativo.",
            "Inglés: competencia orientada principalmente a la comprensión de documentación, herramientas y comunicaciones profesionales. Aunque la expresión oral es más limitada, toda mi experiencia se ha desarrollado en entornos donde el inglés es el idioma habitual de referencia y, con el apoyo de herramientas actuales de traducción, no supone una limitación para el desempeño del puesto."
          ]
        },
        {
          title: "Recomendaciones profesionales",
          text: "Recomendaciones contrastadas de directivos, responsables de seguridad y profesionales senior del sector disponibles en LinkedIn, destacando liderazgo técnico, visión estratégica, fiabilidad operativa y capacidad de ejecución en entornos críticos.",
          bullets: []
        }
      ]
    },
    {
      id: "otros",
      title: "Otros datos de interés",
      type: "bullets",
      bullets: [
        "Fundador de **GRCreal** (grcreal.com), plataforma de divulgación en GRC, ciberseguridad, ENS e inteligencia artificial, y de **Technology Advisory** (technology-advisory.es), centrada en arquitectura de infraestructura.",
        "Autor de publicaciones técnicas en LinkedIn, con reconocimiento por parte de profesionales del sector y recomendaciones públicas que respaldan su trayectoria y liderazgo técnico; **asesoramiento y mentoría a técnicos junior de la comunidad, guiándolos en el desarrollo de proyectos**.",
        "Desarrollo de laboratorios internos y entornos **PoC (Proof of Concept)** para validación de arquitecturas, controles de seguridad y nuevas tecnologías.",
        "Trayectoria consolidada en teletrabajo y dirección remota de equipos técnicos, proveedores y proyectos en entornos corporativos complejos.",
        "Formación continua y actualización permanente en infraestructuras, cloud, ciberseguridad, cumplimiento normativo e inteligencia artificial aplicada a la gestión del riesgo.",
        "Posicionamiento destacado en rankings de creadores de contenido en ciberseguridad en España (Favikon)."
      ]
    },
    {
      id: "proyectos",
      title: "Proyectos propios",
      type: "projects",
      columns: 4,
      items: [
        { name: "OpenTrust Group", url: "opentrust.group", desc: "Ecosistema de confianza digital." },
        { name: "GRCREAL", url: "grcreal.com", desc: "Gobierno, Riesgo, Cumplimiento e Inteligencia Artificial." },
        { name: "FraudeDigital", url: "fraudedigital.es", desc: "Prevención, análisis y respuesta frente al fraude digital." },
        { name: "Technology Advisory", url: "technology-advisory.es", desc: "Arquitectura empresarial, infraestructura, cloud y ciberseguridad." },
        { name: "CyberLibrary AI", url: "cyberlibrary-ai.es", desc: "Arquitectura, seguridad, auditoría y gobierno de sistemas de Inteligencia Artificial." },
        { name: "LexRadar", url: "lexradar.es", desc: "Inteligencia jurídica y análisis normativo." },
        { name: "Arq Studio", url: "opentrust.group/apps/arq-studio.html", desc: "Diseño, documentación y gobierno profesional de arquitecturas de soluciones." },
        { name: "AuditHub", url: "opentrust.group/apps/audithub.html", desc: "Gestión centralizada de auditorías, controles, evidencias y planes de acción." }
      ]
    }
  ]
};

const MAX_TEXT = 4000;
const MAX_ITEMS = 80;

const text = (value, max = MAX_TEXT) =>
  typeof value === "string" ? value.replace(/\r/g, "").replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max) : "";

// No se filtran cadenas vacías: una línea en blanco es una entrada legítima
// (p. ej. espaciar un párrafo o una viñeta desde la edición inline de la
// vista previa). text() ya normaliza cualquier valor no-string a "".
const list = (value, max = MAX_ITEMS) => (Array.isArray(value) ? value.slice(0, max).map((item) => text(item)) : []);

/**
 * Normaliza y limita cualquier modelo recibido del cliente.
 * Nada que no esté contemplado aquí llega al documento renderizado.
 */
export function sanitizeModel(input) {
  const source = input && typeof input === "object" ? input : {};
  const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
  const focus = source.focus && typeof source.focus === "object" ? source.focus : {};

  return {
    version: CV_MODEL_VERSION,
    meta: {
      brandLead: text(meta.brandLead, 80) || DEFAULT_CV_MODEL.meta.brandLead,
      brandTail: text(meta.brandTail, 200),
      name: text(meta.name, 120) || DEFAULT_CV_MODEL.meta.name,
      role: text(meta.role, 160),
      contact: list(meta.contact, 6),
      footer: text(meta.footer, 300),
      pdfFileName:
        (text(meta.pdfFileName, 80) || DEFAULT_CV_MODEL.meta.pdfFileName).replace(/[^A-Za-z0-9._-]+/g, "_")
    },
    claim: list(source.claim, 4),
    summary: list(source.summary, 10),
    focus: { title: text(focus.title, 80), items: list(focus.items, 12) },
    closing: text(source.closing, 400),
    sections: (Array.isArray(source.sections) ? source.sections : []).slice(0, 15).map(sanitizeSection)
  };
}

function sanitizeSection(raw, index) {
  const input = raw && typeof raw === "object" ? raw : {};
  const type = ["experience", "bullets", "groups", "certs", "blocks", "projects"].includes(input.type)
    ? input.type
    : "bullets";

  const section = {
    id: (text(input.id, 40) || `seccion-${index + 1}`).replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
    title: text(input.title, 120) || `Sección ${index + 1}`,
    type
  };

  if (type === "experience") {
    section.jobs = (Array.isArray(input.jobs) ? input.jobs : []).slice(0, 20).map((job) => {
      const j = job && typeof job === "object" ? job : {};
      return {
        company: text(j.company, 140),
        place: text(j.place, 120),
        dates: text(j.dates, 60),
        subrole: text(j.subrole, 220),
        intro: text(j.intro),
        meta: text(j.meta),
        tag: text(j.tag, 60),
        bullets: list(j.bullets),
        roles: (Array.isArray(j.roles) ? j.roles : []).slice(0, 10).map((role) => {
          const r = role && typeof role === "object" ? role : {};
          return { title: text(r.title, 160), dates: text(r.dates, 60), bullets: list(r.bullets) };
        })
      };
    });
  } else if (type === "bullets") {
    section.bullets = list(input.bullets);
  } else if (type === "groups") {
    section.groups = (Array.isArray(input.groups) ? input.groups : []).slice(0, 12).map((group) => {
      const g = group && typeof group === "object" ? group : {};
      return { title: text(g.title, 140), intro: text(g.intro), bullets: list(g.bullets) };
    });
  } else if (type === "certs") {
    const columns = Array.isArray(input.columns) ? input.columns : [];
    section.columns = columns.slice(0, 2).map((column) =>
      (Array.isArray(column) ? column : []).slice(0, 10).map((group) => {
        const g = group && typeof group === "object" ? group : {};
        return {
          title: text(g.title, 140),
          items: (Array.isArray(g.items) ? g.items : []).slice(0, 40).map((item) => {
            const i = item && typeof item === "object" ? item : { text: item };
            return { text: text(i.text), sub: list(i.sub, 20) };
          })
        };
      })
    );
    while (section.columns.length < 2) section.columns.push([]);
  } else if (type === "blocks") {
    section.blocks = (Array.isArray(input.blocks) ? input.blocks : []).slice(0, 12).map((block) => {
      const b = block && typeof block === "object" ? block : {};
      return { title: text(b.title, 140), text: text(b.text), bullets: list(b.bullets) };
    });
  } else if (type === "projects") {
    section.intro = text(input.intro);
    const columns = Number(input.columns);
    section.columns = columns >= 2 && columns <= 4 ? Math.trunc(columns) : 4;
    section.items = (Array.isArray(input.items) ? input.items : []).slice(0, 24).map((item) => {
      const i = item && typeof item === "object" ? item : {};
      return { name: text(i.name, 80), url: text(i.url, 160), desc: text(i.desc, 400) };
    });
  }

  return section;
}

export function cloneDefaultModel() {
  return JSON.parse(JSON.stringify(DEFAULT_CV_MODEL));
}
