import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env') });

const globalForPrisma = globalThis;

// Build URL from individual components if available (avoids special-char encoding issues)
function buildDatabaseUrl() {
  const host     = process.env.MYSQLHOST     || process.env.MYSQL_HOST;
  const port     = process.env.MYSQLPORT     || process.env.MYSQL_PORT     || '3306';
  const user     = process.env.MYSQLUSER     || process.env.MYSQL_USER;
  const password = process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE;

  if (host && user && password && database) {
    const encodedPassword = encodeURIComponent(password);
    const encodedUser     = encodeURIComponent(user);
    const url = `mysql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
    console.log('🔗 Built DATABASE_URL from MYSQL_* components');
    return url;
  }

  // Railway provides MYSQL_URL (internal) — already properly encoded
  if (process.env.MYSQL_URL) {
    console.log('🔗 Using MYSQL_URL from Railway');
    return process.env.MYSQL_URL;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  return process.env.VITE_DATABASE_URL;
}

const dbUrl = buildDatabaseUrl();

console.log('🔗 Initializing Prisma client...');
console.log('📍 Database URL configured:', !!dbUrl);

if (!dbUrl) {
  console.warn('⚠️  DATABASE_URL is not set — database features will be unavailable.');
  console.warn('   Set DATABASE_URL in Railway environment variables to enable the database.');
}

// Only pass datasources config when URL is available to avoid crash on missing URL
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  errorFormat: 'pretty',
  ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {})
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add connection retry logic
let connectionRetries = 0;
const maxRetries = 3;

async function connectWithRetry() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test a simple query to ensure full connectivity
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database query test passed');
    
  } catch (error) {
    console.error(`❌ Database connection attempt ${connectionRetries + 1}/${maxRetries} failed:`, error.message);
    
    connectionRetries++;
    if (connectionRetries < maxRetries) {
      console.log(`🔄 Retrying database connection in 3 seconds...`);
      setTimeout(() => connectWithRetry(), 3000);
    } else {
      console.error('💥 Max database connection retries exceeded');
      console.warn('⚠️  Server will continue without database connection');
    }
  }
}

// Start connection attempt
if (dbUrl) {
  // Only attempt to connect if a database URL is configured
  connectWithRetry();
} else {
  console.warn('⚠️  Skipping Prisma connection attempts because DATABASE_URL is not configured.');
}

export default prisma;