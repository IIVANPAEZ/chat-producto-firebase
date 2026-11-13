import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MAX_TEXT_LENGTH } from '../services/chat.service';
import { useColors } from '../theme/colors';

interface Props {
  onSend: (text: string) => Promise<void>;
  bottomInset: number;
}

export function MessageInput({ onSend, bottomInset }: Props) {
  const colors = useColors();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const disabled = !text.trim() || sending;

  const handleSend = async () => {
    if (disabled) {
      return;
    }
    setSending(true);
    try {
      await onSend(text);
      setText('');
    } catch {
      // el error lo muestra ChatScreen; se conserva el texto
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 10 + bottomInset,
        },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Escribí un mensaje…"
        placeholderTextColor={colors.muted}
        maxLength={MAX_TEXT_LENGTH}
        multiline
        accessibilityLabel="Mensaje"
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        onPress={handleSend}
        disabled={disabled}
        style={[
          styles.send,
          { backgroundColor: colors.primary },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[styles.sendText, { color: colors.primaryText }]}>
          Enviar
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    fontSize: 15,
  },
  send: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendText: { fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
