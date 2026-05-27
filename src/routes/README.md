# API Routes — Resource-Centric Architecture

This directory contains **4 unified route files**, each responsible for a single domain resource.

## Route Files

| File | Mount Path | Responsibility | Endpoints |
|------|-----------|---------------|-----------|
| `auth.routes.js` | `/api/auth` | Register, login, logout, token refresh/verify, current user, change password | **7** |
| `users.routes.js` | `/api/users` | Register, disciplines, roles, registration config, user CRUD, preferences | **10** |
| `cases.routes.js` | `/api/cases` | Case CRUD, categories, duplicate | **7** |
| `simulations.routes.js` | `/api/simulations` | Simulation session lifecycle, performance metrics, treatment plans, retakes | **11** |

## Design Principles

- **Resource-centric**: Each file maps to one domain resource (`users`, `cases`, etc.)
- **Role-aware**: Single endpoints behave differently based on the authenticated user's role
- **Consistent naming**: All files use the `.routes.js` suffix with plural resource names
- **Self-contained**: Each file includes its own route definitions, middleware, and inline handlers
- **Clean separation**: Auth middleware (`authenticateToken`/`requireAnyRole`) is applied per-route

## Removed Route Groups

The following route groups were removed as they had no frontend consumers:
- `/api/analytics` — Analytics routes (13 endpoints)
- `/api/progress` — Progress routes (5 endpoints)
- `/api/dashboard` — Dashboard routes (7 endpoints) — convenience aggregations covered elsewhere

## Trimmed Endpoints

Within remaining route files, the following non-essential endpoints were removed:
- **Auth**: `GET /admin/audit-logs` — admin-only audit log viewer
- **Users**: `POST /import` — admin CSV bulk import
- **Cases**: All review (5), publishing (3), workflow (4), draft workflow (6), templates (3), contributions (4), popular, published, validate endpoints — these were educator/admin case management tooling not needed for student simulation

