import {createSupabaseDatabase} from './supabase-database.js';
let database;
try {
  database = createSupabaseDatabase();
  console.log(JSON.stringify(await database.check()));
} catch {
  console.error('Supabase connection check failed. Check SUPABASE_DATABASE_URL, project and schema. Credentials are not logged.');
  process.exitCode = 1;
} finally { if (database) await database.close(); }
