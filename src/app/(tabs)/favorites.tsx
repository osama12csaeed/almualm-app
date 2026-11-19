import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Bookmark, X } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { EmptyState, FileRow, IconButton, SectionTitle } from '@/components/ui';
import { actions, useStore } from '@/store/store';
import { space, useTheme } from '@/theme/theme';

export default function Favorites() {
  const { c } = useTheme();
  const favFiles = useStore((s) => s.favFiles);
  const favNodes = useStore((s) => s.favNodes);
  const files = useMemo(() => Object.values(favFiles).sort((a, b) => b.savedAt - a.savedAt), [favFiles]);
  const nodes = useMemo(() => Object.values(favNodes).sort((a, b) => b.savedAt - a.savedAt), [favNodes]);

  return (
    <Screen title="المفضلة" search>
      <FlatList
        data={files}
        keyExtractor={(f) => String(f.id)}
        contentContainerStyle={{ padding: space[4], gap: space[3], flexGrow: 1 }}
        ListHeaderComponent={
          nodes.length ? (
            <View style={{ gap: space[3] }}>
              <SectionTitle title="موادي" />
              {nodes.map((n) => (
                <FileRow
                  key={`n${n.id}`}
                  file={{ id: n.id, title: n.title, badge: 'مادة', badge_color: c.accent, thumb: n.image, modified: null }}
                  meta={n.subtitle}
                  onPress={() => router.push({ pathname: '/node/[id]', params: { id: String(n.id), title: n.title } })}
                  right={
                    <IconButton label="إزالة" onPress={() => actions.toggleFavNode(n)}>
                      <X color={c.textMuted} size={20} />
                    </IconButton>
                  }
                />
              ))}
              {files.length ? <SectionTitle title="الملفات" /> : null}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <FileRow
            file={{ ...item, modified: null }}
            onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(item.id) } })}
            right={
              <IconButton label="إزالة من المفضلة" onPress={() => actions.toggleFavFile(item)}>
                <X color={c.textMuted} size={20} />
              </IconButton>
            }
          />
        )}
        ListEmptyComponent={
          nodes.length ? undefined : (
            <EmptyState
              icon={<Bookmark color={c.textMuted} size={44} />}
              title="لا شيء في المفضلة بعد"
              body="اضغط على علامة الحفظ في أي مادة أو ملف ليظهر هنا."
            />
          )
        }
      />
    </Screen>
  );
}
