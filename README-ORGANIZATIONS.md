# VebTask Multi-Tenant Organization System

This document covers the multi-tenant, organization-based system implementation for VebTask with role-based access control (RBAC), email invites, Google OAuth, and Better Auth integration.

## 🏗 Architecture Overview

### Core Concepts

- **Organizations**: Multi-tenant containers where all business data is scoped
- **Users**: Can belong to multiple organizations with different roles  
- **Memberships**: Link users to organizations with specific roles
- **Roles**: `OWNER` > `ADMIN` > `STAFF` > `CLIENT` (hierarchical permissions)
- **Invites**: Email-based onboarding system for new members

### Tech Stack

- **Database**: Prisma + MySQL with full-text search
- **Authentication**: Better Auth with Google OAuth + email/password
- **Authorization**: Custom RBAC middleware with role hierarchy
- **Email**: Nodemailer with SMTP + HTML templates
- **API**: Express REST with comprehensive validation

## 🚀 Setup Instructions

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="mysql://user:password@host:port/database"

# Application URLs
VITE_APP_URL="http://localhost:5173"
BETTER_AUTH_URL="http://localhost:3001"

# Better Auth
BETTER_AUTH_SECRET="your-super-secret-jwt-key-32-chars-minimum"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="VebTask <noreply@yourdomain.com>"

# Environment
NODE_ENV="development"
```

### 2. Database Setup

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Backfill existing data (creates orgs for existing users)
npm run db:seed
```

### 3. Start Development Server

```bash
# Start the backend server
npm start

# In another terminal, start the frontend
npm run dev
```

## 📊 Database Schema

### Core Tables

- `User` - User accounts (managed by Better Auth)
- `Organization` - Tenant containers with unique slugs
- `Membership` - User-Organization relationships with roles
- `Invite` - Email invitation system with tokens
- `Account`, `Session`, `VerificationToken` - Better Auth tables

### Business Tables (Org-scoped)

All business data includes `orgId` for tenant isolation:

- `BrainDump` - AI-processed thought dumps
- `MacroTask` - Task management with priorities
- `TimeLog` - Time tracking with billing
- `CalendarEvent` - Calendar scheduling with recurrence

## 🔐 Authentication & Authorization

### Better Auth Integration

```javascript
// Google OAuth + Email/Password
providers: [
  google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  })
]

// Session with JWT
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
  cookieName: "vebtask.session"
}
```

### RBAC Middleware

```javascript
import { requireAuth, withOrgScope, requireRole } from '../lib/rbac.js';

// Require authentication
router.use(requireAuth);

// Add organization context
router.use(withOrgScope);

// Require specific role
router.get('/admin-only', requireRole('ADMIN'), handler);
```

### Role Permissions

| Action | OWNER | ADMIN | STAFF | CLIENT |
|--------|-------|-------|-------|--------|
| Manage organization | ✅ | ✅* | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Assign roles | ✅ | ✅** | ❌ | ❌ |
| View all data | ✅ | ✅ | ✅*** | ✅**** |
| Edit data | ✅ | ✅ | ✅*** | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ | ❌ |

*Cannot delete org or transfer ownership  
**Cannot assign OWNER role  
***Limited scope/permissions  
****Read-only access  

## 📧 Email System

### Email Templates

All emails use responsive HTML templates with:

- **Invite emails**: Welcome new members with role context
- **Password reset**: Secure token-based reset flow  
- **Welcome emails**: Onboarding after invite acceptance

### SMTP Configuration

```javascript
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
```

## 🛠 API Endpoints

### Organizations

```
GET    /api/organizations              # List user's orgs
POST   /api/organizations              # Create new org
GET    /api/organizations/:orgId       # Get org details  
PATCH  /api/organizations/:orgId       # Update org
DELETE /api/organizations/:orgId       # Delete org
POST   /api/organizations/:orgId/transfer-ownership
POST   /api/organizations/:orgId/switch # Switch active org
```

### Members

```
GET    /api/organizations/:orgId/members           # List members
GET    /api/organizations/:orgId/members/:id       # Member details
PATCH  /api/organizations/:orgId/members/:id       # Update role
DELETE /api/organizations/:orgId/members/:id       # Remove member
POST   /api/organizations/:orgId/leave             # Leave org
```

### Invites

```
GET    /api/organizations/:orgId/invites           # List invites
POST   /api/organizations/:orgId/invites           # Send invite
DELETE /api/organizations/:orgId/invites/:id       # Revoke invite
POST   /api/organizations/:orgId/invites/:id/resend # Resend invite

GET    /api/invites/:token/details                 # Preview invite
POST   /api/invites/accept                         # Accept invite
```

### Auth

```
POST   /api/auth/forgot-password      # Request reset
POST   /api/auth/verify-reset-token   # Verify token  
POST   /api/auth/reset-password       # Reset password
GET    /api/auth/me                   # User profile
PATCH  /api/auth/profile              # Update profile
POST   /api/auth/switch-org           # Switch active org
```

## 🔄 Data Migration

### Backfill Script

The backfill script (`scripts/backfill-orgs.js`) handles:

1. **User Migration**: Creates default org for each existing user
2. **Data Migration**: Adds `orgId` to all existing business records
3. **Membership Creation**: Makes users OWNERS of their personal orgs
4. **Verification**: Ensures all data is properly migrated

```bash
# Run backfill (safe to run multiple times)
npm run db:seed

# Manual execution with logging
node scripts/backfill-orgs.js
```

### Migration Strategy

```javascript
// Create org for each user
const org = await prisma.organization.create({
  data: {
    name: `${user.name}'s Organization`,
    slug: generateSlug(user.name),
    createdById: user.id
  }
});

// Create OWNER membership
await prisma.membership.create({
  data: {
    userId: user.id,
    orgId: org.id, 
    role: 'OWNER'
  }
});

// Migrate all user's data
await prisma.macroTask.updateMany({
  where: { userId: user.id },
  data: { orgId: org.id }
});
```

## 🎨 Frontend Integration

### Organization Context

```typescript
// React context for active organization
const [activeOrg, setActiveOrg] = useState<Organization>();

// API calls with org header
const headers = {
  'X-Org-Id': activeOrg?.id,
  'Authorization': `Bearer ${token}`
};
```

### Org Switcher Component

```tsx
<OrgSwitcher 
  organizations={userOrgs}
  activeOrg={activeOrg}
  onSwitch={setActiveOrg}
/>
```

## 🧪 Testing

### Role-Based Tests

```javascript
describe('RBAC', () => {
  test('ADMIN cannot assign OWNER role', async () => {
    const response = await request(app)
      .patch(`/api/organizations/${orgId}/members/${memberId}`)
      .set('X-Org-Id', orgId)
      .send({ role: 'OWNER' })
      .expect(403);
  });
});
```

### Invite Flow Tests

```javascript
describe('Invites', () => {
  test('Invite expires after 7 days', async () => {
    // Create invite, fast-forward time, test expiry
  });
  
  test('Cannot accept invite for different email', async () => {
    // Test email mismatch protection
  });
});
```

## 🚀 Deployment

### Railway Setup

```bash
# Set environment variables in Railway dashboard
DATABASE_URL=mysql://...
SMTP_HOST=...
GOOGLE_CLIENT_ID=...

# Deploy
railway up
```

### Production Checklist

- [ ] Set strong `BETTER_AUTH_SECRET` (32+ chars)
- [ ] Configure production SMTP credentials  
- [ ] Set up Google OAuth with production domains
- [ ] Run database migrations: `npm run db:deploy`
- [ ] Execute backfill script: `npm run db:seed`
- [ ] Test email delivery and invite flow
- [ ] Verify RBAC permissions across roles

## 🔧 Development

### Adding New Org-Scoped Data

1. **Add `orgId` to Prisma model**:

```prisma
model NewFeature {
  id    String @id
  orgId String @db.VarChar(191)
  
  org Organization @relation(fields: [orgId], references: [id])
  
  @@index([orgId])
}
```

2. **Use RBAC middleware in routes**:

```javascript
router.get('/', requireAuth, withOrgScope, requireRole('STAFF'), async (req, res) => {
  const data = await prisma.newFeature.findMany({
    where: { orgId: req.orgId }
  });
});
```

3. **Update backfill script** to migrate existing data.

### Custom Roles

To add new roles, update the `Role` enum in Prisma:

```prisma
enum Role {
  OWNER
  ADMIN  
  MANAGER  // New role
  STAFF
  CLIENT
}
```

Then update `RoleOrder` in `rbac.js`:

```javascript
export const RoleOrder = {
  OWNER: 5,
  ADMIN: 4,
  MANAGER: 3,  // New role
  STAFF: 2,
  CLIENT: 1
};
```

## 📋 Troubleshooting

### Common Issues

1. **"Missing org context"**: Ensure `X-Org-Id` header is set
2. **"Not a member"**: User needs to be invited to organization  
3. **Email not sending**: Check SMTP credentials and configuration
4. **Role assignment fails**: Verify role hierarchy permissions
5. **Migration issues**: Run backfill script with proper database access

### Debug Commands

```bash
# Check database state
npm run db:studio

# Verify backfill results  
node -e "import('./scripts/backfill-orgs.js').then(m => m.verifyBackfill())"

# Test email configuration
node -e "import('./src/lib/mailer.js').then(m => m.testEmailConfig())"
```

## 📈 Monitoring & Analytics

### Key Metrics

- Organization count and growth
- Member invitations sent/accepted  
- Role distribution across organizations
- Failed authentication attempts
- Email delivery rates

### Logging

All auth and RBAC operations are logged with:

- User ID and email
- Organization context  
- Action attempted
- Success/failure status
- Timestamp and IP address

---

## 🎯 Next Steps

1. **Mobile App**: Extend org context to mobile clients
2. **Advanced Permissions**: Granular permissions beyond roles
3. **Audit Logging**: Detailed activity tracking
4. **SSO Integration**: SAML/LDAP for enterprise clients  
5. **Billing**: Per-organization subscription management
6. **API Keys**: Organization-scoped API access tokens

For questions or issues, please check the troubleshooting section or create an issue in the repository.