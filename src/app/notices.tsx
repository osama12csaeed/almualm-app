import React, { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { useNotices } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, Skeleton, Text } from '@/components/ui';
import { openTarget } from '@/push/push';
import { actions, useStore } from '@/store/store';
import { relativeDate } from '@/lib/core';
import { radius, space, useTheme } from '@/theme/theme';

export default function Notices() {
  const { c } = useTheme();
  const notices = useNotices();
  const lastSeen = useStore((s) => s.lastSeenNotice);
  const newest = notices.data?.[0]?.id ?? 0;

  useEffect(() => {
    if (newest) actions.setLastSeenNotice(newest);
  }, [newest]);

  return (
    <Screen title="الإشعارات" back>
      {notices.isLoading && !notices.data ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} />
          ))}
        </View>
      ) : null}
      {notices.isError && !notices.data ? <ErrorState message={notices.error.message} onRetry={() => notices.refetch()} /> : null}
      {notices.data ? (
        <FlatList
          data={notices.data}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1 }}
          renderItem={({ item }) => {
            const fresh = item.id > lastSeen;
            const tappable = item.target && item.target.type !== 'none';
            return (
              <Pressable
                accessibilityRole={tappable ? 'button' : 'text'}
                disabled={!tappable}
                onPress={() => item.target && openTarget({ type: item.target.type, id: String(item.target.id ?? ''), url: item.target.url })}
                style={[styles.card, { backgroundColor: fresh ? c.surface : c.card, borderColor: fresh ? c.accent : c.border }]}
              >
                <Text weight="bold">{item.title}</Text>
                <Text size="sm" muted>
                  {item.body}
                </Text>
                <Text size="xs" muted>
                  {relativeDate(item.date)}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon={<BellOff color={c.textMuted} size={44} />} title="لا توجد إشعارات" />}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: space[4], borderRadius: radius.lg, borderWidth: 1, gap: space[1] },
});
