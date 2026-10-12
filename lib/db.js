import pg from 'pg';
let pool;
export function getPool() {
  if (!process.env.DATABASE_URL) throw Object.assign(new Error('Database is not configured.'), {status:503});
  pool ||= new pg.Pool({connectionString:process.env.DATABASE_URL, max:3, idleTimeoutMillis:10000, connectionTimeoutMillis:10000, statement_timeout:15000});
  return pool;
}
