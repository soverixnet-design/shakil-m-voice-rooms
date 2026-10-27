import test from 'node:test';
import assert from 'node:assert/strict';
import { createSweepLease } from '../functions/sweep-lease.js';

function fakeStore() {
  const rows = new Map();
  return {
    doc: path => ({ path }),
    async runTransaction(work) {
      const writes = [];
      const result = await work({
        get: async ref => ({ data: () => rows.get(ref.path) }),
        set: (ref, value) => writes.push([ref.path, value])
      });
      for (const [path, value] of writes) rows.set(path, value);
      return result;
    }
  };
}

test('one instance owns settlement until its lease expires', async () => {
  let now = 1000;
  const store = fakeStore();
  const render = createSweepLease(store, { ownerId: 'render', clock: () => now });
  const digitalOcean = createSweepLease(store, { ownerId: 'digitalocean', clock: () => now });
  assert.equal(await render(), true);
  assert.equal(await digitalOcean(), false);
  now += 10000;
  assert.equal(await render(), true);
  now += 44000;
  assert.equal(await digitalOcean(), false); // renewal extended expiry
  now += 2000;
  assert.equal(await digitalOcean(), true); // prior owner stopped renewing
  assert.equal(await render(), false);
});

test('database errors never grant the settlement lease', async () => {
  const store = {
    doc: path => ({ path }),
    runTransaction: async () => { throw Error('database-connection-failed'); }
  };
  const claim = createSweepLease(store, { ownerId: 'isolated-backup' });
  await assert.rejects(claim(), /database-connection-failed/);
});

test('misconfigured leases fail closed', () => {
  assert.throws(() => createSweepLease(fakeStore(), { ownerId: '' }), /invalid-sweep-lease-configuration/);
  assert.throws(() => createSweepLease(fakeStore(), { ttlMs: 1000 }), /invalid-sweep-lease-configuration/);
});
