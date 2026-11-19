import React, { useMemo } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { HardDrive, Pin, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Button, EmptyState, FileRow, IconButton, Text } from '@/components/ui';
import { actions, useStore } from '@/store/store';
import { removeLocal } from '@/store/pdfCache';
import { formatBytes, relativeDate } from '@/lib/core';
import { space, useTheme } from '@/theme/theme';

export default function Downloads() {
  const { c } = useTheme();
  const downloads = useStore((s) => s.downloads);
  const progress = useStore((s) => s.progress);
  const cap = useStore((s) => s.settings.cacheCapMB);
  const list = useMemo(() => Object.values(downloads).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastOpened - a.lastOpened), [downloads]);
  const total = list.reduce((s, d) => s + d.size, 0);

  const clearUnpinned = () =>
    Alert.alert('حذف الملفات غير المثبتة؟', 'تبقى الملفات المثبتة. يمكنك تنزيل أي ملف مرة أخرى بفتحه.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => removeLocal(list.filter((d) => !d.pinned).map((d) => d.key)) },
    ]);

  return (
    <Screen title="ملفاتي" search>
      <FlatList
        data={list}
        keyExtractor={(d) => d.key}
        contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1 }}
        ListHeaderComponent={
          list.length ? (
            <View style={{ gap: space[2], marginBottom: space[2] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                <HardDrive color={c.textMuted} size={18} />
                <Text size="sm" muted>
                  {list.length} ملف على هاتفك · {formatBytes(total)} من {cap} م.ب
                </Text>
              </View>
              <Text size="xs" muted>
                كل ملف تفتحه يُحفظ هنا ويعمل بدون إنترنت. الملفات المثبتة 📌 لا تُحذف تلقائياً.
              </Text>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const p = progress[item.fileId];
          return (
            <FileRow
              file={{ id: item.fileId, title: item.title, badge: item.pinned ? 'مثبّت' : 'محفوظ', badge_color: item.pinned ? c.accent : null, thumb: null, modified: null }}
              meta={[formatBytes(item.size), p ? `صفحة ${p.page}/${p.total}` : null, relativeDate(new Date(item.lastOpened).toISOString())].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(item.fileId) } })}
              right={
                <View style={{ flexDirection: 'row' }}>
                  <IconButton label={item.pinned ? 'إلغاء التثبيت' : 'تثبيت'} onPress={() => actions.setPinned(item.key, !item.pinned)}>
                    <Pin color={item.pinned ? c.accent : c.textMuted} size={20} />
                  </IconButton>
                  <IconButton label="حذف من الهاتف" onPress={() => removeLocal([item.key])}>
                    <Trash2 color={c.textMuted} size={20} />
                  </IconButton>
                </View>
              }
            />
          );
        }}
        ListEmptyComponent={
          <EmptyState icon={<HardDrive color={c.textMuted} size={44} />} title="لا توجد ملفات على هاتفك بعد" body="افتح أي كتاب أو ملف مرة واحدة وسيعمل بعدها بدون إنترنت." />
        }
        ListFooterComponent={list.some((d) => !d.pinned) ? <Button title="حذف الملفات غير المثبتة" variant="ghost" onPress={clearUnpinned} /> : undefined}
      />
    </Screen>
  );
}
