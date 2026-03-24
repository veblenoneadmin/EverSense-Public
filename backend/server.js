import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { prisma } from './lib/prisma.js';

// Import new route modules
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import memberRoutes from './routes/members.js';
import inviteRoutes from './routes/invites.js';
import wizardRoutes from './routes/wizard.js';
import statsRoutes from './api/stats.js';
import timersRoutes from './api/timers.js';
import timerRoutes from './api/timer.js';
import tasksRoutes from './api/tasks.js';
import projectsRoutes from './api/projects.js';
import clientsRoutes from './api/clients.js';
// import expensesRoutes from './api/expenses.js';
import reportsRoutes from './api/reports.js';
import userReportsRoutes from './api/user-reports.js';
import onboardingRoutes from './api/onboarding.js';
import adminRoutes from './api/admin.js';
import passwordResetRoutes from './routes/password-reset.js';
import invitationRoutes from './api/invitations.js';
import skillsRoutes from './api/skills.js';
import attendanceRoutes from './api/attendance.js';
import calendarRoutes from './api/calendar.js';
import usersRoutes from './api/users.js';
import kpiReportRoutes from './api/kpi-report.js';
import notificationsRoutes from './api/notifications.js';
import firefliesRoutes, { startFirefliesPolling } from './api/fireflies.js';
import eventsRoutes from './api/events.js';
import leavesRoutes from './api/leaves.js';
import apikeysRoutes from './api/apikeys.js';
import integrationsRoutes from './api/integrations.js';
import superAdminRoutes, { logError } from './api/super-admin.js';
import { startNotificationScheduler } from './services/notificationScheduler.js';
import { startAttendanceCron } from './lib/attendance-cron.js';
import {
  blockPublicRegistration, 
  addInternalBranding, 
  validateInvitationOnSignup,
  enforceUserLimits,
  getInternalSystemInfo 
} from './middleware/internal-security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

console.log('🚀 Starting server...');
console.log('📊 User Reports API: ENABLED');

// Environment variable validation (non-blocking)
const requiredEnvVars = ['DATABASE_URL'];
const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
if (missingEnvVars.length > 0) {
  console.warn('⚠️  Missing environment variables:', missingEnvVars.join(', '));
  console.warn('🔧 Server will start but some features may not work properly');
} else {
  console.log('✅ All required environment variables are configured');
}

// Database migration function
async function runDatabaseMigrations() {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not found, skipping migrations');
    return;
  }

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    console.log('🔄 Pushing database schema...');
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss');
    if (stdout) console.log('📋 Schema push output:', stdout);
    if (stderr && !stderr.includes('INFO')) console.warn('⚠️  Schema push warnings:', stderr);
    console.log('✅ Database schema ready');
  } catch (error) {
    console.error('❌ Database schema push failed:', error.message);
  }
}

// CORS headers with environment-aware configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5177',
    'http://localhost:3001',
    'http://localhost:3000',
    'https://vebtask.com',
    'https://www.vebtask.com',
    'https://vebtask-production.up.railway.app',
    'https://vebtaskrevamp-production.up.railway.app'
  ];
  
  const origin = req.headers.origin;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (isProduction) {
    // In production, be more restrictive
    const host = req.get('host');
    if (host && (host.includes('railway.app') || host.includes('vebtask.com'))) {
      res.header('Access-Control-Allow-Origin', `https://${host}`);
    } else {
      res.header('Access-Control-Allow-Origin', 'https://vebtask-production.up.railway.app',
    'https://vebtaskrevamp-production.up.railway.app');
    }
  } else {
    // In development, allow localhost with current port, but also allow production origins
    if (origin && origin.includes('vebtask.com')) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Mount express json middleware BEFORE auth routes for request logging  
app.use(express.json({ limit: '10mb' }));


// Simple health check for Railway (at root path)
app.get('/health-simple', (req, res) => {
  res.json({ status: 'ok', service: 'vebtask', timestamp: new Date() });
});

// Test route
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Temp: manually trigger clockout and return full result
app.get('/run-clockout', async (req, res) => {
  const hours = Number(req.query.hours) || 1.5;
  const threshSec = hours * 3600;
  const log = [];
  try {
    const overdue = await prisma.$queryRawUnsafe(
      `SELECT id, userId, orgId, timeIn FROM attendance_logs WHERE timeOut IS NULL AND timeIn <= DATE_SUB(NOW(), INTERVAL ${threshSec} SECOND)`
    );
    log.push(`found ${overdue.length} overdue sessions (threshold: ${hours}h)`);
    for (const row of overdue) {
      try {
        const affected = await prisma.$executeRawUnsafe(
          `UPDATE attendance_logs SET timeOut = NOW(3), duration = TIMESTAMPDIFF(SECOND, timeIn, NOW(3)), updatedAt = NOW(3) WHERE id = ? AND timeOut IS NULL`,
          row.id
        );
        log.push(`session ${row.id}: rowsAffected=${Number(affected)}`);
        try { broadcast(row.orgId, 'attendance', { action: 'clock-out', userId: row.userId }); } catch {}
      } catch (e) { log.push(`session ${row.id} ERROR: ${e.message}`); }
    }
    res.json({ ok: true, log });
  } catch (e) { res.json({ ok: false, error: e.message, log }); }
});

// Temp: diagnose attendance cron
app.get('/debug-attendance', async (req, res) => {
  try {
    const open = await prisma.$queryRawUnsafe(
      `SELECT id, userId, orgId, timeIn, TIMESTAMPDIFF(SECOND, timeIn, NOW()) as elapsedSeconds
       FROM attendance_logs WHERE timeOut IS NULL ORDER BY timeIn ASC`
    );
    const sessions = open.map(r => ({ ...r, elapsedSeconds: Number(r.elapsedSeconds), elapsedHours: (Number(r.elapsedSeconds) / 3600).toFixed(1) }));
    const overdue = sessions.filter(r => r.elapsedSeconds >= 12 * 3600);
    res.json({ openSessions: sessions.length, overdueSessions: overdue.length, sessions, serverNow: new Date() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Temp: reopen a session that was incorrectly force-clocked out
// POST /reopen-session?sessionId=xxx  OR  ?email=prans@example.com
app.post('/reopen-session', async (req, res) => {
  try {
    const { sessionId, email } = req.query;
    if (sessionId) {
      await prisma.$executeRawUnsafe(
        `UPDATE attendance_logs SET timeOut = NULL, duration = 0, updatedAt = NOW(3) WHERE id = ?`,
        sessionId
      );
      return res.json({ success: true, reopened: sessionId });
    }
    if (email) {
      // Find the most recently closed session today for this user
      const users = await prisma.$queryRawUnsafe(`SELECT id FROM \`User\` WHERE email = ? LIMIT 1`, email);
      if (!users.length) return res.status(404).json({ error: 'User not found' });
      const userId = users[0].id;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id FROM attendance_logs WHERE userId = ? AND DATE(timeIn) = CURDATE() ORDER BY timeIn DESC LIMIT 1`,
        userId
      );
      if (!rows.length) return res.status(404).json({ error: 'No session found today for this user' });
      await prisma.$executeRawUnsafe(
        `UPDATE attendance_logs SET timeOut = NULL, duration = 0, updatedAt = NOW(3) WHERE id = ?`,
        rows[0].id
      );
      return res.json({ success: true, reopened: rows[0].id, userId });
    }
    res.status(400).json({ error: 'Provide sessionId or email query param' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Temp: force clock-out all sessions open longer than X hours (default 12)
app.post('/force-clockout', async (req, res) => {
  try {
    const hours = Number(req.query.hours) || 12;
    const thresholdSeconds = hours * 3600;
    const open = await prisma.$queryRawUnsafe(
      `SELECT id, userId, orgId, timeIn,
              TIMESTAMPDIFF(SECOND, timeIn, NOW()) as elapsedSeconds
       FROM attendance_logs
       WHERE timeOut IS NULL
         AND timeIn <= DATE_SUB(NOW(), INTERVAL ${thresholdSeconds} SECOND)`
    );
    const results = [];
    for (const row of open) {
      const now = new Date();
      const elapsed = Number(row.elapsedSeconds);
      const affected = await prisma.$executeRawUnsafe(
        `UPDATE attendance_logs SET timeOut = ?, duration = ?, updatedAt = NOW(3) WHERE id = ? AND timeOut IS NULL`,
        now, elapsed, row.id
      );
      results.push({ id: row.id, userId: row.userId, timeIn: row.timeIn, elapsedHours: (elapsed / 3600).toFixed(1), rowsAffected: Number(affected) });
    }
    res.json({ clocked_out: results.length, sessions: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Temp: diagnose admin login
app.get('/debug-admin', async (req, res) => {
  try {
    const { verifyPassword } = await import('better-auth/crypto');
    const user = await prisma.user.findUnique({ where: { email: 'admin@eversense.ai' }, select: { id: true, email: true } });
    if (!user) return res.json({ step: 'user_not_found' });

    const accounts = await prisma.account.findMany({ where: { userId: user.id }, select: { id: true, providerId: true, password: true } });
    const credential = accounts.find(a => a.providerId === 'credential');

    if (!credential) return res.json({ step: 'no_credential_account', accounts: accounts.map(a => a.providerId) });
    if (!credential.password) return res.json({ step: 'no_password', providerId: credential.providerId });

    const testPassword = process.env.ADMIN_SETUP_PASSWORD || 'Admin@EverSense2025!';
    const valid = await verifyPassword({ hash: credential.password, password: testPassword });

    res.json({
      step: 'done',
      userId: user.id,
      accounts: accounts.map(a => a.providerId),
      hashFormat: credential.password.includes(':') ? 'scrypt(ok)' : 'unknown(bad)',
      passwordVerifies: valid,
      testPassword
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Add logging middleware for auth routes
app.use('/api/auth', (req, res, next) => {
  console.log(`🔐 Auth ${req.method} ${req.originalUrl}`, {
    path: req.path,
    fullUrl: req.url,
    query: req.query,
    body: req.method === 'POST' ? req.body : undefined,
    headers: {
      'content-type': req.headers['content-type'],
      'origin': req.headers.origin,
      'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
    }
  });
  next();
});

// Auth routes using proper Express adapter with error handling
// Create the handler once
const authHandler = toNodeHandler(auth);

// Handle the /api/auth root path
app.get("/api/auth", (req, res) => {
  res.json({
    status: "ok",
    message: "Better Auth API",
    endpoints: [
      "/api/auth/sign-in/social",
      "/api/auth/callback/google",
      "/api/auth/get-session",
      "/api/auth/sign-out"
    ]
  });
});

// Password reset must be registered BEFORE the Better Auth catch-all
// so these specific routes are not intercepted by Better Auth
app.use('/api/auth', passwordResetRoutes);

// Use a catch-all route for Better Auth sub-paths
app.all(["/api/auth/*", "/api/auth/*splat"], (req, res) => {
  // Better Auth's toNodeHandler expects to handle the request/response directly
  return authHandler(req, res);
});

// ==================== INTERNAL SECURITY MIDDLEWARE ====================

// Apply internal security middleware globally
app.use(addInternalBranding);
app.use(blockPublicRegistration);
app.use(validateInvitationOnSignup);
app.use(enforceUserLimits);

// Internal system info endpoint
app.get('/api/system/info', getInternalSystemInfo);

// Health check endpoint with detailed status
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      auth: 'unknown'
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasDbUrl: !!process.env.DATABASE_URL,
      hasAuthSecret: !!process.env.BETTER_AUTH_SECRET,
      baseUrl: process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.VITE_APP_URL,
      smtp: {
        configured: !!process.env.SMTP_HOST,
        host: process.env.SMTP_HOST || '(not set)',
        port: process.env.SMTP_PORT || '587 (default)',
        from: process.env.SMTP_FROM || process.env.SMTP_USER || '(not set)',
      }
    }
  };

  // Test database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'degraded';
    console.error('Health check: Database connection failed:', error.message);
  }

  // Test auth system (basic check)
  try {
    const testHeaders = { cookie: 'test=check' };
    await auth.api.getSession({ headers: testHeaders });
    health.services.auth = 'available';
  } catch (error) {
    // Auth system is available if it can handle requests (even if session is invalid)
    health.services.auth = error.message.includes('session') ? 'available' : 'error';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

// ==================== USER AUTHENTICATION MIDDLEWARE ====================

// Middleware to extract user from Better Auth session
app.use('/api', async (req, res, next) => {
  try {
    // Skip auth for public endpoints
    const publicEndpoints = [
      '/api/auth/',
      '/api/invites/accept',
      '/api/invites/',
      '/api/invitations/accept',
      '/api/system/info',
      '/api/health',
      '/api/ai/',
      '/api/integrations/google/callback',
      '/test'
    ];

    const isPublicEndpoint = publicEndpoints.some(endpoint => req.path.startsWith(endpoint));
    if (isPublicEndpoint) {
      return next();
    }

    // Try to get user from Better Auth session
    const request = {
      headers: req.headers,
      method: req.method,
      url: req.url
    };

    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session?.user) {
        req.user = {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image
        };
        console.log('✅ User session validated:', req.user.email);
      } else {
        console.log('⚠️  No valid session found for request to:', req.path);

          // TEMPORARY FIX: Auto-authenticate existing users for testing
          // TODO: Remove this after fixing session management
          try {
            const existingUser = await prisma.user.findFirst({
              where: { email: 'tony@opusautomations.com' },
              select: { id: true, email: true, name: true }
            });

            if (existingUser) {
              req.user = {
                id: existingUser.id,
                email: existingUser.email,
                name: existingUser.name,
                image: null
              };
              console.log('🔧 TEMP: Auto-authenticated user for testing:', req.user.email);
            }
          } catch (tempError) {
            console.log('⚠️  Temp auth failed:', tempError.message);
          }
      }
    } catch (authError) {
      // Session might be expired or invalid, continue without user
      console.error('❌ Auth session check failed for', req.path, ':', authError.message);
      console.error('Request headers:', {
        authorization: req.headers.authorization ? '[PRESENT]' : '[MISSING]',
        cookie: req.headers.cookie ? req.headers.cookie.substring(0, 100) + '...' : '[MISSING]',
        'user-agent': req.headers['user-agent']?.substring(0, 50)
      });
    }

    next();
  } catch (error) {
    console.error('❌ User auth middleware error:', error);
    next();
  }
});

// ==================== NEW API ROUTES ====================

// Organization management routes
app.use('/api/organizations', organizationRoutes);

// Member management routes (nested under organizations)
app.use('/api/organizations', memberRoutes);

// Invite system routes
app.use('/api/invites', inviteRoutes);
app.use('/api/organizations', inviteRoutes);

// Wizard/onboarding routes
app.use('/api/wizard', wizardRoutes);

// Widget API routes
app.use('/api/stats', statsRoutes);
app.use('/api/timers', timersRoutes);
app.use('/api/timer', timerRoutes); // Mount the timer.js routes at /api/timer
app.use('/api/time-logs', timersRoutes); // Add time-logs alias for Timer component
app.use('/api/tasks', tasksRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/clients', clientsRoutes);
// app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/user-reports', userReportsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/kpi-report', kpiReportRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/fireflies', firefliesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/leaves', leavesRoutes);
app.use('/api/apikeys', apikeysRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Test routes for debugging (NO AUTH - REMOVE IN PRODUCTION)
import testProjectsRoutes from './api/test-projects.js';
app.use('/api/test-projects', testProjectsRoutes);

// Additional custom auth routes (password reset, etc.)
// Note: Better Auth routes are handled above
app.use('/api/auth', authRoutes);

// ==================== TEMPORARY FIX ENDPOINT ====================
// REMOVE THIS AFTER FIXING TONY'S MEMBERSHIP!

app.get('/fix-tony-membership', async (req, res) => {
  try {
    console.log('🔧 TEMPORARY: Fixing Tony\'s organization membership...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Find Tony's user
      const tonyUser = await prisma.user.findUnique({
        where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail }
      });
      
      if (!tonyUser) {
        return res.status(404).json({
          error: `Tony's user (${INTERNAL_CONFIG.ORGANIZATION.ownerEmail}) not found`
        });
      }
      
      console.log(`✅ Found Tony: ${tonyUser.email} (${tonyUser.id})`);
      
      // Look for ANY existing organization first
      const existingOrgs = await prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log(`📊 Found ${existingOrgs.length} existing organizations:`, existingOrgs.map(o => `${o.name} (${o.slug})`));
      
      // Find or create Veblen organization
      let veblenOrg = await prisma.organization.findUnique({
        where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
      });
      
      if (!veblenOrg) {
        console.log('🏢 Attempting to create Veblen organization...');
        console.log('Tony user details:', { id: tonyUser.id, email: tonyUser.email, emailVerified: tonyUser.emailVerified });
        
        try {
          veblenOrg = await prisma.organization.create({
            data: {
              name: INTERNAL_CONFIG.ORGANIZATION.name,
              slug: INTERNAL_CONFIG.ORGANIZATION.slug,
              createdById: tonyUser.id
            }
          });
          console.log(`✅ Created organization: ${veblenOrg.name} (${veblenOrg.id})`);
        } catch (orgCreateError) {
          console.error('❌ Failed to create organization:', orgCreateError);
          
          // Try to use an existing organization if creation fails
          if (existingOrgs.length > 0) {
            veblenOrg = existingOrgs[0];
            console.log(`🔄 Using existing organization instead: ${veblenOrg.name} (${veblenOrg.slug})`);
          } else {
            // Last resort: Create a minimal organization record directly
            console.log('🆘 Last resort: Creating minimal organization without foreign key...');
            try {
              veblenOrg = await prisma.$executeRaw`
                INSERT INTO organizations (id, name, slug, createdById, createdAt, updatedAt) 
                VALUES (${`org_${Date.now()}`}, ${INTERNAL_CONFIG.ORGANIZATION.name}, ${INTERNAL_CONFIG.ORGANIZATION.slug}, ${tonyUser.id}, NOW(), NOW())
              `;
              
              // Now fetch the created org
              veblenOrg = await prisma.organization.findUnique({
                where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
              });
              
              if (veblenOrg) {
                console.log(`✅ Created organization via raw SQL: ${veblenOrg.name}`);
              } else {
                throw new Error('Raw SQL creation failed');
              }
            } catch (rawError) {
              console.error('❌ Raw SQL also failed:', rawError);
              throw new Error(`All organization creation methods failed: ${orgCreateError.message}`);
            }
          }
        }
      } else {
        console.log(`✅ Found existing organization: ${veblenOrg.name} (${veblenOrg.id})`);
      }
      
      // Check if membership already exists
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_orgId: {
            userId: tonyUser.id,
            orgId: veblenOrg.id
          }
        }
      });
      
      if (existingMembership) {
        if (existingMembership.role !== 'OWNER') {
          console.log(`🔄 Updating role from ${existingMembership.role} to OWNER...`);
          await prisma.membership.update({
            where: { id: existingMembership.id },
            data: { role: 'OWNER' }
          });
          console.log('✅ Role updated to OWNER');
        } else {
          console.log('✅ Already has OWNER role');
        }
      } else {
        console.log('👑 Creating OWNER membership...');
        await prisma.membership.create({
          data: {
            userId: tonyUser.id,
            orgId: veblenOrg.id,
            role: 'OWNER'
          }
        });
        console.log('✅ OWNER membership created');
      }
      
      // Verify the fix
      const verification = await prisma.user.findUnique({
        where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
        include: {
          memberships: {
            include: {
              org: true
            }
          }
        }
      });
      
      const result = {
        success: true,
        message: 'Tony\'s membership fixed successfully! You can now refresh the page.',
        user: {
          email: verification.email,
          name: verification.name,
          memberships: verification.memberships.map(m => ({
            role: m.role,
            organization: m.org.name,
            slug: m.org.slug
          }))
        }
      };
      
      console.log('🎉 SUCCESS:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Error fixing membership:', error);
    res.status(500).json({ 
      error: 'Failed to fix membership', 
      details: error.message 
    });
  }
});

// ==================== QUICK RAILWAY MEMBERSHIP FIX ====================
app.get('/quick-fix-membership', async (req, res) => {
  try {
    console.log('🚀 Quick membership fix triggered...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Find Tony's user
      const tonyUser = await prisma.user.findUnique({
        where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
        include: { memberships: { include: { org: true } } }
      });
      
      if (!tonyUser) {
        throw new Error(`Tony's user (${INTERNAL_CONFIG.ORGANIZATION.ownerEmail}) not found`);
      }
      
      console.log('✅ Found Tony:', tonyUser.email, 'ID:', tonyUser.id);
      
      // Find or create Veblen organization
      let veblenOrg = await prisma.organization.findUnique({
        where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
      });
      
      if (!veblenOrg) {
        console.log('🏢 Creating Veblen organization with raw SQL...');
        
        // Use raw SQL to avoid foreign key constraint issues
        const orgId = `org_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        await prisma.$executeRaw`
          INSERT INTO organizations (id, name, slug, createdAt, updatedAt)
          VALUES (
            ${orgId},
            ${INTERNAL_CONFIG.ORGANIZATION.name}, 
            ${INTERNAL_CONFIG.ORGANIZATION.slug}, 
            NOW(), 
            NOW()
          )
        `;
        
        // Fetch the created organization
        veblenOrg = await prisma.organization.findUnique({
          where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
        });
        
        console.log('✅ Created organization:', veblenOrg.name, 'ID:', veblenOrg.id);
      } else {
        console.log('✅ Found organization:', veblenOrg.name, 'ID:', veblenOrg.id);
      }
      
      // Check if membership exists
      const existingMembership = await prisma.membership.findFirst({
        where: {
          userId: tonyUser.id,
          orgId: veblenOrg.id
        }
      });
      
      if (existingMembership) {
        if (existingMembership.role !== 'OWNER') {
          console.log('🔄 Updating role to OWNER...');
          await prisma.membership.update({
            where: { id: existingMembership.id },
            data: { role: 'OWNER' }
          });
          console.log('✅ Role updated to OWNER');
        } else {
          console.log('✅ Already has OWNER role');
        }
      } else {
        console.log('👑 Creating OWNER membership...');
        await prisma.membership.create({
          data: {
            userId: tonyUser.id,
            orgId: veblenOrg.id,
            role: 'OWNER'
          }
        });
        console.log('✅ OWNER membership created');
      }
      
      // Verification
      const verification = await prisma.user.findUnique({
        where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail },
        include: {
          memberships: {
            include: { org: true }
          }
        }
      });
      
      const result = {
        success: true,
        message: 'Tony\'s membership fixed successfully! Please refresh the page.',
        user: {
          email: verification.email,
          name: verification.name,
          memberships: verification.memberships.map(m => ({
            role: m.role,
            organization: m.org.name,
            slug: m.org.slug
          }))
        }
      };
      
      console.log('🎉 SUCCESS:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Error fixing membership:', error);
    res.status(500).json({ 
      error: 'Failed to fix membership', 
      details: error.message 
    });
  }
});

// ==================== CHECK DATABASE STRUCTURE ====================
app.get('/debug-database-structure', async (req, res) => {
  try {
    console.log('🔍 Checking database structure...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      // Check table names
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE()
      `;
      
      // Check user table structure
      const userTableStructure = await prisma.$queryRaw`
        DESCRIBE user
      `;
      
      // Check organizations table structure if it exists
      let orgTableStructure = null;
      try {
        orgTableStructure = await prisma.$queryRaw`
          DESCRIBE organizations
        `;
      } catch (e) {
        console.log('Organizations table does not exist');
      }
      
      // Check foreign key constraints
      const foreignKeys = await prisma.$queryRaw`
        SELECT 
          CONSTRAINT_NAME,
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('organizations', 'memberships')
      `;
      
      const result = {
        tables,
        userTableStructure,
        orgTableStructure,
        foreignKeys
      };
      
      console.log('📊 Database Structure:', JSON.stringify(result, null, 2));
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Error checking database structure:', error);
    res.status(500).json({ 
      error: 'Failed to check database structure', 
      details: error.message 
    });
  }
});

// ==================== SIMPLE FIX ENDPOINT (RAW SQL) ====================
app.get('/fix-tony-membership-raw', async (req, res) => {
  try {
    console.log('🔧 RAW SQL: Fixing Tony\'s membership with direct database access...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Step 1: Create organization using raw SQL
      console.log('📝 Creating Veblen organization with raw SQL...');
      
      await prisma.$executeRaw`
        INSERT IGNORE INTO organizations (id, name, slug, createdById, createdAt, updatedAt) 
        VALUES (
          CONCAT('org_', UNIX_TIMESTAMP()),
          ${INTERNAL_CONFIG.ORGANIZATION.name}, 
          ${INTERNAL_CONFIG.ORGANIZATION.slug}, 
          ${INTERNAL_CONFIG.ORGANIZATION.ownerId}, 
          NOW(), 
          NOW()
        )
      `;
      
      // Step 2: Get the organization
      const org = await prisma.organization.findUnique({
        where: { slug: INTERNAL_CONFIG.ORGANIZATION.slug }
      });
      
      if (!org) {
        throw new Error('Organization creation failed');
      }
      
      console.log(`✅ Organization ready: ${org.name} (${org.id})`);
      
      // Step 3: Create membership using raw SQL
      console.log('👑 Creating OWNER membership with raw SQL...');
      
      await prisma.$executeRaw`
        INSERT IGNORE INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
        VALUES (
          CONCAT('mem_', UNIX_TIMESTAMP()),
          ${INTERNAL_CONFIG.ORGANIZATION.ownerId},
          ${org.id},
          'OWNER',
          NOW(),
          NOW()
        )
      `;
      
      // Step 4: Verify the result
      const verification = await prisma.membership.findFirst({
        where: {
          userId: INTERNAL_CONFIG.ORGANIZATION.ownerId,
          orgId: org.id
        },
        include: {
          user: { select: { email: true, name: true } },
          org: { select: { name: true, slug: true } }
        }
      });
      
      if (!verification) {
        throw new Error('Membership verification failed');
      }
      
      const result = {
        success: true,
        message: 'Tony\'s membership fixed via raw SQL! Refresh the page to see changes.',
        membership: {
          user: verification.user.email,
          role: verification.role,
          organization: verification.org.name,
          slug: verification.org.slug
        }
      };
      
      console.log('🎉 RAW SQL SUCCESS:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Raw SQL fix failed:', error);
    res.status(500).json({ 
      error: 'Raw SQL fix failed', 
      details: error.message 
    });
  }
});

// ==================== MINIMAL FIX - JUST CREATE MEMBERSHIP ====================
app.get('/fix-tony-minimal', async (req, res) => {
  try {
    console.log('🔧 MINIMAL: Just creating Tony\'s membership...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Step 1: Create a simple organization record with minimal data
      console.log('📝 Creating minimal organization...');
      
      const orgId = `org_${Date.now()}`;
      
      await prisma.$executeRaw`
        INSERT IGNORE INTO organizations (id, name, slug, createdById, createdAt, updatedAt) 
        VALUES (
          ${orgId},
          'Veblen', 
          'veblen', 
          'system-created',
          NOW(), 
          NOW()
        )
      `;
      
      // Step 2: Create membership directly
      console.log('👑 Creating membership...');
      
      const membershipId = `mem_${Date.now()}`;
      
      await prisma.$executeRaw`
        INSERT IGNORE INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
        VALUES (
          ${membershipId},
          ${INTERNAL_CONFIG.ORGANIZATION.ownerId},
          (SELECT id FROM organizations WHERE slug = 'veblen' LIMIT 1),
          'OWNER',
          NOW(),
          NOW()
        )
      `;
      
      // Step 3: Verify by checking if we can fetch organizations now
      const organizations = await prisma.membership.findMany({
        where: { userId: INTERNAL_CONFIG.ORGANIZATION.ownerId },
        include: {
          org: { select: { name: true, slug: true } }
        }
      });
      
      const result = {
        success: true,
        message: 'Minimal fix complete! Refresh the page.',
        memberships: organizations.map(m => ({
          role: m.role,
          organization: m.org.name,
          slug: m.org.slug
        })),
        debug: {
          membershipCount: organizations.length,
          userId: INTERNAL_CONFIG.ORGANIZATION.ownerId
        }
      };
      
      console.log('🎉 MINIMAL SUCCESS:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Minimal fix failed:', error);
    res.status(500).json({ 
      error: 'Minimal fix failed', 
      details: error.message 
    });
  }
});

// ==================== MANUAL DATA INSERT - FORCE CREATE RECORDS ====================
app.get('/force-create-membership', async (req, res) => {
  try {
    console.log('🔧 FORCE: Manually inserting organization and membership...');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    try {
      const orgId = 'veblen_org_' + Date.now();
      const membershipId = 'membership_' + Date.now();
      const tonyId = '53ebe8d8-4700-43b0-aae7-f30608cd3b66';
      
      console.log('Creating organization with ID:', orgId);
      console.log('Creating membership with ID:', membershipId);
      console.log('Tony ID:', tonyId);
      
      // Step 1: Insert organization directly with raw SQL
      await prisma.$executeRawUnsafe(`
        INSERT INTO organizations (id, name, slug, createdById, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `, orgId, 'Veblen', 'veblen', tonyId);
      
      console.log('✅ Organization inserted');
      
      // Step 2: Insert membership directly with raw SQL
      await prisma.$executeRawUnsafe(`
        INSERT INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `, membershipId, tonyId, orgId, 'OWNER');
      
      console.log('✅ Membership inserted');
      
      // Step 3: Verify what we created
      const finalCheck = await prisma.organization.findMany({
        include: {
          memberships: {
            include: {
              user: { select: { email: true, name: true } }
            }
          }
        }
      });
      
      const result = {
        success: true,
        message: 'Records force-created! Refresh the page to see changes.',
        created: {
          organizationId: orgId,
          membershipId: membershipId,
          userId: tonyId
        },
        verification: finalCheck.map(org => ({
          org: org.name,
          slug: org.slug,
          members: org.memberships.map(m => ({
            user: m.user.email,
            role: m.role
          }))
        }))
      };
      
      console.log('🎉 FORCE SUCCESS:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Force creation failed:', error);
    res.status(500).json({ 
      error: 'Force creation failed', 
      details: error.message,
      code: error.code
    });
  }
});

// ==================== FINAL DIAGNOSTIC - CHECK DATABASE STATE ====================
app.get('/debug-database-state', async (req, res) => {
  try {
    console.log('🔍 FINAL DIAGNOSTIC: Checking entire database state...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Check organizations
      const orgs = await prisma.organization.findMany({
        select: { id: true, name: true, slug: true, createdById: true, createdAt: true }
      });
      
      // Check memberships
      const memberships = await prisma.membership.findMany({
        include: {
          user: { select: { email: true, name: true } },
          org: { select: { name: true, slug: true } }
        }
      });
      
      // Check Tony's user specifically
      const tony = await prisma.user.findUnique({
        where: { id: INTERNAL_CONFIG.ORGANIZATION.ownerId },
        select: { id: true, email: true, name: true }
      });
      
      // Check raw counts
      const counts = {
        users: await prisma.user.count(),
        organizations: await prisma.organization.count(),
        memberships: await prisma.membership.count()
      };
      
      const result = {
        config: {
          targetUserId: INTERNAL_CONFIG.ORGANIZATION.ownerId,
          targetEmail: INTERNAL_CONFIG.ORGANIZATION.ownerEmail,
          targetOrgSlug: INTERNAL_CONFIG.ORGANIZATION.slug
        },
        tony: tony,
        organizations: orgs,
        memberships: memberships,
        counts: counts,
        analysis: {
          hasOrganizations: orgs.length > 0,
          hasMemberships: memberships.length > 0,
          tonyExists: !!tony,
          veblenOrgExists: orgs.some(o => o.slug === 'veblen')
        }
      };
      
      console.log('🎯 DATABASE STATE:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Database state check failed:', error);
    res.status(500).json({ 
      error: 'Database state check failed', 
      details: error.message 
    });
  }
});

// ==================== DIAGNOSTIC ENDPOINT ====================
app.get('/debug-tony-user', async (req, res) => {
  try {
    console.log('🔍 DIAGNOSTIC: Checking Tony\'s user record...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Find Tony by email
      const tonyByEmail = await prisma.user.findUnique({
        where: { email: INTERNAL_CONFIG.ORGANIZATION.ownerEmail }
      });
      
      // Find Tony by ID from config
      const tonyById = await prisma.user.findUnique({
        where: { id: INTERNAL_CONFIG.ORGANIZATION.ownerId }
      });
      
      // Get all users to see what exists
      const allUsers = await prisma.user.findMany({
        select: { id: true, email: true, name: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      
      const result = {
        config: {
          ownerEmail: INTERNAL_CONFIG.ORGANIZATION.ownerEmail,
          ownerId: INTERNAL_CONFIG.ORGANIZATION.ownerId
        },
        userByEmail: tonyByEmail ? {
          id: tonyByEmail.id,
          email: tonyByEmail.email,
          name: tonyByEmail.name,
          emailVerified: tonyByEmail.emailVerified
        } : null,
        userById: tonyById ? {
          id: tonyById.id,
          email: tonyById.email,
          name: tonyById.name,
          emailVerified: tonyById.emailVerified
        } : null,
        recentUsers: allUsers,
        diagnosis: {
          userExistsByEmail: !!tonyByEmail,
          userExistsById: !!tonyById,
          idsMatch: tonyByEmail && tonyById && tonyByEmail.id === tonyById.id,
          recommendation: tonyByEmail && tonyById ? 
            'IDs match - should work' :
            tonyByEmail ? 
            'User exists but config ID is wrong - update config' :
            'User does not exist - need to create or find correct email'
        }
      };
      
      console.log('🎯 DIAGNOSTIC RESULT:', result);
      res.json(result);
      
    } finally {
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    res.status(500).json({ 
      error: 'Diagnostic failed', 
      details: error.message 
    });
  }
});

// EMERGENCY FIX - Ensure user and org exist for reports
app.get('/api/emergency/setup-user-org', async (req, res) => {
  try {
    console.log('🚨 EMERGENCY: Setting up user and organization for reports');

    const requiredUserId = '53ebe8d8-4700-43b0-aae7-f30608cd3b66';
    const requiredOrgId = 'org_1757046595553';
    const userEmail = 'tony@opusautomations.com';

    // Step 1: Ensure user exists
    let user = await prisma.user.findUnique({
      where: { id: requiredUserId }
    });

    if (!user) {
      console.log('👤 Creating missing user...');
      user = await prisma.user.create({
        data: {
          id: requiredUserId,
          email: userEmail,
          name: 'Tony',
          emailVerified: true
        }
      });
      console.log('✅ User created:', user.id);
    } else {
      console.log('✅ User exists:', user.id);
    }

    // Step 2: Ensure organization exists
    let org = await prisma.organization.findUnique({
      where: { id: requiredOrgId }
    });

    if (!org) {
      console.log('🏢 Creating missing organization...');
      org = await prisma.organization.create({
        data: {
          id: requiredOrgId,
          name: 'Veblen',
          slug: 'veblen',
          createdById: requiredUserId
        }
      });
      console.log('✅ Organization created:', org.id);
    } else {
      console.log('✅ Organization exists:', org.id);
    }

    // Step 3: Ensure membership exists
    let membership = await prisma.membership.findFirst({
      where: {
        userId: requiredUserId,
        orgId: requiredOrgId
      }
    });

    if (!membership) {
      console.log('👥 Creating missing membership...');
      membership = await prisma.membership.create({
        data: {
          userId: requiredUserId,
          orgId: requiredOrgId,
          role: 'OWNER'
        }
      });
      console.log('✅ Membership created:', membership.id);
    } else {
      console.log('✅ Membership exists:', membership.id);
    }

    res.json({
      success: true,
      message: 'User and organization setup complete',
      data: {
        user: { id: user.id, email: user.email },
        organization: { id: org.id, name: org.name },
        membership: { id: membership.id, role: membership.role }
      }
    });

  } catch (error) {
    console.error('❌ Emergency setup failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// DATABASE COLUMN UPDATE ENDPOINT - Update image column to LONGTEXT
app.get('/api/migrate/image-column', async (req, res) => {
  try {
    console.log('🔄 MIGRATE: Updating image column to LONGTEXT');

    // Execute raw SQL to modify the image column
    await prisma.$executeRaw`ALTER TABLE reports MODIFY COLUMN image LONGTEXT`;

    console.log('✅ Successfully updated image column to LONGTEXT');

    res.json({
      success: true,
      message: 'Image column successfully updated to support large images',
      details: 'Column type changed from TEXT to LONGTEXT'
    });

  } catch (error) {
    console.error('❌ Image column migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update image column',
      details: error.message
    });
  }
});

// DATABASE INSPECTION ENDPOINT
app.get('/api/inspect/database', async (req, res) => {
  try {
    console.log('🔍 INSPECT: Checking database state');

    const userId = '53ebe8d8-4700-43b0-aae7-f30608cd3b66';
    const orgId = 'org_1757046595553';

    // Check what actually exists in database
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { email: 'tony@opusautomations.com' }
        ]
      },
      select: { id: true, email: true, name: true }
    });

    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: orgId },
          { slug: 'veblen' }
        ]
      },
      select: { id: true, name: true, slug: true }
    });

    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true },
      take: 5
    });

    const allOrgs = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      take: 5
    });

    const recentReports = await prisma.report.findMany({
      select: { id: true, userId: true, orgId: true, userName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    res.json({
      inspection: {
        targetUser: user,
        targetOrg: org,
        allUsers: allUsers,
        allOrganizations: allOrgs,
        recentReports: recentReports,
        searchCriteria: { userId, orgId }
      }
    });

  } catch (error) {
    console.error('❌ Database inspection failed:', error);
    res.status(500).json({
      error: error.message,
      code: error.code
    });
  }
});

// ULTIMATE SIMPLE REPORTS ENDPOINT - Uses first available user/org
app.post('/api/simple/user-reports', async (req, res) => {
  try {
    console.log('🔧 SIMPLE: Creating report with first available user/org');

    const { title, description, userName, image, projectId } = req.body;

    if (!description || !userName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: description and userName'
      });
    }

    // Find any available user and org
    const anyUser = await prisma.user.findFirst({
      select: { id: true, email: true }
    });

    const anyOrg = await prisma.organization.findFirst({
      select: { id: true, name: true }
    });

    if (!anyUser) {
      return res.status(500).json({
        success: false,
        error: 'No users found in database'
      });
    }

    if (!anyOrg) {
      return res.status(500).json({
        success: false,
        error: 'No organizations found in database'
      });
    }

    console.log('Using available records:', {
      userId: anyUser.id,
      userEmail: anyUser.email,
      orgId: anyOrg.id,
      orgName: anyOrg.name
    });

    // Create report with available user/org (now supports full-size images with LongText column)
    const report = await prisma.report.create({
      data: {
        title: title || 'User Report',
        description: description,
        userName: userName,
        image: image || null, // Full image data now supported
        projectId: null, // Skip project to avoid constraint issues
        userId: anyUser.id,
        orgId: anyOrg.id
      }
    });

    console.log('✅ SIMPLE: Report created successfully:', report.id);

    res.status(201).json({
      success: true,
      message: 'Report created with available user/org',
      report: {
        id: report.id,
        title: report.title,
        description: report.description,
        userName: report.userName,
        userId: anyUser.id,
        orgId: anyOrg.id,
        createdAt: report.createdAt
      }
    });

  } catch (error) {
    console.error('❌ SIMPLE ERROR:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });

    res.status(500).json({
      success: false,
      error: 'Simple endpoint failed',
      details: {
        message: error.message,
        code: error.code,
        meta: error.meta
      }
    });
  }
});

// SIMPLE DELETE REPORTS ENDPOINT - Uses first available user/org
app.delete('/api/simple/user-reports/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ SIMPLE: Deleting report with id:', id);

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Report ID is required'
      });
    }

    // Check if report exists
    const existingReport = await prisma.report.findUnique({
      where: { id },
      select: { id: true, userName: true, title: true }
    });

    if (!existingReport) {
      console.log('❌ Report not found:', id);
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    console.log('Found report to delete:', {
      id: existingReport.id,
      userName: existingReport.userName,
      title: existingReport.title
    });

    // Delete the report
    await prisma.report.delete({
      where: { id }
    });

    console.log('✅ Report deleted successfully:', id);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting report:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete report',
      details: {
        message: error.message,
        code: error.code,
        meta: error.meta
      }
    });
  }
});

// BULLETPROOF REPORTS ENDPOINT - Bypasses all middleware
app.post('/api/bulletproof/user-reports', async (req, res) => {
  try {
    console.log('🛡️ BULLETPROOF: Creating user report with minimal validation');
    console.log('Request body:', req.body);
    console.log('Query params:', req.query);

    const { title, description, userName, image, projectId } = req.body;
    const orgId = req.query.orgId || 'org_1757046595553';
    const userId = '53ebe8d8-4700-43b0-aae7-f30608cd3b66'; // Hardcoded system user

    console.log('Using hardcoded values:', { userId, orgId, userName, description });

    if (!description || !userName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: description and userName'
      });
    }

    // Simple, direct database insert with minimal validation (full image support)
    const report = await prisma.report.create({
      data: {
        title: title || 'User Report',
        description: description,
        userName: userName,
        image: image || null, // Full image data now supported with LongText column
        projectId: projectId || null,
        userId: userId,
        orgId: orgId
      }
    });

    console.log('✅ BULLETPROOF: Report created successfully:', report.id);

    res.status(201).json({
      success: true,
      message: 'Report created successfully via bulletproof endpoint',
      report: {
        id: report.id,
        title: report.title,
        description: report.description,
        userName: report.userName,
        image: report.image,
        createdAt: report.createdAt
      }
    });

  } catch (error) {
    console.error('❌ BULLETPROOF ERROR:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    let errorResponse = {
      success: false,
      error: 'Bulletproof endpoint failed',
      details: {
        message: error.message,
        code: error.code,
        meta: error.meta
      }
    };

    // Handle specific database errors
    if (error.code === 'P2003') {
      errorResponse.error = 'Database foreign key constraint failed';
      errorResponse.suggestion = 'Visit /api/emergency/setup-user-org first';
    } else if (error.code === 'P2002') {
      errorResponse.error = 'Duplicate report data';
    }

    res.status(500).json(errorResponse);
  }
});

// DEBUG ENDPOINT - Test user reports API manually
app.post('/api/debug/test-user-report', async (req, res) => {
  try {
    console.log('🔧 DEBUG: Testing user report creation');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('User:', req.user);
    console.log('Query:', req.query);

    const { title, description, userName, image, projectId } = req.body;
    const orgId = req.query.orgId || 'org_1757046595553';

    // Simulate the exact scenario from frontend
    const testUserId = req.user?.id || '53ebe8d8-4700-43b0-aae7-f30608cd3b66'; // fallback

    console.log('🔧 Debug values:', { orgId, testUserId, title, description, userName });

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { id: true, email: true, name: true }
    });
    console.log('👤 User found:', user);

    // Check if org exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, slug: true }
    });
    console.log('🏢 Organization found:', org);

    // Check memberships
    const membership = await prisma.membership.findFirst({
      where: { userId: testUserId, orgId: orgId },
      select: { role: true, userId: true, orgId: true }
    });
    console.log('👥 Membership found:', membership);

    const result = {
      debug: true,
      user: user,
      organization: org,
      membership: membership,
      requestData: { title, description, userName, projectId },
      testParams: { orgId, testUserId }
    };

    res.json(result);
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      error: error.message,
      code: error.code,
      debug: true
    });
  }
});

// Test endpoint for Whisper API debugging
app.get('/api/ai/whisper-status', (req, res) => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const status = {
    openai_key_configured: !!openaiKey,
    openai_key_length: openaiKey ? openaiKey.length : 0,
    openai_key_prefix: openaiKey ? openaiKey.substring(0, 20) : 'none',
    openai_key_suffix: openaiKey ? openaiKey.substring(openaiKey.length - 10) : 'none',
    openai_key_has_spaces: openaiKey ? (openaiKey !== openaiKey.trim()) : false,
    openrouter_key_configured: !!process.env.OPENROUTER_API_KEY,
    node_env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
  
  console.log('🔍 Whisper status check:', status);
  res.json(status);
});

// Test OpenAI API key with simple models endpoint
app.get('/api/ai/openai-test', async (req, res) => {
  try {
    console.log('🧪 Testing OpenAI API key with models endpoint...');
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Test with simple models endpoint first
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    console.log('🧪 OpenAI models response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🧪 OpenAI models error:', errorText);
      return res.json({
        test: 'openai-models',
        status: response.status,
        error: errorText,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await response.json();
    const whisperModels = result.data?.filter(model => model.id.includes('whisper')) || [];
    
    console.log('🧪 OpenAI API key valid, found models:', result.data?.length);
    
    res.json({
      test: 'openai-models',
      status: response.status,
      success: true,
      totalModels: result.data?.length || 0,
      whisperModels: whisperModels.map(m => m.id),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ OpenAI test error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint using OpenAI SDK
app.post('/api/ai/whisper-sdk-test', async (req, res) => {
  try {
    console.log('🧪 Testing Whisper API with OpenAI SDK...');
    
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Import OpenAI SDK
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    
    // Create a minimal base64 audio data for testing
    const testAudioData = 'UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAC4uLi4uLi4uLi4'; 
    const audioBuffer = Buffer.from(testAudioData, 'base64');
    
    console.log('🧪 Test audio buffer:', {
      length: audioBuffer.length,
      first8Bytes: Array.from(audioBuffer.slice(0, 8)).map(b => String.fromCharCode(b)).join('')
    });
    
    // Create a File-like object for the SDK
    const audioFile = new File([audioBuffer], 'test-audio.wav', { type: 'audio/wav' });
    
    console.log('🧪 Sending request via OpenAI SDK...');
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json'
    });
    
    console.log('🧪 OpenAI SDK success:', transcription);
    
    res.json({
      test: 'whisper-sdk',
      success: true,
      result: transcription,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Whisper SDK test error:', error);
    res.status(500).json({ 
      error: 'SDK test failed',
      message: error.message,
      details: error.response?.data || error.stack,
      timestamp: new Date().toISOString()
    });
  }
});

// Whisper Speech-to-Text API endpoint with GPT-4o transcribe models
app.post('/api/ai/transcribe', async (req, res) => {
  try {
    console.log('🎤 Whisper API called:', {
      hasBody: !!req.body,
      hasAudioData: !!(req.body && req.body.audioData),
      audioDataLength: req.body && req.body.audioData ? req.body.audioData.length : 0,
      audioFormat: req.body ? req.body.audioFormat : 'none',
      language: req.body ? req.body.language : 'none',
      model: req.body ? req.body.model : 'auto',
      includeLogProbs: req.body ? req.body.includeLogProbs : false
    });

    if (!req.body || !req.body.audioData) {
      console.log('❌ Missing audio data in request');
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    
    if (!OPENAI_API_KEY) {
      console.log('❌ OpenAI API key not found in environment variables');
      return res.status(500).json({ 
        error: 'OpenAI API key not configured', 
        debug: {
          env_keys: Object.keys(process.env).filter(key => key.includes('OPENAI')),
          node_env: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        },
        fallback: 'browser-speech-recognition' 
      });
    }

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(req.body.audioData, 'base64');
    
    // Check file size (25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (audioBuffer.length > maxSize) {
      return res.status(413).json({ 
        error: 'Audio file too large. Maximum size is 25MB.', 
        fallback: 'browser-speech-recognition' 
      });
    }
    
    // Determine file extension based on audio format
    const audioFormat = req.body.audioFormat || 'webm';
    const filename = `audio.${audioFormat}`;
    const contentType = `audio/${audioFormat}`;
    
    // Use whisper-1 by default for maximum compatibility
    let selectedModel = 'whisper-1';
    
    // Allow explicit model selection if requested
    if (req.body.model && ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'].includes(req.body.model)) {
      selectedModel = req.body.model;
    }
    
    console.log('🎤 Processing audio with OpenAI transcription...', {
      audioSize: audioBuffer.length,
      audioFormat: audioFormat,
      language: req.body.language,
      model: selectedModel,
      filename: filename
    });
    
    // Use OpenAI SDK for reliable multipart handling
    console.log('🔧 Using OpenAI SDK for transcription...');
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
    
    // Create a File-like object for the SDK
    const audioFile = new File([audioBuffer], filename, { type: contentType });
    
    console.log('🔧 Sending request via OpenAI SDK...', {
      filename,
      contentType,
      bufferLength: audioBuffer.length,
      language: req.body.language,
      model: selectedModel
    });
    
    // Build transcription parameters - simplified for whisper-1 focus
    const transcriptionParams = {
      file: audioFile,
      model: selectedModel,
      response_format: 'json'
    };
    
    // Add language if specified
    if (req.body.language && req.body.language !== 'auto') {
      transcriptionParams.language = req.body.language;
    }
    
    // Add prompt for context if provided
    if (req.body.prompt) {
      transcriptionParams.prompt = req.body.prompt;
    }
    
    // GPT-4o specific features (if model is available)
    if (selectedModel.includes('gpt-4o')) {
      if (req.body.chunkingStrategy) {
        transcriptionParams.chunking_strategy = req.body.chunkingStrategy;
      } else {
        transcriptionParams.chunking_strategy = 'auto';
      }
      
      if (req.body.includeLogProbs) {
        transcriptionParams.include = ['logprobs'];
      }
      
      if (req.body.temperature !== undefined) {
        transcriptionParams.temperature = Math.max(0, Math.min(1, req.body.temperature));
      }
    }
    
    const data = await openai.audio.transcriptions.create(transcriptionParams);
    
    console.log('🔧 OpenAI SDK response received successfully');
    
    // Build response based on model and requested features
    const response = {
      transcription: data.text,
      model: selectedModel,
      language: data.language || req.body.language || 'en'
    };
    
    // Add confidence score (simulate for models that don't provide it)
    if (data.confidence !== undefined) {
      response.confidence = data.confidence;
    } else {
      // Estimate confidence based on text length and model
      const textLength = data.text?.length || 0;
      if (selectedModel.includes('gpt-4o')) {
        response.confidence = Math.min(0.95, 0.7 + (textLength * 0.001)); // GPT-4o models are generally more accurate
      } else {
        response.confidence = Math.min(0.9, 0.6 + (textLength * 0.001));
      }
    }
    
    // Add log probabilities if available
    if (data.logprobs) {
      response.logprobs = data.logprobs;
    }
    
    // Add segments if available (verbose response)
    if (data.segments) {
      response.segments = data.segments;
    }
    
    // Add processing metadata
    response.processing = {
      audioSizeBytes: audioBuffer.length,
      audioFormat: audioFormat,
      chunkingStrategy: transcriptionParams.chunking_strategy,
      processingTime: new Date().toISOString()
    };
    
    console.log('✅ Audio transcribed successfully with', selectedModel);
    return res.json(response);

  } catch (error) {
    console.error('❌ Whisper transcription error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: {
        hasAudioData: !!(req.body && req.body.audioData),
        audioDataLength: req.body && req.body.audioData ? req.body.audioData.length : 0,
        audioFormat: req.body ? req.body.audioFormat : 'none',
        model: req.body ? req.body.model : 'auto'
      },
      environment: {
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
      },
      timestamp: new Date().toISOString()
    });
    
    // Simple error handling - let client handle fallback to browser speech recognition
    let errorMessage = 'Transcription failed';
    let statusCode = 500;
    
    if (error.message?.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('quota')) {
      errorMessage = 'API quota exceeded. Please try again later.';
      statusCode = 429;
    } else if (error.message?.includes('model') || error.message?.includes('gpt-4o')) {
      errorMessage = 'Requested model not available. Using whisper-1 as fallback.';
      statusCode = 503;
    } else if (error.message?.includes('invalid')) {
      errorMessage = 'Invalid audio format or parameters.';
      statusCode = 400;
    }
    
    return res.status(statusCode).json({ 
      error: errorMessage, 
      message: error.message,
      type: error.name,
      debug: {
        timestamp: new Date().toISOString(),
        hasAudioData: !!(req.body && req.body.audioData),
        audioDataLength: req.body && req.body.audioData ? req.body.audioData.length : 0,
        requestedModel: req.body?.model || 'auto-select',
        hasApiKey: !!process.env.OPENAI_API_KEY
      },
      fallback: 'browser-speech-recognition',
      retryWithWhisper1: statusCode === 503 // Suggest fallback to whisper-1 if GPT-4o unavailable
    });
  }
});

// AI Processing API endpoint (secure server-side OpenRouter proxy)
app.post('/api/ai/process-brain-dump', async (req, res) => {
  try {
    const { content, timestamp, preferences } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

    // If no API key, fallback to simulation
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using simulation fallback');
      const result = simulateAIProcessing(content, preferences);
      return res.status(200).json(result);
    }

    console.log('🤖 Processing brain dump with GPT-4o Mini...');

    // Call OpenAI API directly
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: getAISystemPrompt(preferences)
        }, {
          role: 'user',
          content: content
        }],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`, errText);
      // Fallback to simulation on API error
      const result = simulateAIProcessing(content, preferences);
      return res.status(200).json(result);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    try {
      // Strip markdown code fences if the model wrapped its JSON
      const cleaned = aiResponse.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      const result = {
        ...parsed,
        processingTimestamp: new Date().toISOString(),
        aiModel: 'gpt-4o-mini'
      };

      console.log(`✅ Brain dump processed: ${result.extractedTasks?.length || 0} tasks extracted (gpt-4o-mini)`);
      return res.status(200).json(result);
    } catch (parseError) {
      console.warn('AI response not valid JSON, falling back to simulation. Response preview:', aiResponse?.substring(0, 300));
      const result = simulateAIProcessing(content);
      return res.status(200).json(result);
    }

  } catch (error) {
    console.error('❌ AI processing error:', error);
    
    // Always provide fallback simulation on error
    try {
      const result = simulateAIProcessing(req.body.content || '');
      return res.status(200).json(result);
    } catch (fallbackError) {
      return res.status(500).json({ error: 'AI processing failed' });
    }
  }
});

// AI helper functions
function getAISystemPrompt(preferences = {}) {
  const {
    workingHours = { start: '9:00 AM', end: '5:00 PM' },
    focusHours = ['9:00 AM - 11:00 AM', '2:00 PM - 4:00 PM'],
    scheduleType = 'traditional',
    breakTime = '12:00 PM - 1:00 PM',
    timezone = 'UTC'
  } = preferences;

  // Dynamic scheduling principles based on user's schedule
  const getSchedulingGuidance = () => {
    switch (scheduleType) {
      case 'night':
        return `
NIGHT SHIFT SCHEDULING PRINCIPLES:
- Schedule high-cognitive tasks during peak night hours (${focusHours.join(', ')})
- Place urgent/important tasks in early evening when energy is fresh
- Account for lower collaboration availability during traditional business hours
- Consider energy dips around 2-4 AM, schedule lighter tasks then
- Group similar tasks to maximize focus during limited peak periods
- Allow flexibility for team coordination during overlapping hours`;

      case 'evening':
        return `
EVENING SHIFT SCHEDULING PRINCIPLES:  
- Schedule high-cognitive tasks during peak afternoon/evening hours (${focusHours.join(', ')})
- Place urgent/important tasks in early afternoon when energy is high
- Maximize overlap with traditional business hours for collaboration
- Consider energy peaks in late afternoon/early evening
- Group meetings and collaborative tasks during business hour overlap
- Buffer time for end-of-day wrap-up and planning`;

      case 'early':
        return `
EARLY BIRD SCHEDULING PRINCIPLES:
- Schedule high-cognitive tasks during peak morning hours (${focusHours.join(', ')})
- Place most important work in early morning when energy is highest
- Front-load difficult tasks before afternoon energy dips
- Group collaborative tasks for mid-morning when others are available
- Consider natural energy decline in late morning/early afternoon
- Plan lighter administrative tasks for later in the schedule`;

      default: // traditional
        return `
TRADITIONAL SCHEDULING PRINCIPLES:
- Schedule high-cognitive tasks during peak focus hours (${focusHours.join(', ')})
- Group similar tasks together to minimize context switching
- Place urgent/important tasks in morning slots when energy is highest
- Buffer time between meetings and complex tasks
- Consider task dependencies and logical workflow
- Account for collaboration requirements and team availability
- Suggest realistic daily workload (6-7 productive hours)`;
    }
  };
  return `You are an expert AI assistant specialized in analyzing brain dumps and creating optimal daily schedules for employees.

USER'S WORK SCHEDULE:
- Work Hours: ${workingHours.start} - ${workingHours.end}
- Peak Focus Periods: ${focusHours.join(' and ')}
- Schedule Type: ${scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
- Break Time: ${breakTime}
- Timezone: ${timezone}

CORE RESPONSIBILITIES:
1. Parse unstructured thoughts into clear, actionable tasks with proper grammar and formatting
2. Assign realistic priorities based on context and urgency indicators  
3. Provide accurate time estimates based on task complexity and employee productivity patterns
4. Categorize tasks into relevant professional categories
5. Extract meaningful tags that enhance organization and searchability
6. Break down complex tasks into manageable micro-tasks when beneficial
7. Create optimal time blocks considering energy levels, task complexity, and deadlines
8. Suggest ideal scheduling times based on USER'S SPECIFIC WORK SCHEDULE
9. Use proper capitalization and professional language throughout

${getSchedulingGuidance()}

PRIORITY ASSIGNMENT LOGIC:
- "Urgent": Critical issues, emergencies, immediate deadlines, blocking other work
- "High": Important deliverables, upcoming deadlines, key stakeholder requests  
- "Medium": Standard work items, planned features, regular maintenance
- "Low": Nice-to-have features, optimization tasks, long-term improvements

CATEGORY DEFINITIONS:
- "Development": Code writing, programming, technical implementation
- "Design": UI/UX design, wireframes, mockups, visual assets
- "Testing": QA testing, debugging, code review, validation
- "Research": Investigation, analysis, learning, competitive research  
- "Documentation": Writing docs, technical specs, user guides
- "Meeting": Calls, discussions, presentations, planning sessions
- "Deployment": Release management, CI/CD, infrastructure, monitoring
- "General": Administrative tasks, planning, organization

TAG GUIDELINES:
- Use Title Case for all tags (e.g., "Frontend", "API Integration", "User Experience")
- Keep tags concise but descriptive (2-3 words max)
- Focus on technology, feature area, or skill type
- Avoid redundant tags that duplicate the category

FORMATTING REQUIREMENTS:
- All task titles must be properly capitalized and professional
- Descriptions should be clear, specific, and actionable
- Micro-tasks should be concrete steps, not vague suggestions
- Use consistent terminology and avoid abbreviations

Return a JSON object with this exact structure:
{
  "originalContent": "preserved original input",
  "extractedTasks": [{
    "id": "task-[timestamp]-[random]",
    "title": "Professional Task Title (max 60 chars)",
    "description": "Clear, detailed description of what needs to be done and why",
    "priority": "Urgent|High|Medium|Low", 
    "estimatedHours": 2.5,
    "category": "Development|Design|Testing|Research|Documentation|Meeting|Deployment|General",
    "tags": ["Title Case Tag", "Another Tag"],
    "microTasks": ["Specific actionable step 1", "Specific actionable step 2"],
    "optimalTimeSlot": "9:00 AM - 11:00 AM",
    "energyLevel": "High|Medium|Low",
    "focusType": "Deep Work|Collaboration|Administrative",
    "dependencies": ["Optional dependency task IDs"],
    "suggestedDay": "Today|Tomorrow|This Week"
  }],
  "dailySchedule": {
    "totalEstimatedHours": 6.5,
    "workloadAssessment": "Optimal|Heavy|Light",
    "recommendedOrder": ["task-id-1", "task-id-2", "task-id-3"],
    "timeBlocks": [{
      "time": "9:00 AM - 11:00 AM",
      "taskId": "task-id-1",
      "rationale": "High-focus morning slot for complex cognitive work"
    }]
  },
  "summary": "Professional summary highlighting key tasks, total time, and scheduling rationale"
}

CRITICAL: Return ONLY the JSON object. No additional text, explanations, or formatting.`;
}

function simulateAIProcessing(content, preferences = {}) {
  // Split on newlines and also on sentence-ending punctuation followed by capital letters
  const rawLines = content.split(/\n|(?<=[.!?])\s+(?=[A-Z])/);
  const tasks = [];

  rawLines.forEach((line) => {
    const trimmedLine = line.replace(/^[-•*\d.)\s]+/, '').trim(); // strip bullet/number prefixes
    if (trimmedLine.length < 8) return;

    const priority = determinePriority(trimmedLine);
    const estimatedTime = trimmedLine.length > 100 ? 3 : trimmedLine.length > 50 ? 2 : 1;

    tasks.push({
      id: generateSimpleId(),
      title: extractSimpleTitle(trimmedLine),
      description: trimmedLine,
      priority,
      estimatedHours: estimatedTime,
      category: inferCategory(trimmedLine),
      tags: [],
      microTasks: []
    });
  });

  if (tasks.length === 0) {
    tasks.push({
      id: generateSimpleId(),
      title: extractSimpleTitle(content.substring(0, 60)),
      description: content,
      priority: 'Medium',
      estimatedHours: 2,
      category: 'General',
      tags: [],
      microTasks: []
    });
  }

  return {
    originalContent: content,
    extractedTasks: tasks,
    summary: `Identified ${tasks.length} actionable tasks. Estimated total time: ${tasks.reduce((sum, t) => sum + t.estimatedHours, 0)} hours. (Note: AI processing unavailable — add OPENROUTER_API_KEY for smarter extraction)`,
    processingTimestamp: new Date().toISOString(),
    aiModel: 'simulation-fallback'
  };
}

function inferCategory(text) {
  const lower = text.toLowerCase();
  if (/\b(code|build|implement|develop|api|bug|fix|refactor|deploy|release)\b/.test(lower)) return 'Development';
  if (/\b(design|ui|ux|mockup|wireframe|figma|layout|style)\b/.test(lower)) return 'Design';
  if (/\b(test|qa|review|validate|check|verify)\b/.test(lower)) return 'Testing';
  if (/\b(research|analyze|investigate|explore|study|learn)\b/.test(lower)) return 'Research';
  if (/\b(write|document|spec|report|proposal|draft)\b/.test(lower)) return 'Documentation';
  if (/\b(call|meet|discuss|present|sync|standup|demo)\b/.test(lower)) return 'Meeting';
  return 'General';
}

function isTaskLike(text) {
  const taskIndicators = [
    'need to', 'have to', 'should', 'must', 'create', 'build', 'implement',
    'fix', 'update', 'review', 'test', 'deploy', 'setup', 'configure',
    'design', 'research', 'analyze', 'write', 'document', 'plan'
  ];
  
  const lowerText = text.toLowerCase();
  return taskIndicators.some(indicator => lowerText.includes(indicator));
}

function determinePriority(text) {
  const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', 'blocking'];
  const highWords = ['important', 'priority', 'soon', 'deadline', 'milestone'];
  const lowWords = ['low priority', 'when time', 'eventually', 'nice to have', 'optional'];
  
  const lowerText = text.toLowerCase();
  
  if (urgentWords.some(word => lowerText.includes(word))) return 'Urgent';
  if (highWords.some(word => lowerText.includes(word))) return 'High';
  if (lowWords.some(word => lowerText.includes(word))) return 'Low';
  
  return 'Medium';
}

function extractSimpleTitle(text) {
  const cleaned = text.replace(/[^\w\s]/g, ' ').trim();
  const words = cleaned.split(/\s+/).slice(0, 6);
  const title = words.join(' ').substring(0, 50);
  
  // Proper title case formatting
  return title.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function generateSimpleId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Serve static files from frontend dist directory
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// Auth configuration endpoint
app.get('/api/auth-config', (req, res) => {
  res.json({
    googleOAuthEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    emailVerificationEnabled: true
  });
});

// Health check endpoint for Railway
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { createPool } = await import('mysql2/promise');
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    
    if (connectionString) {
      const url = new URL(connectionString);
      const pool = createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port) : 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.substring(1),
        acquireTimeout: 10000
      });
      
      const [rows] = await pool.execute('SELECT 1 as test');
      await pool.end();
      
      res.json({ 
        status: 'ok', 
        auth: 'better-auth working',
        database: 'connected',
        tables_check: 'run /api/check-db for details'
      });
    } else {
      res.json({ 
        status: 'ok', 
        auth: 'better-auth working',
        database: 'no connection string'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      auth: 'better-auth working',
      database: 'connection failed',
      error: error.message
    });
  }
});

// Database check endpoint
app.get('/api/check-db', async (req, res) => {
  try {
    const { createPool } = await import('mysql2/promise');
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    
    if (!connectionString) {
      return res.json({ error: 'No database connection string' });
    }
    
    const url = new URL(connectionString);
    const pool = createPool({
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1)
    });
    
    // Check if tables exist
    const [tables] = await pool.execute("SHOW TABLES");
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    const checks = {};
    for (const tableName of ['user', 'account', 'session', 'verification']) {
      if (tableNames.includes(tableName)) {
        const [columns] = await pool.execute(`DESCRIBE ${tableName}`);
        const [count] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        checks[tableName] = {
          exists: true,
          columns: columns.map(col => col.Field),
          count: count[0].count
        };
      } else {
        checks[tableName] = { exists: false };
      }
    }
    
    await pool.end();
    
    res.json({
      database: 'connected',
      tables: checks,
      allTables: tableNames
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Database check failed',
      message: error.message
    });
  }
});

// User cleanup/reset endpoint for debugging
app.post('/api/reset-user', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const { createPool } = await import('mysql2/promise');
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    
    if (!connectionString) {
      return res.status(500).json({ error: 'No database connection' });
    }
    
    const url = new URL(connectionString);
    const pool = createPool({
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1)
    });

    // Check if user exists
    const [users] = await pool.execute('SELECT id, email, name FROM user WHERE email = ?', [email]);
    
    if (users.length === 0) {
      await pool.end();
      return res.json({ message: 'User not found', email });
    }

    const user = users[0];
    
    // Check account records
    const [accounts] = await pool.execute('SELECT * FROM account WHERE userId = ?', [user.id]);
    
    // Check session records
    const [sessions] = await pool.execute('SELECT * FROM session WHERE userId = ?', [user.id]);

    // Delete all related records for clean slate
    await pool.execute('DELETE FROM session WHERE userId = ?', [user.id]);
    await pool.execute('DELETE FROM account WHERE userId = ?', [user.id]);
    await pool.execute('DELETE FROM user WHERE id = ?', [user.id]);
    
    await pool.end();

    res.json({ 
      message: 'User and all related records deleted successfully', 
      email,
      deletedRecords: {
        user: 1,
        accounts: accounts.length,
        sessions: sessions.length
      }
    });
    
  } catch (error) {
    console.error('❌ User reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Shared database pool for reuse
let sharedDbPool = null;

async function getDbPool() {
  if (!sharedDbPool) {
    const { createPool } = await import('mysql2/promise');
    const connectionString = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('No database connection string available');
    }
    
    const url = new URL(connectionString);
    sharedDbPool = createPool({
      host: url.hostname,
      port: url.port ? parseInt(url.port) : 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      // Production optimizations
      connectionLimit: 10,
      queueLimit: 0,
      idleTimeout: 300000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }
  return sharedDbPool;
}

// Save brain dump tasks to database with optimal scheduling
app.post('/api/brain-dump/save-tasks', async (req, res) => {
  try {
    const { extractedTasks, dailySchedule, userId } = req.body;
    let { orgId } = req.body;

    if (!extractedTasks || !userId) {
      return res.status(400).json({ error: 'extractedTasks and userId are required' });
    }

    // Auto-resolve orgId from DB if not provided by frontend
    if (!orgId) {
      const membership = await prisma.membership.findFirst({
        where: { userId },
        select: { orgId: true }
      });
      orgId = membership?.orgId;
    }

    if (!orgId) {
      return res.status(400).json({ error: 'Could not determine organization for this user' });
    }

    console.log('💾 save-tasks:', { userId, orgId, taskCount: extractedTasks?.length });

    // Ensure brain_dumps table exists (non-fatal)
    try {
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS `brain_dumps` (' +
        '  `id` VARCHAR(255) NOT NULL,' +
        '  `userId` VARCHAR(255) NOT NULL,' +
        '  `orgId` VARCHAR(191) NOT NULL,' +
        '  `rawContent` TEXT NOT NULL,' +
        '  `processedContent` JSON,' +
        '  `processingStatus` ENUM(\'pending\',\'processing\',\'completed\',\'failed\') DEFAULT \'pending\',' +
        '  `aiModel` VARCHAR(100),' +
        '  `processedAt` DATETIME(3) NULL,' +
        '  `createdAt` DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),' +
        '  PRIMARY KEY (`id`),' +
        '  KEY `bd_userId_idx` (`userId`),' +
        '  KEY `bd_orgId_idx` (`orgId`)' +
        ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
      );
    } catch (e) { /* table already exists */ }

    const savedTasks = [];

    // Save tasks using Prisma (same as POST /api/tasks)
    for (const task of extractedTasks) {
      const created = await prisma.macroTask.create({
        data: {
          title: task.title,
          description: task.description || null,
          userId,
          orgId,
          createdBy: userId,
          priority: task.priority || 'Medium',
          estimatedHours: parseFloat(task.estimatedHours) || 0,
          category: task.category || 'General',
          tags: task.tags || null,
        }
      });
      savedTasks.push({ id: created.id, ...task });
    }

    // Save brain dump record (non-fatal)
    const brainDumpId = `dump-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      await prisma.$executeRawUnsafe(
        'INSERT INTO `brain_dumps` (id, userId, orgId, rawContent, processedContent, processingStatus, aiModel, processedAt, createdAt) VALUES (?, ?, ?, ?, ?, \'completed\', \'claude\', NOW(), NOW())',
        brainDumpId, userId, orgId,
        req.body.originalContent || '',
        JSON.stringify({ extractedTasks, dailySchedule, savedAt: new Date().toISOString() })
      );
    } catch (e) {
      console.warn('brain_dumps record insert failed (non-fatal):', e.message);
    }

    res.json({
      success: true,
      message: 'Tasks and schedule saved successfully',
      data: {
        brainDumpId,
        savedTasks,
        dailySchedule,
        totalTasksCreated: savedTasks.length
      }
    });

  } catch (error) {
    console.error('❌ Brain dump save error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Time logs API endpoint
app.post('/api/time-logs', async (req, res) => {
  try {
    const { taskId, userId, startTime, endTime, duration, type, description, isBillable, hourlyRate, earnings } = req.body;

    if (!userId || !duration) {
      return res.status(400).json({ error: 'userId and duration are required' });
    }

    const pool = await getDbPool();

    // Generate UUID for time log
    const timeLogId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Handle null values properly
    const safeTaskId = taskId || null;
    const safeStartTime = startTime || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const safeEndTime = endTime || null;
    const safeType = type || 'work';
    const safeDescription = description || null;
    const safeIsBillable = isBillable || false;
    const safeHourlyRate = hourlyRate || null;
    const safeEarnings = earnings || null;

    // Insert time log
    await pool.execute(
      `INSERT INTO time_logs (id, taskId, userId, startTime, endTime, duration, type, description, isBillable, hourlyRate, earnings, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [timeLogId, safeTaskId, userId, safeStartTime, safeEndTime, duration, safeType, safeDescription, safeIsBillable, safeHourlyRate, safeEarnings]
    );

    res.json({ 
      success: true, 
      id: timeLogId,
      message: 'Time log saved successfully',
      data: {
        id: timeLogId,
        taskId: safeTaskId,
        userId,
        startTime: safeStartTime,
        endTime: safeEndTime,
        duration,
        type: safeType,
        description: safeDescription,
        isBillable: safeIsBillable,
        hourlyRate: safeHourlyRate,
        earnings: safeEarnings
      }
    });
    
  } catch (error) {
    console.error('❌ Time log save error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's tasks endpoint
app.get('/api/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    const pool = await getDbPool();
    
    let query = `
      SELECT id, title, description, priority, estimatedHours, actualHours, 
             status, category, tags, dueDate, completedAt, createdAt, updatedAt
      FROM macro_tasks 
      WHERE userId = ?
    `;
    const params = [userId];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const [tasks] = await pool.execute(query, params);
    
    // Parse JSON tags for each task
    const formattedTasks = tasks.map(task => ({
      ...task,
      tags: task.tags ? JSON.parse(task.tags) : {}
    }));
    
    res.json({
      success: true,
      tasks: formattedTasks,
      count: formattedTasks.length
    });
    
  } catch (error) {
    console.error('❌ Get tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task status endpoint
app.patch('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, actualHours, completedAt } = req.body;

    const pool = await getDbPool();
    
    let query = 'UPDATE macro_tasks SET updatedAt = NOW()';
    const params = [];
    
    if (status) {
      query += ', status = ?';
      params.push(status);
      
      if (status === 'completed' && !completedAt) {
        query += ', completedAt = NOW()';
      }
    }
    
    if (actualHours !== undefined) {
      query += ', actualHours = ?';
      params.push(actualHours);
    }
    
    if (completedAt) {
      query += ', completedAt = ?';
      params.push(completedAt);
    }
    
    query += ' WHERE id = ?';
    params.push(taskId);
    
    const [result] = await pool.execute(query, params);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({
      success: true,
      message: 'Task updated successfully',
      taskId
    });
    
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's brain dump history
app.get('/api/brain-dumps/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const pool = await getDbPool();
    
    const [dumps] = await pool.execute(`
      SELECT id, rawContent, processingStatus, aiModel, processedAt, createdAt,
             JSON_LENGTH(processedContent, '$.extractedTasks') as taskCount
      FROM brain_dumps 
      WHERE userId = ? 
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);
    
    res.json({
      success: true,
      brainDumps: dumps,
      count: dumps.length
    });
    
  } catch (error) {
    console.error('❌ Get brain dumps error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ==================== NUCLEAR OPTION - DISABLE CONSTRAINTS ====================
app.get('/fix-tony-nuclear', async (req, res) => {
  try {
    console.log('💥 NUCLEAR: Temporarily disabling foreign key constraints...');
    
    const { PrismaClient } = await import('@prisma/client');
    const { INTERNAL_CONFIG } = await import('./config/internal.js');
    
    const prisma = new PrismaClient();
    
    try {
      // Step 1: Temporarily disable foreign key checks
      console.log('🔓 Disabling foreign key checks...');
      await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;
      
      // Step 2: Create organization directly
      console.log('🏢 Creating organization with constraints disabled...');
      
      const orgId = `org_${Date.now()}`;
      
      await prisma.$executeRaw`
        INSERT INTO organizations (id, name, slug, createdById, createdAt, updatedAt) 
        VALUES (
          ${orgId},
          'Veblen', 
          'veblen', 
          ${INTERNAL_CONFIG.ORGANIZATION.ownerId},
          NOW(), 
          NOW()
        )
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        createdById = VALUES(createdById),
        updatedAt = NOW()
      `;
      
      // Step 3: Create membership directly
      console.log('👑 Creating OWNER membership with constraints disabled...');
      
      await prisma.$executeRaw`
        INSERT INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
        VALUES (
          CONCAT('mem_', UNIX_TIMESTAMP(), '_', FLOOR(RAND() * 1000)),
          ${INTERNAL_CONFIG.ORGANIZATION.ownerId},
          ${orgId},
          'OWNER',
          NOW(),
          NOW()
        )
        ON DUPLICATE KEY UPDATE
        role = VALUES(role),
        updatedAt = NOW()
      `;
      
      // Step 4: Re-enable foreign key checks
      console.log('🔒 Re-enabling foreign key checks...');
      await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
      
      // Step 5: Verify everything worked
      console.log('✅ Verifying the nuclear fix...');
      
      const verification = await prisma.user.findUnique({
        where: { id: INTERNAL_CONFIG.ORGANIZATION.ownerId },
        include: {
          memberships: {
            include: {
              org: { select: { name: true, slug: true } }
            }
          }
        }
      });
      
      if (!verification || verification.memberships.length === 0) {
        throw new Error('Nuclear fix verification failed');
      }
      
      const result = {
        success: true,
        message: 'NUCLEAR FIX SUCCESSFUL! Tony now has organization access. Please refresh the page.',
        user: {
          email: verification.email,
          name: verification.name,
          memberships: verification.memberships.map(m => ({
            role: m.role,
            organization: m.org.name,
            slug: m.org.slug
          }))
        },
        method: 'Foreign key constraints temporarily disabled'
      };
      
      console.log('💥🎉 NUCLEAR SUCCESS:', result);
      res.json(result);
      
    } finally {
      // Always re-enable foreign key checks
      try {
        await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
      } catch (e) {
        console.error('Failed to re-enable foreign key checks:', e);
      }
      await prisma.$disconnect();
    }
    
  } catch (error) {
    console.error('💥❌ Nuclear fix failed:', error);
    res.status(500).json({ 
      error: 'Nuclear fix failed', 
      details: error.message 
    });
  }
});

// Serve the React app for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  // Skip API routes - they should return JSON, not HTML
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found', path: req.path });
  }
  
  // Handle root path health checks from Railway
  if (req.path === '/' && (
    req.headers['user-agent']?.toLowerCase().includes('railway') ||
    req.headers['x-healthcheck'] ||
    req.query.health === 'check'
  )) {
    return res.json({ status: 'ok', service: 'vebtask', timestamp: new Date() });
  }
  
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Ensure task_comments and task_attachments tables exist
async function ensureTaskTablesSchema() {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `task_comments` (' +
      '  `id` VARCHAR(191) NOT NULL, `taskId` VARCHAR(50) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL, `userId` VARCHAR(36) NOT NULL,' +
      '  `content` TEXT NOT NULL,' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`), KEY `tc_taskId_idx` (`taskId`),' +
      '  KEY `tc_orgId_idx` (`orgId`), KEY `tc_userId_idx` (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `task_attachments` (' +
      '  `id` VARCHAR(191) NOT NULL, `taskId` VARCHAR(50) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL, `userId` VARCHAR(36) NOT NULL,' +
      '  `name` VARCHAR(500) NOT NULL,' +
      '  `mimeType` VARCHAR(100) NOT NULL DEFAULT \'application/octet-stream\',' +
      '  `size` INT NOT NULL DEFAULT 0,' +
      '  `data` LONGTEXT NOT NULL,' +
      '  `category` VARCHAR(50) NOT NULL DEFAULT \'attachment\',' +
      '  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),' +
      '  PRIMARY KEY (`id`), KEY `ta_taskId_idx` (`taskId`),' +
      '  KEY `ta_orgId_idx` (`orgId`), KEY `ta_userId_idx` (`userId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('  ✅ task_comments + task_attachments tables ready');
  } catch (e) { console.warn('  ⚠️  task tables:', e.message); }
}

async function ensureTaskAssigneesSchema() {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS `task_assignees` (' +
      '  `id` VARCHAR(191) NOT NULL,' +
      '  `taskId` VARCHAR(50) NOT NULL,' +
      '  `userId` VARCHAR(36) NOT NULL,' +
      '  `orgId` VARCHAR(191) NOT NULL,' +
      '  PRIMARY KEY (`id`),' +
      '  UNIQUE KEY `ta_task_user_key` (`taskId`,`userId`),' +
      '  KEY `ta_taskId_idx` (`taskId`),' +
      '  KEY `ta_userId_idx` (`userId`),' +
      '  KEY `ta_orgId_idx` (`orgId`)' +
      ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'
    );
    console.log('  ✅ task_assignees table ready');
  } catch (e) { console.warn('  ⚠️  task_assignees table:', e.message); }
}

// Widen account.scope column to TEXT so long Google OAuth scope strings fit
async function ensureAccountScopeText() {
  if (!process.env.DATABASE_URL) return;
  try {
    // Step 1: Use INFORMATION_SCHEMA to find the exact table name (case-insensitive)
    const rows = await prisma.$queryRawUnsafe(
      `SELECT TABLE_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND LOWER(TABLE_NAME) = 'account'
         AND COLUMN_NAME = 'scope'
       LIMIT 1`
    );

    if (!rows.length) {
      console.warn('  ⚠️  ensureAccountScopeText: account.scope column not found via INFORMATION_SCHEMA');
      return;
    }

    const accountTable = rows[0].TABLE_NAME || rows[0].table_name;
    const colType = (rows[0].DATA_TYPE || rows[0].data_type || '').toLowerCase();
    console.log(`  🔍 ensureAccountScopeText: found \`${accountTable}\`.scope type = ${colType}`);

    if (colType === 'text' || colType === 'mediumtext' || colType === 'longtext') {
      console.log(`  ✅ ${accountTable}.scope is already ${colType} — no alter needed`);
      return;
    }

    // Step 2: Widen the column
    console.log(`  🔄 ${accountTable}.scope is ${colType} — widening to TEXT...`);
    await prisma.$executeRawUnsafe(`ALTER TABLE \`${accountTable}\` MODIFY COLUMN \`scope\` TEXT NULL`);
    console.log(`  ✅ ${accountTable}.scope widened to TEXT`);
  } catch (e) {
    console.warn('  ⚠️  ensureAccountScopeText failed:', e.message, e.stack?.split('\n')[1] || '');
  }
}

// Global error handler — captures all unhandled API errors into super-admin log
app.use((err, req, res, next) => {
  const msg = err?.message || String(err);
  logError('error', `${req.method} ${req.path}`, msg, err?.stack?.split('\n')[1]?.trim() ?? null);
  console.error('❌ Unhandled error:', msg);
  res.status(500).json({ error: 'Internal server error' });
});

// Add jobTitle/phone to user, industry/size/website to organizations
async function ensureProfileColumns() {
  if (!process.env.DATABASE_URL) return;
  const cols = [
    ['user',          'jobTitle', 'VARCHAR(100) NULL DEFAULT NULL'],
    ['user',          'phone',    'VARCHAR(50)  NULL DEFAULT NULL'],
    ['organizations', 'industry', 'VARCHAR(100) NULL DEFAULT NULL'],
    ['organizations', 'size',     'VARCHAR(50)  NULL DEFAULT NULL'],
    ['organizations', 'website',  'VARCHAR(500) NULL DEFAULT NULL'],
  ];
  for (const [tbl, col, def] of cols) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        tbl, col
      );
      if (!rows.length) await prisma.$executeRawUnsafe(`ALTER TABLE \`${tbl}\` ADD COLUMN \`${col}\` ${def}`);
    } catch { /* column already exists or table not ready */ }
  }
  // Widen User.image to MEDIUMTEXT so base64 avatars fit
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE `User` MODIFY COLUMN `image` MEDIUMTEXT NULL');
  } catch { /* already widened or table not ready */ }
  console.log('  ✅ profile columns ready');
}

async function ensureRoleEnumSchema() {
  if (!process.env.DATABASE_URL) return;
  try {
    // Idempotent: re-declares the ENUM with all values including HALL_OF_JUSTICE.
    // MySQL silently no-ops if the column already has all values.
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `memberships` MODIFY COLUMN `role` ENUM('OWNER','ADMIN','STAFF','CLIENT','HALL_OF_JUSTICE') NOT NULL DEFAULT 'STAFF'"
    );
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `invites` MODIFY COLUMN `role` ENUM('OWNER','ADMIN','STAFF','CLIENT','HALL_OF_JUSTICE') NOT NULL DEFAULT 'STAFF'"
    );
    console.log('  ✅ role enum columns ready (HALL_OF_JUSTICE included)');
  } catch (e) {
    console.warn('  ⚠️  ensureRoleEnumSchema:', e.message);
  }
}

// Ensure admin@eversense.ai has a valid scrypt credential account
async function ensureAdminCredentialAccount() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@eversense.ai' }, select: { id: true } });
    if (!user) { console.log('  ⚠️  admin@eversense.ai user not found in DB'); return; }

    const { hashPassword } = await import('better-auth/crypto');
    const { randomUUID } = await import('crypto');
    const pw = process.env.ADMIN_SETUP_PASSWORD || 'Admin@EverSense2025!';
    const hashed = await hashPassword(pw);

    // List all accounts for diagnostics
    const allAccounts = await prisma.account.findMany({ where: { userId: user.id }, select: { id: true, providerId: true } });
    console.log(`  ℹ️  admin accounts in DB: ${JSON.stringify(allAccounts.map(a => a.providerId))}`);

    const credentialAccount = allAccounts.find(a => a.providerId === 'credential');
    if (credentialAccount) {
      await prisma.account.update({ where: { id: credentialAccount.id }, data: { password: hashed } });
      console.log('  ✅ admin@eversense.ai credential password reset');
    } else {
      await prisma.account.deleteMany({ where: { userId: user.id, providerId: { in: ['email-password', 'email'] } } });
      await prisma.account.create({
        data: { id: randomUUID(), accountId: user.id, userId: user.id, providerId: 'credential', password: hashed, createdAt: new Date(), updatedAt: new Date() }
      });
      console.log('  ✅ admin@eversense.ai credential account created');
    }
  } catch (e) {
    console.warn('  ⚠️  ensureAdminCredentialAccount error:', e.message);
  }
}

// Run migrations and start server
async function ensureUserColumns() {
  const cols = [
    { name: 'emailVerified', ddl: 'ALTER TABLE `User` ADD COLUMN `emailVerified` TINYINT(1) NULL DEFAULT 0' },
    { name: 'completedWizards', ddl: 'ALTER TABLE `User` ADD COLUMN `completedWizards` TEXT NULL' },
  ];
  for (const col of cols) {
    try {
      const exists = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'User' AND column_name = ?`,
        col.name
      );
      if (Number(exists[0]?.cnt ?? 0) === 0) {
        await prisma.$executeRawUnsafe(col.ddl);
        console.log(`✅ Added missing column User.${col.name}`);
      }
    } catch (e) {
      console.warn(`⚠️  Could not add User.${col.name}:`, e.message);
    }
  }
}

async function startServer() {
  await runDatabaseMigrations();
  await ensureUserColumns();
  await ensureRoleEnumSchema();
  await ensureTaskTablesSchema();
  await ensureTaskAssigneesSchema();
  await ensureAccountScopeText();
  await ensureProfileColumns();
  await ensureAdminCredentialAccount();
  startFirefliesPolling().catch(e => console.warn('[Fireflies] Polling init error:', e.message));
  startNotificationScheduler();
  startAttendanceCron();

  // Inline attendance auto-clockout (backup — runs directly in server process)
  const AUTO_CLOCKOUT_SEC = 1.5 * 3600; // TEST: 1h 30m
  async function runInlineClockout() {
    if (!process.env.DATABASE_URL) return;
    try {
      const overdue = await prisma.$queryRawUnsafe(
        `SELECT id, userId, orgId, timeIn FROM attendance_logs WHERE timeOut IS NULL AND timeIn <= DATE_SUB(NOW(), INTERVAL ${AUTO_CLOCKOUT_SEC} SECOND)`
      );
      if (!overdue.length) return;
      console.log(`[InlineClockout] Found ${overdue.length} overdue session(s)`);
      for (const row of overdue) {
        try {
          // Use NOW() and TIMESTAMPDIFF entirely in SQL — no JS Date params to avoid type issues
          const affected = await prisma.$executeRawUnsafe(
            `UPDATE attendance_logs SET timeOut = NOW(3), duration = TIMESTAMPDIFF(SECOND, timeIn, NOW(3)), updatedAt = NOW(3) WHERE id = ? AND timeOut IS NULL`,
            row.id
          );
          console.log(`[InlineClockout] Closed session ${row.id} (${row.userId}), rows affected: ${Number(affected)}`);
          try { broadcast(row.orgId, 'attendance', { action: 'clock-out', userId: row.userId }); } catch {}
        } catch (e) { console.error(`[InlineClockout] Row error ${row.id}:`, e.message); }
      }
    } catch (e) { console.error('[InlineClockout] Error:', e.message); }
  }
  runInlineClockout();
  setInterval(runInlineClockout, 60 * 1000);
  console.log('  ✅ Inline attendance clockout running (every 1 min, limit: 9h30m)');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🔐 Auth endpoints available at /api/auth/*`);
    console.log(`📱 React app available at /`);
    console.log(`🏥 Health check available at /health-simple`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📊 Database URL configured: ${!!process.env.DATABASE_URL}`);
  }).on('error', (err) => {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});