import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../src/ui/Screen';
import { api } from '../../src/services/api';

type DashboardSnapshot = {
  profileName: string;
  level: number | null;
  currentXp: number | null;
  currentStreak: number | null;
};

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, gamification] = await Promise.all([
        api.getProfile(),
        api.getGamificationSummary(),
      ]);
      setSnapshot({
        profileName: profile?.name || profile?.firstName || 'Operator',
        level: gamification?.xp?.level ?? null,
        currentXp: gamification?.xp?.currentXp ?? null,
        currentStreak: profile?.streakDays ?? profile?.currentStreak ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, [loadDashboard]);

  return (
    <Screen
      title="Command"
      subtitle="Mobile foundation is live. Feature-complete UI migration starts from this shell."
    >
      {loading ? (
        <ActivityIndicator color="#D4A853" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome, {snapshot?.profileName}</Text>
          <Text style={styles.cardLine}>Level: {snapshot?.level ?? '—'}</Text>
          <Text style={styles.cardLine}>XP: {snapshot?.currentXp ?? '—'}</Text>
          <Text style={styles.cardLine}>Streak: {snapshot?.currentStreak ?? '—'} days</Text>
        </View>
      )}

      <Pressable style={styles.refreshButton} onPress={loadDashboard}>
        <Text style={styles.refreshButtonText}>Refresh data</Text>
      </Pressable>

      <Link href="/(tabs)/hypnosis" style={styles.link}>
        Open Session (Hypnosis)
      </Link>
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
    gap: 6,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardLine: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: '#D4A853',
    fontWeight: '600',
  },
  link: {
    color: '#D4A853',
    fontSize: 15,
  },
  errorText: {
    color: '#FB7185',
  },
});
