# ClientPulse AI

**Demo en vivo:** https://clientpulse-ai-seven.vercel.app

Plataforma SaaS de análisis de soporte al cliente con inteligencia artificial. Detecta sentimiento, frustración y riesgo de abandono (churn) en los tickets de soporte usando Google Gemini, y presenta un dashboard analítico en tiempo real para equipos de Customer Success.

[![Demo](https://img.shields.io/badge/Demo_en_vivo-clientpulse--ai.vercel.app-4285F4?style=flat&logo=vercel&logoColor=white)](https://clientpulse-ai-seven.vercel.app)

![Angular](https://img.shields.io/badge/Angular-19-DD0031?style=flat&logo=angular&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-2.5_Flash-4285F4?style=flat&logo=google&logoColor=white)

## ¿Qué hace?

1. Un agente de soporte registra un ticket describiendo el problema del cliente
2. El sistema procesa el texto con seguridad (detecta phishing y datos sensibles, anonimiza la descripción)
3. Google Gemini 2.5 Flash analiza el ticket y devuelve:
   - **Sentimiento**: POSITIVO / NEUTRO / NEGATIVO
   - **Frustración**: BAJA / MEDIA / ALTA
   - **Score de churn**: 0–100
   - **Riesgo de churn**: BAJO / MEDIO / ALTO
   - **Tipo**: CORRECTIVO / EVOLUTIVO / OTRO
   - **Prioridad**: BAJA / MEDIA / ALTA / CRITICA
   - **Recomendaciones** para el equipo de soporte
4. El dashboard muestra los clientes con mayor riesgo, distribución de sentimientos y métricas globales

### RBAC multitenant
- Cada empresa contratante tiene sus propios usuarios con roles y permisos específicos
- Los módulos disponibles se configuran por cliente (una empresa puede tener solo Dashboard + Tickets)
- Los guards de Angular y los middlewares del backend validan en doble capa
- Si un cliente es desactivado, **todos sus usuarios quedan bloqueados automáticamente** en el siguiente intento de login

### Panel de administración (admin global)
- Crear, editar y activar/desactivar usuarios
- Crear roles y asignar permisos con matriz visual agrupada por módulo
- Activar/desactivar módulos por empresa desde la UI, sin tocar la base de datos

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | Angular 19, Bootstrap 5, Chart.js 4, SweetAlert2 |
| Backend | Node.js + Express 4, TypeScript |
| IA | Google Gemini 2.5 Flash (`@google/generative-ai`) |
| Base de datos | PostgreSQL 16, `pg` Pool |
| Auth | JWT + bcrypt, RBAC por módulos y permisos |

## Modelo de datos

```
┌──────────────┐    ┌──────────────────┐    ┌────────────────────┐
│    roles     │    │    permisos      │    │      modulos       │
├──────────────┤    ├──────────────────┤    ├────────────────────┤
│ id_rol       │    │ id_permiso       │    │ id_modulo          │
│ codigo       │    │ codigo           │    │ codigo             │
│ nombre       │    │ descripcion      │    │ nombre             │
└──────┬───────┘    └────────┬─────────┘    └─────────┬──────────┘
       │                     │                         │
       └──── roles_permisos ─┘         ┌──── clientes_modulos ────┐
                                        │                          │
┌──────────────────────┐    ┌───────────┴──────┐                  │
│       usuarios       │    │     clientes     │◄─────────────────┘
├──────────────────────┤    ├──────────────────┤
│ id_usuario           │    │ id_cliente       │
│ nombre               │    │ nombre           │
│ correo               │    │ nit (único)      │
│ password_hash        │    │ sector           │
│ id_rol          FK──►│    │ fecha_inicio_rel │
│ id_cliente FK (null) │    │ estado           │
│ rol (desnorm.)       │    └────────┬─────────┘
└──────────────────────┘             │
                                     ▼
                          ┌──────────────────────┐
                          │      contratos       │
                          ├──────────────────────┤
                          │ id_contrato          │
                          │ id_cliente      FK──►│
                          │ nombre_proyecto      │
                          │ fecha_inicio         │
                          │ fecha_fin            │
                          │ valor_mensual        │
                          │ estado               │
                          │ nivel_servicio       │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐    ┌──────────────────────────┐
                          │       tickets        │    │     analisis_ticket      │
                          ├──────────────────────┤    ├──────────────────────────┤
                          │ id_ticket            │───►│ id_analisis              │
                          │ id_contrato     FK──►│    │ id_ticket (único)   FK──►│
                          │ titulo               │    │ sentimiento              │
                          │ descripcion          │    │ frustracion              │
                          │ tipo                 │    │ score_churn (0-100)      │
                          │ prioridad            │    │ riesgo_churn             │
                          │ estado               │    │ es_potencial_phishing    │
                          │ fecha_creacion       │    │ tiene_datos_sensibles    │
                          │ fecha_cierre         │    │ recomendaciones          │
                          └──────────────────────┘    │ fecha_analisis           │
                                                      └──────────────────────────┘
```

### Valores convencionales (manejados por la aplicación)

| Campo | Valores |
|-------|---------|
| `clientes.estado` | `ACTIVO`, `INACTIVO` |
| `contratos.estado` | `VIGENTE`, `INACTIVO`, `VENCIDO`, `CANCELADO` |
| `contratos.nivel_servicio` | `DIAMOND`, `GOLD`, `SILVER`, `BRONZE` |
| `tickets.tipo` | `CORRECTIVO`, `EVOLUTIVO`, `OTRO` |
| `tickets.prioridad` | `BAJA`, `MEDIA`, `ALTA`, `CRITICA` |
| `tickets.estado` | `ENTREGADO`, `EN_PROCESO`, `CERRADO`, `BLOQUEADO_POR_SEGURIDAD` |
| `analisis_ticket.sentimiento` | `POSITIVO`, `NEUTRO`, `NEGATIVO` |
| `analisis_ticket.frustracion` | `BAJA`, `MEDIA`, `ALTA` |
| `analisis_ticket.riesgo_churn` | `BAJO`, `MEDIO`, `ALTO` |

## Endpoints de la API

**Base URL:** `http://localhost:3000/api`

### Autenticación (sin token)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Iniciar sesión |
| GET | `/auth/access` | Obtener módulos y permisos del usuario (requiere token) |

### Dashboard

| Método | Ruta | Descripción | Módulo | Permiso |
|--------|------|-------------|--------|---------|
| GET | `/dashboard/resumen` | KPIs, top clientes, distribución churn | DASHBOARD | — |

### Clientes

| Método | Ruta | Descripción | Módulo | Permiso |
|--------|------|-------------|--------|---------|
| GET | `/clientes/consultar-clientes` | Listar todos los clientes | CLIENTES | CLIENTES_VER |
| GET | `/clientes/consultar-cliente-por-nit/:nit` | Buscar cliente por NIT | CLIENTES | — |
| GET | `/clientes/:id/resumen-cliente` | Detalle + churn + tickets recientes | CLIENTES | — |
| POST | `/clientes/insertar-cliente` | Registrar nuevo cliente | CLIENTES | CLIENTES_CREAR |

### Contratos

| Método | Ruta | Descripción | Módulo | Permiso |
|--------|------|-------------|--------|---------|
| GET | `/contratos/consultar-contratos` | Listar todos los contratos | CONTRATOS | CONTRATOS_VER |
| POST | `/contratos/insertar-contrato` | Crear contrato para un cliente | CONTRATOS | CONTRATOS_CREAR |

### Tickets

| Método | Ruta | Descripción | Módulo | Permiso |
|--------|------|-------------|--------|---------|
| GET | `/tickets/listadoTicket` | Listar tickets con análisis | TICKETS | TICKETS_VER |
| POST | `/tickets/listadoTicketAnalisis` | Crear ticket + análisis IA | TICKETS | TICKETS_CREAR |
| GET | `/tickets/:id/detalleTicket` | Detalle de un ticket | TICKETS | TICKETS_VER |
| GET | `/tickets/contexto-creacion` | Datos para crear ticket (usuario autenticado) | TICKETS | TICKETS_CREAR |
| GET | `/tickets/contexto-creacion/:nit` | Datos para crear ticket por NIT | TICKETS | TICKETS_CREAR |

Todos los endpoints (excepto `/auth/login`) requieren el header:
```
Authorization: Bearer <token>
```

## Configurar y ejecutar localmente

**Requisitos:** Node.js 18+, PostgreSQL 14+, clave de API de Google Gemini

### 1. Clonar el repositorio

```bash
git clone https://github.com/Sneider4/clientpulse-ai.git
cd clientpulse-ai
```

### 2. Restaurar la base de datos

**Opción A — desde el backup completo (recomendado, incluye datos reales):**
```bash
psql -U postgres -c "CREATE DATABASE vortex;"
pg_restore -U postgres -d vortex database/clientpulseai.sql
```

**Opción B — solo el esquema vacío (para empezar desde cero):**
```bash
psql -U postgres -c "CREATE DATABASE vortex;"
psql -U postgres -d vortex -f database/schema.sql
# Luego cargar datos de prueba:
node database/seed.js
```

### 3. Configurar el backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales
npm install
```

**`backend/.env`:**
```env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=vortex
PGUSER=postgres
PGPASSWORD=tu_password
JWT_SECRET=una_clave_secreta_de_al_menos_32_caracteres
JWT_EXPIRES_IN=8h
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
GEMINI_MODEL=gemini-2.5-flash
```

### 4. Cargar datos de prueba

```bash
# Desde la raíz del proyecto
node database/seed.js
```

### 5. Iniciar el backend

```bash
cd backend
npm run dev        # desarrollo con ts-node-dev
# o
npm start          # producción
```

API disponible en `http://localhost:3000/api`

### 6. Iniciar el frontend

```bash
cd frontend
npm install
ng serve
```

App disponible en `http://localhost:4200`

## Credenciales de prueba (tras ejecutar el seed)

| Usuario | Email | Contraseña | Rol | Acceso |
|---------|-------|------------|-----|--------|
| Sneider Malagón | sneider@gmail.com | 1234 | ADMIN_GLOBAL | Todos los clientes y módulos + panel admin |
| Laura Torres | sup1@techcorp.com | 1234 | SUPERVISOR | TechCorp S.A.S — todos los módulos |
| Andrés Vargas | sup2@bancol.com | 1234 | SUPERVISOR | Bancol Finanzas — todos los módulos |
| Camila Ruiz | agente1@techcorp.com | 1234 | AGENTE | TechCorp — solo dashboard y tickets |
| David Morales | agente2@techcorp.com | 1234 | AGENTE | TechCorp — solo dashboard y tickets |
| Sofía Herrera | viewer@eduplus.com | 1234 | VISUALIZADOR | EduPlus — solo lectura, módulos limitados |

> **EduPlus** tiene únicamente los módulos DASHBOARD y TICKETS habilitados, lo que permite demostrar la restricción de acceso por cliente.

## Estructura del proyecto

```
clientpulse-ai/
├── backend/
│   └── src/
│       ├── controllers/        # Manejadores HTTP
│       ├── services/           # Lógica de negocio y queries
│       ├── middlewares/        # authJwt, requireModule, requirePermission
│       ├── models/             # Interfaces TypeScript
│       ├── routes/             # Definición de rutas
│       ├── utils/              # JWT, bcrypt, seguridad de texto
│       ├── db/pool.ts          # Pool de conexión PostgreSQL
│       └── index.ts            # Entry point Express
├── frontend/
│   └── src/app/
│       ├── components/
│       │   ├── admin/          # Panel admin: usuarios, roles/permisos, módulos por cliente
│       │   ├── dashboard/      # KPIs + 3 gráficas Chart.js
│       │   ├── tickets/        # Listado, detalle, nuevo ticket
│       │   ├── clientes/       # Listado, detalle, crear cliente
│       │   ├── error/          # 403 sin-acceso, 404
│       │   └── login/
│       └── services/
│           ├── auth/           # AuthService (signals) · authGuard · moduleGuard
│           └── admin.service   # HTTP client para el panel admin
└── database/
    ├── schema.sql              # Tablas, constraints e índices
    └── seed.js                 # Script Node.js con datos de prueba
```

## Autor

**Richard Sneider Malagón** — Desarrollador Fullstack  
Especializado en Angular · Node.js · PostgreSQL  
Desarrollador en U.D.C.A — Sistema de Información Institucional (SII) · Bogotá, Colombia

[![LinkedIn](https://img.shields.io/badge/LinkedIn-sneider--malagon-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/sneider-malagon/)
[![GitHub](https://img.shields.io/badge/GitHub-Sneider4-181717?style=flat&logo=github&logoColor=white)](https://github.com/Sneider4)
