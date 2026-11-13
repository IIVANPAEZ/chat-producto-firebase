import type { Product } from '../../chat/interfaces/chat-message.interface';

export interface Order {
  id: string;
  chatId: string;
  messageId: string;
  product: Product;
  status: 'created';
  createdAt: number;
}

export interface CreateOrderInput {
  chatId: string;
  messageId: string;
  product: Product;
}
