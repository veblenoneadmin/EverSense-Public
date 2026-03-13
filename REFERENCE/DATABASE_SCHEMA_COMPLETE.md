# Complete Database Schema - VebTask System

## Core Tables Overview

### account_lockouts
Security table for managing failed login attempts
- `id` (UUID, PRIMARY KEY)
- `email` (TEXT, NOT NULL)
- `failed_attempts` (INTEGER, DEFAULT 0)
- `locked_until` (TIMESTAMPTZ, NULLABLE)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### brain_dumps
AI-powered note processing and task extraction
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `raw_content` (TEXT, NOT NULL)
- `dump_date` (DATE, DEFAULT CURRENT_DATE)
- `processed` (BOOLEAN, DEFAULT false)
- `ai_analysis_complete` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ)

### calendar_events
Comprehensive calendar and time blocking system
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `macro_task_id` (UUID, FOREIGN KEY → macro_tasks)
- `micro_task_id` (UUID, FOREIGN KEY → micro_tasks)
- `title` (VARCHAR, NOT NULL)
- `start_time`, `end_time` (TIMESTAMPTZ, NOT NULL)
- `all_day` (BOOLEAN, DEFAULT false)
- `time_block_type` (ENUM: focused_work, meeting, break, etc.)
- `color` (VARCHAR, DEFAULT '#3b82f6')
- `is_flexible` (BOOLEAN, DEFAULT true)
- `recurrence_rule` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### client_communications
Client portal communication system
- `id` (UUID, PRIMARY KEY)
- `client_id` (UUID, FOREIGN KEY → profiles)
- `project_id` (UUID, FOREIGN KEY → projects)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `type` (ENUM: message, file, update, etc.)
- `subject` (VARCHAR)
- `message` (TEXT)
- `file_url` (VARCHAR)
- `is_read` (BOOLEAN, DEFAULT false)
- `priority` (VARCHAR, DEFAULT 'normal')
- `created_at` (TIMESTAMPTZ)

### client_portal_access
Fine-grained client access control
- `id` (UUID, PRIMARY KEY)
- `client_id` (UUID, FOREIGN KEY → profiles)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `access_level` (ENUM: view_only, comment, limited_edit)
- `can_view_time_logs` (BOOLEAN, DEFAULT true)
- Various permission flags for different features

### profiles
Extended user profile information
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → auth.users, UNIQUE)
- `email` (TEXT)
- `first_name`, `last_name` (TEXT)
- `full_name` (TEXT, GENERATED)
- `phone` (TEXT)
- `role` (TEXT, DEFAULT 'employee')
- `avatar_url` (TEXT)
- `timezone` (TEXT, DEFAULT 'UTC')
- `notification_preferences` (JSONB)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### projects
Comprehensive project management
- `id` (UUID, PRIMARY KEY)
- `name` (TEXT, NOT NULL)
- `description` (TEXT)
- `client_id` (UUID, FOREIGN KEY → profiles)
- `status` (TEXT, DEFAULT 'active')
- `priority` (TEXT, DEFAULT 'medium')
- `budget` (DECIMAL)
- `hourly_rate` (DECIMAL)
- `is_billable` (BOOLEAN, DEFAULT true)
- `is_archived` (BOOLEAN, DEFAULT false)
- `start_date`, `end_date` (DATE)
- `color` (TEXT, DEFAULT '#3b82f6')
- `tags` (TEXT[])
- `created_by` (UUID, FOREIGN KEY → profiles)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### macro_tasks
High-level task organization
- `id` (UUID, PRIMARY KEY)
- `project_id` (UUID, FOREIGN KEY → projects)
- `title` (TEXT, NOT NULL)
- `description` (TEXT)
- `status` (ENUM: not_started, in_progress, completed, on_hold)
- `priority` (ENUM: low, medium, high, urgent)
- `estimated_hours` (DECIMAL)
- `actual_hours` (DECIMAL, DEFAULT 0)
- `due_date` (TIMESTAMPTZ)
- `assigned_to` (UUID, FOREIGN KEY → profiles)
- `dependencies` (UUID[])
- `completion_percentage` (INTEGER, DEFAULT 0)
- `created_by` (UUID, FOREIGN KEY → profiles)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### micro_tasks
Detailed task breakdown
- `id` (UUID, PRIMARY KEY)
- `macro_task_id` (UUID, FOREIGN KEY → macro_tasks)
- `title` (TEXT, NOT NULL)
- `description` (TEXT)
- `status` (ENUM: not_started, in_progress, completed)
- `priority` (ENUM: low, medium, high, urgent)
- `estimated_minutes` (INTEGER)
- `actual_minutes` (INTEGER, DEFAULT 0)
- `order_index` (INTEGER)
- `is_milestone` (BOOLEAN, DEFAULT false)
- `due_time` (TIMESTAMPTZ)
- `assigned_to` (UUID, FOREIGN KEY → profiles)
- `created_by` (UUID, FOREIGN KEY → profiles)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### time_logs
Comprehensive time tracking
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `project_id` (UUID, FOREIGN KEY → projects)
- `macro_task_id` (UUID, FOREIGN KEY → macro_tasks)
- `micro_task_id` (UUID, FOREIGN KEY → micro_tasks)
- `start_time` (TIMESTAMPTZ, NOT NULL)
- `end_time` (TIMESTAMPTZ)
- `duration_minutes` (INTEGER)
- `description` (TEXT)
- `is_billable` (BOOLEAN, DEFAULT true)
- `hourly_rate` (DECIMAL)
- `is_break` (BOOLEAN, DEFAULT false)
- `break_type` (VARCHAR)
- `productivity_score` (INTEGER)
- `mood_rating` (INTEGER)
- `energy_level` (INTEGER)
- `location` (TEXT)
- `is_approved` (BOOLEAN, DEFAULT false)
- `approved_by` (UUID, FOREIGN KEY → profiles)
- `approved_at` (TIMESTAMPTZ)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### expenses
Business expense tracking
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `project_id` (UUID, FOREIGN KEY → projects)
- `category` (TEXT, NOT NULL)
- `amount` (DECIMAL, NOT NULL)
- `currency` (TEXT, DEFAULT 'USD')
- `description` (TEXT)
- `receipt_url` (TEXT)
- `expense_date` (DATE, NOT NULL)
- `is_billable` (BOOLEAN, DEFAULT false)
- `is_reimbursed` (BOOLEAN, DEFAULT false)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### invoices
Client billing system
- `id` (UUID, PRIMARY KEY)
- `client_id` (UUID, FOREIGN KEY → profiles)
- `project_id` (UUID, FOREIGN KEY → projects)
- `invoice_number` (TEXT, UNIQUE)
- `status` (ENUM: draft, sent, paid, overdue, cancelled)
- `subtotal` (DECIMAL, NOT NULL)
- `tax_rate` (DECIMAL, DEFAULT 0)
- `tax_amount` (DECIMAL, DEFAULT 0)
- `total_amount` (DECIMAL, NOT NULL)
- `currency` (TEXT, DEFAULT 'USD')
- `issue_date` (DATE, NOT NULL)
- `due_date` (DATE, NOT NULL)
- `paid_date` (DATE)
- `notes` (TEXT)
- `created_by` (UUID, FOREIGN KEY → profiles)
- `created_at`, `updated_at` (TIMESTAMPTZ)

### invoice_line_items
Detailed invoice breakdown
- `id` (UUID, PRIMARY KEY)
- `invoice_id` (UUID, FOREIGN KEY → invoices)
- `time_log_id` (UUID, FOREIGN KEY → time_logs)
- `expense_id` (UUID, FOREIGN KEY → expenses)
- `description` (TEXT, NOT NULL)
- `quantity` (DECIMAL, NOT NULL)
- `rate` (DECIMAL, NOT NULL)
- `amount` (DECIMAL, NOT NULL)
- `created_at` (TIMESTAMPTZ)

### notifications
User notification system
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `type` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL)
- `message` (TEXT)
- `data` (JSONB)
- `is_read` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMPTZ)

### security_audit_logs
Security and audit tracking
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → profiles)
- `action` (TEXT, NOT NULL)
- `resource_type` (TEXT)
- `resource_id` (UUID)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `success` (BOOLEAN, NOT NULL)
- `error_message` (TEXT)
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ)

## Custom Types (ENUMs)

### time_block_type
- focused_work
- meeting
- break
- admin
- learning
- planning

### communication_type
- message
- file
- status_update
- invoice
- payment

### access_level
- view_only
- comment
- limited_edit
- full_access

### task_status
- not_started
- in_progress
- in_review
- completed
- on_hold
- cancelled

### task_priority
- low
- medium
- high
- urgent

### invoice_status
- draft
- sent
- paid
- overdue
- cancelled

## Row Level Security (RLS) Policies

All tables have comprehensive RLS policies implementing:

1. **User Isolation**: Users can only access their own data
2. **Role-Based Access**: Admins have broader access, managers have team access
3. **Client Restrictions**: Clients can only see their own projects and data
4. **Audit Trail**: All sensitive operations are logged
5. **Data Masking**: Sensitive fields are masked based on user role

## Indexes for Performance

Key indexes for optimal query performance:
- User-based queries (user_id indexes)
- Time-range queries (timestamp indexes)
- Project-based filtering (project_id indexes)
- Status-based filtering (status indexes)
- Full-text search (description fields)

## Triggers and Functions

Automatic functionality:
- `updated_at` timestamp updates
- Audit log creation
- Data validation
- Security checks
- Notification generation
- Time calculation automation