import { useState, type SubmitEvent } from 'react';
import { MAX_TEXT_LENGTH } from '../services/chat.service';

interface Props {
  onSend: (text: string) => Promise<void>;
}

export function MessageInput({ onSend }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setText('');
    } catch {
      // el error lo muestra ChatPage; se conserva el texto
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="message-input" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Escribí un mensaje…"
        maxLength={MAX_TEXT_LENGTH}
        aria-label="Mensaje"
      />
      <button type="submit" className="button" disabled={!text.trim() || sending}>
        Enviar
      </button>
    </form>
  );
}
