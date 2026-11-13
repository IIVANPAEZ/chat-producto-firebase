import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { CreateOrderDto } from '../dto/create-order.dto.js';
import type { Order } from '../interfaces/order.interface.js';
import { OrdersService } from './orders.service.js';

const CHAT_ID = 'chat-test';

function buildDto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    chatId: CHAT_ID,
    messageId: '-Omsg1',
    product: {
      id: 'p-101',
      name: 'Bandeja paisa',
      price: 32000,
      currency: 'COP',
      imageUrl: 'https://ejemplo.com/bandeja.jpg',
    },
    ...overrides,
  };
}

describe('OrdersService', () => {
  let dir: string;
  let filePath: string;

  async function createService(env: Record<string, string> = {}): Promise<OrdersService> {
    const values: Record<string, string> = { ORDERS_FILE_PATH: filePath, ...env };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ConfigService,
          useValue: { get: (key: string, fallback?: string) => values[key] ?? fallback },
        },
      ],
    }).compile();
    await moduleRef.init(); // ejecuta onModuleInit (carga el json)
    return moduleRef.get(OrdersService);
  }

  async function readOrdersFile(): Promise<Order[]> {
    return JSON.parse(await readFile(filePath, 'utf8')) as Order[];
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'orders-spec-'));
    filePath = join(dir, 'orders.json');
  });

  afterEach(async () => {
    await chmod(dir, 0o700).catch(() => undefined);
    await rm(dir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('crea el pedido con id, status created y createdAt, y lo guarda en el archivo', async () => {
      const service = await createService();
      const before = Date.now();

      const { order, created } = await service.create(buildDto());

      expect(created).toBe(true);
      expect(order.id).toEqual(expect.any(String));
      expect(order.status).toBe('created');
      expect(order.createdAt).toBeGreaterThanOrEqual(before);
      expect(order).toMatchObject({ chatId: CHAT_ID, messageId: '-Omsg1', product: buildDto().product });
      expect(await readOrdersFile()).toEqual([order]);
    });

    it('es idempotente: la misma oferta (chatId + messageId) no duplica el pedido', async () => {
      const service = await createService();

      const first = await service.create(buildDto());
      const second = await service.create(buildDto());

      expect(second.created).toBe(false);
      expect(second.order).toEqual(first.order);
      expect(await readOrdersFile()).toHaveLength(1);
    });

    it('crea pedidos distintos para ofertas distintas', async () => {
      const service = await createService();

      const a = await service.create(buildDto({ messageId: '-OmsgA' }));
      const b = await service.create(buildDto({ messageId: '-OmsgB' }));

      expect(a.order.id).not.toBe(b.order.id);
      expect(await readOrdersFile()).toHaveLength(2);
    });

    it('guarda todos los pedidos cuando llegan en paralelo', async () => {
      const service = await createService();

      await Promise.all(
        Array.from({ length: 10 }, (_, i) => service.create(buildDto({ messageId: `-Omsg${i}` }))),
      );

      expect(await readOrdersFile()).toHaveLength(10);
    });

    it('no guarda imageUrl cuando no viene en el producto', async () => {
      const service = await createService();
      const { imageUrl: _omit, ...product } = buildDto().product;

      const { order } = await service.create(buildDto({ product }));

      expect(order.product).not.toHaveProperty('imageUrl');
    });

    it('rechaza con 400 un chatId distinto al configurado en CHAT_ID', async () => {
      const service = await createService({ CHAT_ID });

      await expect(service.create(buildDto({ chatId: 'otro-chat' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('acepta cualquier chatId cuando CHAT_ID no está configurado', async () => {
      const service = await createService();

      const { created } = await service.create(buildDto({ chatId: 'otro-chat' }));

      expect(created).toBe(true);
    });

    it('devuelve 500 y no deja el pedido en memoria si no puede escribir el archivo', async () => {
      const service = await createService();
      const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await chmod(dir, 0o500); // carpeta de solo lectura

      await expect(service.create(buildDto())).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(service.findAll()).toHaveLength(0);
      expect(logError).toHaveBeenCalledOnce();
      logError.mockRestore();
    });
  });

  describe('findOne', () => {
    it('devuelve el pedido por id', async () => {
      const service = await createService();
      const { order } = await service.create(buildDto());

      expect(service.findOne(order.id)).toEqual(order);
    });

    it('lanza 404 si el pedido no existe', async () => {
      const service = await createService();

      expect(() => service.findOne('no-existe')).toThrow(NotFoundException);
    });
  });

  describe('persistencia', () => {
    it('recupera los pedidos guardados al reiniciar', async () => {
      const first = await createService();
      const { order } = await first.create(buildDto());

      const restarted = await createService();

      expect(restarted.findOne(order.id)).toEqual(order);
    });

    it('arranca vacío si el archivo no existe o está vacío', async () => {
      expect((await createService()).findAll()).toEqual([]);

      await writeFile(filePath, '');
      expect((await createService()).findAll()).toEqual([]);
    });

    it('no arranca si orders.json tiene JSON inválido', async () => {
      await writeFile(filePath, '{ esto no es json');

      await expect(createService()).rejects.toThrow(SyntaxError);
    });

    it('no arranca si orders.json no contiene un arreglo', async () => {
      await writeFile(filePath, '{"id": "1"}');

      await expect(createService()).rejects.toThrow('debe contener un arreglo');
    });
  });
});
