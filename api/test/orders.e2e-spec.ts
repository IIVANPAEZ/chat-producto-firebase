import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import type { Order } from '../src/orders/interfaces/order.interface.js';

const CHAT_ID = 'chat-e2e';

const validBody = {
  chatId: CHAT_ID,
  messageId: '-Omsg1',
  product: {
    id: 'p-101',
    name: 'Bandeja paisa',
    price: 32000,
    currency: 'COP',
    imageUrl: 'https://ejemplo.com/bandeja.jpg',
  },
};

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let dir: string;

  beforeAll(async () => {
    // Las variables del proceso tienen prioridad sobre el .env: no se toca el orders.json real.
    dir = await mkdtemp(join(tmpdir(), 'orders-e2e-'));
    process.env.ORDERS_FILE_PATH = join(dir, 'orders.json');
    process.env.CHAT_ID = CHAT_ID;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración de validación que main.ts
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('POST /orders', () => {
    let createdOrder: Order;

    it('201: crea el pedido y devuelve id, status created y createdAt', async () => {
      const res = await request(app.getHttpServer()).post('/orders').send(validBody).expect(201);

      createdOrder = res.body as Order;
      expect(createdOrder).toMatchObject({
        id: expect.any(String),
        status: 'created',
        createdAt: expect.any(Number),
        chatId: CHAT_ID,
        messageId: '-Omsg1',
        product: validBody.product,
      });
    });

    it('200: repetir la misma oferta devuelve el pedido existente', async () => {
      const res = await request(app.getHttpServer()).post('/orders').send(validBody).expect(200);

      expect((res.body as Order).id).toBe(createdOrder.id);
    });

    it.each([
      ['falta chatId', { ...validBody, chatId: undefined }, 'chatId es obligatorio'],
      ['falta messageId', { ...validBody, messageId: undefined }, 'messageId es obligatorio'],
      ['falta product', { ...validBody, product: undefined }, 'product es obligatorio'],
      [
        'falta product.id',
        { ...validBody, product: { ...validBody.product, id: undefined } },
        'product.id es obligatorio',
      ],
      [
        'product.price es 0',
        { ...validBody, product: { ...validBody.product, price: 0 } },
        'product.price debe ser mayor que cero',
      ],
      [
        'product.price es negativo',
        { ...validBody, product: { ...validBody.product, price: -10 } },
        'product.price debe ser mayor que cero',
      ],
      [
        'product.price no es número',
        { ...validBody, product: { ...validBody.product, price: '32000' } },
        'product.price debe ser un número',
      ],
      ['campo no permitido', { ...validBody, extra: true }, 'property extra should not exist'],
    ])('400: %s', async (_case, body, expectedMessage) => {
      const res = await request(app.getHttpServer()).post('/orders').send(body).expect(400);

      expect((res.body as { message: string[] }).message).toContain(expectedMessage);
    });

    it('400: chatId distinto al configurado', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({ ...validBody, chatId: 'otro-chat', messageId: '-Omsg9' })
        .expect(400);

      expect((res.body as { message: string }).message).toContain('no corresponde');
    });

    it('400: JSON mal formado', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Content-Type', 'application/json')
        .send('{"chatId":')
        .expect(400);
    });
  });

  describe('GET /orders/:id', () => {
    it('200: devuelve el pedido guardado', async () => {
      const created = await request(app.getHttpServer())
        .post('/orders')
        .send({ ...validBody, messageId: '-Omsg2' })
        .expect(201);
      const id = (created.body as Order).id;

      const res = await request(app.getHttpServer()).get(`/orders/${id}`).expect(200);

      expect(res.body).toEqual(created.body);
    });

    it('404: el pedido no existe', async () => {
      await request(app.getHttpServer()).get('/orders/no-existe').expect(404);
    });
  });
});
