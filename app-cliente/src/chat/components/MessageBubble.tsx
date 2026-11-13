import { StyleSheet, Text, View } from 'react-native';
import type { OfferDecision } from '../services/chat.service';
import { useColors } from '../theme/colors';
import type { ChatMessage, Sender } from '../interfaces/chat-message.interface';
import { formatTime } from '../utils/format';
import { ProductOfferCard } from './ProductOfferCard';

interface Props {
  message: ChatMessage;
  currentUser: Sender;
  processing: OfferDecision | null;
  onAnswerOffer: (offerId: string, decision: OfferDecision) => void;
}

export function MessageBubble({
  message,
  currentUser,
  processing,
  onAnswerOffer,
}: Props) {
  const colors = useColors();

  if (message.type === 'order_accepted') {
    return (
      <View
        style={[styles.system, { backgroundColor: colors.status.accepted.bg }]}
      >
        <Text style={[styles.systemText, { color: colors.status.accepted.fg }]}>
          ✅ Pedido creado · {message.orderId.slice(0, 8)}
        </Text>
        <Text style={[styles.time, { color: colors.muted }]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  }

  const own = message.sender === currentUser;

  return (
    <View style={[styles.row, own ? styles.rowOwn : styles.rowOther]}>
      <View
        style={[
          styles.bubble,
          own
            ? { backgroundColor: colors.ownBubble }
            : {
                backgroundColor: colors.otherBubble,
                borderColor: colors.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
        ]}
      >
        {message.type === 'text' ? (
          <Text style={[styles.text, { color: colors.text }]}>
            {message.text}
          </Text>
        ) : (
          <ProductOfferCard
            offer={message}
            processing={processing}
            onAnswer={onAnswerOffer}
          />
        )}
        <Text style={[styles.time, { color: colors.muted }]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  text: { fontSize: 15, lineHeight: 21 },
  time: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  system: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  systemText: { fontSize: 13, fontWeight: '600' },
});
