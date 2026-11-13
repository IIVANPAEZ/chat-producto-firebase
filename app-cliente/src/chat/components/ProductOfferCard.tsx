import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '../theme/colors';
import type {
  OfferStatus,
  ProductOfferMessage,
} from '../interfaces/chat-message.interface';
import type { OfferDecision } from '../services/chat.service';
import { formatPrice } from '../utils/format';

const STATUS_LABEL: Record<OfferStatus, string> = {
  pending: 'Esperando tu respuesta',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada por el comercio',
};

interface Props {
  offer: ProductOfferMessage;
  processing: OfferDecision | null;
  onAnswer: (offerId: string, decision: OfferDecision) => void;
}

export function ProductOfferCard({ offer, processing, onAnswer }: Props) {
  const colors = useColors();
  const { product, status } = offer;
  const statusColors = colors.status[status];
  const busy = processing !== null;

  return (
    <View style={styles.card}>
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          style={styles.image}
          accessibilityLabel={product.name}
        />
      ) : null}
      <Text style={[styles.label, { color: colors.muted }]}>OFERTA</Text>
      <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
      <Text style={[styles.price, { color: colors.text }]}>
        {formatPrice(product.price, product.currency)}
      </Text>
      <Text
        style={[
          styles.status,
          { color: statusColors.fg, backgroundColor: statusColors.bg },
        ]}
      >
        {STATUS_LABEL[status]}
      </Text>

      {status === 'pending' && (
        <View style={styles.actions}>
          {busy ? (
            <View style={styles.processing}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.muted }}>
                {processing === 'accepted' ? 'Creando pedido…' : 'Procesando…'}
              </Text>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => onAnswer(offer.id, 'rejected')}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: colors.danger, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.buttonText, { color: colors.danger }]}>
                  Rechazar
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onAnswer(offer.id, 'accepted')}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[styles.buttonText, { color: colors.primaryText }]}
                >
                  Aprobar
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minWidth: 220, gap: 4 },
  image: { width: '100%', height: 140, borderRadius: 8, marginBottom: 4 },
  label: { fontSize: 11, letterSpacing: 0.8 },
  name: { fontSize: 17, fontWeight: '700' },
  price: { fontSize: 15, fontWeight: '600' },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  processing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  buttonText: { fontWeight: '700' },
});
