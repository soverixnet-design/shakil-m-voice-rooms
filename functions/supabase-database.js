import pg from 'pg';
const PROJECT = 'rfrmcmeyamndghtiheci';

// Backend only: never expose the connection string through an API or log.
export function createSupabaseDatabase(connectionString = process.env.SUPABASE_DATABASE_URL) {
  if (!connectionString) throw new Error('supabase-connection-not-configured');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.pooler.supabase.com')) {
    throw new Error('invalid-supabase-connection');
  }
  if (url.hostname !== `db.${PROJECT}.supabase.co` && !decodeURIComponent(url.username).endsWith(`.${PROJECT}`)) {
    throw new Error('wrong-supabase-project');
  }
  // URL ssl flags must not override certificate verification.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new pg.Pool({connectionString: url.toString(), max: 5,
    connectionTimeoutMillis: 8000, idleTimeoutMillis: 30000,
    statement_timeout: 10000, ssl: {rejectUnauthorized: true}});
  pool.on('error', () => console.error('Supabase idle database connection failed.'));
  return {
    pool,
    async check() {
      const result = await pool.query(`select count(*)::int as tables
        from pg_tables where schemaname = 'earnbd' and tablename = any($1::text[])`,
        [['users','wallets','rooms','room_members','game_rounds','game_secrets','game_bets','wallet_ledger']]);
      if (result.rows[0].tables !== 8) throw new Error('supabase-schema-incomplete');
      return {status: 'connected', project: PROJECT, schema: 'earnbd', tables: 8};
    },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('begin isolation level serializable');
        const result = await work(client);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback').catch(() => {});
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
