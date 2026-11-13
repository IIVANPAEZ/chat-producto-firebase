import type {
  ChatMessage,
  ProductOfferMessage,
  Sender,
} from '../interfaces/chat-message.interface';
import { formatTime } from '../utils/format';
import { ProductOfferCard } from './ProductOfferCard';

interface Props {
  message: ChatMessage;
  currentUser: Sender;
  onEditOffer: (offer: ProductOfferMessage) => void;
  onCancelOffer: (offerId: string) => Promise<void>;
}

export function MessageBubble({ message, currentUser, onEditOffer, onCancelOffer }: Props) {
  if (message.type === 'order_accepted') {
    return (
      <div className="system-message">
        ✅ El cliente aceptó la oferta · pedido <code>{message.orderId}</code>
        <span className="message__time">{formatTime(message.createdAt)}</span>
      </div>
    );
  }

  const own = message.sender === currentUser;

  return (
    <div className={`message ${own ? 'message--own' : 'message--other'}`}>
      <div className="message__bubble">
        {message.type === 'text' ? (
          <p className="message__text">{message.text}</p>
        ) : (
          <ProductOfferCard offer={message} onEdit={onEditOffer} onCancel={onCancelOffer} />
        )}
        <span className="message__time">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
