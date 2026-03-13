import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runExtendedSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'vebtask',
    multipleStatements: true
  });

  try {
    console.log('Connected to MySQL database');
    
    // Read the extended schema file
    const schemaPath = path.join(__dirname, 'database-extended.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running extended database schema...');
    await connection.execute(schema);
    
    console.log('✅ Extended database schema executed successfully!');
    
    // Verify some tables were created
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'vebtask' 
      AND TABLE_NAME IN ('clients', 'projects', 'macro_tasks', 'brain_dumps')
    `);
    
    console.log('New tables created:', tables.map(t => t.TABLE_NAME));
    
  } catch (error) {
    console.error('❌ Error running extended schema:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runExtendedSchema().catch(console.error);