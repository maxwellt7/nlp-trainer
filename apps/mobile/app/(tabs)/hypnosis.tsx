import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/ui/Screen';
import { api } from '../../src/services/api';

export default function HypnosisScreen() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Ready');

  const startSession = async () => {
    try {
      setStatus('Starting...');
      const session = await api.hypnosisInit({ sessionType: 'daily' });
      setSessionId(session?.sessionId || null);
      setStatus('Session initialized');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Unable to initialize session');
    }
  };

  return (
    <Screen
      title="Session"
      subtitle="This route is wired to the hypnosis API contract and will be expanded to full chat + script generation parity."
    >
      <View style={styles.card}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.value}>{status}</Text>
        <Text style={styles.label}>Session ID</Text>
        <Text style={styles.value}>{sessionId ?? 'Not started'}</Text>
      </View>

      <Pressable style={styles.button} onPress={startSession}>
        <Text style={styles.buttonText}>Start Daily Session</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    gap: 8,
  },
  label: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  value: {
    color: '#F8FAFC',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#D4A853',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#0B0F19',
    fontSize: 16,
    fontWeight: '700',
  },
});
