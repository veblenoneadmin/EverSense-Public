# VebTask - Complete Project Documentation
## AI-Powered Time Tracking & Client Management System

---

## 🏗️ ARCHITECTURE & TECH STACK

### Frontend Stack
- **Framework**: React 18.3.1 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Custom Design System
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router DOM v6
- **Form Handling**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Animations**: Tailwind CSS animations + Custom keyframes

### Backend & Database
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Authentication**: Supabase Auth with JWT
- **Real-time**: Supabase Realtime subscriptions
- **File Storage**: Supabase Storage
- **Edge Functions**: Deno-based serverless functions

---

## 🎨 DESIGN SYSTEM

### Color Palette (HSL Values)
```css
/* Core Brand Colors */
--primary: 220 67% 56%        /* Main brand blue */
--primary-foreground: 0 0% 98%
--primary-glow: 220 67% 70%   /* Lighter blue for glows */
--primary-dark: 220 67% 45%   /* Darker variant */

/* Surface Colors */
--background: 224 71% 4%      /* Dark background */
--foreground: 213 31% 91%     /* Light text */
--surface: 217 33% 17%        /* Card/surface background */
--surface-elevated: 215 28% 17%
--surface-glass: rgba(255, 255, 255, 0.05) /* Glassmorphism */

/* Status Colors */
--success: 142 69% 58%        /* Green for success states */
--warning: 48 96% 53%         /* Yellow for warnings */
--error: 0 84% 60%            /* Red for errors */
--info: 199 89% 48%           /* Blue for info */

/* Timer States */
--timer-active: 142 69% 58%   /* Green when running */
--timer-paused: 48 96% 53%    /* Yellow when paused */
--timer-break: 199 89% 48%    /* Blue for breaks */
--timer-complete: 259 94% 51% /* Purple when complete */

/* Project States */
--project-billable: 142 69% 58%     /* Green for billable */
--project-non-billable: 220 67% 56% /* Blue for non-billable */
--project-emergency: 0 84% 60%       /* Red for emergency */
```

### Gradients
```css
--gradient-primary: linear-gradient(135deg, hsl(220 67% 56%), hsl(220 67% 70%))
--gradient-secondary: linear-gradient(135deg, hsl(217 33% 17%), hsl(215 28% 17%))
--gradient-glass: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))
--gradient-success: linear-gradient(135deg, hsl(142 69% 58%), hsl(142 69% 70%))
--gradient-warning: linear-gradient(135deg, hsl(48 96% 53%), hsl(48 96% 65%))
--gradient-error: linear-gradient(135deg, hsl(0 84% 60%), hsl(0 84% 70%))
```

### Shadows & Effects
```css
--shadow-glass: 0 8px 32px rgba(31, 38, 135, 0.37)
--shadow-glow: 0 0 30px hsl(var(--primary) / 0.3)
--shadow-elevation: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
```

### Typography
- **Font Stack**: System fonts (Inter fallback)
- **Scales**: text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px), text-2xl (24px), text-3xl (30px), text-4xl (36px)
- **Weights**: font-normal (400), font-medium (500), font-semibold (600), font-bold (700)

### Spacing System
- **Base Unit**: 4px (Tailwind's default)
- **Common Spacings**: p-2 (8px), p-4 (16px), p-6 (24px), p-8 (32px)
- **Gaps**: gap-2 (8px), gap-4 (16px), gap-6 (24px)

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### User Roles
1. **Admin**: Full system access, user management, all features
2. **Manager**: Team oversight, project management, reporting
3. **Employee**: Time tracking, task management, basic features
4. **Client**: Limited portal access, view own projects/invoices

### Authentication Flow
```typescript
// Login process
1. Email/password validation
2. Supabase auth.signInWithPassword()
3. JWT token storage
4. Profile data fetch
5. Role-based route redirect

// Registration process
1. Form validation (email, password strength)
2. Supabase auth.signUp()
3. Email verification
4. Profile creation
5. Role assignment (default: employee)
```

### Protected Routes
- **ProtectedRoute component** wraps all authenticated pages
- **Role-based navigation** in Sidebar component
- **Conditional feature access** based on user role

---

## 🏠 LAYOUT & NAVIGATION

### Main Layout Structure
```
MainLayout
├── Sidebar (Fixed left, 288px width)
│   ├── Logo & Branding
│   ├── Role-based Navigation
│   └── User Profile Section
└── Main Content (Offset left by 288px)
    └── Page Content (32px padding)
```

### Sidebar Navigation by Role

#### Admin Navigation
- Dashboard (overview + admin panel toggle)
- Brain Dump (AI-powered notes)
- Timer (time tracking)
- Tasks (task management)
- Calendar (scheduling)
- Projects (project management)
- Timesheets (time log viewing)
- Clients (client management)
- Invoices (billing)
- Expenses (expense tracking)
- Reports (analytics)
- Settings (system configuration)

#### Manager Navigation
- Dashboard
- Brain Dump
- Timer
- Tasks
- Calendar
- Projects
- Timesheets
- Clients
- Reports
- Settings

#### Employee Navigation
- Dashboard
- Brain Dump
- Timer
- Tasks
- Calendar
- Timesheets
- Settings

#### Client Navigation
- Client Portal (dedicated interface)

---

## 📊 CORE FEATURES

### 1. Dashboard Overview
**Location**: `src/components/Dashboard/DashboardOverview.tsx`

**Features**:
- Real-time metrics cards
- Recent activity feed
- Quick action buttons
- Time tracking summary
- Project status overview
- Upcoming deadlines
- Performance charts (using Recharts)

**UI Components**:
- Metric cards with gradient backgrounds
- Activity timeline
- Progress indicators
- Chart visualizations

### 2. Brain Dump Interface
**Location**: `src/components/BrainDump/BrainDumpInterface.tsx`

**Features**:
- AI-powered note processing via Supabase Edge Function
- Real-time text analysis
- Automatic categorization
- Task extraction from notes
- Time estimation suggestions
- Voice-to-text capability (planned)

**UI Flow**:
1. User types/speaks ideas
2. AI processes content in real-time
3. Extracts actionable items
4. Suggests time estimates
5. Auto-categorizes content
6. Creates tasks/events

### 3. Timer Interface
**Location**: `src/components/Timer/TimerInterface.tsx`

**Features**:
- Pomodoro-style time tracking
- Project association
- Break management
- Time log creation
- Productivity analytics
- Focus session statistics

**Timer States**:
- **Active**: Green glow, running countdown
- **Paused**: Yellow indicator, time preserved
- **Break**: Blue theme, rest period
- **Complete**: Purple celebration, session done

### 4. Task Management
**Location**: `src/components/Tasks/TaskInterface.tsx`

**Features**:
- Kanban board view
- Task creation/editing
- Priority levels (Low, Medium, High, Urgent)
- Due date management
- Project association
- Time tracking integration
- Subtask support
- File attachments

**Task States**:
- Todo
- In Progress
- Review
- Done

### 5. Calendar Integration
**Location**: `src/components/Calendar/CalendarInterface.tsx`

**Features**:
- Full calendar view (month/week/day)
- Event creation/editing
- Time blocking
- Recurring events
- Integration with external calendars
- Meeting scheduling
- Availability management

### 6. Project Management
**Location**: `src/components/Projects/ProjectForm.tsx`

**Features**:
- Project creation/editing
- Budget tracking
- Time allocation
- Team assignment
- Client association
- Status management
- Milestone tracking
- Resource planning

**Project Types**:
- Billable (green indicator)
- Non-billable (blue indicator)
- Emergency (red indicator)

### 7. Timesheet Management
**Location**: `src/components/Timesheets/TimeLogForm.tsx`

**Features**:
- Manual time entry
- Bulk time editing
- Project categorization
- Approval workflow
- Export functionality
- Billing integration

### 8. Client Portal
**Location**: `src/components/Client/ClientPortal.tsx`

**Features**:
- Project visibility
- Invoice viewing
- Time log access
- File sharing
- Communication tools
- Payment tracking

### 9. Admin Command Center
**Location**: `src/components/Admin/AdminCommandCenter.tsx`

**Features**:
- User management
- System statistics
- Audit logs
- Configuration management
- Database insights
- Security monitoring

---

## 🎯 UI/UX PATTERNS

### Card Layouts
```tsx
// Standard card pattern
<Card className="glass border-0 bg-surface/50">
  <CardHeader className="pb-3">
    <CardTitle className="gradient-text">Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Form Patterns
```tsx
// Standard form with validation
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit" className="w-full">
      Submit
    </Button>
  </form>
</Form>
```

### Button Variants
```tsx
// Primary action
<Button variant="default" className="gradient-text">
  Primary Action
</Button>

// Secondary action
<Button variant="outline">
  Secondary Action
</Button>

// Destructive action
<Button variant="destructive">
  Delete
</Button>

// Ghost action
<Button variant="ghost">
  Cancel
</Button>
```

### Loading States
```tsx
// Loading button
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? "Loading..." : "Submit"}
</Button>

// Loading card
{isLoading ? (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
) : (
  <Content />
)}
```

### Animation Patterns
```css
/* Fade in animation */
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* Scale hover effect */
.hover-scale {
  transition: transform 0.2s ease;
}
.hover-scale:hover {
  transform: scale(1.05);
}

/* Pulse glow effect */
.glow-primary {
  box-shadow: 0 0 20px hsl(var(--primary-glow) / 0.5);
  animation: pulseGlow 2s ease-in-out infinite;
}
```

---

## 🗄️ DATABASE SCHEMA

### Core Tables

#### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users UNIQUE,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'employee',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### projects
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active',
  budget DECIMAL,
  is_billable BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### tasks
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES projects(id),
  assigned_to UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  estimated_hours DECIMAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### time_logs
```sql
CREATE TABLE time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),
  task_id UUID REFERENCES tasks(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### brain_dumps
```sql
CREATE TABLE brain_dumps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  processed_content JSONB,
  extracted_tasks JSONB,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### calendar_events
```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security (RLS) Policies

All tables have RLS enabled with role-based access:

```sql
-- Example: profiles table policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

---

## 🔧 KEY HOOKS & UTILITIES

### useAuth Hook
**Location**: `src/hooks/useAuth.tsx`

```typescript
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  isLoading: boolean;
}
```

### useDatabase Hook
**Location**: `src/hooks/useDatabase.tsx`

Provides React Query wrappers for:
- `useProfile()` - Current user profile
- `useProjects()` - Project list
- `useTasks()` - Task management
- `useTimeLogs()` - Time tracking data
- `useBrainDumps()` - Brain dump entries
- `useCalendarEvents()` - Calendar data

### Security Utilities
**Location**: `src/lib/security.ts`, `src/lib/data-masking.ts`

- Input sanitization
- XSS prevention
- Data masking for sensitive fields
- Rate limiting
- Audit logging

---

## 🎨 COMPONENT LIBRARY

### Custom Components

#### GlassCard
```tsx
const GlassCard = ({ children, className, ...props }) => (
  <Card className={cn("glass border-0 bg-surface/50", className)} {...props}>
    {children}
  </Card>
);
```

#### MetricCard
```tsx
const MetricCard = ({ title, value, change, icon: Icon }) => (
  <GlassCard>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold gradient-text">{value}</p>
          {change && (
            <p className={cn("text-sm", change > 0 ? "text-success" : "text-error")}>
              {change > 0 ? "+" : ""}{change}%
            </p>
          )}
        </div>
        <Icon className="h-8 w-8 text-primary" />
      </div>
    </CardContent>
  </GlassCard>
);
```

#### StatusBadge
```tsx
const StatusBadge = ({ status, variant = "default" }) => {
  const variants = {
    active: "bg-success/20 text-success border-success/30",
    paused: "bg-warning/20 text-warning border-warning/30",
    complete: "bg-info/20 text-info border-info/30",
    error: "bg-error/20 text-error border-error/30"
  };
  
  return (
    <Badge className={cn("border", variants[variant])}>
      {status}
    </Badge>
  );
};
```

---

## 🚀 AI INTEGRATION

### Brain Dump Processing
**Location**: `supabase/functions/process-brain-dump/index.ts`

```typescript
// Edge Function for AI processing
export default async function handler(req: Request) {
  const { content, userId } = await req.json();
  
  // 1. Process text with AI (OpenAI/Claude)
  const analysis = await processWithAI(content);
  
  // 2. Extract actionable items
  const tasks = extractTasks(analysis);
  
  // 3. Estimate time requirements
  const timeEstimates = estimateTime(tasks);
  
  // 4. Categorize content
  const categories = categorizeContent(analysis);
  
  // 5. Store results
  await supabase.from('brain_dumps').insert({
    user_id: userId,
    content,
    processed_content: analysis,
    extracted_tasks: tasks,
    time_estimates: timeEstimates,
    categories
  });
  
  return new Response(JSON.stringify({ success: true }));
}
```

---

## 📱 RESPONSIVE DESIGN

### Breakpoints
- **sm**: 640px and up
- **md**: 768px and up  
- **lg**: 1024px and up
- **xl**: 1280px and up
- **2xl**: 1536px and up

### Mobile Adaptations
- Collapsible sidebar on mobile
- Touch-friendly button sizes (min 44px)
- Simplified navigation
- Stack layouts on small screens
- Responsive data tables

---

## 🔍 TESTING STRATEGY

### Component Testing
- Jest + React Testing Library
- Snapshot testing for UI consistency
- User interaction testing
- Accessibility testing

### Integration Testing
- Supabase connection testing
- Authentication flow testing
- API endpoint testing
- Real-time subscription testing

### E2E Testing
- Playwright for full user journeys
- Critical path testing
- Cross-browser compatibility
- Performance testing

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE

### Supabase Configuration
- **Database**: PostgreSQL with RLS
- **Auth**: Email/password + social login
- **Storage**: File uploads and avatars
- **Edge Functions**: AI processing
- **Realtime**: Live updates

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Build Configuration
- **Vite**: Fast development and building
- **TypeScript**: Type safety
- **ESLint**: Code quality
- **Prettier**: Code formatting

---

## 🎯 KEY USER FLOWS

### 1. New User Onboarding
1. Registration with email verification
2. Profile completion
3. Role assignment
4. Welcome tour
5. First project/task creation

### 2. Daily Time Tracking
1. Start timer from dashboard
2. Select project/task
3. Work session with breaks
4. Automatic time logging
5. Review and adjust entries

### 3. Brain Dump to Task
1. Open brain dump interface
2. Type/speak ideas
3. AI processes content
4. Review extracted tasks
5. Create tasks with estimates
6. Schedule in calendar

### 4. Project Management
1. Create new project
2. Set budget and timeline
3. Assign team members
4. Create milestone tasks
5. Track progress
6. Generate reports

### 5. Client Portal Access
1. Client receives invitation
2. Account creation
3. Access project dashboard
4. View time logs and invoices
5. Download reports
6. Communicate with team

---

## 🔐 SECURITY FEATURES

### Authentication Security
- Password strength requirements
- Email verification
- Session management
- JWT token rotation
- Rate limiting on auth endpoints

### Data Protection
- Row Level Security (RLS)
- Input sanitization
- XSS prevention
- SQL injection protection
- Data masking for sensitive fields

### Admin Controls
- User role management
- Access audit logs
- Security monitoring
- Data export controls
- GDPR compliance tools

---

## 📊 ANALYTICS & REPORTING

### Built-in Reports
- Time tracking summaries
- Project profitability
- Team productivity metrics
- Client billing reports
- Resource utilization

### Dashboard Metrics
- Daily/weekly/monthly time totals
- Active projects count
- Overdue tasks
- Revenue projections
- Team performance indicators

---

## 🔧 CUSTOMIZATION OPTIONS

### Theme Customization
- Color scheme modification
- Typography adjustments
- Layout preferences
- Component styling overrides

### Feature Toggles
- Module enable/disable
- Role-based feature access
- Integration on/off switches
- AI processing controls

### Workflow Configuration
- Custom task statuses
- Project templates
- Approval workflows
- Notification preferences

---

## 📚 DEVELOPMENT SETUP

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm
- Supabase account

### Installation
```bash
npm install
cp .env.example .env.local
# Configure Supabase credentials
npm run dev
```

### Key Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking
```

---

## 🔄 FUTURE ENHANCEMENTS

### Planned Features
- Mobile app (React Native)
- Advanced AI integrations
- Team collaboration tools
- Third-party integrations
- Advanced reporting
- Workflow automation

### Scalability Considerations
- Microservices architecture
- CDN integration
- Database sharding
- Caching strategies
- Performance monitoring

---

This documentation provides a complete blueprint for replicating the VebTask system. The design system, component patterns, and architectural decisions are all documented to ensure consistent implementation across the entire application.