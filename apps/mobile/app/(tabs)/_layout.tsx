import { Redirect, Tabs } from 'expo-router';
import { SignedIn, SignedOut } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { env } from '../../src/config/env';
import { AuthTokenProvider } from '../../src/providers/AuthTokenProvider';

function TabsNavigator() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0F19' },
        headerTintColor: '#D4A853',
        tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#1F2937' },
        tabBarActiveTintColor: '#D4A853',
        tabBarInactiveTintColor: '#64748B',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Command',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="hypnosis"
        options={{
          title: 'Session',
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Drill',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbox-ellipses-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  if (!env.clerkPublishableKey) {
    return <TabsNavigator />;
  }

  return (
    <>
      <SignedIn>
        <AuthTokenProvider>
          <TabsNavigator />
        </AuthTokenProvider>
      </SignedIn>
      <SignedOut>
        <Redirect href="/sign-in" />
      </SignedOut>
    </>
  );
}
