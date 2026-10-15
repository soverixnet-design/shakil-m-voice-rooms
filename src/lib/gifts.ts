import { collection, doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { walletApi } from './walletApi';

const pending = new Map<string, any>();

export async function sendDirectGift(
  firestoreDb: Firestore,
  args: {
    senderId: string;
    receiverId: string;
    roomId?: string;
    item: { name: string; emoji: string; image?: string; cost: number };
    quantity: number;
  }
) {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid !== args.senderId) {
    throw new Error('Google দিয়ে লগইন করুন।');
  }

  const cost = args.item.cost * args.quantity;
  if (!Number.isSafeInteger(args.quantity) || args.quantity < 1 || args.quantity > 999 || !Number.isSafeInteger(args.item.cost) || args.item.cost <= 0 || !Number.isSafeInteger(cost)) {
    throw new Error('সঠিক গিফট ও সংখ্যা দিন।');
  }

  const key = JSON.stringify([args.senderId, args.receiverId, args.item.name, args.item.cost, args.item.image || '', args.quantity]);
  const data = pending.get(key) || { ...args, requestId: crypto.randomUUID() };
  pending.set(key, data);

  // Strategy 1: Try via walletApi if available
  try {
    const apiResult = await walletApi('gift', data);
    pending.delete(key);
    return apiResult;
  } catch (apiError: any) {
    // If client is unauthenticated or explicitly invalid, don't fallback silently to avoid invalid debits
    if (['functions/failed-precondition', 'functions/invalid-argument', 'functions/unauthenticated'].includes(apiError?.code)) {
      pending.delete(key);
      const messages: any = {
        'insufficient-coins': 'কয়েন যথেষ্ট নয়।',
        'inactive-user': 'সক্রিয় ইউজার পাওয়া যায়নি।',
        'invalid-gift': 'গিফটের দাম বদলেছে। আবার গিফট বেছে নিন।'
      };
      if (messages[apiError.message]) apiError.message = messages[apiError.message];
      throw apiError;
    }

    // Strategy 2: Fallback to direct Firestore atomic transaction
    const targetDb = firestoreDb || db;
    const ledger = doc(collection(targetDb, 'transactions'));

    try {
      const result = await runTransaction(targetDb, async (t) => {
        const senderRef = doc(targetDb, 'users', args.senderId);
        const receiverRef = doc(targetDb, 'users', args.receiverId);

        const source = await t.get(senderRef);
        const destination = args.senderId === args.receiverId ? source : await t.get(receiverRef);

        if (!source.exists()) {
          throw new Error('আপনার প্রোফাইল পাওয়া যায়নি।');
        }

        const sender = source.data();
        const recipient = destination.exists() ? destination.data() : { name: 'বন্ধু', id: args.receiverId, avatar: '👤', coins: 0 };
        const senderCoins = Number(sender.coins || 0);

        if (!Number.isSafeInteger(senderCoins) || senderCoins < cost) {
          throw new Error('কয়েন যথেষ্ট নয়।');
        }

        const receiverOnline = recipient.online === true && Date.now() - (recipient.lastSeen?.toMillis?.() || 0) < 90000;
        const destinationRoom = receiverOnline && recipient.currentRoomId ? String(recipient.currentRoomId) : args.roomId || null;

        const event = {
          type: 'gift_sent',
          senderId: args.senderId,
          receiverId: args.receiverId,
          userId: args.senderId,
          senderName: String(sender.name || 'ইউজার').slice(0, 80),
          receiverName: String(recipient.name || 'ইউজার').slice(0, 80),
          receiverPublicId: String(recipient.id || args.receiverId),
          receiverAvatar: String(recipient.avatar || '👤').slice(0, 24),
          giftName: String(args.item.name || 'গিফট').slice(0, 80),
          emoji: String(args.item.emoji || '🎁').slice(0, 24),
          giftImage: args.item.image || '',
          quantity: args.quantity,
          cost,
          roomId: destinationRoom,
          createdAt: serverTimestamp()
        };

        // Update sender balance and sent counters
        // Update sender balance and sent counters (satisfies validGiftDebit)
        t.update(senderRef, {
          coins: senderCoins - cost,
          lastGiftReceipt: ledger.id,
          giftSentCount: Number(sender.giftSentCount || 0) + args.quantity,
          giftSentCoins: Number(sender.giftSentCoins || 0) + cost
        });

        t.set(ledger, event);

        // Broadcast to live room so RoomGiftFlights animates across seats
        if (destinationRoom) {
          t.set(doc(targetDb, 'rooms', destinationRoom, 'giftEvents', ledger.id), event);
        }

        return { ...event, id: ledger.id, balance: senderCoins - cost };
      });

      pending.delete(key);
      return result;
    } catch (txError: any) {
      pending.delete(key);
      const messages: any = {
        'insufficient-coins': 'কয়েন যথেষ্ট নয়।',
        'inactive-user': 'সক্রিয় ইউজার পাওয়া যায়নি।'
      };
      if (messages[txError?.message]) {
        throw new Error(messages[txError.message]);
      }
      throw txError;
    }
  }
}
