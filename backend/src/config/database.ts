import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export interface IDatabaseClient {
  query: (text: string, params?: any[]) => Promise<any>;
  release: () => void;
}

export interface IDatabasePool {
  query: (text: string, params?: any[]) => Promise<any>;
  connect: () => Promise<IDatabaseClient>;
  end?: () => Promise<void>;
}

let activePool: IDatabasePool | null = null;
let isInitialized = false;

function resolveDatabaseFile(filename: string): string | null {
  const possiblePaths = [
    path.resolve(__dirname, '../../database', filename),
    path.resolve(process.cwd(), 'database', filename),
    path.resolve(process.cwd(), 'backend/database', filename),
    path.resolve(__dirname, '../../../database', filename),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export async function getDatabasePool(): Promise<IDatabasePool> {
  if (activePool && isInitialized) {
    return activePool;
  }

  let connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is missing. Please provide a valid Neon PostgreSQL connection string in backend/.env'
    );
  }

  // Strip leading and trailing quotes if present in environment
  connectionString = connectionString.replace(/^["']+|["']+$/g, '').trim();

  console.log('🔌 Connecting to Neon PostgreSQL with DATABASE_URL...');

  const isNeon = connectionString.includes('.neon.tech') || connectionString.includes('sslmode=require');

  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isNeon ? { rejectUnauthorized: false } : undefined,
  });

  // Verify connection
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');

    // Check if database tables exist, otherwise initialize schema & seed
    const tableCheck = await client.query(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
    );

    if (tableCheck.rows[0]?.count === 0) {
      console.log('📦 Creating database tables from schema.sql on PostgreSQL...');
      const schemaPath = resolveDatabaseFile('schema.sql');
      const seedPath = resolveDatabaseFile('seed.sql');

      if (schemaPath && fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
        await client.query(schemaSql);
        console.log('✅ schema.sql executed successfully.');
      }

      if (seedPath && fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf-8');
        await client.query(seedSql);
        console.log('✅ seed.sql executed successfully.');
      }
    }
    console.log('✅ Connected to Neon PostgreSQL database successfully.');
  } catch (err: any) {
    console.error('❌ Failed to verify database schema or connection:', err.message);
    throw err;
  } finally {
    client.release();
  }

  activePool = pool;
  isInitialized = true;
  return activePool;
}

// Global query helper
export async function query(text: string, params?: any[]): Promise<any> {
  const pool = await getDatabasePool();
  return pool.query(text, params);
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: IDatabaseClient) => Promise<T>
): Promise<T> {
  const pool = await getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  query,
  getDatabasePool,
  withTransaction,
};
