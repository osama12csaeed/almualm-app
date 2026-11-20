import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { Bookmark, BookmarkCheck, CheckCircle2, CloudOff, ExternalLink } from 'lucide-react-native';
import { openSiteLink, useFile } from '@/api/hooks';
import type { FileDetail, Pdf as PdfItem, ShareNetwork } from '@/api/types';
import { Screen } from '@/components/screen';
import { Button, EmptyState, ErrorState, IconButton, Skeleton, Text } from '@/components/ui';
import { Fa, SiteBox, SiteCardGrid, SiteHeading } from '@/components/site';
import { Comments } from '@/components/Comments';
import { AdBanner, useInterstitialOnOpen } from '@/ads/ads';
import { actions, getState, useStore } from '@/store/store';
import { getPdf, localFileFor, type DownloadHandle } from '@/store/pdfCache';
import { openWith, saveToPhone } from '@/store/savePdf';
import { formatBytes, htmlToBlocks } from '@/lib/core';
import { font, space, useTheme } from '@/theme/theme';

/**
 * The post page, built like almualm.com's (same order, colours, sizes and buttons):
 * breadcrumb → title → PDF viewer (scroll + zoom, like PDF.js) → «تحميل الملف» → follow us →
 * «ملفات اخرى» → «شارك المقالة» → post text → comments.
 */
export default function FileScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const file = useFile(id);
  const { c } = useTheme();
  const onFileOpened = useInterstitialOnOpen();
  const counted = useRef(false);
  const fav = useStore((s) => Boolean(s.favFiles[id]));

  const offlineCopy = useStore((s) => Object.values(s.downloads).find((d) => d.fileId === id));
  // No connection and nothing cached: show the copy already on the phone.
  const offlineDetail = useMemo<FileDetail | undefined>(
    () =>
      offlineCopy
        ? {
            id, title: offlineCopy.title, badge: 'ملف', badge_color: null, thumb: null, modified: null, date: null, html: '', link: '',
            pdfs: [{ url: offlineCopy.url, name: offlineCopy.title, size: offlineCopy.size, version: offlineCopy.version }],
          }
        : undefined,
    [id, offlineCopy],
  );
  const detail: FileDetail | undefined = file.data ?? offlineDetail;

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

  return (
    <Screen title={detail?.title ?? ''} back search actions={headerActions}>
      {!detail && file.isLoading ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          <Skeleton height={16} style={{ width: 240 }} />
          <Skeleton height={56} />
          <Skeleton height={520} />
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
  const { width } = useWindowDimensions();
  const [pdfIndex, setPdfIndex] = useState(() => getState().progress[detail.id]?.pdfIndex ?? 0);
  const blocks = useMemo(() => htmlToBlocks(detail.html), [detail.html]);
  const pdf: PdfItem | undefined = detail.pdfs[Math.min(pdfIndex, detail.pdfs.length - 1)];
  const labels = detail.labels ?? { follow: 'للمزيد تابعنا في منصات التواصل الاجتماعي', related: 'ملفات اخرى', share: 'شارك المقالة', comments: 'التعليقات' };
  const [localUri, setLocalUri] = useState<string | null>(null);
  const contentW = width - space[4] * 2;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {/* 1. Breadcrumb (one line, scrolls sideways like the site) */}
      {detail.breadcrumb?.length ? <Breadcrumb crumbs={detail.breadcrumb} title={detail.title} /> : null}

      {/* 2. Title: h1.subheading */}
      <SiteHeading title={detail.title} size={21} />

      {/* 3. PDF viewer */}
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
                style={[styles.tab, { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border }]}
              >
                <Text size="sm" color={active ? '#ffffff' : c.text} numberOfLines={1}>
                  {p.name || `الملف ${i + 1}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {pdf ? (
        <PdfViewer key={pdf.url + (pdf.version ?? '')} detail={detail} pdf={pdf} pdfIndex={pdfIndex} onReady={setLocalUri} />
      ) : (
        // No PDF on this post: its content is shown below, as on the website.
        blocks.length ? null : (
          <View style={{ gap: space[3] }}>
            <EmptyState icon={<Fa name="file-lines" size={40} color={c.textMuted} />} title="لا يوجد محتوى لعرضه" />
            {detail.link ? <Button title="فتح على الموقع" variant="secondary" icon={<ExternalLink color={c.accent} size={18} />} onPress={() => Linking.openURL(detail.link)} /> : null}
          </View>
        )
      )}

      {/* Post without a PDF: the content takes the viewer's place (the website shows it the same way). */}
      {!pdf && blocks.length ? <PostText blocks={blocks} /> : null}

      {/* 4. .file-download-container */}
      {pdf ? <DownloadBox detail={detail} pdf={pdf} localUri={localUri} /> : null}

      {/* 5. .sharer: follow us */}
      {detail.follow?.length ? (
        <SiteBox radius={8} style={styles.sharer}>
          <Text style={[styles.sharerText, { color: c.text }]}>{labels.follow}</Text>
          <View style={styles.sharerIcons}>
            {detail.follow.map((f) => (
              <FollowIcon key={f.url} network={f.network} url={f.url} />
            ))}
          </View>
        </SiteBox>
      ) : null}

      {/* 6. «ملفات اخرى» */}
      {detail.related?.length ? (
        <View style={{ gap: 20 }}>
          <SiteHeading title={labels.related} />
          <SiteCardGrid files={detail.related} width={contentW} onOpen={(rid) => router.push({ pathname: '/file/[id]', params: { id: String(rid) } })} />
        </View>
      ) : null}

      {/* 7. «شارك المقالة» */}
      {detail.link ? (
        <ShareSection
          title={labels.share}
          link={detail.link}
          postTitle={detail.title}
          networks={detail.share?.length ? detail.share : ['facebook', 'twitter', 'whatsapp', 'telegram', 'linkedin', 'copy']}
        />
      ) : null}

      {/* 8. Post text (the site shows it under the share box) */}
      {pdf && blocks.length ? <PostText blocks={blocks} /> : null}

      {/* 9. Comments */}
      {detail.comments ? <Comments fileId={detail.id} title={labels.comments} /> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/report/[id]', params: { id: String(detail.id), page: String(getState().progress[detail.id]?.page ?? '') } })}
        style={styles.report}
      >
        <Fa name="flag" size={13} color={c.textMuted} />
        <Text size="sm" muted>
          الإبلاغ عن مشكلة في هذا الملف
        </Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- 1. Breadcrumb: الرئيسية » المنهج » الصف » المادة » العنوان ---------------- */

function Breadcrumb({ crumbs, title }: { crumbs: NonNullable<FileDetail['breadcrumb']>; title: string }) {
  const { c } = useTheme();
  const link = { color: c.text, fontSize: 12, textDecorationLine: 'underline' as const };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crumbs}>
      <Pressable accessibilityRole="link" onPress={() => router.navigate('/')} hitSlop={8}>
        <Text style={link}>الرئيسية</Text>
      </Pressable>
      {crumbs.map((cr, i) => (
        <View key={i} style={styles.crumb}>
          <Text style={{ color: c.text, fontSize: 12 }}> » </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() =>
              cr.type === 'node'
                ? router.push({ pathname: '/node/[id]', params: { id: String(cr.id), title: cr.title } })
                : openSiteLink(cr.url)
            }
          >
            <Text style={link}>{cr.title}</Text>
          </Pressable>
        </View>
      ))}
      <Text style={{ color: c.text, fontSize: 12 }}> » {title}</Text>
    </ScrollView>
  );
}

/* ---------------- 3. PDF viewer: scroll through pages and zoom, inside the page ---------------- */

/**
 * Zoom is left entirely to the viewer (pinch / double tap). Its zoom level must never be fed back
 * as the `scale` prop: on Android every prop change reloads the document and re-applies `scale`,
 * which made a pinch zoom in again and again without stopping.
 * Memoised so the page's scroll lock (state in the parent) doesn't re-render the viewer.
 */
const PdfViewer = React.memo(function PdfViewer({
  detail, pdf, pdfIndex, onReady,
}: { detail: FileDetail; pdf: PdfItem; pdfIndex: number; onReady: (uri: string) => void }) {
  const { c, dark } = useTheme();
  const { height } = useWindowDimensions();
  const saved = getState().progress[detail.id];
  const startPage = saved && saved.pdfIndex === pdfIndex ? saved.page : 1;
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(startPage);
  const [total, setTotal] = useState(0);
  const pdfRef = useRef<PdfRef>(null);
  const [pageInput, setPageInput] = useState(String(startPage));
  const [attempt, setAttempt] = useState(0);
  const handle = useRef<DownloadHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tall like the site's 800px frame, while leaving page above/below it to grab and scroll the page.
  const frameHeight = Math.min(800, Math.round(height * 0.68));

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
        if (e.message === 'cancelled') return;
        if (pdf.host === 'gdrive') setError('لم يسمح Google Drive بتنزيل الملف الآن (قد يكون حد التنزيل اليومي). أعد المحاولة لاحقاً أو افتحه في Google Drive.');
        else setError('تعذّر تحميل الملف. تحقق من الاتصال ثم أعد المحاولة.');
      });
    return () => handle.current?.cancel();
  }, [detail.id, detail.title, pdf.url, pdf.version, pdf.host, attempt, onReady]);

  const onPage = (p: number, n: number) => {
    setPage(p);
    setTotal(n);
    setPageInput(String(p));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => actions.saveProgress({ fileId: detail.id, title: detail.title, badge: detail.badge, pdfIndex, page: p, total: n }), 400);
  };

  const jump = () => {
    const n = Number(pageInput);
    // Jump with the viewer's command: changing the `page` prop would reload the whole file.
    if (Number.isInteger(n) && n >= 1 && (!total || n <= total)) pdfRef.current?.setPage(n);
    else setPageInput(String(page));
  };

  // Stable props: the native viewer reloads the whole file whenever a prop changes.
  const source = useMemo(() => (uri ? { uri } : null), [uri]);
  const pdfStyle = useMemo(() => ({ flex: 1, backgroundColor: dark ? '#05080f' : '#d4d4d7' }), [dark]);

  const openFull = () => router.push({ pathname: '/read/[id]', params: { id: String(detail.id), pdf: String(pdfIndex) } });
  const toolColor = c.text;

  return (
    <View style={[styles.frame, { height: frameHeight, borderColor: dark ? c.border : '#cccccc' }]}>
      {/* Toolbar, like PDF.js: page box, zoom, full screen */}
      <View style={[styles.toolbar, { backgroundColor: dark ? c.surface : '#f9f9fa', borderBottomColor: dark ? c.border : '#dddddd' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="ملء الشاشة" onPress={openFull} hitSlop={6} style={[styles.tool, styles.fullBtn]}>
          <Fa name="expand" size={15} color={toolColor} />
          <Text style={{ color: toolColor, fontSize: 12 }}>ملء الشاشة</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <View style={styles.pageBox}>
          <TextInput
            value={pageInput}
            onChangeText={setPageInput}
            onSubmitEditing={jump}
            onBlur={jump}
            keyboardType="number-pad"
            returnKeyType="go"
            selectTextOnFocus
            accessibilityLabel="رقم الصفحة"
            style={[styles.pageInput, { color: c.text, borderColor: dark ? c.border : '#bbbbbb', backgroundColor: dark ? c.bg : '#ffffff' }]}
          />
          <Text style={{ color: c.text, fontSize: 13 }}>من {total || '…'}</Text>
        </View>
      </View>

      {error ? (
        <EmptyState
          icon={<CloudOff color={c.textMuted} size={40} />}
          title="لم يكتمل التحميل"
          body={error}
          action={
            <View style={{ gap: space[2], alignSelf: 'stretch' }}>
              <Button title="إعادة المحاولة" onPress={() => setAttempt((a) => a + 1)} />
              {pdf.view ? (
                <Button title="فتح في Google Drive" variant="secondary" icon={<ExternalLink color={c.accent} size={18} />} onPress={() => Linking.openURL(pdf.view!).catch(() => {})} />
              ) : null}
            </View>
          }
        />
      ) : !uri ? (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <Fa name="file-pdf" size={38} color={c.accent} />
          <Text>جارٍ تحميل الملف…</Text>
          <View style={[styles.track, { backgroundColor: c.border }]}>
            <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text size="sm" muted>
            {progress > 0 ? `${Math.round(progress * 100)}%` : ''} {pdf.size ? `من ${formatBytes(pdf.size)}` : ''}
          </Text>
        </View>
      ) : (
        // The PDF claims its own touches natively (patches/react-native-pdf): a finger on the PDF
        // scrolls and zooms the PDF, a finger anywhere else scrolls the page.
        <View style={{ flex: 1 }}>
          <Pdf
            ref={pdfRef}
            source={source!}
            page={startPage}
            minScale={1}
            maxScale={4}
            fitPolicy={0}
            spacing={10}
            enableDoubleTapZoom
            enableAntialiasing
            style={pdfStyle}
            onLoadComplete={(n) => setTotal(n)}
            onPageChanged={onPage}
            onError={() => setError('الملف تالف أو غير مكتمل. أعد تحميله.')}
          />
        </View>
      )}
    </View>
  );
});

/* ---------------- 4. «تحميل الملف» ---------------- */

function DownloadBox({ detail, pdf, localUri }: { detail: FileDetail; pdf: PdfItem; localUri: string | null }) {
  const { c, dark } = useTheme();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'shared'>('idle');
  const { key } = localFileFor(detail.id, pdf.url, pdf.version);
  const texts = detail.download ?? { title: 'تحميل الملف', button: 'تحميل PDF' };

  const save = async () => {
    if (!localUri || state === 'saving') return;
    setState('saving');
    actions.setPinned(key, true);
    const r = await saveToPhone(localUri, pdf.name || detail.title).catch(() => 'cancelled' as const);
    setState(r === 'cancelled' ? 'idle' : r);
  };

  return (
    <SiteBox style={{ alignItems: 'center', gap: 12 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 16, color: dark ? c.text : '#2c3e50' }}>{texts.title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={texts.button}
        accessibilityState={{ disabled: !localUri, busy: state === 'saving' }}
        onPress={save}
        style={({ pressed }) => [{ alignItems: 'center', gap: 6, opacity: !localUri ? 0.55 : pressed ? 0.85 : 1 }]}
      >
        <LinearGradient colors={['#e74c3c', '#c0392b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pdfBtn}>
          <Fa name={state === 'saved' ? 'check' : 'file-pdf'} size={24} color="#ffffff" />
        </LinearGradient>
        <Text style={{ fontFamily: font.medium, fontSize: 11, color: dark ? c.textMuted : '#34495e' }}>
          {localUri ? texts.button : 'جارٍ التجهيز…'}
          {localUri && pdf.size ? ` (${formatBytes(pdf.size)})` : ''}
        </Text>
      </Pressable>
      {state === 'saved' ? (
        <View style={styles.savedRow}>
          <CheckCircle2 color={c.success} size={16} />
          <Text size="xs" color={c.success}>
            تم حفظ الملف في هاتفك
          </Text>
        </View>
      ) : null}
      {localUri ? (
        <Pressable accessibilityRole="button" onPress={() => openWith(localUri, detail.title)} hitSlop={6}>
          <Text size="xs" style={{ color: c.heading, textDecorationLine: 'underline' }}>
            فتح بتطبيق آخر
          </Text>
        </Pressable>
      ) : null}
    </SiteBox>
  );
}

/* ---------------- 5. Follow icons (.sharer-list) ---------------- */

const FOLLOW: Record<string, { icon: string; bg: string }> = {
  whatsapp: { icon: 'whatsapp', bg: '#4dd060' },
  telegram: { icon: 'telegram', bg: '#3da5f1' },
  facebook: { icon: 'facebook-f', bg: '#1877f2' },
  twitter: { icon: 'x-twitter', bg: '#111111' },
  youtube: { icon: 'youtube', bg: '#ff0000' },
  instagram: { icon: 'instagram', bg: '#c13584' },
  tiktok: { icon: 'tiktok', bg: '#111111' },
  linkedin: { icon: 'linkedin-in', bg: '#0077b5' },
};

function FollowIcon({ network, url }: { network: string; url: string }) {
  const f = FOLLOW[network];
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={network} onPress={() => Linking.openURL(url).catch(() => {})} hitSlop={6} style={[styles.followIcon, { backgroundColor: f?.bg ?? '#6c757d' }]}>
      {f ? <Fa name={f.icon} brand size={14} color="#ffffff" /> : <Fa name="link" size={13} color="#ffffff" />}
    </Pressable>
  );
}

/* ---------------- 7. «شارك المقالة» ---------------- */

const SHARE: Record<ShareNetwork, { label: string; bg: string; icon: string; brand: boolean }> = {
  facebook: { label: 'فيسبوك', bg: '#1877f2', icon: 'facebook-f', brand: true },
  twitter: { label: 'تويتر', bg: '#1da1f2', icon: 'twitter', brand: true },
  whatsapp: { label: 'واتساب', bg: '#25d366', icon: 'whatsapp', brand: true },
  telegram: { label: 'تيليجرام', bg: '#0088cc', icon: 'telegram', brand: true },
  linkedin: { label: 'لينكد إن', bg: '#0077b5', icon: 'linkedin-in', brand: true },
  copy: { label: 'نسخ الرابط', bg: '#6c757d', icon: 'copy', brand: false },
};

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
  const { c, dark } = useTheme();
  const { width } = useWindowDimensions();
  const [copied, setCopied] = useState(false);
  // Three small buttons per row so the box fits any phone.
  const btnW = Math.floor((width - space[4] * 2 - 24 - 2 - 16) / 3);
  return (
    <View style={[styles.shareBox, { borderColor: dark ? c.border : '#dddddd', backgroundColor: c.bg }]}>
      <Text center style={{ color: c.text, fontSize: 16, lineHeight: 24, marginBottom: 10 }}>
        {title}
      </Text>
      <View style={styles.shareGrid}>
        {networks.map((n) => {
          const s = SHARE[n];
          if (!s) return null;
          const done = n === 'copy' && copied;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={s.label}
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
              style={({ pressed }) => [styles.shareBtn, { width: btnW, backgroundColor: s.bg, opacity: pressed ? 0.85 : 1 }]}
            >
              <Fa name={done ? 'check' : s.icon} brand={!done && s.brand} size={12} color="#ffffff" />
              <Text numberOfLines={1} style={{ color: '#ffffff', fontSize: 11, fontFamily: font.medium, flexShrink: 1 }}>
                {done ? 'تم النسخ' : s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ---------------- 8. Post text ---------------- */

function PostText({ blocks }: { blocks: ReturnType<typeof htmlToBlocks> }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {blocks.map((b, i) =>
        b.type === 'img' ? (
          <Image
            key={i}
            source={{ uri: b.src }}
            style={{ width: '100%', aspectRatio: b.ratio ?? 1.5, borderRadius: 6, backgroundColor: c.surface }}
            contentFit="contain"
            cachePolicy="disk"
            accessibilityIgnoresInvertColors
          />
        ) : b.href ? (
          <Pressable key={i} accessibilityRole="link" onPress={() => openSiteLink(b.href!)}>
            <Text style={{ color: c.heading, fontSize: 15, lineHeight: 28, textDecorationLine: 'underline' }}>{b.text}</Text>
          </Pressable>
        ) : (
          <Text key={i} style={{ color: c.text, fontSize: b.type === 'h' ? 17 : 15, lineHeight: b.type === 'h' ? 30 : 28, fontFamily: b.type === 'h' ? font.medium : font.regular }}>
            {b.type === 'li' ? `• ${b.text}` : b.text}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[7], gap: 22 },
  crumbs: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  crumb: { flexDirection: 'row', alignItems: 'center' },
  tab: { paddingHorizontal: space[4], minHeight: 38, maxWidth: 240, justifyContent: 'center', borderRadius: 8, borderWidth: 1 },
  frame: { borderWidth: 1.4, borderRadius: 8, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingHorizontal: 6, borderBottomWidth: 1 },
  tool: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  fullBtn: { flexDirection: 'row', gap: 6, paddingHorizontal: 6 },
  pageBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingEnd: 4 },
  pageInput: { width: 54, height: 34, borderWidth: 1, borderRadius: 4, textAlign: 'center', fontSize: 15, paddingVertical: 0, fontFamily: font.regular },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[5] },
  track: { height: 8, width: '80%', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  pdfBtn: { width: 52, height: 52, borderRadius: 9, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sharer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  sharerText: { flex: 1, fontSize: 15, lineHeight: 24, fontFamily: font.medium },
  sharerIcons: { flexDirection: 'row', gap: 8 },
  followIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  shareBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  shareBtn: { height: 32, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 4 },
  report: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2], minHeight: 44 },
});
