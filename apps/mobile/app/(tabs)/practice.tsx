import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/ui/Screen';

export default function PracticeScreen() {
  return (
    <Screen
      title="Drill"
      subtitle="Practice chat, scenario setup, and debrief are queued for parity migration."
    >
      <View style={styles.card}>
        <Text style={styles.title}>Next migration slice</Text>
        <Text style={styles.body}>
          Port `Practice` from web with coached mode, scenario prompts, and post-session feedback flow.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 16,
    gap: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
});
