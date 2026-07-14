// ClientPulse AI — Seed de datos de prueba
// Ejecutar desde la raíz del proyecto: node database/seed.js
// Requiere schema.sql ya aplicado y backend/.env configurado
//
// Este seed es DESTRUCTIVO: al arrancar borra todo el contenido de las
// tablas de negocio (TRUNCATE ... RESTART IDENTITY CASCADE) y vuelve a
// insertar un set de datos de prueba consistente con el modelo B2B2C
// actual (servicios propios del cliente, conversación de tickets,
// asignación de agente, usuarios finales).

const path = require('path');
const backendModules = path.join(__dirname, '../backend/node_modules');
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const { Pool } = require(path.join(backendModules, 'pg'));
const bcrypt  = require(path.join(backendModules, 'bcrypt'));

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
            host:     process.env.PGHOST     || 'localhost',
            port:     Number(process.env.PGPORT) || 5432,
            database: process.env.PGDATABASE || 'vortex',
            user:     process.env.PGUSER     || 'postgres',
            password: process.env.PGPASSWORD || '1234',
          }
);

async function seed() {
    const client = await pool.connect();
    console.log('Conectado a PostgreSQL...\n');

    try {
        await client.query('BEGIN');

        // ── 0. RESET TOTAL ───────────────────────────────────────────────────
        // Borra todo el contenido y reinicia los SERIAL a 1, para que los
        // índices usados más abajo (cliRows[0], servRows[0], etc.) sean
        // siempre predecibles.
        await client.query(`
            TRUNCATE TABLE
                ticket_mensajes, analisis_ticket, tickets, servicios, contratos,
                roles_permisos, clientes_modulos, usuarios, clientes, permisos, modulos, roles
            RESTART IDENTITY CASCADE
        `);
        console.log('✅ Base de datos limpiada (TRUNCATE)');

        // ── 1. MÓDULOS ──────────────────────────────────────────────────────
        // (permisos tiene FK a modulos, por eso van primero)
        const modulosData = [
            ['DASHBOARD',  'Dashboard analítico',    'Visualización de KPIs y métricas de churn'],
            ['TICKETS',    'Gestión de tickets',     'Creación y seguimiento de tickets de soporte'],
            ['CLIENTES',   'Gestión de clientes',    'Registro y consulta de clientes'],
            ['CONTRATOS',  'Gestión de contratos',   'Registro y consulta de contratos por cliente'],
            ['EQUIPO',     'Gestión de equipo',      'Invitar y administrar usuarios finales de la empresa'],
        ];
        for (const [codigo, nombre, descripcion] of modulosData) {
            await client.query(
                `INSERT INTO modulos (codigo, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, nombre, descripcion]
            );
        }
        const { rows: modRows } = await client.query('SELECT id_modulo, codigo FROM modulos');
        const modId = Object.fromEntries(modRows.map(m => [m.codigo, m.id_modulo]));
        console.log('✅ Módulos:', Object.keys(modId).join(', '));

        // ── 2. PERMISOS (cada permiso ligado a su módulo) ───────────────────
        const permisosData = [
            ['DASHBOARD_VER',   'Ver dashboard',          'Acceso al dashboard de métricas',           'DASHBOARD'],
            ['TICKETS_VER',     'Ver tickets',            'Listar y consultar tickets (propios)',       'TICKETS'],
            ['TICKETS_VER_TODOS', 'Ver todos los tickets', 'Ver todos los tickets de la empresa, no solo los propios', 'TICKETS'],
            ['TICKETS_CREAR',   'Crear tickets',          'Registrar nuevos tickets con análisis IA',   'TICKETS'],
            ['TICKETS_GESTIONAR', 'Gestionar tickets',    'Asignar y cerrar tickets de la propia empresa', 'TICKETS'],
            ['CLIENTES_VER',    'Ver clientes',           'Listar y consultar clientes',                'CLIENTES'],
            ['CLIENTES_CREAR',  'Crear clientes',         'Registrar nuevos clientes',                  'CLIENTES'],
            ['CONTRATOS_VER',   'Ver contratos',          'Listar y consultar contratos',               'CONTRATOS'],
            ['CONTRATOS_CREAR', 'Crear contratos',        'Registrar nuevos contratos',                 'CONTRATOS'],
            ['USUARIOS_FINALES_GESTIONAR', 'Gestionar usuarios finales', 'Invitar y administrar los usuarios finales de la propia empresa', 'EQUIPO'],
            ['SERVICIOS_GESTIONAR', 'Gestionar servicios', 'Crear y administrar el catálogo de servicios de la propia empresa', 'EQUIPO'],
        ];
        for (const [codigo, nombre, descripcion, modCodigo] of permisosData) {
            await client.query(
                `INSERT INTO permisos (codigo, nombre, descripcion, id_modulo)
                 VALUES ($1,$2,$3,$4) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, nombre, descripcion, modId[modCodigo]]
            );
        }
        const { rows: permRows } = await client.query('SELECT id_permiso, codigo FROM permisos');
        const permId = Object.fromEntries(permRows.map(p => [p.codigo, p.id_permiso]));
        console.log('✅ Permisos:', Object.keys(permId).join(', '));

        // ── 3. ROLES ────────────────────────────────────────────────────────
        // ADMIN_GLOBAL  → todo, sin restricción de cliente
        // SUPERVISOR    → todos los módulos de su cliente (ver + crear) + invitar usuarios finales + servicios
        // AGENTE        → tickets (ver todos + crear + gestionar) y dashboard (ver), de su cliente
        // VISUALIZADOR  → solo lectura en todo (ver pero no crear)
        // USUARIO_FINAL → el reclamante: solo crea tickets y ve los SUYOS, nada más
        const rolesData = [
            ['ADMIN_GLOBAL',  'Administrador Global',  'Acceso total a todos los clientes y módulos'],
            ['SUPERVISOR',    'Supervisor',             'Acceso completo dentro de su cliente asignado'],
            ['AGENTE',        'Agente de Soporte',      'Crea y gestiona tickets de su cliente'],
            ['VISUALIZADOR',  'Visualizador',           'Solo lectura — no puede crear ni modificar nada'],
            ['USUARIO_FINAL', 'Usuario final',          'Presenta y consulta únicamente sus propios tickets'],
        ];
        for (const [codigo, nombre, descripcion] of rolesData) {
            await client.query(
                `INSERT INTO roles (codigo, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, nombre, descripcion]
            );
        }
        const { rows: rolRows } = await client.query('SELECT id_rol, codigo FROM roles');
        const rolId = Object.fromEntries(rolRows.map(r => [r.codigo, r.id_rol]));
        console.log('✅ Roles:', Object.keys(rolId).join(', '));

        // ── 4. ROLES ↔ PERMISOS ────────────────────────────────────────────
        const rolPermisos = {
            // Admin global bypassa middleware, pero le asignamos todos igual
            'ADMIN_GLOBAL':  Object.keys(permId),
            // Supervisor: puede todo dentro de su cliente + invitar usuarios finales + servicios
            'SUPERVISOR':    Object.keys(permId),
            // Agente: dashboard (ver) + tickets (ver TODOS los de su empresa + crear + gestionar)
            'AGENTE':        ['DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'TICKETS_CREAR', 'TICKETS_GESTIONAR'],
            // Visualizador: solo ver, nada de crear ni gestionar (pero ve todos los tickets de su empresa)
            'VISUALIZADOR':  ['DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'CLIENTES_VER', 'CONTRATOS_VER'],
            // Usuario final: solo crea tickets y ve los suyos — sin TICKETS_VER_TODOS ni TICKETS_GESTIONAR
            'USUARIO_FINAL': ['TICKETS_VER', 'TICKETS_CREAR'],
        };
        for (const [rolCodigo, perms] of Object.entries(rolPermisos)) {
            for (const permCodigo of perms) {
                await client.query(
                    `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
                    [rolId[rolCodigo], permId[permCodigo]]
                );
            }
        }
        console.log('✅ Roles-Permisos asignados');

        // ── 5. CLIENTES ────────────────────────────────────────────────────
        const clientesData = [
            ['TechCorp S.A.S',     '900111222-3', 'Tecnología',  '2021-01-15', 'ACTIVO'],
            ['Bancol Finanzas',    '800333444-5', 'Banca',       '2020-06-01', 'ACTIVO'],
            ['EduPlus Colombia',   '901555666-7', 'Educación',   '2022-03-20', 'ACTIVO'],
        ];
        for (const [nombre, nit, sector, fecha, estado] of clientesData) {
            await client.query(
                `INSERT INTO clientes (nombre, nit, sector, fecha_inicio_relacion, estado)
                 SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS (SELECT 1 FROM clientes WHERE nit = $6)`,
                [nombre, nit, sector, fecha, estado, nit]
            );
        }
        const { rows: cliRows } = await client.query('SELECT id_cliente, nombre FROM clientes ORDER BY id_cliente');
        console.log('✅ Clientes:', cliRows.map(c => c.nombre).join(', '));

        // ── 6. CLIENTES ↔ MÓDULOS ──────────────────────────────────────────
        // TechCorp y Bancol: todos los módulos habilitados
        // EduPlus: solo TICKETS y DASHBOARD (sin gestión de clientes/contratos/equipo)
        const modulosCliente = {
            [cliRows[0].id_cliente]: ['DASHBOARD', 'TICKETS', 'CLIENTES', 'CONTRATOS', 'EQUIPO'],
            [cliRows[1].id_cliente]: ['DASHBOARD', 'TICKETS', 'CLIENTES', 'CONTRATOS', 'EQUIPO'],
            [cliRows[2].id_cliente]: ['DASHBOARD', 'TICKETS'],
        };
        for (const [idCli, mods] of Object.entries(modulosCliente)) {
            for (const modCodigo of mods) {
                await client.query(
                    `INSERT INTO clientes_modulos (id_cliente, id_modulo, habilitado)
                     VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`,
                    [idCli, modId[modCodigo]]
                );
            }
        }
        console.log('✅ Módulos asignados a clientes');

        // ── 7. USUARIOS ────────────────────────────────────────────────────
        // Escenario de prueba (contraseña: 1234 para todos):
        //   sneider@gmail.com      → ADMIN_GLOBAL  (sin cliente → acceso total)
        //   sup1@techcorp.com      → SUPERVISOR    (TechCorp, todo habilitado)
        //   sup2@bancol.com        → SUPERVISOR    (Bancol, todo habilitado)
        //   agente1@techcorp.com   → AGENTE        (TechCorp)
        //   agente2@techcorp.com   → AGENTE        (TechCorp)
        //   agente3@eduplus.com    → AGENTE        (EduPlus)
        //   viewer@eduplus.com     → VISUALIZADOR  (EduPlus, solo lectura)
        //   cliente1@techcorp.com  → USUARIO_FINAL (TechCorp)
        //   cliente2@techcorp.com  → USUARIO_FINAL (TechCorp)
        //   usuario1@bancol.com    → USUARIO_FINAL (Bancol)
        //   estudiante1@eduplus.com→ USUARIO_FINAL (EduPlus)
        const hash = await bcrypt.hash('1234', 10);

        const usuariosData = [
            ['Sneider Malagón',     'sneider@gmail.com',      'ADMIN_GLOBAL',  null,                  'ADMIN_GLOBAL'],
            ['Laura Torres',        'sup1@techcorp.com',      'SUPERVISOR',    cliRows[0].id_cliente, 'SUPERVISOR'],
            ['Andrés Vargas',       'sup2@bancol.com',        'SUPERVISOR',    cliRows[1].id_cliente, 'SUPERVISOR'],
            ['Camila Ruiz',         'agente1@techcorp.com',   'AGENTE',        cliRows[0].id_cliente, 'AGENTE'],
            ['David Morales',       'agente2@techcorp.com',   'AGENTE',        cliRows[0].id_cliente, 'AGENTE'],
            ['Diego Ramírez',       'agente3@eduplus.com',    'AGENTE',        cliRows[2].id_cliente, 'AGENTE'],
            ['Sofía Herrera',       'viewer@eduplus.com',     'VISUALIZADOR',  cliRows[2].id_cliente, 'VISUALIZADOR'],
            ['Pedro Gómez',         'cliente1@techcorp.com',  'USUARIO_FINAL', cliRows[0].id_cliente, 'USUARIO_FINAL'],
            ['Marta Ríos',          'cliente2@techcorp.com',  'USUARIO_FINAL', cliRows[0].id_cliente, 'USUARIO_FINAL'],
            ['Jorge Salazar',       'usuario1@bancol.com',    'USUARIO_FINAL', cliRows[1].id_cliente, 'USUARIO_FINAL'],
            ['Valentina Cruz',      'estudiante1@eduplus.com','USUARIO_FINAL', cliRows[2].id_cliente, 'USUARIO_FINAL'],
        ];
        for (const [nombre, correo, rolCodigo, idCliente, rolText] of usuariosData) {
            await client.query(
                `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol, activo)
                 VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (correo) DO NOTHING`,
                [nombre, correo, hash, rolId[rolCodigo], idCliente, rolText]
            );
        }
        const { rows: usrRows } = await client.query('SELECT id_usuario, correo FROM usuarios');
        const usrId = Object.fromEntries(usrRows.map(u => [u.correo, u.id_usuario]));
        console.log('✅ Usuarios creados:', usrRows.length);

        // ── 8. CONTRATOS (relación comercial ClientPulse↔Cliente — nunca se
        //      expone al usuario final; independiente del catálogo de servicios) ──
        const contratosData = [
            [cliRows[0].id_cliente, 'Sistema ERP',            '2021-02-01', '2025-12-31', 8500000,  'VIGENTE',  'GOLD'],
            [cliRows[0].id_cliente, 'Soporte Cloud',          '2022-01-01', null,         3200000,  'VIGENTE',  'SILVER'],
            [cliRows[1].id_cliente, 'Core Bancario',          '2020-07-01', '2025-06-30', 25000000, 'VIGENTE',  'DIAMOND'],
            [cliRows[1].id_cliente, 'Módulo BI',              '2023-01-15', null,         5000000,  'VIGENTE',  'GOLD'],
            [cliRows[2].id_cliente, 'LMS Campus Virtual',     '2022-04-01', '2024-12-31', 4200000,  'INACTIVO', 'BRONZE'],
            [cliRows[2].id_cliente, 'Portal Estudiantil v2',  '2024-01-01', null,         6800000,  'VIGENTE',  'SILVER'],
        ];
        for (const [id_cli, nombre, f_ini, f_fin, valor, estado, nivel] of contratosData) {
            await client.query(
                `INSERT INTO contratos (id_cliente, nombre_proyecto, fecha_inicio, fecha_fin, valor_mensual, estado, nivel_servicio)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [id_cli, nombre, f_ini, f_fin, valor, estado, nivel]
            );
        }
        const { rows: ctRows } = await client.query('SELECT id_contrato FROM contratos ORDER BY id_contrato');
        console.log('✅ Contratos:', ctRows.length);

        // ── 9. SERVICIOS (catálogo propio del cliente — lo que el usuario final
        //      elige al crear un ticket; deliberadamente separado de contratos) ──
        const serviciosData = [
            [cliRows[0].id_cliente, 'Sistema ERP',         'ACTIVO'],
            [cliRows[0].id_cliente, 'Soporte Cloud',       'ACTIVO'],
            [cliRows[0].id_cliente, 'Portal de Clientes',  'ACTIVO'],
            [cliRows[1].id_cliente, 'Core Bancario',       'ACTIVO'],
            [cliRows[1].id_cliente, 'Módulo BI',           'ACTIVO'],
            [cliRows[1].id_cliente, 'Banca Móvil',         'ACTIVO'],
            [cliRows[2].id_cliente, 'Portal Estudiantil',  'ACTIVO'],
            [cliRows[2].id_cliente, 'LMS Campus Virtual',  'INACTIVO'],
        ];
        for (const [id_cli, nombre, estado] of serviciosData) {
            await client.query(
                `INSERT INTO servicios (id_cliente, nombre, estado) VALUES ($1,$2,$3)`,
                [id_cli, nombre, estado]
            );
        }
        const { rows: servRows } = await client.query('SELECT id_servicio FROM servicios ORDER BY id_servicio');
        console.log('✅ Servicios:', servRows.length);

        // ── 10. TICKETS + ANÁLISIS IA ──────────────────────────────────────
        // id_contrato se deja NULL a propósito: los tickets nuevos usan
        // id_cliente + id_servicio directamente (contratos ya no se referencia
        // desde tickets, ver ticket.service.ts).
        const hoy = new Date('2026-07-14T08:00:00-05:00');
        const horas = (h) => new Date(hoy.getTime() + h * 3600 * 1000);

        const ticketsData = [
            // TechCorp ------------------------------------------------------
            {
                id_cliente: cliRows[0].id_cliente, id_servicio: servRows[0].id_servicio,
                titulo: 'Error crítico en módulo de nómina',
                descripcion: 'El sistema ERP cayó durante la liquidación de nómina. Llevamos 3 horas sin acceso y estamos perdiendo dinero. Esto es inaceptable.',
                tipo: 'CORRECTIVO', prioridad: 'CRITICA', estado: 'EN_PROCESO',
                creador: 'cliente1@techcorp.com', agente: 'agente1@techcorp.com',
                fecha_creacion: horas(-6), fecha_cierre: null,
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'ALTA', score_churn: 85, riesgo_churn: 'ALTO', phishing: false, sensible: false,
                    recomendaciones: 'Escalar inmediatamente al equipo de infraestructura. Contactar al cliente en menos de 1 hora.' },
                mensajes: [
                    { autor: 'agente1@techcorp.com', tipo: 'RESPUESTA',     mensaje: 'Estamos revisando el incidente con el equipo de infraestructura, te contactamos en breve.', offset: -5 },
                    { autor: 'agente1@techcorp.com', tipo: 'NOTA_INTERNA',  mensaje: 'Escalado a infraestructura, revisar logs del clúster de nómina desde las 05:00.', offset: -4.9 },
                    { autor: 'cliente1@techcorp.com', tipo: 'RESPUESTA',    mensaje: 'Seguimos sin poder generar la nómina, ¿tienen un tiempo estimado de solución?', offset: -3 },
                ],
            },
            {
                id_cliente: cliRows[0].id_cliente, id_servicio: servRows[1].id_servicio,
                titulo: 'Solicitud filtro en reportes',
                descripcion: 'Necesitamos un filtro por centro de costo en el módulo de reportes. No es urgente pero lo requerimos para el próximo trimestre.',
                tipo: 'EVOLUTIVO', prioridad: 'MEDIA', estado: 'ENTREGADO',
                creador: 'cliente2@techcorp.com', agente: null,
                fecha_creacion: horas(-96), fecha_cierre: null,
                analisis: { sentimiento: 'NEUTRO', frustracion: 'BAJA', score_churn: 22, riesgo_churn: 'BAJO', phishing: false, sensible: false,
                    recomendaciones: 'Agregar al backlog del equipo de desarrollo para el siguiente sprint.' },
                mensajes: [],
            },
            {
                id_cliente: cliRows[0].id_cliente, id_servicio: servRows[2].id_servicio,
                titulo: 'Portal de clientes con tiempos de carga altos',
                descripcion: 'El portal de clientes está tardando más de 10 segundos en cargar el listado de facturas desde el lunes.',
                tipo: 'CORRECTIVO', prioridad: 'MEDIA', estado: 'CERRADO',
                creador: 'cliente1@techcorp.com', agente: 'agente2@techcorp.com',
                fecha_creacion: horas(-240), fecha_cierre: horas(-190),
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'MEDIA', score_churn: 40, riesgo_churn: 'MEDIO', phishing: false, sensible: false,
                    recomendaciones: 'Se optimizó el query de facturación y se agregó caché. Monitorear los próximos 7 días.' },
                mensajes: [
                    { autor: 'agente2@techcorp.com', tipo: 'RESPUESTA', mensaje: 'Identificamos un query sin índice en el listado de facturas, ya está en corrección.', offset: -220 },
                    { autor: 'agente2@techcorp.com', tipo: 'RESPUESTA', mensaje: 'Listo, desplegamos el fix y los tiempos de carga bajaron a menos de 1 segundo. Quedamos atentos.', offset: -190.1 },
                ],
            },
            {
                id_cliente: cliRows[0].id_cliente, id_servicio: servRows[0].id_servicio,
                titulo: 'Agradecimiento por soporte',
                descripcion: 'Quería agradecer al equipo por la rápida respuesta al incidente de la semana pasada. Muy satisfechos con el servicio.',
                tipo: 'OTRO', prioridad: 'BAJA', estado: 'CERRADO',
                creador: 'cliente2@techcorp.com', agente: 'agente1@techcorp.com',
                fecha_creacion: horas(-72), fecha_cierre: horas(-71),
                analisis: { sentimiento: 'POSITIVO', frustracion: 'BAJA', score_churn: 5, riesgo_churn: 'BAJO', phishing: false, sensible: false,
                    recomendaciones: 'Mantener el nivel de atención actual y compartir el feedback con el equipo.' },
                mensajes: [
                    { autor: 'agente1@techcorp.com', tipo: 'RESPUESTA', mensaje: '¡Muchas gracias por el mensaje! Lo compartimos con todo el equipo de soporte.', offset: -71.5 },
                ],
            },

            // Bancol ----------------------------------------------------------
            {
                id_cliente: cliRows[1].id_cliente, id_servicio: servRows[3].id_servicio,
                titulo: 'Falla integración PSE',
                descripcion: 'Las transacciones PSE están fallando desde las 8am. El core bancario no comunica con el gateway de pagos.',
                tipo: 'CORRECTIVO', prioridad: 'CRITICA', estado: 'EN_PROCESO',
                creador: 'usuario1@bancol.com', agente: 'sup2@bancol.com',
                fecha_creacion: horas(-4), fecha_cierre: null,
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'ALTA', score_churn: 92, riesgo_churn: 'ALTO', phishing: false, sensible: false,
                    recomendaciones: 'Activar protocolo de incidente crítico. Contactar al cliente en 15 minutos.' },
                mensajes: [
                    { autor: 'sup2@bancol.com', tipo: 'NOTA_INTERNA', mensaje: 'Gateway de pagos reporta timeouts intermitentes desde su lado, escalado con el proveedor externo.', offset: -3.5 },
                    { autor: 'sup2@bancol.com', tipo: 'RESPUESTA',    mensaje: 'Confirmamos que es una falla del proveedor de pagos, ya escalamos con ellos y monitoreamos en tiempo real.', offset: -3.4 },
                ],
            },
            {
                id_cliente: cliRows[1].id_cliente, id_servicio: servRows[4].id_servicio,
                titulo: 'Inconsistencias en reportes de riesgo',
                descripcion: 'Los reportes muestran cifras distintas al sistema legado. Hay una auditoría mañana, necesitamos revisión urgente.',
                tipo: 'CORRECTIVO', prioridad: 'ALTA', estado: 'EN_PROCESO',
                creador: 'usuario1@bancol.com', agente: 'sup2@bancol.com',
                fecha_creacion: horas(-30), fecha_cierre: null,
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'ALTA', score_churn: 75, riesgo_churn: 'ALTO', phishing: false, sensible: false,
                    recomendaciones: 'Comparar queries del nuevo sistema vs el legado. Prioridad máxima por auditoría.' },
                mensajes: [
                    { autor: 'sup2@bancol.com', tipo: 'NOTA_INTERNA', mensaje: 'Se detectó un problema de redondeo en el cálculo de provisión, validar con el equipo contable.', offset: -20 },
                ],
            },
            {
                id_cliente: cliRows[1].id_cliente, id_servicio: servRows[3].id_servicio,
                titulo: 'Renovación certificados SSL',
                descripcion: 'Los certificados SSL del servidor de producción vencen el próximo mes. Necesitamos programar la renovación.',
                tipo: 'OTRO', prioridad: 'MEDIA', estado: 'CERRADO',
                creador: 'usuario1@bancol.com', agente: 'sup2@bancol.com',
                fecha_creacion: horas(-168), fecha_cierre: horas(-140),
                analisis: { sentimiento: 'NEUTRO', frustracion: 'BAJA', score_churn: 10, riesgo_churn: 'BAJO', phishing: false, sensible: false,
                    recomendaciones: 'Programar ventana de mantenimiento y notificar al cliente con 72 horas de anticipación.' },
                mensajes: [
                    { autor: 'sup2@bancol.com', tipo: 'RESPUESTA', mensaje: 'Certificados renovados exitosamente durante la ventana de mantenimiento del fin de semana.', offset: -140.1 },
                ],
            },
            {
                id_cliente: cliRows[1].id_cliente, id_servicio: servRows[5].id_servicio,
                titulo: 'Correo sospechoso solicitando clave de banca móvil',
                descripcion: 'Recibí un correo pidiendo confirmar mi clave y número de tarjeta para "verificar" mi cuenta de banca móvil. Adjunto el mensaje, parece phishing.',
                tipo: 'OTRO', prioridad: 'CRITICA', estado: 'BLOQUEADO_POR_SEGURIDAD',
                creador: 'usuario1@bancol.com', agente: null,
                fecha_creacion: horas(-2), fecha_cierre: null,
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'MEDIA', score_churn: 30, riesgo_churn: 'MEDIO', phishing: true, sensible: true,
                    recomendaciones: 'Ticket bloqueado automáticamente por indicios de phishing/datos sensibles. Requiere revisión manual de seguridad antes de continuar.' },
                mensajes: [
                    { autor: 'sup2@bancol.com', tipo: 'NOTA_INTERNA', mensaje: 'Ticket bloqueado por el filtro de seguridad (phishing + datos sensibles). Contactar al cliente por canal verificado, no por este ticket.', offset: -1.5 },
                ],
            },

            // EduPlus -----------------------------------------------------------
            {
                id_cliente: cliRows[2].id_cliente, id_servicio: servRows[6].id_servicio,
                titulo: 'Estudiantes no pueden acceder al portal',
                descripcion: 'Múltiples estudiantes no pueden iniciar sesión. El error dice credenciales incorrectas pero son correctas.',
                tipo: 'CORRECTIVO', prioridad: 'ALTA', estado: 'EN_PROCESO',
                creador: 'estudiante1@eduplus.com', agente: 'agente3@eduplus.com',
                fecha_creacion: horas(-10), fecha_cierre: null,
                analisis: { sentimiento: 'NEGATIVO', frustracion: 'MEDIA', score_churn: 55, riesgo_churn: 'MEDIO', phishing: false, sensible: false,
                    recomendaciones: 'Verificar el servicio de autenticación y revisar logs de auth de las últimas 2 horas.' },
                mensajes: [
                    { autor: 'agente3@eduplus.com', tipo: 'RESPUESTA', mensaje: 'Estamos revisando el servicio de autenticación, en unos minutos les damos una actualización.', offset: -9 },
                    { autor: 'estudiante1@eduplus.com', tipo: 'RESPUESTA', mensaje: 'Gracias, varios compañeros siguen sin poder entrar antes del examen de hoy.', offset: -8 },
                ],
            },
            {
                id_cliente: cliRows[2].id_cliente, id_servicio: servRows[7].id_servicio,
                titulo: 'Error al descargar certificados en el LMS antiguo',
                descripcion: 'El módulo de certificados del LMS anterior no genera el PDF, aunque el curso ya está marcado como completado.',
                tipo: 'CORRECTIVO', prioridad: 'BAJA', estado: 'CERRADO',
                creador: 'estudiante1@eduplus.com', agente: 'agente3@eduplus.com',
                fecha_creacion: horas(-300), fecha_cierre: horas(-280),
                analisis: { sentimiento: 'NEUTRO', frustracion: 'BAJA', score_churn: 15, riesgo_churn: 'BAJO', phishing: false, sensible: false,
                    recomendaciones: 'Módulo en proceso de reemplazo por el nuevo Portal Estudiantil; se resolvió generando el certificado manualmente.' },
                mensajes: [
                    { autor: 'agente3@eduplus.com', tipo: 'RESPUESTA', mensaje: 'Generamos el certificado manualmente y te lo enviamos por correo. Este módulo se reemplazará pronto por el nuevo portal.', offset: -280.2 },
                ],
            },
        ];

        for (const t of ticketsData) {
            const tr = await client.query(
                `INSERT INTO tickets
                    (id_cliente, id_servicio, titulo, descripcion, tipo, prioridad, estado,
                     fecha_creacion, fecha_cierre, id_usuario_creador, id_agente_asignado)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                 RETURNING id_ticket`,
                [
                    t.id_cliente, t.id_servicio, t.titulo, t.descripcion, t.tipo, t.prioridad, t.estado,
                    t.fecha_creacion, t.fecha_cierre, usrId[t.creador], t.agente ? usrId[t.agente] : null,
                ]
            );
            const idTicket = tr.rows[0].id_ticket;

            const a = t.analisis;
            await client.query(
                `INSERT INTO analisis_ticket
                    (id_ticket, sentimiento, frustracion, score_churn, riesgo_churn,
                     es_potencial_phishing, tiene_datos_sensibles, recomendaciones, fecha_analisis)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [idTicket, a.sentimiento, a.frustracion, a.score_churn, a.riesgo_churn,
                 a.phishing, a.sensible, a.recomendaciones, t.fecha_creacion]
            );

            for (const m of t.mensajes) {
                await client.query(
                    `INSERT INTO ticket_mensajes (id_ticket, id_usuario_autor, mensaje, tipo, fecha_creacion)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [idTicket, usrId[m.autor], m.mensaje, m.tipo, horas(m.offset)]
                );
            }
        }
        console.log('✅ Tickets + análisis + mensajes:', ticketsData.length);

        await client.query('COMMIT');

        console.log(`
──────────────────────────────────────────────────────
  Seed completado — Usuarios de prueba (contraseña: 1234)
──────────────────────────────────────────────────────
  ADMIN_GLOBAL  sneider@gmail.com       → acceso total (todos los clientes)
  SUPERVISOR    sup1@techcorp.com       → TechCorp  (todos los módulos)
  SUPERVISOR    sup2@bancol.com         → Bancol    (todos los módulos)
  AGENTE        agente1@techcorp.com    → TechCorp  (dashboard + tickets)
  AGENTE        agente2@techcorp.com    → TechCorp  (dashboard + tickets)
  AGENTE        agente3@eduplus.com     → EduPlus   (dashboard + tickets)
  VISUALIZADOR  viewer@eduplus.com      → EduPlus   (solo lectura, sin crear)
  USUARIO_FINAL cliente1@techcorp.com   → TechCorp  (solo sus propios tickets)
  USUARIO_FINAL cliente2@techcorp.com   → TechCorp  (solo sus propios tickets)
  USUARIO_FINAL usuario1@bancol.com     → Bancol    (solo sus propios tickets)
  USUARIO_FINAL estudiante1@eduplus.com → EduPlus   (solo sus propios tickets)
──────────────────────────────────────────────────────
  EduPlus solo tiene módulos DASHBOARD y TICKETS habilitados
  (sin CLIENTES/CONTRATOS/EQUIPO).
  TechCorp y Bancol tienen además el módulo EQUIPO (Supervisor
  invita usuarios finales y gestiona el catálogo de servicios).
  Incluye 1 ticket BLOQUEADO_POR_SEGURIDAD (phishing simulado)
  y conversaciones (RESPUESTA + NOTA_INTERNA) en varios tickets.
──────────────────────────────────────────────────────
`);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error durante el seed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
