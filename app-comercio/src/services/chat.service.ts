import {
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  type Database,
} from 'firebase/database';
import { db as defaultDb } from '../config/firebase';
import type {
  ChatMessage,
  OfferStatus,
  Product,
  Sender,
} from '../types/chat';

export const MAX_TEXT_LENGTH = 1000;

const SENDERS: readonly Sender[] = ['cliente', 'comercio'];
const OFFER_STATUSES: readonly OfferStatus[] = ['pending', 'accepted', 'rejected', 'cancelled'];

export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatValidationError';
  }
}

export class OfferNotPendingError extends Error {
  constructor(message = 'La oferta ya no está pendiente') {
    super(message);
    this.name = 'OfferNotPendingError';
  }
}

const messagesRef = (database: Database, chatId: string) =>
  ref(database, `chats/${chatId}/messages`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Convierte un nodo de Firebase en un ChatMessage tipado.
 * Devuelve null si el nodo no tiene la forma esperada (se ignora en la UI).
 */
export const parseMessage = (id: string, raw: unknown): ChatMessage | null => {
  if (!isRecord(raw)) return null;
  const { sender, type, createdAt } = raw;
  if (!SENDERS.includes(sender as Sender) || typeof createdAt !== 'number') return null;
  const base = { id, sender: sender as Sender, createdAt };

  switch (type) {
    case 'text':
      return isNonEmptyString(raw.text) ? { ...base, type, text: raw.text } : null;

    case 'product_offer': {
      const { product, status } = raw;
      if (!OFFER_STATUSES.includes(status as OfferStatus) || !isRecord(product)) return null;
      if (
        !isNonEmptyString(product.id) ||
        !isNonEmptyString(product.name) ||
        typeof product.price !== 'number' ||
        !isNonEmptyString(product.currency)
      ) {
        return null;
      }
      return {
        ...base,
        type,
        status: status as OfferStatus,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          currency: product.currency,
          ...(isNonEmptyString(product.imageUrl) ? { imageUrl: product.imageUrl } : {}),
        },
      };
    }

    case 'order_accepted':
      return isNonEmptyString(raw.orderId) && isNonEmptyString(raw.offerMessageId)
        ? { ...base, type, orderId: raw.orderId, offerMessageId: raw.offerMessageId }
        : null;

    default:
      return null;
  }
};

const normalizeText = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new ChatValidationError('El mensaje no puede estar vacío');
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new ChatValidationError(`El mensaje supera los ${MAX_TEXT_LENGTH} caracteres`);
  }
  return trimmed;
};

const normalizeProduct = (product: Product): Product => {
  const id = product.id.trim();
  const name = product.name.trim();
  const currency = product.currency.trim().toUpperCase();
  const imageUrl = product.imageUrl?.trim();

  if (!id) throw new ChatValidationError('El producto necesita un id');
  if (!name) throw new ChatValidationError('El producto necesita un nombre');
  if (!Number.isFinite(product.price) || product.price <= 0) {
    throw new ChatValidationError('El precio debe ser mayor que cero');
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ChatValidationError('La moneda debe ser un código de 3 letras (ej. COP)');
  }
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    throw new ChatValidationError('La imagen debe ser una URL http(s)');
  }

  return { id, name, price: product.price, currency, ...(imageUrl ? { imageUrl } : {}) };
};

/** Envía un mensaje de texto y devuelve el id generado. */
export const sendTextMessage = async (
  chatId: string,
  sender: Sender,
  text: string,
  database: Database = defaultDb,
): Promise<string> => {
  const newRef = push(messagesRef(database, chatId));
  await set(newRef, {
    sender,
    type: 'text',
    text: normalizeText(text),
    createdAt: serverTimestamp(),
  });
  return newRef.key!;
};

/** El comercio publica una oferta de producto (nace siempre en estado pending). */
export const sendProductOffer = async (
  chatId: string,
  product: Product,
  database: Database = defaultDb,
): Promise<string> => {
  const newRef = push(messagesRef(database, chatId));
  await set(newRef, {
    sender: 'comercio',
    type: 'product_offer',
    status: 'pending',
    product: normalizeProduct(product),
    createdAt: serverTimestamp(),
  });
  return newRef.key!;
};

/**
 * Escucha en tiempo real los mensajes del chat ordenados por fecha.
 * Devuelve la función para dejar de escuchar.
 */
export const listenMessages = (
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
  database: Database = defaultDb,
): (() => void) => {
  const messagesQuery = query(messagesRef(database, chatId), orderByChild('createdAt'));

  return onValue(
    messagesQuery,
    (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((child) => {
        const message = child.key ? parseMessage(child.key, child.val()) : null;
        if (message) messages.push(message);
      });
      onMessages(messages);
    },
    (error) => onError?.(error),
  );
};

/**
 * El comercio cancela una oferta. Usa una transacción para no pisar una
 * respuesta del cliente que llegue al mismo tiempo: solo cambia si sigue pending.
 */
export const cancelOffer = async (
  chatId: string,
  offerMessageId: string,
  database: Database = defaultDb,
): Promise<void> => {
  const offerRef = ref(database, `chats/${chatId}/messages/${offerMessageId}`);

  const result = await runTransaction(offerRef, (current: unknown) => {
    // La primera ejecución puede venir con null (sin caché local): se devuelve tal cual
    // y Firebase vuelve a ejecutar la función con el valor real del servidor.
    if (current === null) return current;
    if (!isRecord(current) || current.type !== 'product_offer' || current.status !== 'pending') {
      return undefined; // aborta la transacción
    }
    return { ...current, status: 'cancelled' };
  });

  const status = isRecord(result.snapshot.val()) ? result.snapshot.val().status : undefined;
  if (!result.committed || status !== 'cancelled') {
    throw new OfferNotPendingError();
  }
};
