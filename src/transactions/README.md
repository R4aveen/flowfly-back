
# Transactions Module - Documentacion Completa

Este documento describe el modulo `transactions` de Flowfly: alcance, reglas, endpoints, casos de uso y como probarlo en Insomnia.

## 1. Objetivo del modulo

El modulo `transactions` gestiona movimientos financieros del usuario autenticado.

Soporta:
- Registro de ingresos y gastos.
- Vinculacion opcional a un `Asset`.
- Actualizacion atomica del saldo del `Asset` asociado.
- Calculo de `lifeHoursCost` usando el sueldo historico vigente en la fecha de la transaccion.

Base path:
- `/transactions`

Proteccion:
- Todas las rutas usan JWT (`JwtAuthGuard`).
- El usuario se toma desde el token (`@CurrentUser`).
- No permite operar transacciones o assets de otro usuario.

## 2. Arquitectura interna

Archivos:
- `src/transactions/transactions.module.ts`
- `src/transactions/transactions.controller.ts`
- `src/transactions/transactions.service.ts`
- `src/transactions/dto/create-transaction.dto.ts`
- `src/transactions/dto/update-transaction.dto.ts`

Dependencias principales:
- `PrismaService` (DB real con Prisma 7 + PostgreSQL)
- `SalaryHistory` (para calculo temporal de `lifeHoursCost`)
- `Asset` (para ajuste de balance cuando aplica)

## 3. Modelo de datos involucrado

En `Transaction` existen los campos clave:
- `userId`: owner de la transaccion
- `assetId` (opcional): activo asociado
- `amount`: monto
- `type`: `INCOME | EXPENSE`
- `category`: `EntropyRiskLevel`
- `description`
- `lifeHoursCost` (opcional, calculado)
- `date`
- `createdAt`

Regla de `lifeHoursCost`:
- Se busca el sueldo historico del usuario en la fecha de la transaccion.
- Formula:
  - `lifeHoursCost = amount / hourlyWage`
- Si no hay sueldo para esa fecha o `hourlyWage <= 0`, queda `null`.

## 4. Reglas de negocio actuales

## 4.1 Ownership (seguridad)
- `findOne`, `update`, `delete` filtran por `id + userId`.
- Si se envia `assetId`, se valida que el asset pertenezca al usuario.

## 4.2 Ajuste de saldo de Asset
- En `create`:
  - `INCOME` incrementa saldo.
  - `EXPENSE` decrementa saldo.
- En `update`:
  - Revierte impacto anterior (asset viejo / amount viejo / type viejo).
  - Aplica impacto nuevo (asset nuevo / amount nuevo / type nuevo).
- En `delete`:
  - Revierte impacto de la transaccion eliminada.

## 4.3 Atomicidad
Todas las operaciones que mutan transaccion y saldo de asset se ejecutan en `prisma.$transaction(...)`.

## 5. Validaciones (DTO + ValidationPipe global)

Requisitos de entrada en `create`:
- `amount`: number, minimo `0.01`, hasta 2 decimales.
- `type`: enum `INCOME | EXPENSE`.
- `description`: string, minimo 2 caracteres.
- `category`: opcional, enum `EntropyRiskLevel`.
- `assetId`: opcional, UUID.
- `date`: opcional, string parseable por JS Date (recomendado ISO 8601).

Requisitos en `update`:
- Todos los campos opcionales.
- Si se envia, deben cumplir mismas reglas de tipo/formato.

Nota:
- El parser de fechas de transactions usa formato ISO 8601 (ejemplo: `2026-09-15T10:30:00.000Z`).

## 6. API Reference

## 6.1 Crear transaccion
`POST /transactions`

Body ejemplo (gasto con asset):
```json
{
  "assetId": "b7f2e4f8-2a1c-4d95-bf69-3dfebdc6dc53",
  "amount": 85000,
  "type": "EXPENSE",
  "category": "HIGH",
  "description": "Arriendo septiembre",
  "date": "2026-09-05T12:00:00.000Z"
}
```

Body ejemplo (ingreso extraordinario sin asset):
```json
{
  "amount": 250000,
  "type": "INCOME",
  "category": "EXTRAORDINARY",
  "description": "Bono trimestral",
  "date": "2026-09-15T09:00:00.000Z"
}
```

Respuesta esperada (201):
```json
{
  "id": "...",
  "userId": "...",
  "assetId": "...",
  "amount": "85000",
  "type": "EXPENSE",
  "category": "HIGH",
  "description": "Arriendo septiembre",
  "lifeHoursCost": "22.67",
  "date": "2026-09-05T12:00:00.000Z",
  "createdAt": "2026-03-30T...Z"
}
```

## 6.2 Listar transacciones del usuario
`GET /transactions`

Respuesta (200): arreglo ordenado por `date DESC`.

## 6.3 Obtener una transaccion
`GET /transactions/:id`

Si no existe o no pertenece al usuario:
- `404 Transaccion no encontrada`

## 6.4 Actualizar transaccion
`PATCH /transactions/:id`

Body ejemplo:
```json
{
  "amount": 90000,
  "type": "EXPENSE",
  "description": "Arriendo ajustado",
  "date": "2026-09-06T12:00:00.000Z"
}
```

Comportamiento:
- Recalcula `lifeHoursCost` con la fecha final.
- Rebalancea asset (revierte anterior + aplica nuevo).

## 6.5 Eliminar transaccion
`DELETE /transactions/:id`

Respuesta (200):
```json
{
  "deleted": true
}
```

Comportamiento:
- Revierte impacto en saldo de asset si estaba asociado.

## 7. Errores comunes

- `401 Unauthorized`
  - Token faltante/expirado/invalido.

- `404 Asset no encontrado para este usuario`
  - `assetId` no existe o no es del owner autenticado.

- `404 Transaccion no encontrada`
  - `id` invalido o no pertenece al usuario.

- `400 date invalida, usa formato ISO 8601`
  - Fecha mal formateada en payload.

- `400` por validacion de DTO
  - `amount <= 0`, `type` fuera de enum, `description` muy corta, UUID invalido, etc.

## 8. Casos de uso clave

## Caso A: Registrar gasto diario
1. Usuario autenticado envia `POST /transactions` con `type: EXPENSE`.
2. Sistema busca sueldo vigente a la fecha y calcula `lifeHoursCost`.
3. Si viene `assetId`, descuenta saldo.

## Caso B: Registrar bono
1. Usuario envia `POST /transactions` con:
   - `type: INCOME`
   - `category: EXTRAORDINARY`
2. Sistema incrementa saldo (si hay asset) y conserva registro para analitica mensual.

## Caso C: Corregir una transaccion ya creada
1. Usuario envia `PATCH /transactions/:id`.
2. Sistema revierte impacto anterior y aplica el nuevo.
3. Recalcula horas de vida segun la fecha final.

## 9. Guia de Insomnia (paso a paso)

## 9.1 Environment recomendado
```json
{
  "baseUrl": "http://localhost:3000",
  "access_token": ""
}
```

## 9.2 Carpeta sugerida
`03-transactions`

Request names sugeridos:
1. `TRX - Create Expense`
2. `TRX - Create Income Extraordinary`
3. `TRX - List`
4. `TRX - Get One`
5. `TRX - Update`
6. `TRX - Delete`

En la carpeta, agrega header comun:
- `Authorization: Bearer {{ _.access_token }}`

## 9.3 Flujo de prueba minimo
1. Ejecuta `AUTH - Login` y guarda token en `_.access_token`.
2. Ejecuta `TRX - Create Expense`.
3. Ejecuta `TRX - List` y valida `lifeHoursCost`.
4. Ejecuta `TRX - Update` y revisa cambio de `lifeHoursCost`.
5. Ejecuta `TRX - Delete` y valida `{ "deleted": true }`.

## 10. Ejemplos listos para copiar en Insomnia

## TRX - Create Expense
`POST {{ _.baseUrl }}/transactions`
```json
{
  "assetId": "REEMPLAZA_CON_ASSET_ID",
  "amount": 58000,
  "type": "EXPENSE",
  "category": "MODERATE",
  "description": "Supermercado semana 1",
  "date": "2026-09-10T20:30:00.000Z"
}
```

## TRX - Create Income Extraordinary
`POST {{ _.baseUrl }}/transactions`
```json
{
  "amount": 300000,
  "type": "INCOME",
  "category": "EXTRAORDINARY",
  "description": "Bono de cumplimiento",
  "date": "2026-09-15T09:00:00.000Z"
}
```

## TRX - List
`GET {{ _.baseUrl }}/transactions`

## TRX - Get One
`GET {{ _.baseUrl }}/transactions/REEMPLAZA_CON_ID`

## TRX - Update
`PATCH {{ _.baseUrl }}/transactions/REEMPLAZA_CON_ID`
```json
{
  "amount": 62000,
  "description": "Supermercado ajustado"
}
```

## TRX - Delete
`DELETE {{ _.baseUrl }}/transactions/REEMPLAZA_CON_ID`

## 11. Limitaciones actuales y siguiente iteracion

Pendientes recomendados:
1. Filtro por rango de fechas y paginacion en `GET /transactions`.
2. Soft-delete en vez de delete fisico (si requieres auditabilidad estricta).
3. Idempotencia para evitar duplicados por reintentos de cliente.
4. Integrar snapshots mensuales para consolidar ingresos/gastos por periodo.

---

Si cambias la logica del modulo, actualiza este README en paralelo para mantener contrato API y comportamiento sincronizados.