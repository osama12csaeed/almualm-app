import React from 'react';
import { router } from 'expo-router';
import { Compass } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button, EmptyState } from '@/components/ui';
import { useTheme } from '@/theme/theme';

export default function NotFound() {
  const { c } = useTheme();
  return (
    <Screen title="" back>
      <EmptyState icon={<Compass color={c.textMuted} size={44} />} title="الصفحة غير موجودة" action={<Button title="الرئيسية" onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
