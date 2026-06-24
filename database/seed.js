// ClientPulse AI — Seed de datos de prueba
// Ejecutar: node database/seed.js
// Requiere que el schema.sql ya esté aplicado y que .env esté configurado

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
// pg y bcrypt residen en backend/node_modules
const { Pool } = require(path.join(__dirname, '../backend/node_modules/pg'));
const bcrypt  = require(path.join(__dirname, '../backend/node_modules/bcrypt'));

const pool = new Pool({
    host:     process.env.PGHOST     || 'localhost',
    port:     Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'vortex',
    user:     process.env.PGUSER     || 'postgres',
    password: process.env.PGPASSWORD || '1234',
});

async function seed() {
    const client = await pool.connect();
    console.log('Conectado a PostgreSQL. Insertando datos de prueba...\n');

    try {
        await client.query('BEGIN');

        // ── Roles ──────────────────────────────────────────────────────────
        await client.query(`
            INSERT INTO roles (codigo, nombre) VALUES
                ('ADMIN_GLOBAL', 'Administrador Global'),
                ('AGENTE',       'Agente de Soporte')
            ON CONFLICT (codigo) DO NOTHING
        `);
        const { rows: roles } = await client.query('SELECT id_rol, codigo FROM roles');
        const rolId = Object.fromEntries(roles.map(r => [r.codigo, r.id_rol]));
        console.log('✅ Roles insertados');

        // ── Permisos ───────────────────────────────────────────────────────
        const permisos = [
            ['DASHBOARD_VER',   'Ver dashboard principal'],
            ['CLIENTES_VER',    'Listar clientes'],
            ['CLIENTES_CREAR',  'Registrar nuevos clientes'],
            ['CONTRATOS_VER',   'Listar contratos'],
            ['CONTRATOS_CREAR', 'Crear contratos'],
            ['TICKETS_VER',     'Ver lista y detalle de tickets'],
            ['TICKETS_CREAR',   'Crear nuevos tickets'],
        ];
        for (const [codigo, descripcion] of permisos) {
            await client.query(
                `INSERT INTO permisos (codigo, descripcion) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, descripcion]
            );
        }
        const { rows: permRows } = await client.query('SELECT id_permiso, codigo FROM permisos');
        const permId = Object.fromEntries(permRows.map(p => [p.codigo, p.id_permiso]));
        console.log('✅ Permisos insertados');

        // ── Roles ↔ Permisos ───────────────────────────────────────────────
        // ADMIN_GLOBAL tiene todos los permisos
        for (const pid of Object.values(permId)) {
            await client.query(
                `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [rolId['ADMIN_GLOBAL'], pid]
            );
        }
        // AGENTE puede ver y crear tickets, ver clientes y dashboard
        const permisosAgente = ['DASHBOARD_VER', 'CLIENTES_VER', 'CONTRATOS_VER', 'TICKETS_VER', 'TICKETS_CREAR'];
        for (const codigo of permisosAgente) {
            await client.query(
                `INSERT INTO roles_permisos (id_rol, id_permiso) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [rolId['AGENTE'], permId[codigo]]
            );
        }
        console.log('✅ Roles-Permisos asignados');

        // ── Módulos ────────────────────────────────────────────────────────
        const modulos = [
            ['DASHBOARD',  'Dashboard analítico'],
            ['CLIENTES',   'Gestión de clientes'],
            ['CONTRATOS',  'Gestión de contratos'],
            ['TICKETS',    'Gestión de tickets'],
        ];
        for (const [codigo, nombre] of modulos) {
            await client.query(
                `INSERT INTO modulos (codigo, nombre) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`,
                [codigo, nombre]
            );
        }
        const { rows: modRows } = await client.query('SELECT id_modulo, codigo FROM modulos');
        const modId = Object.fromEntries(modRows.map(m => [m.codigo, m.id_modulo]));
        console.log('✅ Módulos insertados');

        // ── Clientes ───────────────────────────────────────────────────────
        const clientesData = [
            ['TechCorp S.A.S',        '900111222-3', 'Tecnología',  '2021-01-15', 'ACTIVO'],
            ['Bancol Finanzas',        '800333444-5', 'Banca',       '2020-06-01', 'ACTIVO'],
            ['EduPlus Colombia',       '901555666-7', 'Educación',   '2022-03-20', 'ACTIVO'],
            ['LogisTrans S.A',         '700888999-0', 'Logística',   '2019-11-10', 'ACTIVO'],
        ];
        for (const [nombre, nit, sector, fecha, estado] of clientesData) {
            await client.query(
                `INSERT INTO clientes (nombre, nit, sector, fecha_inicio_relacion, estado)
                 VALUES ($1,$2,$3,$4,$5) ON CONFLICT (nit) DO NOTHING`,
                [nombre, nit, sector, fecha, estado]
            );
        }
        const { rows: cliRows } = await client.query('SELECT id_cliente, nombre FROM clientes ORDER BY id_cliente');
        console.log('✅ Clientes insertados');

        // ── Clientes ↔ Módulos (todos los módulos habilitados) ─────────────
        for (const cli of cliRows) {
            for (const mid of Object.values(modId)) {
                await client.query(
                    `INSERT INTO clientes_modulos (id_cliente, id_modulo, habilitado)
                     VALUES ($1,$2,TRUE) ON CONFLICT DO NOTHING`,
                    [cli.id_cliente, mid]
                );
            }
        }
        console.log('✅ Módulos asignados a clientes');

        // ── Usuarios ───────────────────────────────────────────────────────
        const hashAdmin  = await bcrypt.hash('1234', 10);
        const hashAgente = await bcrypt.hash('1234', 10);

        // Admin global (id_cliente = NULL → acceso a todos)
        await client.query(`
            INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol)
            VALUES ('Sneider Malagón', 'sneider@gmail.com', $1, $2, NULL, 'ADMIN_GLOBAL')
            ON CONFLICT (correo) DO NOTHING
        `, [hashAdmin, rolId['ADMIN_GLOBAL']]);

        // Agente de TechCorp
        await client.query(`
            INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol)
            VALUES ('Ana Rodríguez', 'ana@techcorp.com', $1, $2, $3, 'AGENTE')
            ON CONFLICT (correo) DO NOTHING
        `, [hashAgente, rolId['AGENTE'], cliRows[0].id_cliente]);

        // Agente de Bancol
        await client.query(`
            INSERT INTO usuarios (nombre, correo, password_hash, id_rol, id_cliente, rol)
            VALUES ('Carlos Mejía', 'carlos@bancol.com', $1, $2, $3, 'AGENTE')
            ON CONFLICT (correo) DO NOTHING
        `, [hashAgente, rolId['AGENTE'], cliRows[1].id_cliente]);

        console.log('✅ Usuarios insertados');

        // ── Contratos ──────────────────────────────────────────────────────
        const contratosData = [
            [cliRows[0].id_cliente, 'Sistema de Gestión ERP', '2021-02-01', '2025-12-31', 8500000, 'VIGENTE', 'GOLD'],
            [cliRows[0].id_cliente, 'Soporte Infraestructura Cloud', '2022-01-01', null, 3200000, 'VIGENTE', 'SILVER'],
            [cliRows[1].id_cliente, 'Plataforma Core Bancario', '2020-07-01', '2025-06-30', 25000000, 'VIGENTE', 'DIAMOND'],
            [cliRows[1].id_cliente, 'Módulo de Reportes BI', '2023-01-15', null, 5000000, 'VIGENTE', 'GOLD'],
            [cliRows[2].id_cliente, 'LMS Campus Virtual', '2022-04-01', '2024-12-31', 4200000, 'INACTIVO', 'BRONZE'],
            [cliRows[2].id_cliente, 'Portal Estudiantil v2', '2024-01-01', null, 6800000, 'VIGENTE', 'SILVER'],
            [cliRows[3].id_cliente, 'Sistema de Rastreo GPS', '2019-12-01', '2024-11-30', 12000000, 'VENCIDO', 'GOLD'],
            [cliRows[3].id_cliente, 'App Móvil Entregas', '2023-06-01', null, 9500000, 'VIGENTE', 'SILVER'],
        ];
        for (const [id_cli, nombre, f_ini, f_fin, valor, estado, nivel] of contratosData) {
            await client.query(
                `INSERT INTO contratos (id_cliente, nombre_proyecto, fecha_inicio, fecha_fin, valor_mensual, estado, nivel_servicio)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [id_cli, nombre, f_ini, f_fin, valor, estado, nivel]
            );
        }
        const { rows: ctRows } = await client.query('SELECT id_contrato FROM contratos ORDER BY id_contrato');
        console.log('✅ Contratos insertados');

        // ── Tickets con análisis ───────────────────────────────────────────
        const ticketsData = [
            // [id_contrato, titulo, descripcion, tipo, prioridad, estado, sentimiento, frustracion, score, riesgo, phishing, sensible, recomendaciones]
            [ctRows[0].id_contrato,
             'Error crítico en módulo de nómina',
             'El sistema ERP cayó durante el proceso de liquidación de nómina del mes. Llevamos 3 horas sin poder acceder y estamos perdiendo dinero. Esto es inaceptable, ya es la tercera vez que ocurre.',
             'CORRECTIVO', 'CRITICA', 'EN_PROCESO',
             'NEGATIVO', 'ALTA', 85, 'ALTO', false, false,
             'Escalar inmediatamente al equipo de infraestructura. Contactar al cliente en menos de 1 hora. Riesgo de pérdida de contrato ALTO.'],

            [ctRows[0].id_contrato,
             'Solicitud de nueva funcionalidad en reportes',
             'Necesitamos agregar un filtro por centro de costo en el módulo de reportes financieros. No es urgente pero lo necesitamos para el próximo trimestre.',
             'EVOLUTIVO', 'MEDIA', 'ENTREGADO',
             'NEUTRO', 'BAJA', 25, 'BAJO', false, false,
             'Crear ticket en el backlog del equipo de desarrollo. Programar para el siguiente sprint.'],

            [ctRows[1].id_contrato,
             'Latencia alta en servidores de producción',
             'Desde ayer los tiempos de respuesta de la API aumentaron de 200ms a más de 3 segundos. Los usuarios están reportando timeouts. Urgente revisión.',
             'CORRECTIVO', 'ALTA', 'EN_PROCESO',
             'NEGATIVO', 'MEDIA', 62, 'MEDIO', false, false,
             'Revisar métricas de CPU y memoria en los últimos 24 horas. Verificar si hay jobs programados consumiendo recursos.'],

            [ctRows[2].id_contrato,
             'Falla en integración con sistema de pagos PSE',
             'Las transacciones PSE están fallando desde las 8am. El sistema de core bancario no está comunicando correctamente con el gateway. Esto es crítico para el banco.',
             'CORRECTIVO', 'CRITICA', 'ENTREGADO',
             'NEGATIVO', 'ALTA', 92, 'ALTO', false, false,
             'Contactar al cliente en los próximos 15 minutos. Activar protocolo de incidente crítico. Coordinar con equipo de integraciones PSE.'],

            [ctRows[2].id_contrato,
             'Actualización de certificados SSL',
             'Los certificados SSL del servidor de producción vencen el próximo mes. Necesitamos programar la renovación sin afectar la disponibilidad del servicio.',
             'OTRO', 'MEDIA', 'CERRADO',
             'NEUTRO', 'BAJA', 10, 'BAJO', false, false,
             'Programar ventana de mantenimiento en horario de bajo tráfico. Notificar al cliente con 72 horas de anticipación.'],

            [ctRows[3].id_contrato,
             'Inconsistencias en reportes de riesgo crediticio',
             'Los reportes de análisis de riesgo muestran cifras distintas al sistema legado. Necesitamos una revisión urgente ya que hay una auditoría mañana.',
             'CORRECTIVO', 'ALTA', 'EN_PROCESO',
             'NEGATIVO', 'ALTA', 75, 'ALTO', false, false,
             'Comparar queries del sistema nuevo vs legado. Identificar discrepancias en la lógica de cálculo. Prioridad máxima por auditoría.'],

            [ctRows[5].id_contrato,
             'Estudiantes no pueden acceder al portal',
             'Múltiples estudiantes reportan que no pueden iniciar sesión en el portal. El error dice credenciales incorrectas pero las contraseñas son correctas.',
             'CORRECTIVO', 'ALTA', 'ENTREGADO',
             'NEGATIVO', 'MEDIA', 55, 'MEDIO', false, false,
             'Verificar el servicio de autenticación. Posible caída del LDAP o directorio activo. Revisar logs de auth desde las últimas 2 horas.'],

            [ctRows[7].id_contrato,
             'La app móvil muestra ubicaciones desactualizadas',
             'Los repartidores dicen que la app de entregas les muestra ubicaciones de hace 10 minutos. El sistema de rastreo en tiempo real no está funcionando bien.',
             'CORRECTIVO', 'MEDIA', 'ENTREGADO',
             'NEUTRO', 'MEDIA', 40, 'MEDIO', false, false,
             'Revisar la conexión con el broker de mensajería. Verificar frecuencia de actualización de coordenadas GPS en los dispositivos.'],

            [ctRows[0].id_contrato,
             'Excelente soporte recibido esta semana',
             'Quería agradecer al equipo por la rápida respuesta al incidente de la semana pasada. La solución fue implementada en tiempo récord y el equipo estuvo muy atento. Muy satisfechos con el servicio.',
             'OTRO', 'BAJA', 'CERRADO',
             'POSITIVO', 'BAJA', 5, 'BAJO', false, false,
             'Mantener el nivel de atención actual. Compartir el feedback positivo con el equipo de soporte.'],

            [ctRows[2].id_contrato,
             'Necesitamos más usuarios licenciados',
             'El banco ha contratado 50 nuevos analistas y necesitamos ampliar las licencias del sistema. Por favor gestionar lo antes posible.',
             'EVOLUTIVO', 'BAJA', 'ENTREGADO',
             'NEUTRO', 'BAJA', 15, 'BAJO', false, false,
             'Coordinar con el área comercial para gestionar la ampliación de licencias. Tiempo estimado: 3-5 días hábiles.'],
        ];

        for (const [id_cont, titulo, desc, tipo, prioridad, estadoT, sent, frust, score, riesgo, phishing, sensible, recom] of ticketsData) {
            const tr = await client.query(
                `INSERT INTO tickets (id_contrato, titulo, descripcion, tipo, prioridad, estado)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING id_ticket`,
                [id_cont, titulo, desc, tipo, prioridad, estadoT]
            );
            const id_ticket = tr.rows[0].id_ticket;
            await client.query(
                `INSERT INTO analisis_ticket
                 (id_ticket, sentimiento, frustracion, score_churn, riesgo_churn,
                  es_potencial_phishing, tiene_datos_sensibles, recomendaciones)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [id_ticket, sent, frust, score, riesgo, phishing, sensible, recom]
            );
        }
        console.log('✅ Tickets y análisis insertados');

        await client.query('COMMIT');

        console.log('\n──────────────────────────────────────────');
        console.log('  Seed completado exitosamente');
        console.log('──────────────────────────────────────────');
        console.log('\nCredenciales de prueba:');
        console.log('  Admin global  → sneider@gmail.com  / 1234');
        console.log('  Agente (TechCorp) → ana@techcorp.com   / 1234');
        console.log('  Agente (Bancol)   → carlos@bancol.com  / 1234');
        console.log('\nBase de datos: vortex');
        console.log('Clientes:', cliRows.map(c => c.nombre).join(', '));
        console.log('Contratos:', ctRows.length);
        console.log('Tickets:  ', ticketsData.length, '(con análisis IA simulado)');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error durante el seed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
