export type Sender = 'cliente' | 'comercio';

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

interface BaseMessage {
  id: string;
  sender: Sender;
  createdAt: number;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface ProductOfferMessage extends BaseMessage {
  type: 'product_offer';
  product: Product;
  status: OfferStatus;
}

export interface OrderAcceptedMessage extends BaseMessage {
  type: 'order_accepted';
  orderId: string;
  offerMessageId: string;
}

export type ChatMessage =
  | TextMessage
  | ProductOfferMessage
  | OrderAcceptedMessage;
