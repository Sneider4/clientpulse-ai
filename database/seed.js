// ClientPulse AI — Seed de datos de prueba
// Ejecutar desde la raíz del proyecto: node database/seed.js
// Requiere schema.sql ya aplicado y backend/.env configurado

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
            ['CLIENTES_VER',    'Ver clientes',           'Listar y consultar clientes',                'CLIENTES'],
            ['CLIENTES_CREAR',  'Crear clientes',         'Registrar nuevos clientes',                  'CLIENTES'],
            ['CONTRATOS_VER',   'Ver contratos',          'Listar y consultar contratos',               'CONTRATOS'],
            ['CONTRATOS_CREAR', 'Crear contratos',        'Registrar nuevos contratos',                 'CONTRATOS'],
            ['USUARIOS_FINALES_GESTIONAR', 'Gestionar usuarios finales', 'Invitar y administrar los usuarios finales de la propia empresa', 'EQUIPO'],
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
        // SUPERVISOR    → todos los módulos de su cliente (ver + crear) + invitar usuarios finales
        // AGENTE        → tickets (ver todos + crear) y dashboard (ver), de su cliente
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
            // Supervisor: puede todo dentro de su cliente + invitar usuarios finales
            'SUPERVISOR':    Object.keys(permId),
            // Agente: dashboard (ver) + tickets (ver TODOS los de su empresa + crear)
            'AGENTE':        ['DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'TICKETS_CREAR'],
            // Visualizador: solo ver, nada de crear (pero ve todos los tickets de su empresa)
            'VISUALIZADOR':  ['DASHBOARD_VER', 'TICKETS_VER', 'TICKETS_VER_TODOS', 'CLIENTES_VER', 'CONTRATOS_VER'],
            // Usuario final: solo crea tickets y ve los suyos — sin TICKETS_VER_TODOS
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
        // EduPlus: solo TICKETS y DASHBOARD (sin gestión de clientes/contratos)
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
        // Escenario de prueba:
        //   sneider@gmail.com  → ADMIN_GLOBAL  (sin cliente → acceso total)
        //   sup1@techcorp.com  → SUPERVISOR    (TechCorp, todo habilitado)
        //   sup2@bancol.com    → SUPERVISOR    (Bancol, todo habilitado)
        //   agente1@techcorp.com → AGENTE      (TechCorp, solo tickets + dashboard)
        //   agente2@techcorp.com → AGENTE      (TechCorp, solo tickets + dashboard)
        //   viewer@eduplus.com   → VISUALIZADOR (EduPlus, solo lectura)
        //   cliente1@techcorp.com → USUARIO_FINAL (TechCorp, solo sus propios tickets)
        const hash = await bcrypt.hash('1234', 10);

        const usuariosData = [
            ['Sneider Malagón',    'sneider@gmail.com',     'ADMIN_GLOBAL', null,                       'ADMIN_GLOBAL'],
            ['Laura Torres',       'sup1@techcorp.com',     'SUPERVISOR',   cliRows[0].id_cliente,      'SUPERVISOR'],
            ['Andrés Vargas',      'sup2@bancol.com',       'SUPERVISOR',   cliRows[1].id_cliente,      'SUPERVISOR'],
            ['Camila Ruiz',        'agente1@techcorp.com',  'AGENTE',       cliRows[0].id_cliente,      'AGENTE'],
            ['David Morales',      'agente2@techcorp.com',  'AGENTE',       cliRows[0].id_cliente,      'AGENTE'],
            ['Sofía Herrera',      'viewer@eduplus.com',    'VISUALIZADOR', cliRows[2].id_cliente,      'VISUALIZADOR'],
            ['Pedro Gómez',        'cliente1@techcorp.com', 'USUARIO_FINAL', cliRows[0].id_cliente,     'USUARIO_FINAL'],
        ];
        for (const [nombre, correo, rolCodigo, idCliente, rolText] of usuariosData) {
            await client.query(
                `INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol, activo)
                 VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (correo) DO NOTHING`,
                [nombre, correo, hash, rolId[rolCodigo], idCliente, rolText]
            );
        }
        console.log('✅ Usuarios creados');

        // ── 8. CONTRATOS ───────────────────────────────────────────────────
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

        // ── 9. TICKETS + ANÁLISIS ──────────────────────────────────────────
        const ticketsData = [
            [ctRows[0].id_contrato, 'Error crítico en módulo de nómina',
             'El sistema ERP cayó durante la liquidación de nómina. Llevamos 3 horas sin acceso y estamos perdiendo dinero. Esto es inaceptable.',
             'CORRECTIVO','CRITICA','EN_PROCESO','NEGATIVO','ALTA',85,'ALTO',false,false,
             'Escalar inmediatamente al equipo de infraestructura. Contactar al cliente en menos de 1 hora.'],

            [ctRows[0].id_contrato, 'Solicitud filtro en reportes',
             'Necesitamos un filtro por centro de costo en el módulo de reportes. No es urgente pero lo requerimos para el próximo trimestre.',
             'EVOLUTIVO','MEDIA','ENTREGADO','NEUTRO','BAJA',22,'BAJO',false,false,
             'Agregar al backlog del equipo de desarrollo para el siguiente sprint.'],

            [ctRows[1].id_contrato, 'Latencia alta en servidores',
             'Desde ayer los tiempos de respuesta aumentaron de 200ms a 3 segundos. Los usuarios reportan timeouts frecuentes.',
             'CORRECTIVO','ALTA','EN_PROCESO','NEGATIVO','MEDIA',60,'MEDIO',false,false,
             'Revisar métricas de CPU y memoria en las últimas 24 horas.'],

            [ctRows[2].id_contrato, 'Falla integración PSE',
             'Las transacciones PSE están fallando desde las 8am. El core bancario no comunica con el gateway de pagos.',
             'CORRECTIVO','CRITICA','ENTREGADO','NEGATIVO','ALTA',92,'ALTO',false,false,
             'Activar protocolo de incidente crítico. Contactar al cliente en 15 minutos.'],

            [ctRows[2].id_contrato, 'Renovación certificados SSL',
             'Los certificados SSL del servidor de producción vencen el próximo mes. Necesitamos programar la renovación.',
             'OTRO','MEDIA','CERRADO','NEUTRO','BAJA',10,'BAJO',false,false,
             'Programar ventana de mantenimiento y notificar al cliente con 72 horas de anticipación.'],

            [ctRows[3].id_contrato, 'Inconsistencias en reportes de riesgo',
             'Los reportes muestran cifras distintas al sistema legado. Hay una auditoría mañana, necesitamos revisión urgente.',
             'CORRECTIVO','ALTA','EN_PROCESO','NEGATIVO','ALTA',75,'ALTO',false,false,
             'Comparar queries del nuevo sistema vs el legado. Prioridad máxima por auditoría.'],

            [ctRows[5].id_contrato, 'Estudiantes no pueden acceder al portal',
             'Múltiples estudiantes no pueden iniciar sesión. El error dice credenciales incorrectas pero son correctas.',
             'CORRECTIVO','ALTA','ENTREGADO','NEGATIVO','MEDIA',55,'MEDIO',false,false,
             'Verificar el servicio de autenticación y revisar logs de auth de las últimas 2 horas.'],

            [ctRows[0].id_contrato, 'Agradecimiento por soporte',
             'Quería agradecer al equipo por la rápida respuesta al incidente de la semana pasada. Muy satisfechos.',
             'OTRO','BAJA','CERRADO','POSITIVO','BAJA',5,'BAJO',false,false,
             'Mantener el nivel de atención actual y compartir el feedback con el equipo.'],
        ];

        for (const [id_cont, titulo, desc, tipo, prioridad, estadoT, sent, frust, score, riesgo, phishing, sensible, recom] of ticketsData) {
            const tr = await client.query(
                `INSERT INTO tickets (id_contrato, titulo, descripcion, tipo, prioridad, estado)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_ticket`,
                [id_cont, titulo, desc, tipo, prioridad, estadoT]
            );
            await client.query(
                `INSERT INTO analisis_ticket
                 (id_ticket, sentimiento, frustracion, score_churn, riesgo_churn,
                  es_potencial_phishing, tiene_datos_sensibles, recomendaciones)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [tr.rows[0].id_ticket, sent, frust, score, riesgo, phishing, sensible, recom]
            );
        }
        console.log('✅ Tickets + análisis:', ticketsData.length);

        await client.query('COMMIT');

        console.log(`
──────────────────────────────────────────────────────
  Seed completado — Usuarios de prueba (contraseña: 1234)
──────────────────────────────────────────────────────
  ADMIN_GLOBAL  sneider@gmail.com      → acceso total (todos los clientes)
  SUPERVISOR    sup1@techcorp.com      → TechCorp  (todos los módulos)
  SUPERVISOR    sup2@bancol.com        → Bancol    (todos los módulos)
  AGENTE        agente1@techcorp.com   → TechCorp  (dashboard + tickets)
  AGENTE        agente2@techcorp.com   → TechCorp  (dashboard + tickets)
  VISUALIZADOR  viewer@eduplus.com     → EduPlus   (solo lectura, sin crear)
  USUARIO_FINAL cliente1@techcorp.com  → TechCorp  (solo sus propios tickets)
──────────────────────────────────────────────────────
  EduPlus solo tiene módulos DASHBOARD y TICKETS habilitados.
  TechCorp y Bancol tienen además el módulo EQUIPO (Supervisor invita usuarios finales).
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
