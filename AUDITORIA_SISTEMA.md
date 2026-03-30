# Auditoria Completa del Sistema - Flowfly Back

Fecha de auditoria: 2026-03-29
Repositorio: `flowfly-back`
Stack base: NestJS + Prisma 7 + PostgreSQL + JWT + Passport + bcrypt

## 1. Resumen Ejecutivo

El sistema tiene una base funcional real (sin mocks) para autenticacion y versionado de sueldo.

Estado general:
- Compilacion TypeScript: OK (`npm run build`)
- Unit tests: OK (`npm run test`)
- E2E tests: FAIL por configuracion de entorno (`JWT_SECRET` faltante en contexto de test)
- Persistencia: real en PostgreSQL via Prisma 7 + `@prisma/adapter-pg`

Conclusion rapida:
- Backend funcional para `auth` y `salary-history` en entorno de desarrollo.
- Aun no listo para produccion por faltantes de validacion, pruebas de integracion y varios endpoints scaffold sin logica.

---

## 2. Tecnologias y Herramientas

## Runtime y framework
- Node.js 22.x
- NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`)
- TypeScript 5

## Autenticacion y seguridad
- JWT: `@nestjs/jwt`, `passport-jwt`
- Passport: `@nestjs/passport`, `passport`
- Hash de password: `bcrypt`

## Persistencia
- Prisma 7 (`prisma`, `@prisma/client`)
- Adapter Prisma 7 para Postgres: `@prisma/adapter-pg`
- Driver SQL: `pg`
- PostgreSQL (docker-compose, puerto 5433)

## Calidad y toolchain
- ESLint + Prettier
- Jest (unit)
- Jest e2e

---

## 3. Arquitectura Actual

Monolito NestJS modular con capas:
- Controllers: exponen HTTP routes
- Services: logica de negocio
- PrismaService: acceso a base de datos
- Guards/Strategy/Decorators: autenticacion y contexto de usuario

Modulos registrados en `AppModule`:
1. `PrismaModule`
2. `UsersModule`
3. `AuthModule`
4. `SalaryHistoryModule`

Total de modulos detectados en `src`: 5 (incluye `AppModule`).

---

## 4. Estado por Modulo (funcionalidad real)

## 4.1 AuthModule
Estado: FUNCIONAL

Endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (protegido JWT)

Implementado:
- Registro con hash bcrypt
- Login con comparacion bcrypt
- Emision de token JWT
- Guard JWT y strategy
- Decorador `@CurrentUser()`

Riesgos/mejoras:
- `JWT_SECRET` depende de env sin fallback controlado
- Falta refresh token y revocacion de sesiones

## 4.2 SalaryHistoryModule
Estado: FUNCIONAL (CRUD + endpoints de consulta temporal)

Endpoints:
- `POST /salary-history`
- `GET /salary-history`
- `GET /salary-history/current`
- `GET /salary-history/at?date=...`
- `GET /salary-history/:id`
- `POST /salary-history/change`
- `PATCH /salary-history/:id`
- `DELETE /salary-history/:id`

Implementado:
- Ownership por usuario autenticado
- Validacion de solapamiento de periodos
- Cambio de sueldo con cierre de vigente y apertura de nuevo
- Parser robusto de fechas (preferencia `dd-mm-yyyy`, compat ISO)
- `endDate` manejado como limite exclusivo para evitar huecos
- Sync de `UserProfile` con sueldo vigente

Observacion:
- El endpoint `at` ahora devuelve `404` si no existe salario para la fecha solicitada.

## 4.3 UsersModule
Estado: PARCIAL

Implementado real:
- `UsersService.create` crea usuario + salario inicial (transaccion Prisma)
- `findByEmail` y `findById` usados por auth

No implementado (scaffold):
- `GET /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`

Esos endpoints aun devuelven strings placeholder, no logica real.

## 4.4 PrismaModule
Estado: FUNCIONAL

Implementado:
- Conexion/desconexion de PrismaClient en ciclo de vida Nest
- Prisma 7 adapter con pool pg

## 4.5 AppModule/AppController
Estado: FUNCIONAL MINIMO
- `GET /` devuelve `Hello World!`

---

## 5. Modelo de Datos Prisma

Migraciones aplicadas:
1. `init_finance_core`
2. `add_password_to_user`
3. `add_salary_history_and_extraordinary_income`

Modelos principales presentes:
- `UserProfile`
- `SalaryHistory`
- `Asset`
- `Transaction`
- `SavingGoal`
- `FutureDesire`
- `MonthlySnapshot`

Enums relevantes:
- `TransactionType`
- `EntropyRiskLevel` incluye `EXTRAORDINARY`

---

## 6. Validacion, Tipado y Testing

## TypeScript
- Build pasa correctamente.
- Config actual no es strict completo (`noImplicitAny: false`).

## Validacion de inputs
- Hay validaciones manuales en servicios (ej. `monthlyWorkHours > 0`, parsing de fechas).
- No se usa aun `class-validator` + `ValidationPipe` global.

## Pruebas
- Unit test: 1 test pasando (`app.controller.spec.ts`).
- E2E: falla por `JwtStrategy requires a secret or key` en entorno test.

Interpretacion:
- El codigo compila, pero la cobertura de pruebas de negocio es muy baja.

---

## 7. Seguridad y Autorizacion (auditoria)

Fortalezas:
- Passwords hasheadas con bcrypt.
- JWT en rutas protegidas (`auth/me`, `salary-history/*`).
- Filtro por `userId` en acceso a salary history.

Riesgos actuales:
- `JWT_SECRET` hardcodeado en `.env` de dev (aceptable local, no prod).
- Endpoints scaffold de `/users` no estan protegidos ni implementados.
- Sin rate-limit en login.
- Sin rotacion/revocacion de tokens.

---

## 8. Que esta 100% funcional hoy

Considerado funcional de punta a punta (DB real + auth real + respuesta consistente):
1. Flujo de autenticacion (`register`, `login`, `me`).
2. CRUD y consultas de `salary-history` autenticadas por JWT.
3. Persistencia Prisma 7 en PostgreSQL con migraciones aplicadas.

No 100% funcional aun:
- CRUD real de `/users` (excepto el create usado desde auth).
- Modulos de negocio financiero (`transactions`, `assets`, `saving-goals`, snapshots) en API.

---

## 9. Faltantes Prioritarios (backlog recomendado)

Prioridad alta:
1. Implementar `ValidationPipe` global y DTOs con `class-validator`.
2. Corregir pruebas e2e (inyectar `JWT_SECRET` en setup de test).
3. Implementar o cerrar endpoints placeholder de `UsersController`.

Prioridad media:
1. CRUD de `transactions` protegido por JWT y ownership.
2. Regla de calculo de horas de vida por fecha usando `SalaryHistory`.
3. Documentacion OpenAPI/Swagger de contratos.

Prioridad hardening:
1. Rate limit para login.
2. Refresh tokens + estrategia de revocacion.
3. Secrets management por entorno (dev/staging/prod).

---

## 10. Acciones concretas sugeridas (corto plazo)

1. Validacion runtime
- Instalar `class-validator` y `class-transformer`.
- En `main.ts`: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))`.

2. E2E estable
- Definir `JWT_SECRET` en entorno de test o mockear strategy en test module.

3. Documentacion viva
- Agregar `README` especifico del dominio (no template por defecto).
- Incluir ejemplos de request/response para auth y salary-history.

---

## 11. Veredicto Final

Estado actual del backend: MVP tecnico funcional para autenticacion y salario historico.

Nivel de madurez:
- Desarrollo local: Bueno
- QA automatizado: Bajo-Medio
- Produccion: Aun no recomendado sin los hardening y validaciones faltantes

Enfoque correcto para la siguiente iteracion:
- Consolidar validaciones + tests e2e
- Implementar modulo `transactions` como siguiente vertical de negocio
- Mantener consistencia temporal con `SalaryHistory` como fuente de verdad
