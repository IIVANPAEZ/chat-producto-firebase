import { env } from '../../config/env';
import type { CreateOrderInput, Order } from '../interfaces/order.interface';

export class OrdersApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'OrdersApiError';
  }
}

const TIMEOUT_MS = 10_000;

const errorMessageFrom = (body: unknown): string | null => {
  if (typeof body !== 'object' || body === null || !('message' in body)) {
    return null;
  }
  const { message } = body as { message: unknown };
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return typeof message === 'string' ? message : null;
};

export const createOrder = async (
  input: CreateOrderInput,
  {
    apiUrl = env.apiUrl,
    fetchFn = fetch,
  }: { apiUrl?: string; fetchFn?: typeof fetch } = {},
): Promise<Order> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchFn(`${apiUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
  } catch {
    throw new OrdersApiError(
      'No se pudo conectar con el servidor de pedidos. Revisá que la API esté corriendo.',
    );
  } finally {
    clearTimeout(timeout);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new OrdersApiError(
      errorMessageFrom(body) ??
        `El servidor de pedidos respondió ${response.status}`,
      response.status,
    );
  }

  const order = body as Partial<Order> | null;
  if (!order || typeof order.id !== 'string') {
    throw new OrdersApiError('Respuesta inválida del servidor de pedidos');
  }
  return order as Order;
};
