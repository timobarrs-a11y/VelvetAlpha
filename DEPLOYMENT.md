# Deployment Guide

This guide covers deploying Stellar Pursuit to production environments.

## Prerequisites

- GitHub account with repository access
- Vercel account (recommended) or similar hosting platform
- Supabase project with configured environment variables
- All edge functions deployed

## Environment Variables

Required environment variables for production:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Options

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Connect GitHub repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy on commit

```bash
vercel
```

### Option 2: Railway

1. Connect GitHub repository
2. Set environment variables
3. Deploy

### Option 3: Netlify

1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Set environment variables
5. Deploy

## Build Process

```bash
npm install
npm run build
npm run typecheck
```

## Health Checks

Production deployment includes automated health checks:

- Database connectivity validation
- Authentication service availability
- API latency monitoring
- Error tracking and alerting

Health check endpoint: `/admin/monitoring` (requires admin role)

## SSL/HTTPS

All modern deployment platforms provide free SSL certificates. Ensure:

- HTTPS is enforced
- Security headers are configured
- CORS is properly restricted

## Monitoring

Access the monitoring dashboard at `/admin/monitoring` with admin credentials:

- Real-time performance metrics
- Error tracking and analysis
- System health status
- Alert management

## Rollback

To rollback to a previous deployment:

**Vercel:**
```
vercel rollback
```

**Railway/Netlify:** Use platform UI to revert to previous deployment

## Post-Deployment

1. Test all features in production
2. Monitor error logs and performance
3. Set up alerts for critical errors
4. Configure automated backups
5. Document any manual steps

## Performance Optimization

- Enable caching headers
- Minimize bundle size (already optimized)
- Use CDN for static assets
- Monitor Core Web Vitals

## Security

- Never commit secrets to repository
- Use environment variables for all credentials
- Enable RLS on all database tables
- Regular security audits
- Keep dependencies updated

## Support

For deployment issues, check:
1. Environment variables are set correctly
2. Supabase connection is working
3. Edge functions are deployed
4. Build logs for errors
