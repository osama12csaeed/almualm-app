import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Pdf from 'react-native-pdf';
import {
  Bookmark, BookmarkCheck, CheckCircle2, ChevronLeft, CloudOff, Copy, Download, ExternalLink, FileText, Flag,
  Link as LinkIcon, Maximize2, MessageCircle, Send, Share2,
} from 'lucide-react-native';
import { useFile } from '@/api/hooks';
import type { FileDetail, Pdf as PdfItem, ShareNetwork } from '@/api/types';
import { Screen } from '@/components/screen';
import { Badge, Button, EmptyState, ErrorState, FileRow, IconButton, Skeleton, Text } from '@/components/ui';
import { Comments } from '@/components/Comments';
import { AdBanner, useInterstitialOnOpen } from '@/ads/ads';
import { actions, getState, useStore } from '@/store/store';
import { getPdf, localFileFor, type DownloadHandle } from '@/store/pdfCache';
import { openWith, saveToPhone } from '@/store/savePdf';
import { ensureReadableBadge, formatBytes, htmlToBlocks, textOn } from '@/lib/core';
import { radius, space, useTheme } from '@/theme/theme';

/**
 * The post page, laid out like the website:
 * breadcrumb → title → PDF viewer → «تحميل الملف» box → follow us → «ملفات اخرى» → share → comments.
 * Every part comes from the site through the plugin.
 */
export default function FileScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const file = useFile(id);
  const { c } = useTheme();
  const onFileOpened = useInterstitialOnOpen();
  const counted = useRef(false);
  const fav = useStore((s) => Boolean(s.favFiles[id]));

  // Offline and never fetched? Fall back to the copy saved on the phone.
  const offlineCopy = useStore((s) => Object.values(s.downloads).find((d) => d.fileId === id));
  const detail: FileDetail | undefined =
    file.data ??
    (offlineCopy
      ? {
          id, title: offlineCopy.title, badge: 'ملف', badge_color: null, thumb: null, modified: null, date: null, html: '', link: '',
          pdfs: [{ url: offlineCopy.url, name: offlineCopy.title, size: offlineCopy.size, version: offlineCopy.version }],
        }
      : undefined);

  useEffect(() => {
    if (detail && !counted.current) {
      counted.current = true;
      onFileOpened();
    }
  }, [detail, onFileOpened]);

  const headerActions = detail ? (
    <IconButton label={fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} onPress={() => actions.toggleFavFile(detail)}>
      {fav ? <BookmarkCheck color={c.accent} size={22} /> : <Bookmark color={c.text} size={22} />}
    </IconButton>
  ) : null;

  const headerTitle = detail?.breadcrumb?.length ? detail.breadcrumb[detail.breadcrumb.length - 1].title : (detail?.title ?? '');

  return (
    <Screen title={headerTitle} back search actions={headerActions}>
      {!detail && file.isLoading ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          <Skeleton height={20} style={{ width: 220 }} />
          <Skeleton height={60} />
          <Skeleton height={420} />
        </View>
      ) : null}
      {!detail && file.isError ? <ErrorState message={file.error.message} onRetry={() => file.refetch()} /> : null}
      {detail ? <PostPage detail={detail} /> : null}
      <AdBanner placement="banner_reader" />
    </Screen>
  );
}

function PostPage({ detail }: { detail: FileDetail }) {
  const { c } = useTheme();
  const [pdfIndex, setPdfIndex] = useState(() => getState().progress[detail.id]?.pdfIndex ?? 0);
  const blocks = useMemo(() => htmlToBlocks(detail.html), [detail.html]);
  const pdf: PdfItem | undefined = detail.pdfs[Math.min(pdfIndex, detail.pdfs.length - 1)];
  const labels = detail.labels ?? { follow: 'للمزيد تابعنا في منصات التواصل الاجتماعي', related: 'ملفات اخرى', share: 'شارك المقالة', comments: 'التعليقات' };
  const [localUri, setLocalUri] = useState<string | null>(null);

  return (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[5], paddingBottom: space[7] }} keyboardShouldPersistTaps="handled">
      {/* 1. Breadcrumb */}
      {detail.breadcrumb?.length ? <Breadcrumb crumbs={detail.breadcrumb} /> : null}

      {/* 2. Title */}
      <View style={{ gap: space[2] }}>
        <View style={{ flexDirection: 'row' }}>
          <Badge name={detail.badge} color={detail.badge_color} />
        </View>
        <Text size="xl" weight="bold" accessibilityRole="header">
          {detail.title}
        </Text>
      </View>

      {/* 3. PDF viewer (one tab per PDF when the post has several) */}
      {detail.pdfs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2] }}>
          {detail.pdfs.map((p, i) => {
            const active = i === pdfIndex;
            return (
              <Pressable
                key={p.url}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setLocalUri(null);
                  setPdfIndex(i);
                }}
                style={[styles.chip, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
              >
                <Text size="sm" weight="medium" color={active ? c.onAccent : c.text} numberOfLines={1}>
                  {p.name || `الملف ${i + 1}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {pdf ? (
        <PdfEmbed key={pdf.url + (pdf.version ?? '')} detail={detail} pdf={pdf} pdfIndex={pdfIndex} onReady={setLocalUri} />
      ) : (
        <View style={{ gap: space[3] }}>
          {blocks.length ? <Blocks blocks={blocks} /> : <EmptyState icon={<FileText color={c.textMuted} size={40} />} title="لا يوجد ملف PDF في هذه الصفحة" />}
          {detail.link ? <Button title="فتح على الموقع" variant="secondary" icon={<ExternalLink color={c.accent} size={18} />} onPress={() => Linking.openURL(detail.link)} /> : null}
        </View>
      )}

      {/* 4. «تحميل الملف» */}
      {pdf ? <DownloadBox detail={detail} pdf={pdf} localUri={localUri} /> : null}

      {/* 5. Follow us */}
      {detail.follow?.length ? (
        <View style={{ gap: space[2] }}>
          <Text weight="bold">{labels.follow}</Text>
          <View style={styles.wrap}>
            {detail.follow.map((f) => (
              <BrandPill key={f.url} network={f.network} onPress={() => Linking.openURL(f.url).catch(() => {})} />
            ))}
          </View>
        </View>
      ) : null}

      {/* 6. «ملفات اخرى» */}
      {detail.related?.length ? (
        <View style={{ gap: space[3] }}>
          <Text size="lg" weight="bold" accessibilityRole="header">
            {labels.related}
          </Text>
          {detail.related.map((r) => (
            <FileRow key={r.id} file={r} onPress={() => router.push({ pathname: '/file/[id]', params: { id: String(r.id) } })} />
          ))}
        </View>
      ) : null}

      {/* 7. Share */}
      {detail.link ? (
        <ShareSection
          title={labels.share}
          link={detail.link}
          postTitle={detail.title}
          networks={detail.share?.length ? detail.share : ['facebook', 'twitter', 'whatsapp', 'telegram', 'linkedin', 'copy']}
        />
      ) : null}

      {/* 8. Comments */}
      {detail.comments ? <Comments fileId={detail.id} title={labels.comments} /> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/report/[id]', params: { id: String(detail.id), page: String(getState().progress[detail.id]?.page ?? '') } })}
        style={styles.report}
      >
        <Flag color={c.textMuted} size={16} />
        <Text size="sm" muted>
          الإبلاغ عن مشكلة في هذا الملف
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- 1. Breadcrumb ---------------- */

function Breadcrumb({ crumbs }: { crumbs: NonNullable<FileDetail['breadcrumb']> }) {
  const { c } = useTheme();
  return (
    <View style={styles.crumbs}>
      <Pressable accessibilityRole="link" onPress={() => router.navigate('/')} hitSlop={6}>
        <Text size="sm" color={c.accent}>
          الرئيسية
        </Text>
      </Pressable>
      {crumbs.map((cr, i) => (
        <View key={i} style={styles.crumb}>
          <ChevronLeft color={c.textMuted} size={14} />
          <Pressable
            accessibilityRole="link"
            hitSlop={6}
            onPress={() =>
              cr.type === 'node'
                ? router.push({ pathname: '/node/[id]', params: { id: String(cr.id), title: cr.title } })
                : Linking.openURL(cr.url).catch(() => {})
            }
          >
            <Text size="sm" color={c.accent}>
              {cr.title}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/* ---------------- 3. Embedded PDF viewer ---------------- */

function PdfEmbed({ detail, pdf, pdfIndex, onReady }: { detail: FileDetail; pdf: PdfItem; pdfIndex: number; onReady: (uri: string) => void }) {
  const { c, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const saved = getState().progress[detail.id];
  const startPage = saved && saved.pdfIndex === pdfIndex ? saved.page : 1;
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(startPage);
  const [total, setTotal] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const handle = useRef<DownloadHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxHeight = Math.min(height * 0.62, (width - space[4] * 2) * 1.42);

  useEffect(() => {
    setError(null);
    setProgress(0);
    handle.current = getPdf(detail.id, detail.title, pdf.url, pdf.version, setProgress);
    handle.current.promise
      .then((u) => {
        setUri(u);
        onReady(u);
      })
      .catch((e: Error) => {
        if (e.message !== 'cancelled') setError('تعذّر تنزيل الملف. تحقق من الاتصال ثم أعد المحاولة.');
      });
    return () => handle.current?.cancel();
  }, [detail.id, detail.title, pdf.url, pdf.version, attempt, onReady]);

  const onPage = (p: number, n: number) => {
    setPage(p);
    setTotal(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => actions.saveProgress({ fileId: detail.id, title: detail.title, badge: detail.badge, pdfIndex, page: p, total: n }), 400);
  };

  const openFull = () => router.push({ pathname: '/read/[id]', params: { id: String(detail.id), pdf: String(pdfIndex) } });

  return (
    <View style={[styles.viewer, { height: boxHeight, borderColor: c.border, backgroundColor: dark ? '#05080f' : c.surface }]}>
      {error ? (
        <EmptyState
          icon={<CloudOff color={c.textMuted} size={40} />}
          title="لم يكتمل التنزيل"
          body={error}
          action={<Button title="إعادة المحاولة" onPress={() => setAttempt((a) => a + 1)} />}
        />
      ) : !uri ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <FileText color={c.accent} size={40} />
          <Text weight="medium">جارٍ تحميل الملف…</Text>
          <View style={[styles.track, { backgroundColor: c.border }]}>
            <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text size="sm" muted>
            {progress > 0 ? `${Math.round(progress * 100)}%` : ''} {pdf.size ? `من ${formatBytes(pdf.size)}` : ''}
          </Text>
        </View>
      ) : (
        <>
          {/* Horizontal paging: swipe sideways for pages; the post page itself scrolls up and down. */}
          <Pdf
            source={{ uri }}
            page={startPage}
            horizontal
            enablePaging
            fitPolicy={0}
            minScale={1}
            maxScale={4}
            enableDoubleTapZoom
            enableAntialiasing
            style={{ flex: 1, backgroundColor: 'transparent' }}
            onLoadComplete={(n) => setTotal(n)}
            onPageChanged={onPage}
            onError={() => setError('الملف تالف أو غير مكتمل. أعد تحميله.')}
          />
          <View style={[styles.viewerBar, { backgroundColor: c.bg, borderTopColor: c.border }]}>
            <Text size="sm" weight="medium">
              صفحة {page} من {total || '…'}
            </Text>
            <View style={{ flex: 1 }} />
            <Pressable accessibilityRole="button" onPress={openFull} style={styles.fullBtn} hitSlop={6}>
              <Maximize2 color={c.accent} size={18} />
              <Text size="sm" weight="medium" color={c.accent}>
                ملء الشاشة
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

/* ---------------- 4. «تحميل الملف» ---------------- */

function DownloadBox({ detail, pdf, localUri }: { detail: FileDetail; pdf: PdfItem; localUri: string | null }) {
  const { c } = useTheme();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'shared'>('idle');
  const { key } = localFileFor(detail.id, pdf.url, pdf.version);
  const texts = detail.download ?? { title: 'تحميل الملف', button: 'تحميل PDF' };

  const save = async () => {
    if (!localUri) return;
    setState('saving');
    actions.setPinned(key, true); // keep it in the app too
    const r = await saveToPhone(localUri, pdf.name || detail.title).catch(() => 'cancelled' as const);
    setState(r === 'cancelled' ? 'idle' : r);
  };

  return (
    <View style={[styles.download, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text size="lg" weight="bold" center>
        {texts.title}
      </Text>
      <Button
        title={localUri ? `${texts.button}${pdf.size ? ` (${formatBytes(pdf.size)})` : ''}` : 'جارٍ تجهيز الملف…'}
        icon={<Download color={c.onAccent} size={20} />}
        loading={state === 'saving'}
        disabled={!localUri}
        onPress={save}
      />
      {state === 'saved' ? (
        <View style={styles.savedRow}>
          <CheckCircle2 color={c.success} size={18} />
          <Text size="sm" color={c.success} style={{ flex: 1 }}>
            تم حفظ الملف في هاتفك، ويبقى متاحاً هنا بدون إنترنت.
          </Text>
        </View>
      ) : null}
      {localUri ? (
        <Pressable accessibilityRole="button" onPress={() => openWith(localUri, detail.title)} style={styles.openWith} hitSlop={6}>
          <ExternalLink color={c.accent} size={16} />
          <Text size="sm" color={c.accent}>
            فتح بتطبيق آخر أو حفظ في Drive
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------- 5 & 7. Social ---------------- */

const BRAND: Record<string, { label: string; color: string }> = {
  facebook: { label: 'فيسبوك', color: '#1877f2' },
  twitter: { label: 'تويتر', color: '#0f1419' },
  whatsapp: { label: 'واتساب', color: '#128c7e' },
  telegram: { label: 'تيليجرام', color: '#229ed9' },
  linkedin: { label: 'لينكد إن', color: '#0a66c2' },
  youtube: { label: 'يوتيوب', color: '#ff0000' },
  instagram: { label: 'إنستغرام', color: '#c13584' },
  tiktok: { label: 'تيك توك', color: '#111111' },
  copy: { label: 'نسخ الرابط', color: '#475569' },
  link: { label: 'رابط', color: '#475569' },
};

function BrandPill({ network, onPress, done }: { network: string; onPress: () => void; done?: boolean }) {
  const b = BRAND[network] ?? BRAND.link;
  const bg = ensureReadableBadge(b.color, '#475569');
  const fg = textOn(bg);
  const Icon =
    network === 'copy' ? (done ? CheckCircle2 : Copy) : network === 'telegram' ? Send : network === 'whatsapp' ? MessageCircle : network === 'link' ? LinkIcon : Share2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={b.label}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Icon color={fg} size={16} />
      <Text size="sm" weight="medium" color={fg}>
        {done ? 'تم النسخ' : b.label}
      </Text>
    </Pressable>
  );
}

function shareUrl(network: ShareNetwork, link: string, title: string): string | null {
  const u = encodeURIComponent(link);
  const t = encodeURIComponent(title);
  switch (network) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${u}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${t}&url=${u}`;
    case 'whatsapp':
      return `https://api.whatsapp.com/send?text=${t}%20${u}`;
    case 'telegram':
      return `https://t.me/share/url?url=${u}&text=${t}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    default:
      return null;
  }
}

function ShareSection({ title, link, postTitle, networks }: { title: string; link: string; postTitle: string; networks: ShareNetwork[] }) {
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <Text weight="bold">{title}</Text>
      <View style={styles.wrap}>
        {networks.map((n) => (
          <BrandPill
            key={n}
            network={n}
            done={n === 'copy' && copied}
            onPress={async () => {
              if (n === 'copy') {
                await Clipboard.setStringAsync(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                return;
              }
              const url = shareUrl(n, link, postTitle);
              if (url) Linking.openURL(url).catch(() => Share.share({ message: `${postTitle}\n${link}` }));
            }}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="مشاركة"
          onPress={() => Share.share({ message: `${postTitle}\n${link}` })}
          style={[styles.pill, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }]}
        >
          <Share2 color={c.text} size={16} />
          <Text size="sm" weight="medium">
            المزيد
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- Text (posts without a PDF) ---------------- */

function Blocks({ blocks }: { blocks: ReturnType<typeof htmlToBlocks> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[3] }}>
      {blocks.map((b, i) =>
        b.href ? (
          <Pressable key={i} accessibilityRole="link" onPress={() => Linking.openURL(b.href!)}>
            <Text color={c.accent} style={{ textDecorationLine: 'underline' }}>
              {b.text}
            </Text>
          </Pressable>
        ) : (
          <Text key={i} size={b.type === 'h' ? 'lg' : 'base'} weight={b.type === 'h' ? 'bold' : 'regular'}>
            {b.type === 'li' ? `• ${b.text}` : b.text}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  chip: { paddingHorizontal: space[4], minHeight: 40, maxWidth: 240, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  viewer: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  viewerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[3], minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth },
  fullBtn: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 44 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[5] },
  track: { height: 8, width: '80%', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  download: { borderWidth: 1, borderRadius: radius.lg, padding: space[4], gap: space[3] },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  openWith: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[1], minHeight: 40 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[3], minHeight: 40, borderRadius: radius.pill },
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], minHeight: 44 },
});
