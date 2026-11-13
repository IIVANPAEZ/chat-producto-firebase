export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export type OrderStatus = 'created';

export interface Order {
  id: string;
  chatId: string;
  // id del mensaje product_offer en Firebase
  messageId: string;
  product: Product;
  status: OrderStatus;
  createdAt: number;
}
