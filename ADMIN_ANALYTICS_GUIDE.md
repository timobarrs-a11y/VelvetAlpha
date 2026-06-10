# Admin Analytics Access Guide

## How to Access Analytics

**URL:** `/admin/analytics`

Simply navigate to `http://localhost:5173/admin/analytics` (or your production URL) while logged in.

**Note:** Currently, any authenticated user can access this page. In production, you should add role-based access control to restrict this to admin users only.

---

## Dashboard Features

### Key Metrics (Top Row)

1. **Active Users**
   - Shows DAU (Daily Active Users) for selected period
   - Displays total registered users below

2. **Premium Users**
   - Number of Plus/Elite tier subscribers
   - Conversion rate percentage

3. **Messages**
   - Total messages sent in period
   - Average messages per user

4. **Errors**
   - Error count for selected period
   - Status indicator

### Time Period Selection

Switch between three time periods:
- **Today** - Last 24 hours
- **Last 7 Days** - Weekly view
- **Last 30 Days** - Monthly view

All metrics update based on selected period.

---

## Analytics Sections

### 1. Popular Features
Shows which features users engage with most:
- Chat
- Insights
- Calendar
- Stories
- Games (Checkers, Pacman, Stellar Pursuit, Momentum)
- Avatar Creator
- Video Watch
- Companion Creation

Displayed as horizontal bars sorted by usage count.

### 2. Session Stats
- **Average Session Duration**: How long users stay active
- **Total Active Sessions**: Number of active sessions in period

### 3. Conversion Funnels
Tracks user progression through key flows:

**Onboarding Funnel:**
- Step-by-step completion rates
- Drop-off points
- Average time per step

**Upgrade to Premium Funnel:**
- Pricing page views
- Payment form interactions
- Successful conversions

Each step shows:
- Total users who reached this step
- Completion rate (%)
- Drop-off rate (%)

### 4. Recent Errors
Last 10 errors logged, showing:
- **Severity Level**: Critical, High, Medium, Low
- **Error Type**: client_error, server_error, network_error, etc.
- **Error Message**: What went wrong
- **Timestamp**: When it occurred
- **Page Path**: Where it happened

Color-coded by severity for quick scanning.

---

## Data Sources

All data comes from these tables:
- `user_behavior_analytics` - User actions and page views
- `feature_usage_stats` - Feature engagement
- `business_metrics` - Aggregated KPIs
- `conversion_funnel` - Funnel progression
- `error_logs` - Error tracking
- `user_profiles` - User counts and tiers

---

## Tracking Events

To track events in your app, use the `analyticsService`:

```typescript
import { analyticsService } from '../services/analyticsService';

// Track page view (automatic on route change)
analyticsService.trackPageView('/calendar');

// Track feature usage
analyticsService.trackFeatureUse('calendar', 300); // 300 seconds spent

// Track button clicks
analyticsService.trackButtonClick('create_event', { eventType: 'reminder' });

// Track message sent
analyticsService.trackMessageSent(companionId);

// Track funnel steps
analyticsService.trackFunnelStep(
  'onboarding',
  'completed_questionnaire',
  3,
  true,
  45 // seconds to complete
);

// Log errors
analyticsService.logError({
  error_type: 'client_error',
  error_message: 'Failed to load calendar',
  severity: 'medium',
  page_path: '/calendar',
  user_action: 'Trying to view calendar'
});
```

---

## Adding Admin Role Protection (Recommended)

To restrict analytics to admin users only:

### 1. Add admin role to database:

```sql
-- Add is_admin column to user_profiles
ALTER TABLE user_profiles ADD COLUMN is_admin boolean DEFAULT false;

-- Make yourself an admin
UPDATE user_profiles
SET is_admin = true
WHERE id = 'YOUR_USER_ID';
```

### 2. Update the ProtectedRoute in Router.tsx:

```typescript
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAuthorized(false);
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      setIsAuthorized(!!profile?.is_admin);
    }

    checkAdmin();
  }, []);

  if (isAuthorized === null) {
    return <LoadingSpinner />;
  }

  if (!isAuthorized) {
    return <Navigate to="/lobby" replace />;
  }

  return <>{children}</>;
}

// Then use AdminRoute instead of ProtectedRoute for /admin/analytics
```

---

## Future Enhancements

Potential additions to the dashboard:

1. **Real-Time Monitoring**
   - WebSocket updates for live metrics
   - Active users right now
   - Messages per minute

2. **Advanced Analytics**
   - Cohort analysis charts
   - Retention heatmaps
   - Revenue trends
   - Churn prediction

3. **User Segmentation**
   - Filter by subscription tier
   - Filter by signup date
   - Filter by engagement level

4. **Export Capabilities**
   - Download as CSV/PDF
   - Scheduled email reports
   - Custom date ranges

5. **A/B Testing Dashboard**
   - Active experiments
   - Variant performance
   - Statistical significance

6. **Performance Monitoring**
   - API endpoint response times
   - Database query performance
   - AI inference latency

---

## Quick Tips

1. **Monitor Daily**: Check analytics daily to spot issues early
2. **Watch Drop-offs**: High drop-off in funnels indicates UX problems
3. **Track Errors**: Critical errors need immediate attention
4. **Feature Usage**: Low usage features might need better onboarding
5. **Session Duration**: Decreasing duration might indicate engagement issues

---

## Troubleshooting

### No data showing?
- Ensure analytics tracking is enabled in your app
- Check that users are triggering trackEvent calls
- Verify database tables have data: run queries in Supabase dashboard

### Incorrect metrics?
- Verify time period selection
- Check for timezone issues
- Ensure RLS policies allow reading analytics tables

### Performance slow?
- Add indexes to analytics tables if querying millions of rows
- Consider archiving old data
- Use database functions for complex aggregations

---

## Support

For questions or issues with analytics:
1. Check the console for errors
2. Verify database connection
3. Review `analyticsService.ts` implementation
4. Check RLS policies in Supabase
