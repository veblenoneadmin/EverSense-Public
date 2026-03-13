import { createPool } from 'mysql2/promise';

const connectionString = process.env.DATABASE_URL || 
  process.env.VITE_DATABASE_URL || 
  "mysql://root:password@localhost:3306/vebtask";

console.log('🔗 Connecting to database...');

// Parse MySQL URL
const url = new URL(connectionString);
const dbConfig = {
  host: url.hostname,
  port: url.port ? parseInt(url.port) : 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.substring(1),
};

console.log('📋 Database Config:', { ...dbConfig, password: '***' });

const pool = createPool(dbConfig);

async function initDatabase() {
  try {
    console.log('🔄 Dropping and recreating tables for fresh schema...');
    
    // Drop existing tables in correct order (reverse foreign key dependency)
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');
    await pool.execute('DROP TABLE IF EXISTS verification');
    await pool.execute('DROP TABLE IF EXISTS session');  
    await pool.execute('DROP TABLE IF EXISTS account');
    await pool.execute('DROP TABLE IF EXISTS user');
    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🗑️ Dropped existing tables');

    // Create extended user table for better-auth with role system
    await pool.execute(`
      CREATE TABLE user (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        emailVerified BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        image VARCHAR(255),
        firstName VARCHAR(255),
        lastName VARCHAR(255),
        role ENUM('admin', 'manager', 'employee', 'client') DEFAULT 'employee',
        isActive BOOLEAN DEFAULT TRUE,
        lastLogin TIMESTAMP NULL,
        failedLoginAttempts INT DEFAULT 0,
        lockedUntil TIMESTAMP NULL,
        phoneNumber VARCHAR(20),
        jobTitle VARCHAR(255),
        department VARCHAR(255),
        hourlyRate DECIMAL(10,2) DEFAULT 0.00,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created extended user table with role system');

    // Create session table for better-auth
    await pool.execute(`
      CREATE TABLE session (
        id VARCHAR(255) PRIMARY KEY,
        expiresAt TIMESTAMP NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        ipAddress VARCHAR(45),
        userAgent TEXT,
        userId VARCHAR(36) NOT NULL,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created session table');

    // Create account table for better-auth with proper schema
    await pool.execute(`
      CREATE TABLE account (
        id VARCHAR(36) PRIMARY KEY,
        accountId VARCHAR(255) NOT NULL,
        providerId VARCHAR(255) NOT NULL,
        userId VARCHAR(36) NOT NULL,
        accessToken TEXT,
        refreshToken TEXT,
        idToken TEXT,
        accessTokenExpiresAt TIMESTAMP NULL,
        refreshTokenExpiresAt TIMESTAMP NULL,
        scope TEXT,
        password VARCHAR(255),
        salt VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE,
        UNIQUE KEY unique_provider_account (providerId, accountId)
      )
    `);
    console.log('✅ Created account table');

    // Create verification table for better-auth
    await pool.execute(`
      CREATE TABLE verification (
        id VARCHAR(36) PRIMARY KEY,
        identifier VARCHAR(255) NOT NULL,
        value VARCHAR(255) NOT NULL,
        expiresAt TIMESTAMP NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created verification table');

    // Create enterprise tables for CRM and project management
    
    // Clients table
    await pool.execute(`
      CREATE TABLE clients (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phoneNumber VARCHAR(20),
        company VARCHAR(255),
        address TEXT,
        website VARCHAR(255),
        contactPerson VARCHAR(255),
        notes TEXT,
        status ENUM('active', 'inactive', 'prospect') DEFAULT 'active',
        userId VARCHAR(36),
        createdBy VARCHAR(36) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL,
        FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE RESTRICT
      )
    `);
    console.log('✅ Created clients table');

    // Projects table
    await pool.execute(`
      CREATE TABLE projects (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        clientId VARCHAR(36),
        status ENUM('planning', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'planning',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        startDate DATE,
        endDate DATE,
        estimatedBudget DECIMAL(12,2),
        actualBudget DECIMAL(12,2) DEFAULT 0.00,
        color VARCHAR(7) DEFAULT '#6366f1',
        createdBy VARCHAR(36) NOT NULL,
        managerId VARCHAR(36),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL,
        FOREIGN KEY (createdBy) REFERENCES user(id) ON DELETE RESTRICT,
        FOREIGN KEY (managerId) REFERENCES user(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created projects table');

    // Macro tasks table
    await pool.execute(`
      CREATE TABLE macro_tasks (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        projectId VARCHAR(36),
        userId VARCHAR(36) NOT NULL,
        createdBy VARCHAR(36) NOT NULL,
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
      )
    `);
    console.log('✅ Created macro_tasks table');

    // Time logs table
    await pool.execute(`
      CREATE TABLE time_logs (
        id VARCHAR(36) PRIMARY KEY,
        taskId VARCHAR(36),
        userId VARCHAR(36) NOT NULL,
        startTime TIMESTAMP NOT NULL,
        endTime TIMESTAMP,
        duration INT,
        type ENUM('work', 'break', 'meeting') DEFAULT 'work',
        description TEXT,
        isBillable BOOLEAN DEFAULT TRUE,
        hourlyRate DECIMAL(10,2),
        earnings DECIMAL(10,2),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (taskId) REFERENCES macro_tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created time_logs table');

    // Brain dumps table for AI processing
    await pool.execute(`
      CREATE TABLE brain_dumps (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36) NOT NULL,
        rawContent TEXT NOT NULL,
        processedContent JSON,
        processingStatus ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        aiModel VARCHAR(100),
        processedAt TIMESTAMP NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Created brain_dumps table');


    // Security events table for audit logging
    await pool.execute(`
      CREATE TABLE security_events (
        id VARCHAR(36) PRIMARY KEY,
        userId VARCHAR(36),
        eventType ENUM('login_success', 'login_failed', 'logout', 'password_change', 'account_locked', 'data_access', 'data_modify') NOT NULL,
        ipAddress VARCHAR(45),
        userAgent TEXT,
        details JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Created security_events table');

    // Create indexes for performance
    await pool.execute('CREATE INDEX idx_user_role ON user(role)');
    await pool.execute('CREATE INDEX idx_user_email ON user(email)');
    await pool.execute('CREATE INDEX idx_projects_clientId ON projects(clientId)');
    await pool.execute('CREATE INDEX idx_macro_tasks_userId ON macro_tasks(userId)');
    await pool.execute('CREATE INDEX idx_macro_tasks_projectId ON macro_tasks(projectId)');
    await pool.execute('CREATE INDEX idx_time_logs_userId ON time_logs(userId)');
    await pool.execute('CREATE INDEX idx_brain_dumps_userId ON brain_dumps(userId)');
    console.log('✅ Created performance indexes');

    console.log('🎉 Extended VebTask database initialization completed successfully!');
    
    // Test the connection
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM user');
    console.log(`📊 Current user count: ${rows[0].count}`);

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initDatabase().catch(console.error);