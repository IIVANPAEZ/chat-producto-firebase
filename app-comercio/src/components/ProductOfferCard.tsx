import { useState } from 'react';
import type { OfferStatus, ProductOfferMessage } from '../types/chat';
import { formatPrice } from '../utils/format';

const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: 'Esperando respuesta',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

interface Props {
  offer: ProductOfferMessage;
  onCancel: (offerId: string) => Promise<void>;
}

export function ProductOfferCard({ offer, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const { product, status } = offer;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await onCancel(offer.id);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="offer-card">
      {product.imageUrl && (
        <img className="offer-card__image" src={product.imageUrl} alt={product.name} />
      )}
      <div className="offer-card__body">
        <span className="offer-card__label">Oferta</span>
        <strong className="offer-card__name">{product.name}</strong>
        <span className="offer-card__price">{formatPrice(product.price, product.currency)}</span>
        <span className={`status status--${status}`}>{STATUS_LABEL[status]}</span>
        {status === 'pending' && (
          <button
            type="button"
            className="button button--secondary"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelando…' : 'Cancelar oferta'}
          </button>
        )}
      </div>
    </div>
  );
}
