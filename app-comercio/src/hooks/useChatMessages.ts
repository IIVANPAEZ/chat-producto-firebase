import { useEffect, useState } from 'react';
import { listenMessages } from '../services/chat.service';
import type { ChatMessage } from '../types/chat';

interface ChatMessagesState {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
}

interface Snapshot {
  chatId: string;
  messages: ChatMessage[];
  error: string | null;
}

/** Se suscribe a los mensajes del chat y se desuscribe al desmontar o cambiar de chat. */
export const useChatMessages = (chatId: string): ChatMessagesState => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(
    () =>
      listenMessages(
        chatId,
        (messages) => setSnapshot({ chatId, messages, error: null }),
        (error) => setSnapshot({ chatId, messages: [], error: error.message }),
      ),
    [chatId],
  );

  // Si lo último recibido es de otro chat (o aún no llegó nada), seguimos cargando.
  if (snapshot?.chatId !== chatId) return { messages: [], loading: true, error: null };
  return { messages: snapshot.messages, loading: false, error: snapshot.error };
};
