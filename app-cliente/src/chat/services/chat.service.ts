import {
  get,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  update,
  type Database,
} from 'firebase/database';
import { db as defaultDb } from '../../config/firebase';
import type {
  ChatMessage,
  OfferStatus,
  ProductOfferMessage,
  Sender,
} from '../interfaces/chat-message.interface';
import type { Order } from '../../orders/interfaces/order.interface';
import { createOrder as defaultCreateOrder } from '../../orders/services/orders.service';

export const MAX_TEXT_LENGTH = 1000;

const CURRENT_USER: Sender = 'cliente';
const SENDERS: readonly Sender[] = ['cliente', 'comercio'];
const OFFER_STATUSES: readonly OfferStatus[] = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
];

export class ChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatValidationError';
  }
}

export class OfferNotPendingError extends Error {
  constructor(readonly status?: OfferStatus) {
    super(
      status === 'cancelled'
        ? 'El comercio canceló esta oferta'
        : status
        ? 'Esta oferta ya fue respondida'
        : 'La oferta no existe',
    );
    this.name = 'OfferNotPendingError';
  }
}

const messagesPath = (chatId: string) => `chats/${chatId}/messages`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

// null si el nodo no tiene la forma esperada
export const parseMessage = (id: string, raw: unknown): ChatMessage | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const { sender, type, createdAt } = raw;
  if (!SENDERS.includes(sender as Sender) || typeof createdAt !== 'number') {
    return null;
  }
  const base = { id, sender: sender as Sender, createdAt };

  switch (type) {
    case 'text':
      return isNonEmptyString(raw.text)
        ? { ...base, type, text: raw.text }
        : null;

    case 'product_offer': {
      const { product, status } = raw;
      if (
        !OFFER_STATUSES.includes(status as OfferStatus) ||
        !isRecord(product)
      ) {
        return null;
      }
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
          ...(isNonEmptyString(product.imageUrl)
            ? { imageUrl: product.imageUrl }
            : {}),
        },
      };
    }

    case 'order_accepted':
      return isNonEmptyString(raw.orderId) &&
        isNonEmptyString(raw.offerMessageId)
        ? {
            ...base,
            type,
            orderId: raw.orderId,
            offerMessageId: raw.offerMessageId,
          }
        : null;

    default:
      return null;
  }
};

const normalizeText = (text: string): string => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new ChatValidationError('El mensaje no puede estar vacío');
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new ChatValidationError(
      `El mensaje supera los ${MAX_TEXT_LENGTH} caracteres`,
    );
  }
  return trimmed;
};

export const sendTextMessage = async (
  chatId: string,
  text: string,
  database: Database = defaultDb,
): Promise<string> => {
  const newRef = push(ref(database, messagesPath(chatId)));
  await set(newRef, {
    sender: CURRENT_USER,
    type: 'text',
    text: normalizeText(text),
    createdAt: serverTimestamp(),
  });
  return newRef.key!;
};

export const listenMessages = (
  chatId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
  database: Database = defaultDb,
): (() => void) => {
  const messagesQuery = query(
    ref(database, messagesPath(chatId)),
    orderByChild('createdAt'),
  );

  return onValue(
    messagesQuery,
    snapshot => {
      const messages: ChatMessage[] = [];
      snapshot.forEach(child => {
        const message = child.key ? parseMessage(child.key, child.val()) : null;
        if (message) {
          messages.push(message);
        }
      });
      onMessages(messages);
    },
    error => onError?.(error),
  );
};

const getPendingOffer = async (
  database: Database,
  chatId: string,
  offerId: string,
): Promise<ProductOfferMessage> => {
  const snapshot = await get(
    ref(database, `${messagesPath(chatId)}/${offerId}`),
  );
  const message = parseMessage(offerId, snapshot.val());
  if (!message || message.type !== 'product_offer') {
    throw new OfferNotPendingError();
  }
  if (message.status !== 'pending') {
    throw new OfferNotPendingError(message.status);
  }
  return message;
};

// si la oferta cambió de estado, se informa eso en lugar del error genérico
const explainWriteError = async (
  error: unknown,
  database: Database,
  chatId: string,
  offerId: string,
): Promise<never> => {
  await getPendingOffer(database, chatId, offerId);
  throw error;
};

export type OfferDecision = 'accepted' | 'rejected';

export interface AnswerOfferDeps {
  database?: Database;
  createOrder?: typeof defaultCreateOrder;
}

// Aprobar: pedido en la API y luego status + order_accepted en un único update atómico.
// Las reglas solo permiten pending -> accepted, así que una cancelación simultánea
// hace fallar toda la escritura. Reintentar no duplica pedidos.
export const answerOffer = async (
  chatId: string,
  offerId: string,
  decision: OfferDecision,
  {
    database = defaultDb,
    createOrder = defaultCreateOrder,
  }: AnswerOfferDeps = {},
): Promise<Order | null> => {
  const offer = await getPendingOffer(database, chatId, offerId);

  if (decision === 'rejected') {
    try {
      await set(
        ref(database, `${messagesPath(chatId)}/${offerId}/status`),
        'rejected',
      );
    } catch (error) {
      await explainWriteError(error, database, chatId, offerId);
    }
    return null;
  }

  const order = await createOrder({
    chatId,
    messageId: offerId,
    product: offer.product,
  });

  const orderMessageId = push(ref(database, messagesPath(chatId))).key!;
  try {
    await update(ref(database, messagesPath(chatId)), {
      [`${offerId}/status`]: 'accepted',
      // si el comercio corrigió la oferta mientras tanto, queda el producto del pedido
      [`${offerId}/product`]: order.product,
      [orderMessageId]: {
        sender: CURRENT_USER,
        type: 'order_accepted',
        orderId: order.id,
        offerMessageId: offerId,
        createdAt: serverTimestamp(),
      },
    });
  } catch (error) {
    await explainWriteError(error, database, chatId, offerId);
  }
  return order;
};
