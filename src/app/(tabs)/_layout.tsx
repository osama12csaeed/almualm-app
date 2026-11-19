import React from 'react';
import { Tabs } from 'expo-router';
import { Bookmark, Download, House, Settings } from 'lucide-react-native';
import { font, useTheme } from '@/theme/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <House color={color} size={24} /> }} />
      <Tabs.Screen name="favorites" options={{ title: 'المفضلة', tabBarIcon: ({ color }) => <Bookmark color={color} size={24} /> }} />
      <Tabs.Screen name="downloads" options={{ title: 'ملفاتي', tabBarIcon: ({ color }) => <Download color={color} size={24} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'الإعدادات', tabBarIcon: ({ color }) => <Settings color={color} size={24} /> }} />
    </Tabs>
  );
}
