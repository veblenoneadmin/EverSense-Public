# Demo Data Setup

This project includes comprehensive mock data for demonstration purposes, including both general demo accounts and the actual Veblen organization data.

## Demo Accounts

The following demo accounts are available:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Admin | `admin@demo.com` | `demo123` | Full system administrator |
| Manager | `manager@demo.com` | `demo123` | Project manager with staff privileges |
| Developer | `developer@demo.com` | `demo123` | Development team member |
| Client | `client@demo.com` | `demo123` | External client user |

## Veblen Organization Accounts

The Veblen team accounts (representing the actual company):

| Role | Email | Password | Name | Title |
|------|-------|----------|------|-------|
| Owner | `founder@veblen.com` | `veblen2024` | Jordan Veblen | Founder & CEO |
| Admin | `sarah@veblen.com` | `veblen2024` | Sarah Mitchell | Head of Operations |
| Admin | `alex@veblen.com` | `veblen2024` | Alex Rodriguez | Lead Developer |
| Staff | `emma@veblen.com` | `veblen2024` | Emma Thompson | Senior Product Designer |
| Staff | `marcus@veblen.com` | `veblen2024` | Marcus Chen | Full-Stack Developer |
| Staff | `lisa@veblen.com` | `veblen2024` | Lisa Park | Project Manager |
| Staff | `david@veblen.com` | `veblen2024` | David Johnson | DevOps Engineer |
| Staff | `rachel@veblen.com` | `veblen2024` | Rachel Kim | UX Researcher |

## Demo Data Includes

### Organizations
- **Demo Agency** - A sample consulting/development agency
- **Veblen** - The actual Veblen company with real team structure and projects

### Clients
**Demo Agency (3 clients):**
- **TechCorp Inc** - High-priority technology client ($125/hr)
- **GreenLeaf Solutions** - Environmental consulting client ($95/hr)  
- **Retail Plus** - Retail industry prospect ($85/hr)

**Veblen (6 enterprise clients):**
- **InnovateTech Solutions** - AI/ML enterprise client ($185/hr)
- **GreenFuture Corp** - Renewable energy leader ($165/hr)
- **MedTech Innovations** - Healthcare technology ($195/hr)
- **FinanceFlow Systems** - Fintech platform ($175/hr)
- **EduTech Academy** - Online education ($145/hr)
- **RetailNext Analytics** - Retail analytics prospect ($155/hr)

### Projects
**Demo Agency (3 projects):**
- **E-commerce Platform Redesign** - Active project (25% complete, $50K budget)
- **Mobile App Development** - Active project (15% complete, $75K budget)
- **Brand Identity Package** - Planning phase project ($15K budget)

**Veblen (6 projects):**
- **VebTask - Time Tracking Platform** - Internal product (65% complete, $250K budget)
- **AI-Powered Healthcare Dashboard** - MedTech project (35% complete, $180K budget)
- **Smart Energy Management System** - GreenFuture project (40% complete, $220K budget)
- **Enterprise AI Integration Suite** - InnovateTech project (15% complete, $300K budget)
- **FinTech Security Compliance Platform** - Planning phase ($165K budget)
- **Educational Content Management System** - Planning phase ($125K budget)

### Tasks (6)
- Mix of completed, in-progress, and planned tasks
- Includes development, design, and planning activities
- Properly categorized with tags and priorities

### Time Logs
- ~15 historical time entries per user over the past month
- One active timer per user to demonstrate real-time tracking
- Mix of billable and non-billable time
- Various work categories (work, meeting, research)

### Additional Data
- **Calendar Events** - Meetings and project milestones
- **Expenses** - Software subscriptions, office supplies, client meals
- **Brain Dumps** - Sample project ideas and client feedback notes

## Running the Demo Data Seeder

To populate your database with demo data:

```bash
# Make sure your database is set up and migrated
npm run db:migrate

# Seed the demo data
npm run db:seed-demo

# OR seed Veblen organization data
npm run db:seed-veblen

# OR seed both
npm run db:seed-demo && npm run db:seed-veblen
```

**⚠️ Warning:** This script will delete existing data in demo-related tables before seeding new data. Only run this on development databases.

## Using Demo Data

1. **Login** with any of the demo accounts above
2. **Switch between roles** to see different permission levels
3. **Explore features** like time tracking, project management, reporting
4. **View active timers** to see real-time functionality
5. **Check out different views** - dashboard, calendar, reports

## Development Notes

- All demo users have verified email addresses
- Passwords are properly hashed using bcrypt
- Time logs include realistic work patterns
- Projects show various stages of completion
- Expenses demonstrate different categories and approval states

The demo data is designed to showcase the full capabilities of VebTask while providing realistic scenarios for testing and demonstration purposes.