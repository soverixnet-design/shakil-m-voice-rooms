import { createServer } from 'node:http';
import { createSupabaseDatabase } from './supabase-database.js';

// Deliberately isolated from render-server.js: importing the live server
// would start migration, game settlement and other production writes.
if (process.env.STAGING_READONLY !== '1') {
  throw new Error('Staging server requires STAGING_READONLY=1');
}

const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid staging port');
}

const database = process.env.SUPABASE_DATABASE_URL
  ? createSupabaseDatabase()
  : null;

function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET') return reply(res, 405, { error: 'method-not-allowed' });
  const path = new URL(req.url, 'http://localhost').pathname;

  if (path === '/ping') {
    return reply(res, 200, { status: 'ok', mode: 'read-only-staging' });
  }

  if (path !== '/health') return reply(res, 404, { error: 'not-found' });
  if (!database) {
    return reply(res, 503, { status: 'configuration-required', mode: 'read-only-staging' });
  }

  try {
    await database.check(); // SELECT-only schema check; never migrates or settles games.
    return reply(res, 200, { status: 'ok', database: 'connected', mode: 'read-only-staging' });
  } catch {
    return reply(res, 503, { status: 'database-unavailable', mode: 'read-only-staging' });
  }
});

server.requestTimeout = 15000;
server.listen(port, '0.0.0.0', () => {
  console.log('Shakil M read-only staging diagnostics listening on port', port);
});

async function shutdown() {
  server.close();
  if (database) await database.close();
}
process.once('SIGTERM', () => { void shutdown(); });
process.once('SIGINT', () => { void shutdown(); });
