import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../src/ui/Screen';

const links = [
  { href: '/audios', label: 'Audios' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/insights', label: 'Insights' },
  { href: '/identity', label: 'Identity' },
  { href: '/reference', label: 'Reference' },
] as const;

export default function MoreScreen() {
  return (
    <Screen
      title="More"
      subtitle="Remaining product areas are scaffolded as individual stack screens."
    >
      <View style={styles.linkList}>
        {links.map((item) => (
          <Link key={item.href} href={item.href} style={styles.linkItem}>
            {item.label}
          </Link>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  linkList: {
    gap: 10,
  },
  linkItem: {
    color: '#D4A853',
    fontSize: 16,
    paddingVertical: 8,
  },
});
