import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SearchX, X } from 'lucide-react-native';
import { useSearch } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { EmptyState, FileRow, IconButton, Skeleton, Text } from '@/components/ui';
import { AdBanner } from '@/ads/ads';
import { useStore } from '@/store/store';
import { normalizeArabic } from '@/lib/core';
import type { FileSummary } from '@/api/types';
import { radius, space, useTheme } from '@/theme/theme';

export default function SearchScreen() {
  const { c } = useTheme();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const root = useStore((s) => s.settings.rootId) ?? 0;
  const progress = useStore((s) => s.progress);
  const favFiles = useStore((s) => s.favFiles);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const results = useSearch(q, root);

  // Offline: still search what the student has opened or saved.
  const local = useMemo(() => {
    if (q.length < 2) return [];
    const n = normalizeArabic(q);
    const seen = new Set<number>();
    const items: FileSummary[] = [
      ...Object.values(favFiles).map((f) => ({ id: f.id, title: f.title, badge: f.badge, badge_color: f.badge_color, thumb: f.thumb, modified: null, date: null })),
      ...Object.values(progress).map((p) => ({ id: p.fileId, title: p.title, badge: p.badge, badge_color: null, thumb: null, modified: null, date: null })),
    ];
    return items.filter((f) => !seen.has(f.id) && seen.add(f.id) && normalizeArabic(f.title).includes(n));
  }, [q, favFiles, progress]);

  const data = results.data ?? (results.isError ? local : []);

  return (
    <Screen title="بحث" back>
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.borderInput }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          returnKeyType="search"
          placeholder="ابحث عن كتاب، مادة، صف…"
          placeholderTextColor={c.textMuted}
          accessibilityLabel="البحث"
          style={[styles.input, { color: c.text }]}
        />
        {text ? (
          <IconButton label="مسح" onPress={() => setText('')}>
            <X color={c.textMuted} size={20} />
          </IconButton>
        ) : null}
      </View>
      {results.isFetching && !results.data ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={104} />
          ))}
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(f) => String(f.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1 }}
          ListHeaderComponent={
            results.isError && local.length ? (
              <Text size="xs" muted>
                غير متصل: النتائج من ملفاتك المحفوظة فقط.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => <FileRow file={item} onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(item.id) } })} />}
          ListEmptyComponent={
            q.length >= 2 && !results.isFetching ? (
              <EmptyState icon={<SearchX color={c.textMuted} size={44} />} title="لا توجد نتائج" body="جرّب كلمة أقصر، مثل اسم المادة أو الصف." />
            ) : (
              <Text muted center style={{ marginTop: space[6] }}>
                اكتب حرفين على الأقل.
              </Text>
            )
          }
        />
      )}
      <AdBanner placement="banner_search" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', margin: space[4], marginBottom: 0, borderWidth: 1, borderRadius: radius.md, paddingStart: space[3] },
  input: { flex: 1, minHeight: 48, fontSize: 16, fontFamily: 'Cairo_400Regular', textAlign: 'right' },
});
