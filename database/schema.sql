-- ClientPulse AI — Esquema de base de datos
-- Extraído del backup real: clientpulseai.sql
-- PostgreSQL 14+

-- ────────────────────────────────────────────
-- ROLES
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles (
    id_rol   SERIAL PRIMARY KEY,
    codigo   VARCHAR(50)  NOT NULL UNIQUE,
    nombre   VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- ────────────────────────────────────────────
-- MÓDULOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.modulos (
    id_modulo   SERIAL PRIMARY KEY,
    codigo      VARCHAR(50)  NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT
);

-- ────────────────────────────────────────────
-- PERMISOS (vinculados a un módulo)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.permisos (
    id_permiso  SERIAL PRIMARY KEY,
    codigo      VARCHAR(80)  NOT NULL UNIQUE,
    nombre      VARCHAR(120) NOT NULL,
    descripcion TEXT,
    id_modulo   INTEGER      NOT NULL REFERENCES public.modulos(id_modulo) ON DELETE CASCADE
);

-- ────────────────────────────────────────────
-- ROLES ↔ PERMISOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles_permisos (
    id_rol     INTEGER NOT NULL REFERENCES public.roles(id_rol)    ON DELETE CASCADE,
    id_permiso INTEGER NOT NULL REFERENCES public.permisos(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

-- ────────────────────────────────────────────
-- CLIENTES
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes (
    id_cliente            SERIAL PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    nit                   VARCHAR(50),
    sector                VARCHAR(100),
    fecha_inicio_relacion DATE,
    estado                VARCHAR(20) DEFAULT 'ACTIVO'
);

-- ────────────────────────────────────────────
-- CLIENTES ↔ MÓDULOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clientes_modulos (
    id_cliente INTEGER NOT NULL REFERENCES public.clientes(id_cliente) ON DELETE CASCADE,
    id_modulo  INTEGER NOT NULL REFERENCES public.modulos(id_modulo)   ON DELETE CASCADE,
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_cliente, id_modulo)
);

-- ────────────────────────────────────────────
-- USUARIOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usuarios (
    id_usuario    SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    correo        VARCHAR(150) NOT NULL UNIQUE,
    rol           VARCHAR(50),
    password_hash VARCHAR(255),
    id_rol        INTEGER REFERENCES public.roles(id_rol),
    id_cliente    INTEGER REFERENCES public.clientes(id_cliente),
    activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo ON public.usuarios(correo);

-- ────────────────────────────────────────────
-- CONTRATOS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contratos (
    id_contrato     SERIAL PRIMARY KEY,
    id_cliente      INTEGER         NOT NULL REFERENCES public.clientes(id_cliente),
    nombre_proyecto VARCHAR(150)    NOT NULL,
    fecha_inicio    DATE            NOT NULL,
    fecha_fin       DATE,
    valor_mensual   NUMERIC(14, 2),
    estado          VARCHAR(20)     DEFAULT 'VIGENTE',
    nivel_servicio  VARCHAR(50)
);

-- ────────────────────────────────────────────
-- TICKETS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tickets (
    id_ticket      SERIAL PRIMARY KEY,
    id_contrato    INTEGER      NOT NULL REFERENCES public.contratos(id_contrato),
    titulo         VARCHAR(200) NOT NULL,
    descripcion    TEXT         NOT NULL,
    tipo           VARCHAR(20),
    prioridad      VARCHAR(20),
    estado         VARCHAR(20)  DEFAULT 'ENTREGADO',
    fecha_creacion TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_cierre   TIMESTAMP
);

-- ────────────────────────────────────────────
-- ANÁLISIS IA
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analisis_ticket (
    id_analisis           SERIAL PRIMARY KEY,
    id_ticket             INTEGER         NOT NULL REFERENCES public.tickets(id_ticket),
    sentimiento           VARCHAR(20),
    frustracion           VARCHAR(20),
    score_churn           NUMERIC(5, 2),
    riesgo_churn          VARCHAR(20),
    es_potencial_phishing BOOLEAN         DEFAULT FALSE,
    tiene_datos_sensibles BOOLEAN         DEFAULT FALSE,
    recomendaciones       TEXT,
    fecha_analisis        TIMESTAMP       NOT NULL DEFAULT NOW()
);
