import { useEffect, useState } from 'react';
import { listenMessages } from '../services/chat.service';
import type { ChatMessage } from '../interfaces/chat-message.interface';

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

export const useChatMessages = (chatId: string): ChatMessagesState => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(
    () =>
      listenMessages(
        chatId,
        messages => setSnapshot({ chatId, messages, error: null }),
        error => setSnapshot({ chatId, messages: [], error: error.message }),
      ),
    [chatId],
  );

  // sin datos de este chat todavía
  if (snapshot?.chatId !== chatId) {
    return { messages: [], loading: true, error: null };
  }
  return { messages: snapshot.messages, loading: false, error: snapshot.error };
};
