-- ClientPulse AI — Reset + datos de prueba (SQL plano, para pegar en el
-- editor SQL de Neon, o correr con: psql -f database/seed.sql)
--
-- Es el equivalente exacto de database/seed.js pero sin depender de
-- Node/bcrypt: la contraseña de prueba '1234' viene pre-hasheada.
-- ADVERTENCIA: es DESTRUCTIVO — borra todo el contenido de negocio antes
-- de insertar los datos nuevos.
--
-- Contenido:
--   1) Esquema (idéntico a database/schema.sql, idempotente)
--   2) TRUNCATE de todas las tablas de negocio
--   3) INSERTs de datos de prueba (mismo escenario que seed.js)

-- ════════════════════════════════════════════════════════════════════
-- 1) ESQUEMA
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.roles (
    id_rol   SERIAL PRIMARY KEY,
    codigo   VARCHAR(50)  NOT NULL UNIQUE,
    nombre   VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS public.modulos (
    id_modulo   SERIAL PRIMARY KEY,
    codigo      VARCHAR(50)  NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS public.permisos (
    id_permiso  SERIAL PRIMARY KEY,
    codigo      VARCHAR(80)  NOT NULL UNIQUE,
    nombre      VARCHAR(120) NOT NULL,
    descripcion TEXT,
    id_modulo   INTEGER      NOT NULL REFERENCES public.modulos(id_modulo) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.roles_permisos (
    id_rol     INTEGER NOT NULL REFERENCES public.roles(id_rol)    ON DELETE CASCADE,
    id_permiso INTEGER NOT NULL REFERENCES public.permisos(id_permiso) ON DELETE CASCADE,
    PRIMARY KEY (id_rol, id_permiso)
);

CREATE TABLE IF NOT EXISTS public.clientes (
    id_cliente            SERIAL PRIMARY KEY,
    nombre                VARCHAR(150) NOT NULL,
    nit                   VARCHAR(50),
    sector                VARCHAR(100),
    fecha_inicio_relacion DATE,
    estado                VARCHAR(20) DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS public.clientes_modulos (
    id_cliente INTEGER NOT NULL REFERENCES public.clientes(id_cliente) ON DELETE CASCADE,
    id_modulo  INTEGER NOT NULL REFERENCES public.modulos(id_modulo)   ON DELETE CASCADE,
    habilitado BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_cliente, id_modulo)
);

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

CREATE TABLE IF NOT EXISTS public.servicios (
    id_servicio SERIAL PRIMARY KEY,
    id_cliente  INTEGER      NOT NULL REFERENCES public.clientes(id_cliente),
    nombre      VARCHAR(150) NOT NULL,
    estado      VARCHAR(20)  DEFAULT 'ACTIVO'
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id_ticket          SERIAL PRIMARY KEY,
    id_contrato        INTEGER      REFERENCES public.contratos(id_contrato),
    id_cliente         INTEGER      REFERENCES public.clientes(id_cliente),
    id_servicio        INTEGER      REFERENCES public.servicios(id_servicio),
    titulo             VARCHAR(200) NOT NULL,
    descripcion        TEXT         NOT NULL,
    tipo               VARCHAR(20),
    prioridad          VARCHAR(20),
    -- 30 (no 20): debe caber el literal 'BLOQUEADO_POR_SEGURIDAD' (24 chars)
    -- que usa ticket.service.ts al detectar phishing.
    estado             VARCHAR(30)  DEFAULT 'ENTREGADO',
    fecha_creacion     TIMESTAMP    NOT NULL DEFAULT NOW(),
    fecha_cierre       TIMESTAMP,
    id_usuario_creador  INTEGER      REFERENCES public.usuarios(id_usuario),
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
ALTER TABLE public.tickets
    ALTER COLUMN estado TYPE VARCHAR(30);

CREATE TABLE IF NOT EXISTS public.ticket_mensajes (
    id_mensaje        SERIAL PRIMARY KEY,
    id_ticket         INTEGER      NOT NULL REFERENCES public.tickets(id_ticket),
    id_usuario_autor  INTEGER      NOT NULL REFERENCES public.usuarios(id_usuario),
    mensaje           TEXT         NOT NULL,
    tipo              VARCHAR(20)  NOT NULL DEFAULT 'RESPUESTA',
    fecha_creacion    TIMESTAMP    NOT NULL DEFAULT NOW()
);

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

-- ════════════════════════════════════════════════════════════════════
-- 2) RESET TOTAL
-- ════════════════════════════════════════════════════════════════════

BEGIN;

TRUNCATE TABLE
    ticket_mensajes, analisis_ticket, tickets, servicios, contratos,
    roles_permisos, clientes_modulos, usuarios, clientes, permisos, modulos, roles
    RESTART IDENTITY CASCADE;

-- ════════════════════════════════════════════════════════════════════
-- 3) MÓDULOS
-- ════════════════════════════════════════════════════════════════════

INSERT INTO modulos (codigo, nombre, descripcion) VALUES
    ('DASHBOARD', 'Dashboard analítico',  'Visualización de KPIs y métricas de churn'),
    ('TICKETS',   'Gestión de tickets',   'Creación y seguimiento de tickets de soporte'),
    ('CLIENTES',  'Gestión de clientes',  'Registro y consulta de clientes'),
    ('CONTRATOS', 'Gestión de contratos', 'Registro y consulta de contratos por cliente'),
    ('EQUIPO',    'Gestión de equipo',    'Invitar y administrar usuarios finales de la empresa');

-- ════════════════════════════════════════════════════════════════════
-- 4) PERMISOS
-- ════════════════════════════════════════════════════════════════════

INSERT INTO permisos (codigo, nombre, descripcion, id_modulo)
SELECT v.codigo, v.nombre, v.descripcion, m.id_modulo
FROM (VALUES
    ('DASHBOARD_VER',              'Ver dashboard',              'Acceso al dashboard de métricas',                                   'DASHBOARD'),
    ('TICKETS_VER',                'Ver tickets',                'Listar y consultar tickets (propios)',                              'TICKETS'),
    ('TICKETS_VER_TODOS',          'Ver todos los tickets',      'Ver todos los tickets de la empresa, no solo los propios',          'TICKETS'),
    ('TICKETS_CREAR',              'Crear tickets',              'Registrar nuevos tickets con análisis IA',                          'TICKETS'),
    ('TICKETS_GESTIONAR',          'Gestionar tickets',          'Asignar y cerrar tickets de la propia empresa',                     'TICKETS'),
    ('CLIENTES_VER',               'Ver clientes',               'Listar y consultar clientes',                                       'CLIENTES'),
    ('CLIENTES_CREAR',             'Crear clientes',             'Registrar nuevos clientes',                                         'CLIENTES'),
    ('CONTRATOS_VER',              'Ver contratos',              'Listar y consultar contratos',                                      'CONTRATOS'),
    ('CONTRATOS_CREAR',            'Crear contratos',            'Registrar nuevos contratos',                                        'CONTRATOS'),
    ('USUARIOS_FINALES_GESTIONAR', 'Gestionar usuarios finales', 'Invitar y administrar los usuarios finales de la propia empresa',  'EQUIPO'),
    ('SERVICIOS_GESTIONAR',        'Gestionar servicios',        'Crear y administrar el catálogo de servicios de la propia empresa','EQUIPO')
) AS v(codigo, nombre, descripcion, mod_codigo)
JOIN modulos m ON m.codigo = v.mod_codigo;

-- ════════════════════════════════════════════════════════════════════
-- 5) ROLES
-- ════════════════════════════════════════════════════════════════════

INSERT INTO roles (codigo, nombre, descripcion) VALUES
    ('ADMIN_GLOBAL',  'Administrador Global', 'Acceso total a todos los clientes y módulos'),
    ('SUPERVISOR',    'Supervisor',           'Acceso completo dentro de su cliente asignado'),
    ('AGENTE',        'Agente de Soporte',    'Crea y gestiona tickets de su cliente'),
    ('VISUALIZADOR',  'Visualizador',         'Solo lectura — no puede crear ni modificar nada'),
    ('USUARIO_FINAL', 'Usuario final',        'Presenta y consulta únicamente sus propios tickets');

-- ════════════════════════════════════════════════════════════════════
-- 6) ROLES ↔ PERMISOS
-- ════════════════════════════════════════════════════════════════════

-- ADMIN_GLOBAL y SUPERVISOR: todos los permisos
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.codigo IN ('ADMIN_GLOBAL', 'SUPERVISOR');

-- AGENTE: dashboard + tickets (ver todos + crear + gestionar)
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'AGENTE'
  AND p.codigo IN ('DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'TICKETS_CREAR', 'TICKETS_GESTIONAR');

-- VISUALIZADOR: solo lectura
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'VISUALIZADOR'
  AND p.codigo IN ('DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'CLIENTES_VER', 'CONTRATOS_VER');

-- USUARIO_FINAL: solo crea y ve los suyos
INSERT INTO roles_permisos (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r CROSS JOIN permisos p
WHERE r.codigo = 'USUARIO_FINAL'
  AND p.codigo IN ('TICKETS_VER', 'TICKETS_CREAR');

-- ════════════════════════════════════════════════════════════════════
-- 7) CLIENTES
-- ════════════════════════════════════════════════════════════════════

INSERT INTO clientes (nombre, nit, sector, fecha_inicio_relacion, estado) VALUES
    ('TechCorp S.A.S',   '900111222-3', 'Tecnología', '2021-01-15', 'ACTIVO'),
    ('Bancol Finanzas',  '800333444-5', 'Banca',      '2020-06-01', 'ACTIVO'),
    ('EduPlus Colombia', '901555666-7', 'Educación',  '2022-03-20', 'ACTIVO');

-- ════════════════════════════════════════════════════════════════════
-- 8) CLIENTES ↔ MÓDULOS
-- ════════════════════════════════════════════════════════════════════
-- TechCorp y Bancol: todos los módulos. EduPlus: solo DASHBOARD + TICKETS.

INSERT INTO clientes_modulos (id_cliente, id_modulo, habilitado)
SELECT c.id_cliente, m.id_modulo, TRUE
FROM clientes c CROSS JOIN modulos m
WHERE (c.nit IN ('900111222-3', '800333444-5')
       AND m.codigo IN ('DASHBOARD', 'TICKETS', 'CLIENTES', 'CONTRATOS', 'EQUIPO'))
   OR (c.nit = '901555666-7' AND m.codigo IN ('DASHBOARD', 'TICKETS'));

-- ════════════════════════════════════════════════════════════════════
-- 9) USUARIOS (contraseña de todos: 1234)
-- ════════════════════════════════════════════════════════════════════
-- Hash bcrypt (10 rounds) de '1234', generado y verificado localmente.

INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol, activo)
SELECT v.nombre, v.correo,
       '$2b$10$8qVz0HUHx6PnysZgq96sYu81mMKdtWHDy7XIjojZpQ/7dn8sFxTs.',
       r.id_rol, c.id_cliente, v.rol_codigo, TRUE
FROM (VALUES
    ('Sneider Malagón',      'sneider@gmail.com',       'ADMIN_GLOBAL',  NULL,          'ADMIN_GLOBAL'),
    ('Laura Torres',         'sup1@techcorp.com',       'SUPERVISOR',    '900111222-3', 'SUPERVISOR'),
    ('Andrés Vargas',        'sup2@bancol.com',         'SUPERVISOR',    '800333444-5', 'SUPERVISOR'),
    ('Camila Ruiz',          'agente1@techcorp.com',    'AGENTE',        '900111222-3', 'AGENTE'),
    ('David Morales',        'agente2@techcorp.com',    'AGENTE',        '900111222-3', 'AGENTE'),
    ('Diego Ramírez',        'agente3@eduplus.com',     'AGENTE',        '901555666-7', 'AGENTE'),
    ('Sofía Herrera',        'viewer@eduplus.com',      'VISUALIZADOR',  '901555666-7', 'VISUALIZADOR'),
    ('Pedro Gómez',          'cliente1@techcorp.com',   'USUARIO_FINAL', '900111222-3', 'USUARIO_FINAL'),
    ('Marta Ríos',           'cliente2@techcorp.com',   'USUARIO_FINAL', '900111222-3', 'USUARIO_FINAL'),
    ('Jorge Salazar',        'usuario1@bancol.com',     'USUARIO_FINAL', '800333444-5', 'USUARIO_FINAL'),
    ('Valentina Cruz',       'estudiante1@eduplus.com', 'USUARIO_FINAL', '901555666-7', 'USUARIO_FINAL')
) AS v(nombre, correo, rol_codigo, nit, rol)
JOIN roles r ON r.codigo = v.rol_codigo
LEFT JOIN clientes c ON c.nit = v.nit;

-- ════════════════════════════════════════════════════════════════════
-- 10) CONTRATOS (relación comercial ClientPulse↔Cliente — nunca se
--     expone al usuario final; independiente del catálogo de servicios)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO contratos (id_cliente, nombre_proyecto, fecha_inicio, fecha_fin, valor_mensual, estado, nivel_servicio)
SELECT c.id_cliente, v.nombre_proyecto, v.fecha_inicio::date, v.fecha_fin::date, v.valor_mensual::numeric, v.estado, v.nivel_servicio
FROM (VALUES
    ('900111222-3', 'Sistema ERP',           '2021-02-01', '2025-12-31', '8500000',  'VIGENTE',  'GOLD'),
    ('900111222-3', 'Soporte Cloud',         '2022-01-01', NULL,         '3200000',  'VIGENTE',  'SILVER'),
    ('800333444-5', 'Core Bancario',         '2020-07-01', '2025-06-30', '25000000', 'VIGENTE',  'DIAMOND'),
    ('800333444-5', 'Módulo BI',             '2023-01-15', NULL,         '5000000',  'VIGENTE',  'GOLD'),
    ('901555666-7', 'LMS Campus Virtual',    '2022-04-01', '2024-12-31', '4200000',  'INACTIVO', 'BRONZE'),
    ('901555666-7', 'Portal Estudiantil v2', '2024-01-01', NULL,         '6800000',  'VIGENTE',  'SILVER')
) AS v(nit, nombre_proyecto, fecha_inicio, fecha_fin, valor_mensual, estado, nivel_servicio)
JOIN clientes c ON c.nit = v.nit;

-- ════════════════════════════════════════════════════════════════════
-- 11) SERVICIOS (catálogo propio del cliente — lo que el usuario final
--     elige al crear un ticket; deliberadamente separado de contratos)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO servicios (id_cliente, nombre, estado)
SELECT c.id_cliente, v.nombre, v.estado
FROM (VALUES
    ('900111222-3', 'Sistema ERP',        'ACTIVO'),
    ('900111222-3', 'Soporte Cloud',      'ACTIVO'),
    ('900111222-3', 'Portal de Clientes', 'ACTIVO'),
    ('800333444-5', 'Core Bancario',      'ACTIVO'),
    ('800333444-5', 'Módulo BI',          'ACTIVO'),
    ('800333444-5', 'Banca Móvil',        'ACTIVO'),
    ('901555666-7', 'Portal Estudiantil', 'ACTIVO'),
    ('901555666-7', 'LMS Campus Virtual', 'INACTIVO')
) AS v(nit, nombre, estado)
JOIN clientes c ON c.nit = v.nit;

-- ════════════════════════════════════════════════════════════════════
-- 12) TICKETS
-- ════════════════════════════════════════════════════════════════════
-- id_contrato se deja NULL a propósito: los tickets nuevos usan
-- id_cliente + id_servicio directamente (ver ticket.service.ts).
-- titulo es único dentro de este seed — se usa como llave para
-- encadenar análisis IA y mensajes más abajo.

INSERT INTO tickets (id_cliente, id_servicio, titulo, descripcion, tipo, prioridad, estado,
                      fecha_creacion, fecha_cierre, id_usuario_creador, id_agente_asignado)
SELECT cl.id_cliente, sv.id_servicio, v.titulo, v.descripcion, v.tipo, v.prioridad, v.estado,
       v.fecha_creacion::timestamp, v.fecha_cierre::timestamp, uc.id_usuario, ua.id_usuario
FROM (VALUES
    ('900111222-3', 'Sistema ERP',
     'Error crítico en módulo de nómina',
     'El sistema ERP cayó durante la liquidación de nómina. Llevamos 3 horas sin acceso y estamos perdiendo dinero. Esto es inaceptable.',
     'CORRECTIVO', 'CRITICA', 'EN_PROCESO', '2026-07-14 02:00:00', NULL, 'cliente1@techcorp.com', 'agente1@techcorp.com'),

    ('900111222-3', 'Soporte Cloud',
     'Solicitud filtro en reportes',
     'Necesitamos un filtro por centro de costo en el módulo de reportes. No es urgente pero lo requerimos para el próximo trimestre.',
     'EVOLUTIVO', 'MEDIA', 'ENTREGADO', '2026-07-10 08:00:00', NULL, 'cliente2@techcorp.com', NULL),

    ('900111222-3', 'Portal de Clientes',
     'Portal de clientes con tiempos de carga altos',
     'El portal de clientes está tardando más de 10 segundos en cargar el listado de facturas desde el lunes.',
     'CORRECTIVO', 'MEDIA', 'CERRADO', '2026-07-04 08:00:00', '2026-07-06 10:00:00', 'cliente1@techcorp.com', 'agente2@techcorp.com'),

    ('900111222-3', 'Sistema ERP',
     'Agradecimiento por soporte',
     'Quería agradecer al equipo por la rápida respuesta al incidente de la semana pasada. Muy satisfechos con el servicio.',
     'OTRO', 'BAJA', 'CERRADO', '2026-07-11 08:00:00', '2026-07-11 09:00:00', 'cliente2@techcorp.com', 'agente1@techcorp.com'),

    ('800333444-5', 'Core Bancario',
     'Falla integración PSE',
     'Las transacciones PSE están fallando desde las 8am. El core bancario no comunica con el gateway de pagos.',
     'CORRECTIVO', 'CRITICA', 'EN_PROCESO', '2026-07-14 04:00:00', NULL, 'usuario1@bancol.com', 'sup2@bancol.com'),

    ('800333444-5', 'Módulo BI',
     'Inconsistencias en reportes de riesgo',
     'Los reportes muestran cifras distintas al sistema legado. Hay una auditoría mañana, necesitamos revisión urgente.',
     'CORRECTIVO', 'ALTA', 'EN_PROCESO', '2026-07-13 02:00:00', NULL, 'usuario1@bancol.com', 'sup2@bancol.com'),

    ('800333444-5', 'Core Bancario',
     'Renovación certificados SSL',
     'Los certificados SSL del servidor de producción vencen el próximo mes. Necesitamos programar la renovación.',
     'OTRO', 'MEDIA', 'CERRADO', '2026-07-07 08:00:00', '2026-07-08 12:00:00', 'usuario1@bancol.com', 'sup2@bancol.com'),

    ('800333444-5', 'Banca Móvil',
     'Correo sospechoso solicitando clave de banca móvil',
     'Recibí un correo pidiendo confirmar mi clave y número de tarjeta para "verificar" mi cuenta de banca móvil. Adjunto el mensaje, parece phishing.',
     'OTRO', 'CRITICA', 'BLOQUEADO_POR_SEGURIDAD', '2026-07-14 06:00:00', NULL, 'usuario1@bancol.com', NULL),

    ('901555666-7', 'Portal Estudiantil',
     'Estudiantes no pueden acceder al portal',
     'Múltiples estudiantes no pueden iniciar sesión. El error dice credenciales incorrectas pero son correctas.',
     'CORRECTIVO', 'ALTA', 'EN_PROCESO', '2026-07-13 22:00:00', NULL, 'estudiante1@eduplus.com', 'agente3@eduplus.com'),

    ('901555666-7', 'LMS Campus Virtual',
     'Error al descargar certificados en el LMS antiguo',
     'El módulo de certificados del LMS anterior no genera el PDF, aunque el curso ya está marcado como completado.',
     'CORRECTIVO', 'BAJA', 'CERRADO', '2026-07-01 20:00:00', '2026-07-02 16:00:00', 'estudiante1@eduplus.com', 'agente3@eduplus.com')
) AS v(nit, servicio, titulo, descripcion, tipo, prioridad, estado, fecha_creacion, fecha_cierre, creador, agente)
JOIN clientes cl ON cl.nit = v.nit
JOIN servicios sv ON sv.id_cliente = cl.id_cliente AND sv.nombre = v.servicio
JOIN usuarios uc ON uc.correo = v.creador
LEFT JOIN usuarios ua ON ua.correo = v.agente;

-- ════════════════════════════════════════════════════════════════════
-- 13) ANÁLISIS IA (1:1 por ticket, encadenado por título)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO analisis_ticket (id_ticket, sentimiento, frustracion, score_churn, riesgo_churn,
                              es_potencial_phishing, tiene_datos_sensibles, recomendaciones, fecha_analisis)
SELECT tk.id_ticket, v.sentimiento, v.frustracion, v.score_churn::numeric, v.riesgo_churn,
       v.phishing::boolean, v.sensible::boolean, v.recomendaciones, tk.fecha_creacion
FROM (VALUES
    ('Error crítico en módulo de nómina',                     'NEGATIVO', 'ALTA',  '85', 'ALTO',  'false', 'false', 'Escalar inmediatamente al equipo de infraestructura. Contactar al cliente en menos de 1 hora.'),
    ('Solicitud filtro en reportes',                          'NEUTRO',   'BAJA',  '22', 'BAJO',  'false', 'false', 'Agregar al backlog del equipo de desarrollo para el siguiente sprint.'),
    ('Portal de clientes con tiempos de carga altos',         'NEGATIVO', 'MEDIA', '40', 'MEDIO', 'false', 'false', 'Se optimizó el query de facturación y se agregó caché. Monitorear los próximos 7 días.'),
    ('Agradecimiento por soporte',                            'POSITIVO', 'BAJA',  '5',  'BAJO',  'false', 'false', 'Mantener el nivel de atención actual y compartir el feedback con el equipo.'),
    ('Falla integración PSE',                                 'NEGATIVO', 'ALTA',  '92', 'ALTO',  'false', 'false', 'Activar protocolo de incidente crítico. Contactar al cliente en 15 minutos.'),
    ('Inconsistencias en reportes de riesgo',                 'NEGATIVO', 'ALTA',  '75', 'ALTO',  'false', 'false', 'Comparar queries del nuevo sistema vs el legado. Prioridad máxima por auditoría.'),
    ('Renovación certificados SSL',                           'NEUTRO',   'BAJA',  '10', 'BAJO',  'false', 'false', 'Programar ventana de mantenimiento y notificar al cliente con 72 horas de anticipación.'),
    ('Correo sospechoso solicitando clave de banca móvil',    'NEGATIVO', 'MEDIA', '30', 'MEDIO', 'true',  'true',  'Ticket bloqueado automáticamente por indicios de phishing/datos sensibles. Requiere revisión manual de seguridad antes de continuar.'),
    ('Estudiantes no pueden acceder al portal',               'NEGATIVO', 'MEDIA', '55', 'MEDIO', 'false', 'false', 'Verificar el servicio de autenticación y revisar logs de auth de las últimas 2 horas.'),
    ('Error al descargar certificados en el LMS antiguo',     'NEUTRO',   'BAJA',  '15', 'BAJO',  'false', 'false', 'Módulo en proceso de reemplazo por el nuevo Portal Estudiantil; se resolvió generando el certificado manualmente.')
) AS v(titulo, sentimiento, frustracion, score_churn, riesgo_churn, phishing, sensible, recomendaciones)
JOIN tickets tk ON tk.titulo = v.titulo;

-- ════════════════════════════════════════════════════════════════════
-- 14) MENSAJES DE TICKET (conversación: RESPUESTA visible al cliente,
--     NOTA_INTERNA solo staff)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO ticket_mensajes (id_ticket, id_usuario_autor, mensaje, tipo, fecha_creacion)
SELECT tk.id_ticket, u.id_usuario, v.mensaje, v.tipo, v.fecha_creacion::timestamp
FROM (VALUES
    ('Error crítico en módulo de nómina', 'agente1@techcorp.com',    'RESPUESTA',    'Estamos revisando el incidente con el equipo de infraestructura, te contactamos en breve.', '2026-07-14 03:00:00'),
    ('Error crítico en módulo de nómina', 'agente1@techcorp.com',    'NOTA_INTERNA', 'Escalado a infraestructura, revisar logs del clúster de nómina desde las 05:00.',            '2026-07-14 03:06:00'),
    ('Error crítico en módulo de nómina', 'cliente1@techcorp.com',   'RESPUESTA',    'Seguimos sin poder generar la nómina, ¿tienen un tiempo estimado de solución?',               '2026-07-14 05:00:00'),

    ('Portal de clientes con tiempos de carga altos', 'agente2@techcorp.com', 'RESPUESTA', 'Identificamos un query sin índice en el listado de facturas, ya está en corrección.',                   '2026-07-05 04:00:00'),
    ('Portal de clientes con tiempos de carga altos', 'agente2@techcorp.com', 'RESPUESTA', 'Listo, desplegamos el fix y los tiempos de carga bajaron a menos de 1 segundo. Quedamos atentos.',      '2026-07-06 09:54:00'),

    ('Agradecimiento por soporte', 'agente1@techcorp.com', 'RESPUESTA', '¡Muchas gracias por el mensaje! Lo compartimos con todo el equipo de soporte.', '2026-07-11 08:30:00'),

    ('Falla integración PSE', 'sup2@bancol.com', 'NOTA_INTERNA', 'Gateway de pagos reporta timeouts intermitentes desde su lado, escalado con el proveedor externo.',      '2026-07-14 04:30:00'),
    ('Falla integración PSE', 'sup2@bancol.com', 'RESPUESTA',    'Confirmamos que es una falla del proveedor de pagos, ya escalamos con ellos y monitoreamos en tiempo real.', '2026-07-14 04:36:00'),

    ('Inconsistencias en reportes de riesgo', 'sup2@bancol.com', 'NOTA_INTERNA', 'Se detectó un problema de redondeo en el cálculo de provisión, validar con el equipo contable.', '2026-07-13 12:00:00'),

    ('Renovación certificados SSL', 'sup2@bancol.com', 'RESPUESTA', 'Certificados renovados exitosamente durante la ventana de mantenimiento del fin de semana.', '2026-07-08 11:54:00'),

    ('Correo sospechoso solicitando clave de banca móvil', 'sup2@bancol.com', 'NOTA_INTERNA', 'Ticket bloqueado por el filtro de seguridad (phishing + datos sensibles). Contactar al cliente por canal verificado, no por este ticket.', '2026-07-14 06:30:00'),

    ('Estudiantes no pueden acceder al portal', 'agente3@eduplus.com',     'RESPUESTA', 'Estamos revisando el servicio de autenticación, en unos minutos les damos una actualización.', '2026-07-13 23:00:00'),
    ('Estudiantes no pueden acceder al portal', 'estudiante1@eduplus.com', 'RESPUESTA', 'Gracias, varios compañeros siguen sin poder entrar antes del examen de hoy.',                   '2026-07-14 00:00:00'),

    ('Error al descargar certificados en el LMS antiguo', 'agente3@eduplus.com', 'RESPUESTA', 'Generamos el certificado manualmente y te lo enviamos por correo. Este módulo se reemplazará pronto por el nuevo portal.', '2026-07-02 15:48:00')
) AS v(titulo, correo, tipo, mensaje, fecha_creacion)
JOIN tickets tk ON tk.titulo = v.titulo
JOIN usuarios u ON u.correo = v.correo;

COMMIT;
