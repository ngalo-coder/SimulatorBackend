# API Routes — Resource-Centric Architecture

This directory contains **7 unified route files**, each responsible for a single domain resource.
This replaces the previous 30+ fragmented route files that were split by user role.

## Route Files

| File | Mount Path | Responsibility |
|------|-----------|---------------|
| `auth.routes.js` | `/api/auth` | Login, register, token management, password changes, admin audit logs |
| `users.routes.js` | `/api/users` | User CRUD, profiles, preferences, admin user management (export/import/bulk ops) |
| `cases.routes.js` | `/api/cases` | Case CRUD, templates, workflows, publishing, reviews, contributions |
| `analytics.routes.js` | `/api/analytics` | Case usage, effectiveness, difficulty analysis, progress analytics, performance trends |
| `progress.routes.js` | `/api/progress` | Performance summaries, leaderboard, eligibility, evaluations, help/guidance, adaptive learning, achievements, PDF reports |
| `dashboard.routes.js` | `/api/dashboard` | Role-aware dashboards (student/educator/admin), stats, student progress, educator case management |
| `simulations.routes.js` | `/api/simulations` | Simulation session lifecycle (start, ask, end), performance metrics, treatment plans, retakes |

## Design Principles

- **Resource-centric**: Each file maps to one domain resource (`users`, `cases`, `analytics`, etc.)
- **Role-aware**: Single endpoints behave differently based on the authenticated user's role
- **Consistent naming**: All files use the `.routes.js` suffix with plural resource names
- **Self-contained**: Each file includes its own route definitions, middleware, and inline handlers
- **Clean separation**: Auth middleware (`authenticateToken`/`requireAnyRole`) is applied per-route

## Migration Notes

This refactoring consolidated the following legacy files:
- `authRoutes.js` → `auth.routes.js`
- `userRoutes.js`, `adminUserRoutes.js`, `privacyRoutes.js` → `users.routes.js`
- 7+ case-related files → `cases.routes.js`
- `analyticsRoutes.js`, `progressAnalyticsRoutes.js` → `analytics.routes.js`
- `performanceRoutes.js`, `performanceReviewRoutes.js`, `clinicianProgressRoutes.js`, `studentProgressRoutes.js` → `progress.routes.js`
- `studentRoutes.js`, `educatorRoutes.js`, `adminRoutes.js` (dashboard parts) → `dashboard.routes.js`
- `simulationRoutes.js` → `simulations.routes.js`

All legacy route files have been removed from the codebase.
