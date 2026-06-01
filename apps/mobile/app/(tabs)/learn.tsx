import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/ui/Screen';
import { api } from '../../src/services/api';

type ModuleItem = {
  id: string;
  title: string;
  description?: string;
};

export default function LearnScreen() {
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModules = async () => {
      try {
        const payload = await api.getModules();
        const nextModules = Array.isArray(payload?.modules) ? payload.modules : [];
        setModules(nextModules);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load modules');
      } finally {
        setLoading(false);
      }
    };

    loadModules().catch(() => undefined);
  }, []);

  return (
    <Screen
      title="Learn"
      subtitle="Curriculum endpoint is connected. Lesson detail and quizzes are next."
    >
      {loading ? <ActivityIndicator color="#D4A853" /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && !error ? (
        <FlatList
          data={modules}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.moduleCard}>
              <Text style={styles.moduleTitle}>{item.title}</Text>
              {item.description ? <Text style={styles.moduleDescription}>{item.description}</Text> : null}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          scrollEnabled={false}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  moduleCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    gap: 6,
  },
  moduleTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  moduleDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  separator: {
    height: 10,
  },
  errorText: {
    color: '#FB7185',
    fontSize: 14,
  },
});
