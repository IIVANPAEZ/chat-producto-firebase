import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import type { Order } from '../interfaces/order.interface.js';

export interface CreateOrderResult {
  order: Order;
  created: boolean;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  private readonly filePath: string;
  private readonly allowedChatId?: string;
  private readonly orders = new Map<string, Order>();
  // cola de escrituras: evita que dos pedidos simultáneos se pisen el archivo
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(config: ConfigService) {
    this.filePath = resolve(config.get<string>('ORDERS_FILE_PATH', 'orders.json'));
    this.allowedChatId = config.get<string>('CHAT_ID') || undefined;
  }

  async onModuleInit(): Promise<void> {
    const stored = await this.readFromDisk();
    for (const order of stored) this.orders.set(order.id, order);
    this.logger.log(`${this.orders.size} pedido(s) cargados desde ${this.filePath}`);
  }

  async create(dto: CreateOrderDto): Promise<CreateOrderResult> {
    if (this.allowedChatId && dto.chatId !== this.allowedChatId) {
      throw new BadRequestException(`chatId ${dto.chatId} no corresponde al chat configurado`);
    }

    const existing = this.findByOffer(dto.chatId, dto.messageId);
    if (existing) return { order: existing, created: false };

    const order: Order = {
      id: randomUUID(),
      chatId: dto.chatId,
      messageId: dto.messageId,
      product: {
        id: dto.product.id,
        name: dto.product.name,
        price: dto.product.price,
        currency: dto.product.currency,
        ...(dto.product.imageUrl ? { imageUrl: dto.product.imageUrl } : {}),
      },
      status: 'created',
      createdAt: Date.now(),
    };

    this.orders.set(order.id, order);
    try {
      await this.persist();
    } catch (error) {
      this.orders.delete(order.id);
      this.logger.error('No se pudo escribir orders.json', error instanceof Error ? error.stack : error);
      throw new InternalServerErrorException('No se pudo guardar el pedido');
    }
    return { order, created: true };
  }

  findOne(id: string): Order {
    const order = this.orders.get(id);
    if (!order) throw new NotFoundException(`No existe el pedido ${id}`);
    return order;
  }

  findAll(): Order[] {
    return [...this.orders.values()];
  }

  private findByOffer(chatId: string, messageId: string): Order | undefined {
    for (const order of this.orders.values()) {
      if (order.chatId === chatId && order.messageId === messageId) return order;
    }
    return undefined;
  }

  private async readFromDisk(): Promise<Order[]> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    if (raw.trim() === '') return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${this.filePath} debe contener un arreglo de pedidos`);
    }
    return parsed as Order[];
  }

  // escritura atómica (.tmp + rename) para no dejar el json corrupto
  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.findAll(), null, 2);
    const run = async (): Promise<void> => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tmpPath = `${this.filePath}.tmp`;
      await writeFile(tmpPath, snapshot + '\n', 'utf8');
      await rename(tmpPath, this.filePath);
    };
    const next = this.writeQueue.then(run, run);
    this.writeQueue = next.catch(() => undefined);
    return next;
  }
}
