import { StyleSheet, Text, View } from 'react-native';
import { Screen } from './Screen';

type PlaceholderFeatureProps = {
  title: string;
  note: string;
};

export function PlaceholderFeature({ title, note }: PlaceholderFeatureProps) {
  return (
    <Screen title={title} subtitle="Scaffolded route for incremental feature-parity migration.">
      <View style={styles.card}>
        <Text style={styles.note}>{note}</Text>
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
  },
  note: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
});
