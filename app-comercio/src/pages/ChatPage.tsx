import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { OfferForm } from '../components/OfferForm';
import { useChatMessages } from '../hooks/useChatMessages';
import { cancelOffer, sendProductOffer, sendTextMessage } from '../services/chat.service';
import type { Product, Sender } from '../types/chat';

const CURRENT_USER: Sender = 'comercio';

interface Props {
  chatId: string;
}

export function ChatPage({ chatId }: Props) {
  const { messages, loading, error } = useChatMessages(chatId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  /** Ejecuta una acción mostrando su error en pantalla; lo relanza para que el formulario no se limpie. */
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

  const handleSendOffer = (product: Product) => run(() => sendProductOffer(chatId, product));

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
          onClick={() => setShowOfferForm((open) => !open)}
        >
          {showOfferForm ? 'Ocultar oferta' : '+ Ofrecer producto'}
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

      {showOfferForm && (
        <OfferForm
          onSubmit={(product) => handleSendOffer(product)}
          onClose={() => setShowOfferForm(false)}
        />
      )}

      <MessageInput onSend={handleSendText} />
    </div>
  );
}
