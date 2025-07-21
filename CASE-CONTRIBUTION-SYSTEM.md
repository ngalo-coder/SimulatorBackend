# Case Contribution System - Implementation Guide

## 🎯 Overview

This system allows clinicians who achieve "Excellent" ratings to contribute new cases to the database. It includes performance tracking, eligibility verification, case submission workflow, and admin review process.

## 🏗️ System Architecture

### Backend Components

1. **ClinicianPerformanceModel.js** - Tracks clinician performance and eligibility
2. **ContributedCaseModel.js** - Manages contributed cases and review workflow
3. **performanceRoutes.js** - API endpoints for performance tracking
4. **contributeCaseRoutes.js** - API endpoints for case contribution
5. **adminRoutes.js** - Admin review and approval endpoints
6. **performanceMiddleware.js** - Automatic evaluation recording and eligibility checks

### Frontend Components

1. **PerformanceDashboard.vue** - Shows clinician performance and eligibility status
2. **ContributeCaseForm.vue** - Multi-step case contribution form
3. **ContributorDashboard.vue** - Manage contributed cases
4. **AdminCaseReview.vue** - Admin interface for reviewing cases

## 🔄 Workflow

### 1. Performance Tracking
- Automatically records evaluation results after each simulation
- Tracks performance by specialty/module
- Calculates eligibility based on criteria:
  - 3+ "Excellent" ratings in specialty
  - At least 1 excellent rating in last 30 days
  - No "Needs Improvement" in last 10 attempts

### 2. Case Contribution
- Eligible clinicians can access contribution form
- Multi-step form with validation
- Save as draft or submit for review
- Auto-generates case IDs based on specialty

### 3. Admin Review
- Cases submitted for review appear in admin dashboard
- Full case preview with all details
- Approve, reject, or request revisions
- Approved cases automatically added to main database

### 4. Status Tracking
- Contributors can track their case status
- Email notifications (to be implemented)
- Performance stats updated on approval/rejection

## 🚀 Integration Steps

### 1. Database Setup
The models will automatically create the required collections:
- `clinicianperformances` - Performance tracking
- `contributedcases` - Contributed cases

### 2. Middleware Integration
Add to your simulation evaluation endpoint:
```javascript
import { recordEvaluationMiddleware } from './src/middleware/performanceMiddleware.js';

// Add to your evaluation route
app.post('/api/simulation/evaluate', recordEvaluationMiddleware, (req, res) => {
  // Your existing evaluation logic
  // The middleware will automatically record performance
});
```

### 3. Frontend Routes
Add these routes to your Vue router:
```javascript
{
  path: '/performance',
  component: PerformanceDashboard
},
{
  path: '/contribute',
  component: ContributorDashboard
},
{
  path: '/contribute/new',
  component: ContributeCaseForm
},
{
  path: '/admin/review',
  component: AdminCaseReview
}
```

### 4. Authentication Integration
Update the placeholder user IDs in:
- `contributeCaseRoutes.js`
- `performanceMiddleware.js`
- Frontend components

Replace `'current-user-id'` with actual authenticated user data.

## 📊 API Endpoints

### Performance Tracking
- `POST /api/performance/record-evaluation` - Record evaluation result
- `GET /api/performance/summary/:userId` - Get performance summary
- `GET /api/performance/eligibility/:userId/:specialty` - Check eligibility
- `GET /api/performance/leaderboard` - Get top performers

### Case Contribution
- `GET /api/contribute/form-data` - Get form options
- `POST /api/contribute/draft` - Save draft (requires eligibility)
- `POST /api/contribute/submit` - Submit for review (requires eligibility)
- `GET /api/contribute/my-cases/:userId` - Get contributor's cases

### Admin Review
- `GET /api/admin/contributed-cases` - Get cases for review
- `POST /api/admin/contributed-cases/:id/approve` - Approve case
- `POST /api/admin/contributed-cases/:id/reject` - Reject case
- `POST /api/admin/contributed-cases/:id/request-revision` - Request changes

## 🎯 Eligibility Criteria

### Requirements for Case Contribution
1. **Excellence Threshold**: 3+ "Excellent" ratings in the specialty
2. **Recency**: At least 1 excellent rating in the last 30 days
3. **Consistency**: No "Needs Improvement" ratings in the last 10 attempts

### Specialty-Specific Eligibility
- Clinicians can contribute to specialties where they meet criteria
- Internal Medicine contributors can specify modules
- Pediatric cases automatically include guardian support

## 🔧 Configuration

### Eligibility Thresholds
Modify in `ClinicianPerformanceModel.js`:
```javascript
// Current: 3+ excellent ratings
const hasEnoughExcellent = stats.excellentCount >= 3;

// Current: 30 days for recent excellent
const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
```

### Case ID Generation
Modify in `ContributedCaseModel.js`:
```javascript
const moduleMap = {
  'Cardiovascular System': 'CARD',
  'Tropical Medicine': 'ID',
  // Add more mappings
};
```

## 🎉 Features

### ✅ Implemented
- Automatic performance tracking
- Eligibility verification
- Multi-step contribution form
- Draft saving
- Admin review workflow
- Case status tracking
- Performance dashboard
- Specialty-specific modules
- Pediatric guardian support

### 🔄 To Be Added
- Email notifications
- Bulk case import
- Case templates
- Peer review system
- Contribution leaderboard
- Advanced analytics

## 🛠️ Testing

### Test Performance Tracking
1. Complete case evaluations with different ratings
2. Check `/api/performance/summary/:userId`
3. Verify eligibility calculation

### Test Case Contribution
1. Achieve eligibility in a specialty
2. Access contribution form
3. Submit case and verify admin review

### Test Admin Review
1. Submit cases as contributor
2. Access admin review interface
3. Approve/reject cases and verify database updates

## 📈 Monitoring

### Key Metrics to Track
- Number of eligible contributors
- Case submission rate
- Approval/rejection rates
- Performance trends by specialty
- System usage analytics

### Database Queries
```javascript
// Get eligible contributors count
await ClinicianPerformance.countDocuments({ 'contributorStatus.isEligible': true });

// Get cases pending review
await ContributedCase.countDocuments({ status: 'submitted' });

// Get approval rate
await ContributedCase.aggregate([
  { $group: { _id: '$status', count: { $sum: 1 } } }
]);
```

## 🎯 Success Metrics

- **Engagement**: % of excellent performers who contribute cases
- **Quality**: Approval rate of contributed cases
- **Growth**: Number of new cases added monthly
- **Retention**: Contributor activity over time

The system is now ready for integration and testing! 🚀