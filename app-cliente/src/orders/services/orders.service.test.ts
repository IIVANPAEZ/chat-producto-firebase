jest.mock('../../config/env', () => ({
  env: { apiUrl: 'http://api.test' },
}));

import { createOrder, OrdersApiError } from './orders.service';

const input = {
  chatId: 'chat-1',
  messageId: 'offer-1',
  product: {
    id: 'prod-1',
    name: 'Bandeja paisa',
    price: 35000,
    currency: 'COP',
  },
};

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);

describe('createOrder', () => {
  it('hace POST /orders con el JSON del pedido y devuelve el pedido', async () => {
    const order = { id: 'order-1', ...input, status: 'created', createdAt: 1 };
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(201, order));

    await expect(createOrder(input, { fetchFn })).resolves.toEqual(order);
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/orders',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    );
  });

  it('acepta 200 (pedido ya existente, API idempotente)', async () => {
    const order = { id: 'order-1', ...input, status: 'created', createdAt: 1 };
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, order));

    await expect(createOrder(input, { fetchFn })).resolves.toEqual(order);
  });

  it('muestra los mensajes de validación de la API', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        statusCode: 400,
        message: ['price debe ser mayor que cero', 'currency inválida'],
      }),
    );

    const promise = createOrder(input, { fetchFn });
    await expect(promise).rejects.toBeInstanceOf(OrdersApiError);
    await expect(promise).rejects.toMatchObject({
      message: 'price debe ser mayor que cero, currency inválida',
      status: 400,
    });
  });

  it('usa un mensaje genérico si el error no trae cuerpo JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('no es JSON');
      },
    } as unknown as Response);

    await expect(createOrder(input, { fetchFn })).rejects.toThrow(
      'El servidor de pedidos respondió 502',
    );
  });

  it('informa claramente cuando la API no responde', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValue(new TypeError('Network request failed'));

    await expect(createOrder(input, { fetchFn })).rejects.toThrow(
      'No se pudo conectar con el servidor de pedidos',
    );
  });

  it('rechaza una respuesta exitosa sin id de pedido', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(201, { ok: true }));

    await expect(createOrder(input, { fetchFn })).rejects.toThrow(
      'Respuesta inválida',
    );
  });

  it('corta la petición si la API tarda más de 10 segundos', async () => {
    jest.useFakeTimers();
    const fetchFn = jest.fn(
      (_input: RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
        }),
    );

    const promise = createOrder(input, { fetchFn });
    jest.advanceTimersByTime(10_000);

    await expect(promise).rejects.toThrow(
      'No se pudo conectar con el servidor de pedidos',
    );
    jest.useRealTimers();
  });
});
