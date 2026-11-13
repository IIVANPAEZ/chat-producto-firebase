import { useState, type SubmitEvent } from 'react';
import type { Product } from '../interfaces/chat-message.interface';

interface Props {
  initialProduct?: Product;
  onSubmit: (product: Product) => Promise<void>;
  onClose: () => void;
}

const EMPTY_FORM = { name: '', price: '', currency: 'COP', imageUrl: '' };

const toForm = (product?: Product) =>
  product
    ? {
        name: product.name,
        price: String(product.price),
        currency: product.currency,
        imageUrl: product.imageUrl ?? '',
      }
    : EMPTY_FORM;

export function OfferForm({ initialProduct, onSubmit, onClose }: Props) {
  const editing = initialProduct !== undefined;
  const [form, setForm] = useState(() => toForm(initialProduct));
  const [sending, setSending] = useState(false);

  const update = (field: keyof typeof EMPTY_FORM) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    try {
      await onSubmit({
        id: initialProduct?.id ?? `prod-${crypto.randomUUID()}`,
        name: form.name,
        price: Number(form.price),
        currency: form.currency,
        ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl } : {}),
      });
      setForm(EMPTY_FORM);
      onClose();
    } catch {
      // el error lo muestra ChatPage; se conservan los datos
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="offer-form" onSubmit={handleSubmit}>
      <h2>{editing ? 'Corregir oferta' : 'Nueva oferta'}</h2>
      <label>
        Producto
        <input
          required
          value={form.name}
          onChange={(e) => update('name')(e.target.value)}
          placeholder="Bandeja paisa"
        />
      </label>
      <div className="offer-form__row">
        <label>
          Precio
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={(e) => update('price')(e.target.value)}
            placeholder="35000"
          />
        </label>
        <label className="offer-form__currency">
          Moneda
          <input
            required
            value={form.currency}
            onChange={(e) => update('currency')(e.target.value.toUpperCase())}
            maxLength={3}
            pattern="[A-Za-z]{3}"
            title="Código de 3 letras, ej. COP"
          />
        </label>
      </div>
      <label>
        Imagen (opcional)
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => update('imageUrl')(e.target.value)}
          placeholder="https://…"
        />
      </label>
      <div className="offer-form__actions">
        <button type="button" className="button button--secondary" onClick={onClose}>
          Cerrar
        </button>
        <button type="submit" className="button" disabled={sending}>
          {sending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Enviar oferta'}
        </button>
      </div>
    </form>
  );
}
