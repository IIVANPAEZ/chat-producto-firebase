import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../interfaces/chat-message.interface';

// mock de firebase con estado del servidor controlable
const fake = vi.hoisted(() => {
  const SERVER_TIMESTAMP = { '.sv': 'timestamp' };
  let pushCounter = 0;

  type Listener = {
    path: string;
    onData: (snapshot: unknown) => void;
    onError?: (error: Error) => void;
  };

  const state = {
    listeners: [] as Listener[],
    unsubscribed: 0,
    serverValue: null as unknown,
    writeError: null as Error | null,
  };

  const reset = () => {
    pushCounter = 0;
    state.listeners = [];
    state.unsubscribed = 0;
    state.serverValue = null;
    state.writeError = null;
  };

  return { SERVER_TIMESTAMP, state, reset, nextKey: () => `msg-${++pushCounter}` };
});

vi.mock('../../config/firebase', () => ({ db: { fake: true } }));

vi.mock('firebase/database', () => ({
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn((parent: { path: string }) => {
    const key = fake.nextKey();
    return { path: `${parent.path}/${key}`, key };
  }),
  set: vi.fn(async () => undefined),
  serverTimestamp: vi.fn(() => fake.SERVER_TIMESTAMP),
  orderByChild: vi.fn((field: string) => ({ orderByChild: field })),
  query: vi.fn((ref: { path: string }) => ref),
  onValue: vi.fn(
    (
      ref: { path: string },
      onData: (snapshot: unknown) => void,
      onError?: (error: Error) => void,
    ) => {
      fake.state.listeners.push({ path: ref.path, onData, onError });
      return () => {
        fake.state.unsubscribed++;
      };
    },
  ),
  // writeError simula que las reglas rechazan la escritura
  update: vi.fn(async () => {
    if (fake.state.writeError) throw fake.state.writeError;
  }),
  get: vi.fn(async () => ({ val: () => fake.state.serverValue })),
}));

const firebase = await import('firebase/database');
const {
  cancelOffer,
  ChatValidationError,
  listenMessages,
  MAX_TEXT_LENGTH,
  OfferNotPendingError,
  parseMessage,
  sendProductOffer,
  sendTextMessage,
  updateOffer,
} = await import('./chat.service');

const snapshotOf = (children: Record<string, unknown>) => ({
  forEach: (cb: (child: { key: string; val: () => unknown }) => void) => {
    for (const [key, value] of Object.entries(children)) cb({ key, val: () => value });
  },
});

const validOffer = {
  sender: 'comercio',
  type: 'product_offer',
  status: 'pending',
  createdAt: 1000,
  product: { id: 'prod-1', name: 'Bandeja paisa', price: 35000, currency: 'COP' },
};

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
});

describe('parseMessage', () => {
  it('convierte un mensaje de texto válido', () => {
    expect(
      parseMessage('m1', { sender: 'cliente', type: 'text', text: 'Hola', createdAt: 1 }),
    ).toEqual({ id: 'm1', sender: 'cliente', type: 'text', text: 'Hola', createdAt: 1 });
  });

  it('convierte una oferta válida y conserva imageUrl si existe', () => {
    const raw = {
      ...validOffer,
      product: { ...validOffer.product, imageUrl: 'https://img/1.png' },
    };
    expect(parseMessage('o1', raw)).toEqual({
      id: 'o1',
      sender: 'comercio',
      type: 'product_offer',
      status: 'pending',
      createdAt: 1000,
      product: { ...raw.product },
    });
  });

  it('convierte un mensaje order_accepted', () => {
    expect(
      parseMessage('a1', {
        sender: 'cliente',
        type: 'order_accepted',
        orderId: 'ord-1',
        offerMessageId: 'o1',
        createdAt: 5,
      }),
    ).toMatchObject({ type: 'order_accepted', orderId: 'ord-1', offerMessageId: 'o1' });
  });

  it.each([
    ['null', null],
    ['sin sender', { type: 'text', text: 'Hola', createdAt: 1 }],
    ['sender desconocido', { sender: 'admin', type: 'text', text: 'Hola', createdAt: 1 }],
    ['createdAt no numérico', { sender: 'cliente', type: 'text', text: 'Hola', createdAt: 'ayer' }],
    ['texto vacío', { sender: 'cliente', type: 'text', text: '   ', createdAt: 1 }],
    ['tipo desconocido', { sender: 'cliente', type: 'sticker', createdAt: 1 }],
    ['oferta con estado inválido', { ...validOffer, status: 'paid' }],
    ['oferta sin producto', { ...validOffer, product: undefined }],
    ['oferta con precio texto', { ...validOffer, product: { ...validOffer.product, price: '100' } }],
    ['order_accepted sin orderId', { sender: 'cliente', type: 'order_accepted', offerMessageId: 'o1', createdAt: 1 }],
  ])('devuelve null para un mensaje mal formado: %s', (_label, raw) => {
    expect(parseMessage('x', raw)).toBeNull();
  });
});

describe('sendTextMessage', () => {
  it('guarda el texto recortado con hora del servidor y devuelve el id', async () => {
    const id = await sendTextMessage('chat-1', 'comercio', '  Hola  ');

    expect(id).toBe('msg-1');
    expect(firebase.set).toHaveBeenCalledWith(
      { path: 'chats/chat-1/messages/msg-1', key: 'msg-1' },
      { sender: 'comercio', type: 'text', text: 'Hola', createdAt: fake.SERVER_TIMESTAMP },
    );
  });

  it('rechaza un texto vacío sin escribir en Firebase', async () => {
    await expect(sendTextMessage('chat-1', 'comercio', '   ')).rejects.toBeInstanceOf(
      ChatValidationError,
    );
    expect(firebase.set).not.toHaveBeenCalled();
  });

  it(`rechaza textos de más de ${MAX_TEXT_LENGTH} caracteres`, async () => {
    await expect(
      sendTextMessage('chat-1', 'comercio', 'a'.repeat(MAX_TEXT_LENGTH + 1)),
    ).rejects.toThrow(`supera los ${MAX_TEXT_LENGTH}`);
    expect(firebase.set).not.toHaveBeenCalled();
  });

  it('acepta exactamente el máximo permitido', async () => {
    await expect(
      sendTextMessage('chat-1', 'comercio', 'a'.repeat(MAX_TEXT_LENGTH)),
    ).resolves.toBe('msg-1');
  });
});

describe('sendProductOffer', () => {
  const product = { id: ' prod-1 ', name: ' Bandeja paisa ', price: 35000, currency: 'cop' };

  it('publica la oferta normalizada, siempre en estado pending y como comercio', async () => {
    const id = await sendProductOffer('chat-1', product);

    expect(id).toBe('msg-1');
    expect(firebase.set).toHaveBeenCalledWith(expect.objectContaining({ key: 'msg-1' }), {
      sender: 'comercio',
      type: 'product_offer',
      status: 'pending',
      product: { id: 'prod-1', name: 'Bandeja paisa', price: 35000, currency: 'COP' },
      createdAt: fake.SERVER_TIMESTAMP,
    });
  });

  it('incluye imageUrl solo cuando viene informada', async () => {
    await sendProductOffer('chat-1', { ...product, imageUrl: ' https://img/1.png ' });
    const payload = vi.mocked(firebase.set).mock.calls[0][1] as { product: object };
    expect(payload.product).toHaveProperty('imageUrl', 'https://img/1.png');

    await sendProductOffer('chat-1', { ...product, imageUrl: '   ' });
    const payload2 = vi.mocked(firebase.set).mock.calls[1][1] as { product: object };
    expect(payload2.product).not.toHaveProperty('imageUrl');
  });

  it.each([
    ['precio cero', { price: 0 }, 'mayor que cero'],
    ['precio negativo', { price: -10 }, 'mayor que cero'],
    ['precio no numérico', { price: Number.NaN }, 'mayor que cero'],
    ['sin nombre', { name: '  ' }, 'nombre'],
    ['sin id', { id: '' }, 'id'],
    ['moneda de 2 letras', { currency: 'CO' }, '3 letras'],
    ['moneda con números', { currency: 'C0P' }, '3 letras'],
    ['imagen sin http', { imageUrl: 'ftp://img' }, 'URL http'],
  ])('rechaza %s sin escribir en Firebase', async (_label, override, message) => {
    await expect(sendProductOffer('chat-1', { ...product, ...override })).rejects.toThrow(
      message,
    );
    expect(firebase.set).not.toHaveBeenCalled();
  });
});

describe('listenMessages', () => {
  it('escucha los mensajes del chat ordenados por createdAt', () => {
    listenMessages('chat-1', vi.fn());

    expect(firebase.orderByChild).toHaveBeenCalledWith('createdAt');
    expect(fake.state.listeners[0].path).toBe('chats/chat-1/messages');
  });

  it('entrega los mensajes válidos en el orden recibido e ignora los mal formados', () => {
    const onMessages = vi.fn();
    listenMessages('chat-1', onMessages);

    fake.state.listeners[0].onData(
      snapshotOf({
        a: { sender: 'cliente', type: 'text', text: 'Hola', createdAt: 1 },
        roto: { sender: 'cliente', type: 'text', createdAt: 2 },
        b: validOffer,
      }),
    );

    const messages = onMessages.mock.calls[0][0] as ChatMessage[];
    expect(messages.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('entrega una lista vacía cuando el chat no tiene mensajes', () => {
    const onMessages = vi.fn();
    listenMessages('chat-1', onMessages);
    fake.state.listeners[0].onData(snapshotOf({}));
    expect(onMessages).toHaveBeenCalledWith([]);
  });

  it('propaga los errores de Firebase', () => {
    const onError = vi.fn();
    listenMessages('chat-1', vi.fn(), onError);
    fake.state.listeners[0].onError?.(new Error('permission_denied'));
    expect(onError).toHaveBeenCalledWith(new Error('permission_denied'));
  });

  it('devuelve una función que deja de escuchar', () => {
    const unsubscribe = listenMessages('chat-1', vi.fn());
    unsubscribe();
    expect(fake.state.unsubscribed).toBe(1);
  });
});

const OFFER_REF = { path: 'chats/chat-1/messages/o1' };
const permissionDenied = () => new Error('PERMISSION_DENIED');

describe('cancelOffer', () => {
  it('escribe solo status cancelled en la oferta', async () => {
    await expect(cancelOffer('chat-1', 'o1')).resolves.toBeUndefined();

    expect(firebase.update).toHaveBeenCalledWith(OFFER_REF, { status: 'cancelled' });
    expect(firebase.get).not.toHaveBeenCalled();
  });

  it.each(['accepted', 'rejected', 'cancelled'])(
    'si las reglas la rechazan porque ya está %s, lanza OfferNotPendingError',
    async (status) => {
      fake.state.writeError = permissionDenied();
      fake.state.serverValue = { ...validOffer, status };

      await expect(cancelOffer('chat-1', 'o1')).rejects.toBeInstanceOf(OfferNotPendingError);
    },
  );

  it('si la oferta no existe, lanza OfferNotPendingError', async () => {
    fake.state.writeError = permissionDenied();
    fake.state.serverValue = null;

    await expect(cancelOffer('chat-1', 'o1')).rejects.toBeInstanceOf(OfferNotPendingError);
  });

  it('no trata como oferta un mensaje de texto', async () => {
    fake.state.writeError = permissionDenied();
    fake.state.serverValue = { sender: 'comercio', type: 'text', text: 'Hola', createdAt: 1 };

    await expect(cancelOffer('chat-1', 'o1')).rejects.toBeInstanceOf(OfferNotPendingError);
  });

  it('si falla con la oferta todavía pending, propaga el error original', async () => {
    fake.state.writeError = new Error('network error');
    fake.state.serverValue = validOffer;

    await expect(cancelOffer('chat-1', 'o1')).rejects.toThrow('network error');
  });
});

describe('updateOffer', () => {
  const corrected = {
    id: 'prod-1',
    name: ' Bandeja paisa grande ',
    price: 42000,
    currency: 'cop',
  };

  it('escribe solo el producto normalizado, sin tocar el estado', async () => {
    await expect(updateOffer('chat-1', 'o1', corrected)).resolves.toBeUndefined();

    expect(firebase.update).toHaveBeenCalledWith(OFFER_REF, {
      product: { id: 'prod-1', name: 'Bandeja paisa grande', price: 42000, currency: 'COP' },
    });
  });

  it('reemplaza el producto completo, así se puede quitar la imagen', async () => {
    await updateOffer('chat-1', 'o1', corrected);

    const changes = vi.mocked(firebase.update).mock.calls[0][1] as { product: object };
    expect(changes.product).not.toHaveProperty('imageUrl');
  });

  it.each(['accepted', 'rejected', 'cancelled'])(
    'no corrige una oferta en estado %s',
    async (status) => {
      fake.state.writeError = permissionDenied();
      fake.state.serverValue = { ...validOffer, status };

      await expect(updateOffer('chat-1', 'o1', corrected)).rejects.toBeInstanceOf(
        OfferNotPendingError,
      );
    },
  );

  it('valida el producto antes de tocar Firebase', async () => {
    await expect(updateOffer('chat-1', 'o1', { ...corrected, price: 0 })).rejects.toBeInstanceOf(
      ChatValidationError,
    );
    expect(firebase.update).not.toHaveBeenCalled();
  });
});
