import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Bell, BookOpenCheck, Search } from 'lucide-react-native';
import { useConfig, useLatest, useNotices, useTree } from '@/api/hooks';
import type { AppConfig, Banner } from '@/api/types';
import { Screen } from '@/components/screen';
import { ErrorState, FileRow, IconButton, ImageCard, SectionTitle, Skeleton, Text } from '@/components/ui';
import { AdBanner } from '@/ads/ads';
import { actions, useStore } from '@/store/store';
import { radius, space, useTheme } from '@/theme/theme';
import { relativeDate } from '@/lib/core';

export default function Home() {
  const config = useConfig();
  const { c } = useTheme();
  const rootId = useStore((s) => s.settings.rootId) ?? 0;
  const tree = useTree(rootId);
  const latestCount = config.data?.home.latest_count ?? 10;
  const sections = config.data?.home.sections ?? ['continue', 'curricula', 'latest'];
  const [refreshing, setRefreshing] = useState(false);
  const notices = useNotices();
  const lastSeen = useStore((s) => s.lastSeenNotice);
  const unread = (notices.data ?? []).some((n) => n.id > lastSeen);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([config.refetch(), tree.refetch(), notices.refetch()]);
    setRefreshing(false);
  };

  const look = config.data?.look;

  return (
    <Screen>
      <View style={[styles.top, { borderBottomColor: c.border }]}>
        {look?.logo ? <Image source={{ uri: look.logo }} style={styles.logo} contentFit="contain" /> : <BookOpenCheck color={c.accent} size={30} />}
        <Text size="lg" weight="bold" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
          {look?.app_name ?? 'المعلم التعليمي'}
        </Text>
        <IconButton label="بحث" onPress={() => router.push('/search')}>
          <Search color={c.text} size={22} />
        </IconButton>
        <IconButton label={unread ? 'الإشعارات، توجد رسائل جديدة' : 'الإشعارات'} onPress={() => router.push('/notices')}>
          <Bell color={c.text} size={22} />
          {unread ? <View style={[styles.dot, { backgroundColor: c.highlight }]} /> : null}
        </IconButton>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space[4], paddingBottom: space[7] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[c.accent]} />}
      >
        {!config.data && config.isLoading ? <HomeSkeleton /> : null}
        {!config.data && config.isError ? <ErrorState message={config.error.message} onRetry={() => config.refetch()} /> : null}

        {config.data
          ? sections.map((key) => {
              switch (key) {
                case 'continue':
                  return <ContinueReading key={key} />;
                case 'banners':
                  return <Banners key={key} banners={config.data!.home.banners} />;
                case 'curricula':
                  return <Curricula key={key} config={config.data!} tree={tree} />;
                case 'latest':
                  return <Latest key={key} root={rootId} count={latestCount} />;
                case 'favorites':
                  return <FavoriteNodes key={key} />;
                default:
                  return null;
              }
            })
          : null}
      </ScrollView>
      <AdBanner placement="banner_home" />
    </Screen>
  );
}

function ContinueReading() {
  const progress = useStore((s) => s.progress);
  const items = useMemo(() => Object.values(progress).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6), [progress]);
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <View>
      <SectionTitle title="متابعة القراءة" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[3] }}>
        {items.map((p) => (
          <Pressable
            key={p.fileId}
            accessibilityRole="button"
            accessibilityLabel={`متابعة ${p.title} من صفحة ${p.page}`}
            onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(p.fileId) } })}
            style={[styles.continueCard, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text size="sm" weight="medium" numberOfLines={2}>
              {p.title}
            </Text>
            <View style={[styles.track, { backgroundColor: c.border }]}>
              <View style={[styles.fill, { backgroundColor: c.accent, width: `${p.total ? Math.round((p.page / p.total) * 100) : 0}%` }]} />
            </View>
            <Text size="xs" muted>
              صفحة {p.page} من {p.total} · {relativeDate(new Date(p.updatedAt).toISOString())}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Banners({ banners }: { banners: Banner[] }) {
  const { width } = useWindowDimensions();
  if (!banners.length) return null;
  const w = width - space[4] * 2;
  const open = (b: Banner) => {
    const id = Number(b.target);
    if (b.type === 'node' && id) router.push({ pathname: '/node/[id]', params: { id: String(id) } });
    else if (b.type === 'file' && id) router.push({ pathname: '/file/[id]', params: { id: String(id) } });
    else if (b.type === 'url' && b.target) Linking.openURL(b.target).catch(() => {});
  };
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: space[3] }}>
      {banners.map((b, i) => (
        <Pressable key={i} accessibilityRole={b.type === 'none' ? 'image' : 'link'} accessibilityLabel={b.title || 'بنر'} onPress={() => open(b)} style={{ width: w, marginLeft: i ? space[3] : 0 }}>
          <Image source={{ uri: b.image }} style={{ width: w, aspectRatio: 2.4, borderRadius: radius.lg }} contentFit="cover" cachePolicy="disk" />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Curricula({ config, tree }: { config: AppConfig; tree: ReturnType<typeof useTree> }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const rootId = useStore((s) => s.settings.rootId);
  const curricula = config.home.curricula;
  const cardW = (width - space[4] * 2 - space[3]) / 2;
  const grades = tree.data?.children ?? [];

  return (
    <View>
      {curricula.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], marginTop: space[4] }}>
          {curricula.map((cu) => {
            const active = cu.id === rootId;
            return (
              <Pressable
                key={cu.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => actions.setSettings({ rootId: cu.id, gradeId: null })}
                style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
              >
                <Text size="sm" weight="medium" color={active ? c.onAccent : c.text}>
                  {cu.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <SectionTitle title={tree.data?.title ?? curricula.find((x) => x.id === rootId)?.title ?? 'الصفوف'} />
      {tree.isLoading && !tree.data ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={170} style={{ width: cardW }} />
          ))}
        </View>
      ) : null}
      {tree.isError && !tree.data ? <ErrorState message={tree.error.message} onRetry={() => tree.refetch()} /> : null}
      <View style={styles.grid}>
        {grades.map((g) => (
          <ImageCard
            key={g.id}
            width={cardW}
            title={g.title}
            image={g.image}
            subtitle={g.children.length ? `${g.children.length} مواد` : undefined}
            onPress={() => {
              actions.setSettings({ gradeId: g.id });
              router.push({ pathname: '/node/[id]', params: { id: String(g.id), title: g.title } });
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Latest({ root, count }: { root: number; count: number }) {
  const latest = useLatest(root, count);
  if (!latest.data?.length) return null;
  return (
    <View>
      <SectionTitle title="أحدث الملفات" />
      <View style={{ gap: space[3] }}>
        {latest.data.map((f) => (
          <FileRow key={f.id} file={f} onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(f.id) } })} />
        ))}
      </View>
    </View>
  );
}

function FavoriteNodes() {
  const nodes = useStore((s) => s.favNodes);
  const { c } = useTheme();
  const list = Object.values(nodes).sort((a, b) => b.savedAt - a.savedAt);
  if (!list.length) return null;
  return (
    <View>
      <SectionTitle title="موادي" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {list.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/node/[id]', params: { id: String(n.id), title: n.title } })}
            style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Text size="sm" weight="medium">
              {n.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HomeSkeleton() {
  return (
    <View style={{ gap: space[3], marginTop: space[4] }}>
      <Skeleton height={28} style={{ width: 160 }} />
      <Skeleton height={170} />
      <Skeleton height={170} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[4], minHeight: 60, borderBottomWidth: StyleSheet.hairlineWidth },
  logo: { width: 36, height: 36 },
  dot: { position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  chip: { paddingHorizontal: space[4], minHeight: 40, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  continueCard: { width: 220, padding: space[3], borderRadius: radius.lg, borderWidth: 1, gap: space[2] },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
