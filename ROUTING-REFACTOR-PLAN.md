# API Routing Architecture Refactor Plan

## Current Problem

The backend has **30 route files** with massive duplication across role-based endpoints.
Endpoints are split by **who the user is** instead of **what resource they access**.

## Target Architecture

Consolidate into **~12 resource-centric route files**, using RBAC middleware to control access.

---

## Proposed Route Map

### Consolidated Route Files (new)

```
src/routes/
├── auth.routes.js                    ← /api/auth          (merged from authRoutes.js)
├── users.routes.js                   ← /api/users          (merged from userRoutes.js, adminUserRoutes.js)
├── cases.routes.js                   ← /api/cases          (BIG MERGE: adminRoutes.js case parts, 
│                                                              caseTemplateRoutes.js, caseWorkflowRoutes.js,
│                                                              casePublishingRoutes.js, caseReviewRoutes.js,
│                                                              contributeCaseRoutes.js, adminContributionRoutes.js)
├── simulations.routes.js             ← /api/simulations    (from simulationRoutes.js)
├── analytics.routes.js               ← /api/analytics      (BIG MERGE: analyticsRoutes.js, progressAnalyticsRoutes.js, 
│                                                              adminRoutes.js analytics parts, educatorRoutes.js analytics)
├── progress.routes.js                ← /api/progress       (merged from clinicianProgressRoutes.js, 
│                                                              performanceRoutes.js, performanceReviewRoutes.js,
│                                                              studentProgressRoutes.js)
├── learning.routes.js                ← /api/learning       (merged from learningGoalRoutes.js, 
│                                                              learningPathRoutes.js, competencyAssessmentRoutes.js)
├── leaderboard.routes.js             ← /api/leaderboard    (from leaderboardRoutes.js)
├── feedback.routes.js                ← /api/feedback       (from feedbackRoutes.js)
├── dashboard.routes.js               ← /api/dashboard      (merged from studentRoutes.js dashboards, 
│                                                              educatorRoutes.js dashboards, adminRoutes.js dashboards)
├── tracking.routes.js                ← /api/tracking       (from interactionTrackingRoutes.js)
└── admin.routes.js                   ← /api/admin          (admin-only utility endpoints)
```

### Deleted Route Files (after migration)

| File | Migrated To |
|------|------------|
| adminRoutes.js | → cases.routes.js + users.routes.js + analytics.routes.js |
| adminUserRoutes.js | → users.routes.js |
| adminProgramRoutes.js | → admin.routes.js |
| adminContributionRoutes.js | → cases.routes.js |
| userRoutes.js | → users.routes.js |
| studentRoutes.js | → dashboard.routes.js |
| educatorRoutes.js | → dashboard.routes.js + analytics.routes.js |
| simulationRoutes.js | → simulations.routes.js |
| caseTemplateRoutes.js | → cases.routes.js |
| caseWorkflowRoutes.js | → cases.routes.js |
| casePublishingRoutes.js | → cases.routes.js |
| caseReviewRoutes.js | → cases.routes.js |
| contributeCaseRoutes.js | → cases.routes.js |
| analyticsRoutes.js | → analytics.routes.js |
| progressAnalyticsRoutes.js | → analytics.routes.js |
| performanceRoutes.js | → progress.routes.js |
| performanceReviewRoutes.js | → progress.routes.js |
| clinicianProgressRoutes.js | → progress.routes.js |
| studentProgressRoutes.js | → progress.routes.js |
| learningGoalRoutes.js | → learning.routes.js |
| learningPathRoutes.js | → learning.routes.js |
| competencyAssessmentRoutes.js | → learning.routes.js |
| leaderboardRoutes.js | → leaderboard.routes.js |
| feedbackRoutes.js | → feedback.routes.js |
| interactionTrackingRoutes.js | → tracking.routes.js |
| healthRoutes.js | → Keep (simple health check) |
| privacyRoutes.js | → users.routes.js |
| authRoutes.js | → auth.routes.js |
| queueRoutes.js | → admin.routes.js |
| systemStateRoutes.js | → admin.routes.js |
