-- Extended VebTask Database Schema (MySQL)
-- Extends the existing better-auth tables with enterprise features
-- Run after database-init.sql

USE vebtask;

-- Add role and additional fields to existing user table
ALTER TABLE user ADD COLUMN IF NOT EXISTS role ENUM('admin', 'manager', 'employee', 'client') DEFAULT 'employee';
ALTER TABLE user ADD COLUMN IF NOT EXISTS isActive BOOLEAN DEFAULT TRUE;
ALTER TABLE user ADD COLUMN IF NOT EXISTS lastLogin TIMESTAMP NULL;
ALTER TABLE user ADD COLUMN IF NOT EXISTS failedLoginAttempts INT DEFAULT 0;
ALTER TABLE user ADD COLUMN IF NOT EXISTS lockedUntil TIMESTAMP NULL;
ALTER TABLE user ADD COLUMN IF NOT EXISTS phoneNumber VARCHAR(20);
ALTER TABLE user ADD COLUMN IF NOT EXISTS jobTitle VARCHAR(255);
ALTER TABLE user ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE user ADD COLUMN IF NOT EXISTS hourlyRate DECIMAL(10,2) DEFAULT 0.00;

-- Clients table for CRM
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phoneNumber VARCHAR(20),
  company VARCHAR(255),
  address TEXT,
  website VARCHAR(255),
  contactPerson VARCHAR(255),
  notes TEXT,
  status ENUM('active', 'inactive', 'prospect') DEFAULT 'active',
  userId VARCHAR(255), -- Associated client user account
  createdBy VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL,
  FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE RESTRICT
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  clientId VARCHAR(255),
  status ENUM('planning', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'planning',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  startDate DATE,
  endDate DATE,
  estimatedBudget DECIMAL(12,2),
  actualBudget DECIMAL(12,2) DEFAULT 0.00,
  color VARCHAR(7) DEFAULT '#6366f1',
  createdBy VARCHAR(255) NOT NULL,
  managerId VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE RESTRICT,
  FOREIGN KEY (managerId) REFERENCES user(id) ON DELETE SET NULL
);

-- Project team members (many-to-many)
CREATE TABLE IF NOT EXISTS project_members (
  id VARCHAR(255) PRIMARY KEY,
  projectId VARCHAR(255) NOT NULL,
  userId VARCHAR(255) NOT NULL,
  role ENUM('manager', 'member', 'viewer') DEFAULT 'member',
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE KEY unique_project_user (projectId, userId)
);

-- Enhanced macro_tasks table (main tasks)
CREATE TABLE IF NOT EXISTS macro_tasks (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  projectId VARCHAR(255),
  userId VARCHAR(255) NOT NULL, -- assigned user
  createdBy VARCHAR(255) NOT NULL,
  status ENUM('not_started', 'in_progress', 'paused', 'completed', 'cancelled') DEFAULT 'not_started',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  estimatedHours DECIMAL(5,2),
  actualHours DECIMAL(5,2) DEFAULT 0.00,
  isBillable BOOLEAN DEFAULT TRUE,
  hourlyRate DECIMAL(10,2),
  dueDate DATETIME,
  completedAt TIMESTAMP NULL,
  tags JSON,
  attachments JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE RESTRICT,
  FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE RESTRICT
);

-- Micro tasks (sub-tasks)
CREATE TABLE IF NOT EXISTS micro_tasks (
  id VARCHAR(255) PRIMARY KEY,
  macroTaskId VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  estimatedMinutes INT DEFAULT 0,
  actualMinutes INT DEFAULT 0,
  orderIndex INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (macroTaskId) REFERENCES macro_tasks(id) ON DELETE CASCADE
);

-- Time logs for detailed tracking
CREATE TABLE IF NOT EXISTS time_logs (
  id VARCHAR(255) PRIMARY KEY,
  taskId VARCHAR(255),
  microTaskId VARCHAR(255),
  userId VARCHAR(255) NOT NULL,
  startTime TIMESTAMP NOT NULL,
  endTime TIMESTAMP,
  duration INT, -- in seconds
  type ENUM('work', 'break', 'meeting') DEFAULT 'work',
  description TEXT,
  isBillable BOOLEAN DEFAULT TRUE,
  hourlyRate DECIMAL(10,2),
  earnings DECIMAL(10,2),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (taskId) REFERENCES macro_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (microTaskId) REFERENCES micro_tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);

-- Brain dumps with AI processing
CREATE TABLE IF NOT EXISTS brain_dumps (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  rawContent TEXT NOT NULL,
  processedContent JSON, -- AI extracted tasks
  processingStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  aiModel VARCHAR(100),
  processedAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
);



-- Expenses tracking
CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(255) PRIMARY KEY,
  projectId VARCHAR(255),
  userId VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  expenseDate DATE NOT NULL,
  receiptUrl VARCHAR(500),
  isBillable BOOLEAN DEFAULT FALSE,
  isReimbursable BOOLEAN DEFAULT FALSE,
  status ENUM('pending', 'approved', 'rejected', 'reimbursed') DEFAULT 'pending',
  approvedBy VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  FOREIGN KEY (approvedBy) REFERENCES user(id) ON DELETE SET NULL
);

-- Security and audit tables
CREATE TABLE IF NOT EXISTS security_events (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255),
  eventType ENUM('login_success', 'login_failed', 'logout', 'password_change', 'account_locked', 'data_access', 'data_modify') NOT NULL,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  details JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_analytics (
  id VARCHAR(255) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  totalWorkTime INT DEFAULT 0, -- in seconds
  totalBreakTime INT DEFAULT 0,
  tasksCompleted INT DEFAULT 0,
  tasksCreated INT DEFAULT 0,
  productivityScore DECIMAL(5,2),
  earningsAmount DECIMAL(10,2) DEFAULT 0.00,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (userId, date)
);

-- Create all necessary indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_role ON user(role);
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_createdBy ON clients(createdBy);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_clientId ON projects(clientId);
CREATE INDEX IF NOT EXISTS idx_projects_managerId ON projects(managerId);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_userId ON macro_tasks(userId);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_projectId ON macro_tasks(projectId);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_status ON macro_tasks(status);
CREATE INDEX IF NOT EXISTS idx_macro_tasks_dueDate ON macro_tasks(dueDate);
CREATE INDEX IF NOT EXISTS idx_micro_tasks_macroTaskId ON micro_tasks(macroTaskId);
CREATE INDEX IF NOT EXISTS idx_time_logs_userId ON time_logs(userId);
CREATE INDEX IF NOT EXISTS idx_time_logs_taskId ON time_logs(taskId);
CREATE INDEX IF NOT EXISTS idx_time_logs_startTime ON time_logs(startTime);
CREATE INDEX IF NOT EXISTS idx_brain_dumps_userId ON brain_dumps(userId);
CREATE INDEX IF NOT EXISTS idx_expenses_projectId ON expenses(projectId);
CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId);
CREATE INDEX IF NOT EXISTS idx_security_events_userId ON security_events(userId);
CREATE INDEX IF NOT EXISTS idx_security_events_eventType ON security_events(eventType);
CREATE INDEX IF NOT EXISTS idx_user_analytics_userId ON user_analytics(userId);
CREATE INDEX IF NOT EXISTS idx_user_analytics_date ON user_analytics(date);

SELECT 'Extended VebTask database schema created successfully!' as status;