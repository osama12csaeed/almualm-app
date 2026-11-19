import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Bookmark, BookmarkCheck, FolderOpen } from 'lucide-react-native';
import { useNode, useNodeFiles } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, FileRow, IconButton, ImageCard, Skeleton, Text } from '@/components/ui';
import { AdBanner } from '@/ads/ads';
import { actions, useStore } from '@/store/store';
import { radius, space, useTheme } from '@/theme/theme';

export default function NodeScreen() {
  const params = useLocalSearchParams<{ id: string; title?: string }>();
  const id = Number(params.id);
  const node = useNode(id);
  const isLeaf = node.data ? node.data.children.length === 0 : undefined;
  const files = useNodeFiles(id, isLeaf === true);
  const { c } = useTheme();
  const saved = useStore((s) => Boolean(s.favNodes[id]));
  const title = node.data?.title ?? params.title ?? '';
  const crumbs = node.data?.path.slice(1, -1).map((p) => p.title).join(' › ');

  const favButton = node.data ? (
    <IconButton label={saved ? 'إزالة من موادي' : 'إضافة إلى موادي'} onPress={() => actions.toggleFavNode(node.data!, crumbs)}>
      {saved ? <BookmarkCheck color={c.accent} size={22} /> : <Bookmark color={c.text} size={22} />}
    </IconButton>
  ) : null;

  return (
    <Screen title={title} back search actions={favButton}>
      {crumbs ? (
        <Text size="xs" muted style={{ paddingHorizontal: space[4], paddingTop: space[2] }} numberOfLines={1}>
          {crumbs}
        </Text>
      ) : null}
      {node.isLoading && !node.data ? <LoadingList /> : null}
      {node.isError && !node.data ? <ErrorState message={node.error.message} onRetry={() => node.refetch()} /> : null}
      {node.data && !isLeaf ? <Children node={node} /> : null}
      {node.data && isLeaf ? <Files files={files} /> : null}
      <AdBanner placement="banner_list" />
    </Screen>
  );
}

function Children({ node }: { node: ReturnType<typeof useNode> }) {
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const cardW = (width - space[4] * 2 - space[3]) / 2;
  const [refreshing, setRefreshing] = useState(false);
  return (
    <FlatList
      data={node.data!.children}
      keyExtractor={(n) => String(n.id)}
      numColumns={2}
      columnWrapperStyle={{ gap: space[3] }}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          colors={[c.accent]}
          onRefresh={async () => {
            setRefreshing(true);
            await node.refetch();
            setRefreshing(false);
          }}
        />
      }
      renderItem={({ item }) => (
        <ImageCard
          width={cardW}
          title={item.title}
          image={item.image}
          onPress={() => router.push({ pathname: '/node/[id]', params: { id: String(item.id), title: item.title } })}
        />
      )}
      ListEmptyComponent={<EmptyState icon={<FolderOpen color={c.textMuted} size={44} />} title="لا يوجد محتوى بعد" />}
    />
  );
}

function Files({ files }: { files: ReturnType<typeof useNodeFiles> }) {
  const { c } = useTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const all = files.data?.files ?? [];
  const badges = useMemo(() => Array.from(new Set(all.map((f) => f.badge))), [all]);
  const shown = filter ? all.filter((f) => f.badge === filter) : all;

  if (files.isLoading && !files.data) return <LoadingList />;
  if (files.isError && !files.data) return <ErrorState message={files.error.message} onRetry={() => files.refetch()} />;

  return (
    <FlatList
      data={shown}
      keyExtractor={(f) => String(f.id)}
      contentContainerStyle={{ padding: space[4], gap: space[3] }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          colors={[c.accent]}
          onRefresh={async () => {
            setRefreshing(true);
            await files.refetch();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        badges.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingBottom: space[1] }}>
            {[null, ...badges].map((b) => {
              const active = filter === b;
              return (
                <Pressable
                  key={b ?? 'all'}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setFilter(b)}
                  style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
                >
                  <Text size="sm" weight="medium" color={active ? c.onAccent : c.text}>
                    {b ?? `الكل (${all.length})`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : undefined
      }
      renderItem={({ item }) => <FileRow file={item} onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(item.id) } })} />}
      ListEmptyComponent={<EmptyState icon={<FolderOpen color={c.textMuted} size={44} />} title="لا توجد ملفات بعد" body="ستظهر هنا تلقائياً فور إضافتها في الموقع." />}
    />
  );
}

function LoadingList() {
  return (
    <View style={{ padding: space[4], gap: space[3] }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} height={104} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: space[4], minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
});
