import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { useChatMessages } from '../hooks/useChatMessages';
import {
  answerOffer,
  sendTextMessage,
  type OfferDecision,
} from '../services/chat.service';
import { useColors } from '../theme/colors';
import type { ChatMessage, Sender } from '../interfaces/chat-message.interface';

const CURRENT_USER: Sender = 'cliente';

interface Props {
  chatId: string;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocurrió un error inesperado';

export function ChatScreen({ chatId }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, loading, error } = useChatMessages(chatId);
  const [actionError, setActionError] = useState<string | null>(null);
  // evita doble toque
  const [processing, setProcessing] = useState<{
    offerId: string;
    decision: OfferDecision;
  } | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = async (text: string) => {
    setActionError(null);
    try {
      await sendTextMessage(chatId, text);
    } catch (err) {
      setActionError(errorMessage(err));
      throw err;
    }
  };

  const handleAnswer = async (offerId: string, decision: OfferDecision) => {
    if (processing) {
      return;
    }
    setActionError(null);
    setProcessing({ offerId, decision });
    try {
      await answerOffer(chatId, offerId, decision);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setProcessing(null);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <MessageBubble
      message={item}
      currentUser={CURRENT_USER}
      processing={processing?.offerId === item.id ? processing.decision : null}
      onAnswerOffer={handleAnswer}
    />
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior="padding"
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>Comercio</Text>
        <Text style={{ color: colors.muted }}>Chat {chatId}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted }}>Cargando mensajes…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.danger }}>
            No se pudo cargar el chat: {error}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => listRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.muted }]}>
              Todavía no hay mensajes. ¡Escribile al comercio!
            </Text>
          }
        />
      )}

      {actionError && (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setActionError(null)}
          style={[
            styles.errorBanner,
            { backgroundColor: colors.status.rejected.bg },
          ]}
        >
          <Text style={[styles.flex, { color: colors.danger }]}>
            {actionError}
          </Text>
          <Text style={{ color: colors.danger }}>✕</Text>
        </Pressable>
      )}

      <MessageInput onSend={handleSend} bottomInset={insets.bottom} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 19, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  list: { padding: 12, gap: 8, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: 40 },
  errorBanner: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
