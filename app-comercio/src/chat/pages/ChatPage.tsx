import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { OfferForm } from '../components/OfferForm';
import { useChatMessages } from '../hooks/useChatMessages';
import {
  cancelOffer,
  sendProductOffer,
  sendTextMessage,
  updateOffer,
} from '../services/chat.service';
import type {
  Product,
  ProductOfferMessage,
  Sender,
} from '../interfaces/chat-message.interface';

const CURRENT_USER: Sender = 'comercio';

type OfferFormMode = { type: 'new' } | { type: 'edit'; offer: ProductOfferMessage } | null;

interface Props {
  chatId: string;
}

export function ChatPage({ chatId }: Props) {
  const { messages, loading, error } = useChatMessages(chatId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<OfferFormMode>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // se relanza para que el formulario no se limpie
  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ocurrió un error inesperado');
      throw err;
    }
  };

  const handleSendText = (text: string) =>
    run(() => sendTextMessage(chatId, CURRENT_USER, text));

  const handleSubmitOffer = (product: Product) =>
    run(() =>
      formMode?.type === 'edit'
        ? updateOffer(chatId, formMode.offer.id, product)
        : sendProductOffer(chatId, product),
    );

  const handleCancelOffer = (offerId: string) =>
    run(() => cancelOffer(chatId, offerId)).catch(() => undefined);

  return (
    <div className="chat">
      <header className="chat__header">
        <div>
          <h1>Comercio</h1>
          <span className="chat__subtitle">Chat {chatId}</span>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setFormMode((mode) => (mode ? null : { type: 'new' }))}
        >
          {formMode ? 'Ocultar oferta' : '+ Ofrecer producto'}
        </button>
      </header>

      <section className="chat__messages" aria-live="polite">
        {loading && <p className="chat__notice">Cargando mensajes…</p>}
        {error && <p className="chat__notice chat__notice--error">No se pudo cargar el chat: {error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="chat__notice">Todavía no hay mensajes. ¡Saludá al cliente!</p>
        )}
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            currentUser={CURRENT_USER}
            onEditOffer={(offer) => setFormMode({ type: 'edit', offer })}
            onCancelOffer={handleCancelOffer}
          />
        ))}
        <div ref={bottomRef} />
      </section>

      {actionError && (
        <div className="chat__error" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}

      {formMode && (
        <OfferForm
          key={formMode.type === 'edit' ? formMode.offer.id : 'new'}
          initialProduct={formMode.type === 'edit' ? formMode.offer.product : undefined}
          onSubmit={handleSubmitOffer}
          onClose={() => setFormMode(null)}
        />
      )}

      <MessageInput onSend={handleSendText} />
    </div>
  );
}
