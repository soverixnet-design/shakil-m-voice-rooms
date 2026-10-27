import { randomUUID } from 'node:crypto';

// Both Render and DigitalOcean must share the same Supabase social_documents
// store before running background settlement. This only coordinates the
// background sweep; individual bet receipts remain transaction-idempotent.
export function createSweepLease(store, { clock = Date.now, ownerId = randomUUID(), ttlMs = 45000 } = {}) {
  if (!store?.doc || !store?.runTransaction || typeof ownerId !== 'string' ||
      !ownerId || !Number.isSafeInteger(ttlMs) || ttlMs < 20000) {
    throw new Error('invalid-sweep-lease-configuration');
  }

  const ref = store.doc('system/gameSweepLease');
  return async function claimOrRenew() {
    const now = clock();
    if (!Number.isFinite(now)) throw new Error('invalid-sweep-lease-clock');
    return store.runTransaction(async tx => {
      const current = await tx.get(ref);
      const lease = current.data() || {};
      if (lease.owner && lease.owner !== ownerId && Number(lease.expiresAt) > now) {
        return false;
      }
      tx.set(ref, { owner: ownerId, expiresAt: now + ttlMs, renewedAt: now });
      return true;
    });
  };
}
