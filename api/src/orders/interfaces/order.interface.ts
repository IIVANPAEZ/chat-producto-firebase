/** Producto ofrecido por el comercio (mismo shape que `product` en Firebase). */
export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export type OrderStatus = 'created';

/** Pedido guardado cuando el cliente aprueba una oferta. */
export interface Order {
  id: string;
  chatId: string;
  /** Id del mensaje product_offer en Firebase que originó el pedido. */
  messageId: string;
  product: Product;
  status: OrderStatus;
  /** Epoch en milisegundos, igual que los mensajes del chat. */
  createdAt: number;
}
