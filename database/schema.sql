-- ClientPulse AI — Esquema de base de datos
-- PostgreSQL 14+
-- Ejecutar: psql -U postgres -d vortex -f database/schema.sql

-- ────────────────────────────────────────────
-- ROLES Y PERMISOS (RBAC)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
    id_rol   SERIAL PRIMARY KEY,
    codigo   VARCHAR(50)  NOT NULL UNIQUE,
    nombre   VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS permisos (
    id_permiso  SERIAL PRIMARY KEY,
    codigo      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS roles_permisos (
    id_rol      INTEGER NOT NULL REFERENCES roles(id_rol)   ON DELETE CASCADE,
    id_permiso  INTEGER NOT NULL REFERENCES permisos(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

-- ────────────────────────────────────────────
-- MÓDULOS (funcionalidades por cliente)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS modulos (
    id_modulo  SERIAL PRIMARY KEY,
    codigo     VARCHAR(50)  NOT NULL UNIQUE,
    nombre     VARCHAR(100) NOT NULL
);

-- ────────────────────────────────────────────
-- CLIENTES
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clientes (
    id_cliente            SERIAL PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    nit                   VARCHAR(20)  NOT NULL UNIQUE,
    sector                VARCHAR(100),
    fecha_inicio_relacion DATE         NOT NULL,
    estado                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVO'
                            CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE IF NOT EXISTS clientes_modulos (
    id_cliente  INTEGER NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    id_modulo   INTEGER NOT NULL REFERENCES modulos(id_modulo)   ON DELETE CASCADE,
    habilitado  BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_cliente, id_modulo)
);

-- ────────────────────────────────────────────
-- USUARIOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario    SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    correo        VARCHAR(150) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    id_rol        INTEGER      NOT NULL REFERENCES roles(id_rol),
    id_cliente    INTEGER      REFERENCES clientes(id_cliente) ON DELETE SET NULL,
    -- Campo desnormalizado para el login rápido sin JOIN adicional
    rol           VARCHAR(50)  NOT NULL
);

-- ────────────────────────────────────────────
-- CONTRATOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contratos (
    id_contrato     SERIAL PRIMARY KEY,
    id_cliente      INTEGER        NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    nombre_proyecto VARCHAR(200)   NOT NULL,
    fecha_inicio    DATE           NOT NULL,
    fecha_fin       DATE,
    valor_mensual   NUMERIC(15, 2) NOT NULL DEFAULT 0,
    estado          VARCHAR(20)    NOT NULL DEFAULT 'VIGENTE'
                        CHECK (estado IN ('VIGENTE', 'INACTIVO', 'VENCIDO', 'CANCELADO')),
    nivel_servicio  VARCHAR(10)
                        CHECK (nivel_servicio IN ('DIAMOND', 'GOLD', 'SILVER', 'BRONZE'))
);

-- ────────────────────────────────────────────
-- TICKETS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tickets (
    id_ticket      SERIAL PRIMARY KEY,
    id_contrato    INTEGER      NOT NULL REFERENCES contratos(id_contrato) ON DELETE CASCADE,
    titulo         VARCHAR(200) NOT NULL,
    descripcion    TEXT         NOT NULL,
    tipo           VARCHAR(15)  CHECK (tipo IN ('CORRECTIVO', 'EVOLUTIVO', 'OTRO')),
    prioridad      VARCHAR(10)  CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'CRITICA')),
    estado         VARCHAR(30)  NOT NULL DEFAULT 'ENTREGADO'
                        CHECK (estado IN ('ENTREGADO', 'EN_PROCESO', 'CERRADO', 'BLOQUEADO_POR_SEGURIDAD')),
    fecha_creacion TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    fecha_cierre   TIMESTAMPTZ
);

-- ────────────────────────────────────────────
-- ANÁLISIS IA
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analisis_ticket (
    id_analisis           SERIAL PRIMARY KEY,
    id_ticket             INTEGER     NOT NULL UNIQUE REFERENCES tickets(id_ticket) ON DELETE CASCADE,
    sentimiento           VARCHAR(10) NOT NULL CHECK (sentimiento IN ('POSITIVO', 'NEUTRO', 'NEGATIVO')),
    frustracion           VARCHAR(5)  NOT NULL CHECK (frustracion  IN ('BAJA', 'MEDIA', 'ALTA')),
    score_churn           INTEGER     NOT NULL CHECK (score_churn BETWEEN 0 AND 100),
    riesgo_churn          VARCHAR(5)  NOT NULL CHECK (riesgo_churn IN ('BAJO', 'MEDIO', 'ALTO')),
    es_potencial_phishing BOOLEAN     NOT NULL DEFAULT FALSE,
    tiene_datos_sensibles BOOLEAN     NOT NULL DEFAULT FALSE,
    recomendaciones       TEXT,
    fecha_analisis        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- ÍNDICES
-- ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_contratos_cliente    ON contratos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_tickets_contrato     ON tickets(id_contrato);
CREATE INDEX IF NOT EXISTS idx_tickets_estado       ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_analisis_ticket      ON analisis_ticket(id_ticket);
CREATE INDEX IF NOT EXISTS idx_analisis_riesgo      ON analisis_ticket(riesgo_churn);
CREATE INDEX IF NOT EXISTS idx_clientes_modulos     ON clientes_modulos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_usuarios_correo      ON usuarios(correo);
