import type { Firestore } from 'firebase/firestore';
import { auth } from '../firebase';
import { walletApi } from './walletApi';

// Retain the same request ID when a network response is uncertain. The server
// owns the gift ledger and uses this ID to prevent a second debit on retries.
const pending = new Map<string, any>();
export async function sendDirectGift(
  _firestoreDb: Firestore,
  args: {
    senderId: string;
    receiverId: string;
    roomId?: string;
    item: { name: string; emoji: string; image?: string; cost: number };
    quantity: number;
  }
) {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== args.senderId)
    throw new Error('Sign in before sending a gift.');

  const cost = args.item.cost * args.quantity;
  if (!Number.isSafeInteger(args.quantity) || args.quantity < 1 || args.quantity > 999
      || !Number.isSafeInteger(args.item.cost) || args.item.cost <= 0 || !Number.isSafeInteger(cost))
    throw new Error('Select a valid gift and quantity.');

  const key = JSON.stringify([args.senderId, args.receiverId, args.roomId || '', args.item.name, args.item.cost, args.item.image || '', args.quantity]);
  const data = pending.get(key) || { ...args, requestId: crypto.randomUUID() };
  pending.set(key, data);
  try {
    // A single authenticated request makes the coin debit, diamond credit,
    // transaction receipt and room animation event atomically on the server.
    const result = await walletApi('gift', data);
    pending.delete(key);
    return result;
  } catch (error: any) {
    const rejected = ['functions/failed-precondition', 'functions/invalid-argument',
      'functions/unauthenticated', 'functions/permission-denied'].includes(error?.code)
      || ['insufficient-coins', 'inactive-user', 'invalid-gift', 'invalid-request', 'request-conflict'].includes(error?.message);
    if (rejected) {
      pending.delete(key);
      const messages: Record<string, string> = {
        'insufficient-coins': 'Not enough coins.',
        'inactive-user': 'An active sender or recipient was not found.',
        'invalid-gift': 'The gift catalog changed. Choose the gift again.',
        'request-conflict': 'This gift request does not match its existing receipt.'
      };
      throw new Error(messages[error?.message] || error?.message || 'Gift was not accepted.');
    }
    // Never fall back to a separate Firestore wallet: that can debit twice if
    // the server committed this request before a timeout.
    throw new Error('Gift result not confirmed. Tap Send again to verify the same request.');
  }
}
