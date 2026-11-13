import type { Order } from '../../orders/interfaces/order.interface';

// serverData: datos del servidor; writeError: escritura rechazada por las reglas
const mockFirebase = {
  serverData: {} as Record<string, unknown>,
  writeError: null as Error | null,
  // simula una cancelación del comercio justo antes del fallo
  beforeWriteFails: null as (() => void) | null,
  pushCounter: 0,
};

jest.mock('../../config/env', () => ({
  env: { chatId: 'chat-1', apiUrl: 'http://api.test' },
}));
jest.mock('../../config/firebase', () => ({ db: { fake: true } }));

jest.mock('firebase/database', () => {
  const failIfConfigured = async () => {
    if (mockFirebase.writeError) {
      mockFirebase.beforeWriteFails?.();
      throw mockFirebase.writeError;
    }
  };
  return {
    ref: jest.fn((_db: unknown, path: string) => ({ path })),
    push: jest.fn((parent: { path: string }) => {
      const key = `msg-${++mockFirebase.pushCounter}`;
      return { path: `${parent.path}/${key}`, key };
    }),
    get: jest.fn(async (ref: { path: string }) => ({
      val: () => mockFirebase.serverData[ref.path] ?? null,
    })),
    set: jest.fn(failIfConfigured),
    update: jest.fn(failIfConfigured),
    serverTimestamp: jest.fn(() => ({ '.sv': 'timestamp' })),
    orderByChild: jest.fn(),
    query: jest.fn((ref: unknown) => ref),
    onValue: jest.fn(),
  };
});

import { get, set, update } from 'firebase/database';
import {
  answerOffer,
  ChatValidationError,
  OfferNotPendingError,
  sendTextMessage,
} from './chat.service';
import { OrdersApiError } from '../../orders/services/orders.service';

const OFFER_PATH = 'chats/chat-1/messages/offer-1';
const product = {
  id: 'prod-1',
  name: 'Bandeja paisa',
  price: 35000,
  currency: 'COP',
};
const offer = (status = 'pending') => ({
  sender: 'comercio',
  type: 'product_offer',
  status,
  createdAt: 1000,
  product,
});
const order: Order = {
  id: 'order-1',
  chatId: 'chat-1',
  messageId: 'offer-1',
  product,
  status: 'created',
  createdAt: 2000,
};

let createOrder: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFirebase.serverData = { [OFFER_PATH]: offer() };
  mockFirebase.writeError = null;
  mockFirebase.beforeWriteFails = null;
  mockFirebase.pushCounter = 0;
  createOrder = jest.fn().mockResolvedValue(order);
});

describe('answerOffer — aprobar', () => {
  it('crea el pedido en la API con los datos de la oferta', async () => {
    await answerOffer('chat-1', 'offer-1', 'accepted', { createOrder });

    expect(createOrder).toHaveBeenCalledWith({
      chatId: 'chat-1',
      messageId: 'offer-1',
      product,
    });
  });

  it('marca accepted y publica order_accepted en UNA sola escritura atómica', async () => {
    const result = await answerOffer('chat-1', 'offer-1', 'accepted', {
      createOrder,
    });

    expect(result).toEqual(order);
    expect(update).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      { path: 'chats/chat-1/messages' },
      {
        'offer-1/status': 'accepted',
        'offer-1/product': product,
        'msg-1': {
          sender: 'cliente',
          type: 'order_accepted',
          orderId: 'order-1',
          offerMessageId: 'offer-1',
          createdAt: { '.sv': 'timestamp' },
        },
      },
    );
  });

  it('si el comercio corrige la oferta durante la aprobación, queda el producto del pedido', async () => {
    createOrder.mockImplementation(async input => {
      mockFirebase.serverData[OFFER_PATH] = {
        ...offer(),
        product: { ...product, price: 99000 },
      };
      return { ...order, product: input.product };
    });

    await answerOffer('chat-1', 'offer-1', 'accepted', { createOrder });

    const payload = (update as jest.Mock).mock.calls[0][1];
    expect(payload['offer-1/product']).toEqual(product);
  });

  it('llama a la API antes de escribir en Firebase', async () => {
    await answerOffer('chat-1', 'offer-1', 'accepted', { createOrder });

    const apiOrder = createOrder.mock.invocationCallOrder[0];
    const writeOrder = (update as jest.Mock).mock.invocationCallOrder[0];
    expect(apiOrder).toBeLessThan(writeOrder);
  });

  it('si la API falla no escribe nada en Firebase y propaga el error', async () => {
    createOrder.mockRejectedValue(new OrdersApiError('API caída'));

    await expect(
      answerOffer('chat-1', 'offer-1', 'accepted', { createOrder }),
    ).rejects.toThrow('API caída');
    expect(update).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('si el comercio cancela mientras se crea el pedido, informa que fue cancelada', async () => {
    mockFirebase.writeError = new Error('PERMISSION_DENIED');
    mockFirebase.beforeWriteFails = () => {
      mockFirebase.serverData[OFFER_PATH] = offer('cancelled');
    };

    const promise = answerOffer('chat-1', 'offer-1', 'accepted', {
      createOrder,
    });

    await expect(promise).rejects.toBeInstanceOf(OfferNotPendingError);
    await expect(promise).rejects.toThrow('El comercio canceló esta oferta');
  });

  it('si la escritura falla por otro motivo (oferta sigue pending) propaga el error original', async () => {
    mockFirebase.writeError = new Error('network error');

    await expect(
      answerOffer('chat-1', 'offer-1', 'accepted', { createOrder }),
    ).rejects.toThrow('network error');
  });
});

describe('answerOffer — validaciones previas', () => {
  it.each([
    ['accepted', 'Esta oferta ya fue respondida'],
    ['rejected', 'Esta oferta ya fue respondida'],
    ['cancelled', 'El comercio canceló esta oferta'],
  ])(
    'con la oferta en %s no llama a la API ni escribe',
    async (status, message) => {
      mockFirebase.serverData[OFFER_PATH] = offer(status);

      await expect(
        answerOffer('chat-1', 'offer-1', 'accepted', { createOrder }),
      ).rejects.toThrow(message);
      expect(createOrder).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('si la oferta no existe lo informa', async () => {
    mockFirebase.serverData = {};

    await expect(
      answerOffer('chat-1', 'offer-1', 'rejected', { createOrder }),
    ).rejects.toThrow('La oferta no existe');
    expect(set).not.toHaveBeenCalled();
  });

  it('no permite responder un mensaje que no es oferta', async () => {
    mockFirebase.serverData[OFFER_PATH] = {
      sender: 'comercio',
      type: 'text',
      text: 'Hola',
      createdAt: 1,
    };

    await expect(
      answerOffer('chat-1', 'offer-1', 'accepted', { createOrder }),
    ).rejects.toBeInstanceOf(OfferNotPendingError);
  });

  it('lee la oferta desde el servidor antes de responder', async () => {
    await answerOffer('chat-1', 'offer-1', 'rejected', { createOrder });
    expect(get).toHaveBeenCalledWith({ path: OFFER_PATH });
  });
});

describe('answerOffer — rechazar', () => {
  it('solo marca la oferta como rejected y no llama a la API', async () => {
    const result = await answerOffer('chat-1', 'offer-1', 'rejected', {
      createOrder,
    });

    expect(result).toBeNull();
    expect(set).toHaveBeenCalledWith(
      { path: `${OFFER_PATH}/status` },
      'rejected',
    );
    expect(createOrder).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('si el comercio canceló justo antes, lo informa', async () => {
    mockFirebase.writeError = new Error('PERMISSION_DENIED');
    mockFirebase.beforeWriteFails = () => {
      mockFirebase.serverData[OFFER_PATH] = offer('cancelled');
    };

    await expect(
      answerOffer('chat-1', 'offer-1', 'rejected', { createOrder }),
    ).rejects.toThrow('El comercio canceló esta oferta');
  });
});

describe('sendTextMessage', () => {
  it('envía el texto recortado siempre como cliente', async () => {
    const id = await sendTextMessage('chat-1', '  Hola  ');

    expect(id).toBe('msg-1');
    expect(set).toHaveBeenCalledWith(
      { path: 'chats/chat-1/messages/msg-1', key: 'msg-1' },
      {
        sender: 'cliente',
        type: 'text',
        text: 'Hola',
        createdAt: { '.sv': 'timestamp' },
      },
    );
  });

  it('rechaza un texto vacío sin escribir', async () => {
    await expect(sendTextMessage('chat-1', '  ')).rejects.toBeInstanceOf(
      ChatValidationError,
    );
    expect(set).not.toHaveBeenCalled();
  });
});
