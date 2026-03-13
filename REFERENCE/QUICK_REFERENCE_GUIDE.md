# VebTask - Quick Reference Guide
## Everything You Need to Replicate This System

---

## 🚀 IMMEDIATE SETUP

### 1. Technology Stack
```bash
# Frontend
React 18.3.1 + TypeScript + Vite + Tailwind CSS + Shadcn/ui

# Backend  
Supabase (PostgreSQL + Auth + Storage + Edge Functions)

# Key Dependencies
@supabase/supabase-js, @tanstack/react-query, react-router-dom
react-hook-form, zod, lucide-react, tailwind-merge, class-variance-authority
```

### 2. Project Structure
```
src/
├── components/
│   ├── ui/           # Shadcn components
│   ├── Layout/       # MainLayout, Sidebar
│   ├── Dashboard/    # DashboardOverview, UnifiedDashboard
│   ├── BrainDump/    # AI-powered note interface
│   ├── Timer/        # Pomodoro time tracking
│   ├── Tasks/        # Task management (macro/micro)
│   ├── Calendar/     # Event scheduling
│   ├── Projects/     # Project management
│   ├── Auth/         # Login, signup, reset
│   └── Admin/        # Admin command center
├── hooks/            # useAuth, useDatabase, custom hooks
├── lib/              # Utils, security, validation
├── pages/            # Route components
└── integrations/supabase/
```

---

## 🎨 DESIGN SYSTEM ESSENTIALS

### Core Colors (HSL)
```css
--primary: 220 67% 56%           /* Brand blue */
--background: 224 71% 4%         /* Dark background */
--surface: 217 33% 17%           /* Card backgrounds */
--success: 142 69% 58%           /* Green states */
--warning: 48 96% 53%            /* Yellow states */
--error: 0 84% 60%               /* Red states */
```

### Component Patterns
```tsx
// Glass effect cards
<Card className="glass border-0 bg-surface/50">

// Gradient text
<h1 className="gradient-text">Title</h1>

// Status badges with semantic colors
<Badge className="bg-success/20 text-success border-success/30">

// Loading states
{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
```

---

## 🔐 AUTHENTICATION SYSTEM

### User Roles & Permissions
- **Admin**: Full system access, user management
- **Manager**: Team oversight, project management  
- **Employee**: Time tracking, tasks, basic features
- **Client**: Portal access, view own projects only

### Auth Flow
```typescript
// Login
const { signIn } = useAuth();
await signIn(email, password);

// Protected routes
<ProtectedRoute>
  <Component />
</ProtectedRoute>

// Role-based access
const { profile } = useProfile();
if (profile?.role === 'admin') {
  // Admin content
}
```

---

## 📊 KEY FEATURES

### 1. Dashboard Overview
**File**: `src/components/Dashboard/DashboardOverview.tsx`
- Real-time metrics cards
- Activity timeline
- Quick actions
- Performance charts

### 2. Brain Dump Interface  
**File**: `src/components/BrainDump/BrainDumpInterface.tsx`
- AI-powered note processing
- Task extraction from text
- Time estimation suggestions
- Auto-categorization

### 3. Timer System
**File**: `src/components/Timer/TimerInterface.tsx`
- Pomodoro-style tracking
- Project/task association
- Break management
- Productivity analytics

### 4. Task Management
**Files**: `src/components/Tasks/TaskInterface.tsx`
- Macro tasks (high-level)
- Micro tasks (detailed breakdown)
- Kanban board view
- Priority levels, due dates

### 5. Calendar Integration
**File**: `src/components/Calendar/CalendarInterface.tsx`
- Time blocking
- Event scheduling
- Recurring events
- External calendar sync

---

## 🗄️ DATABASE SCHEMA

### Essential Tables
```sql
-- User profiles with roles
profiles (id, user_id, email, role, full_name, avatar_url)

-- Project management
projects (id, name, client_id, status, budget, is_billable)

-- Two-level task system
macro_tasks (id, project_id, title, status, priority, estimated_hours)
micro_tasks (id, macro_task_id, title, estimated_minutes)

-- Time tracking
time_logs (id, user_id, project_id, start_time, end_time, duration_minutes)

-- AI brain dumps
brain_dumps (id, user_id, raw_content, processed, ai_analysis_complete)

-- Calendar events
calendar_events (id, user_id, title, start_time, end_time, time_block_type)

-- Business features
invoices (id, client_id, project_id, status, total_amount)
expenses (id, user_id, project_id, amount, category)
```

### RLS Security
All tables use Row Level Security with role-based policies:
- Users see only their own data
- Admins have full access
- Clients see only their projects
- Audit logging for sensitive operations

---

## 🎯 UI/UX PATTERNS

### Layout Structure
```tsx
<MainLayout>
  <Sidebar /> {/* Fixed left, 288px width */}
  <main className="pl-72"> {/* Content offset */}
    <div className="p-8">
      <Outlet /> {/* Page content */}
    </div>
  </main>
</MainLayout>
```

### Common Components
```tsx
// Metric display cards
<MetricCard 
  title="Active Projects" 
  value={12} 
  change={+5} 
  icon={FolderIcon} 
/>

// Status indicators
<StatusBadge status="active" variant="success" />

// Form patterns with validation
<Form {...form}>
  <FormField control={form.control} name="title" />
</Form>

// Loading states
<Button disabled={isLoading}>
  {isLoading ? <Spinner /> : "Submit"}
</Button>
```

---

## 🔧 KEY HOOKS

### useAuth Hook
```typescript
const { 
  user,           // Current Supabase user
  profile,        // User profile data
  signIn,         // Login function
  signOut,        // Logout function
  isLoading       // Auth state loading
} = useAuth();
```

### useDatabase Hook
```typescript
const { data: projects } = useProjects();
const { data: tasks } = useTasks(projectId);
const { data: timeLogs } = useTimeLogs();
const { data: profile } = useProfile();
```

---

## 🚀 AI INTEGRATION

### Brain Dump Processing
**File**: `supabase/functions/process-brain-dump/index.ts`

Edge function that:
1. Receives raw text input
2. Processes with AI (OpenAI/Claude)
3. Extracts actionable tasks
4. Estimates time requirements
5. Categorizes content
6. Returns structured data

---

## 📱 RESPONSIVE DESIGN

### Breakpoints
- **Mobile**: < 768px (collapsible sidebar)
- **Tablet**: 768px - 1024px (responsive grid)
- **Desktop**: > 1024px (full layout)

### Mobile Adaptations
- Sidebar collapses to hamburger menu
- Touch-friendly button sizes (44px minimum)
- Simplified navigation
- Stack layouts for forms

---

## 🔍 TESTING & QUALITY

### Code Quality
- TypeScript for type safety
- ESLint + Prettier for formatting
- Zod for runtime validation
- React Hook Form for form management

### Security Features
- Input sanitization
- XSS prevention  
- Rate limiting
- Audit logging
- Data masking

---

## 🚀 DEPLOYMENT

### Environment Setup
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Build Commands
```bash
npm install
npm run dev      # Development
npm run build    # Production build
npm run preview  # Preview build
```

---

## 📚 CRITICAL FILES TO EXAMINE

### Core Application
- `src/App.tsx` - Main app routing
- `src/pages/Index.tsx` - Role-based dashboard routing
- `src/components/Layout/MainLayout.tsx` - Layout wrapper
- `src/components/Layout/Sidebar.tsx` - Navigation

### Feature Components
- `src/components/Dashboard/UnifiedDashboard.tsx` - Main dashboard
- `src/components/BrainDump/BrainDumpInterface.tsx` - AI notes
- `src/components/Timer/TimerInterface.tsx` - Time tracking
- `src/components/Tasks/TaskInterface.tsx` - Task management

### Business Logic
- `src/hooks/useAuth.tsx` - Authentication logic
- `src/hooks/useDatabase.tsx` - Data access layer
- `src/lib/security.ts` - Security utilities

### Styling
- `src/index.css` - Design system variables
- `tailwind.config.ts` - Tailwind configuration

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1: Core Foundation
1. Setup React + TypeScript + Vite
2. Install Shadcn/ui components
3. Configure Tailwind with design system
4. Setup Supabase connection
5. Implement authentication

### Phase 2: Basic Features
1. User profiles and role management
2. Project management
3. Basic time tracking
4. Simple task management

### Phase 3: Advanced Features
1. AI brain dump processing
2. Calendar integration
3. Client portal
4. Invoicing system
5. Advanced reporting

### Phase 4: Polish & Security
1. Comprehensive testing
2. Security hardening
3. Performance optimization
4. Mobile responsiveness
5. Production deployment

---

This reference guide provides everything needed to replicate the VebTask system. The combination of the detailed documentation files gives you the complete blueprint for implementation.