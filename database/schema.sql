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

-- ────────────────────────────────────────────
-- SERVICIOS (catálogo propio del cliente: "sobre qué producto/área es el
-- ticket". Deliberadamente separado de `contratos` — contratos es la
-- relación comercial ClientPulse↔Cliente (precio, nivel de servicio) y
-- nunca debe exponerse al usuario final; servicios solo tiene nombre.)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.servicios (
    id_servicio SERIAL PRIMARY KEY,
    id_cliente  INTEGER      NOT NULL REFERENCES public.clientes(id_cliente),
    nombre      VARCHAR(150) NOT NULL,
    estado      VARCHAR(20)  DEFAULT 'ACTIVO'
);

-- ────────────────────────────────────────────
-- TICKETS
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tickets (
    id_ticket          SERIAL PRIMARY KEY,
    -- id_contrato queda nullable y solo por compatibilidad con tickets históricos;
    -- los tickets nuevos usan id_cliente + id_servicio directamente.
    id_contrato        INTEGER      REFERENCES public.contratos(id_contrato),
    id_cliente         INTEGER      REFERENCES public.clientes(id_cliente),
    id_servicio        INTEGER      REFERENCES public.servicios(id_servicio),
    titulo             VARCHAR(200) NOT NULL,
    descripcion        TEXT         NOT NULL,
    tipo               VARCHAR(20),
    prioridad          VARCHAR(20),
    estado             VARCHAR(20)  DEFAULT 'ENTREGADO',
    fecha_creacion     TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_cierre       TIMESTAMP,
    -- Quién presentó el ticket (usuario final o personal de la empresa cliente).
    -- Nullable: tickets antiguos no lo tienen; permite que un USUARIO_FINAL vea "sus" tickets.
    id_usuario_creador  INTEGER      REFERENCES public.usuarios(id_usuario),
    -- Quién de la empresa cliente (agente/supervisor) está gestionando el ticket.
    id_agente_asignado  INTEGER      REFERENCES public.usuarios(id_usuario)
);

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS id_usuario_creador INTEGER REFERENCES public.usuarios(id_usuario);
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS id_cliente INTEGER REFERENCES public.clientes(id_cliente);
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS id_servicio INTEGER REFERENCES public.servicios(id_servicio);
ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS id_agente_asignado INTEGER REFERENCES public.usuarios(id_usuario);
ALTER TABLE public.tickets
    ALTER COLUMN id_contrato DROP NOT NULL;

-- ────────────────────────────────────────────
-- MENSAJES DE TICKET (conversación: respuestas visibles para el cliente +
-- notas internas visibles solo para el staff de la empresa)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ticket_mensajes (
    id_mensaje        SERIAL PRIMARY KEY,
    id_ticket         INTEGER      NOT NULL REFERENCES public.tickets(id_ticket),
    id_usuario_autor  INTEGER      NOT NULL REFERENCES public.usuarios(id_usuario),
    mensaje           TEXT         NOT NULL,
    tipo              VARCHAR(20)  NOT NULL DEFAULT 'RESPUESTA', -- 'RESPUESTA' | 'NOTA_INTERNA'
    fecha_creacion    TIMESTAMP    NOT NULL DEFAULT NOW()
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
