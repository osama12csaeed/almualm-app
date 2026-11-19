import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Pdf from 'react-native-pdf';
import { Bookmark, BookmarkCheck, CloudDownload, CloudOff, ExternalLink, Flag, Hash, Pin, PinOff, Share2, Type } from 'lucide-react-native';
import { useFile } from '@/api/hooks';
import type { FileDetail, Pdf as PdfItem } from '@/api/types';
import { Screen } from '@/components/screen';
import { Badge, Button, EmptyState, ErrorState, IconButton, Skeleton, Text } from '@/components/ui';
import { AdBanner, useInterstitialOnOpen } from '@/ads/ads';
import { actions, getState, useStore } from '@/store/store';
import { getPdf, localFileFor, type DownloadHandle } from '@/store/pdfCache';
import { formatBytes, htmlToBlocks } from '@/lib/core';
import { radius, space, useTheme } from '@/theme/theme';

export default function FileScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const file = useFile(id);
  const { c } = useTheme();
  const onFileOpened = useInterstitialOnOpen();
  const counted = useRef(false);
  const fav = useStore((s) => Boolean(s.favFiles[id]));

  // Offline and never fetched details? Fall back to what is saved on the phone.
  const offlineCopy = useStore((s) => Object.values(s.downloads).find((d) => d.fileId === id));
  const detail: FileDetail | undefined =
    file.data ??
    (offlineCopy
      ? { id, title: offlineCopy.title, badge: 'ملف', badge_color: null, thumb: null, modified: null, date: null, html: '', link: '', pdfs: [{ url: offlineCopy.url, name: offlineCopy.title, size: offlineCopy.size, version: offlineCopy.version }] }
      : undefined);

  useEffect(() => {
    if (detail && !counted.current) {
      counted.current = true;
      onFileOpened();
    }
  }, [detail, onFileOpened]);

  const actionsBar = detail ? (
    <>
      <IconButton label={fav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} onPress={() => actions.toggleFavFile(detail)}>
        {fav ? <BookmarkCheck color={c.accent} size={22} /> : <Bookmark color={c.text} size={22} />}
      </IconButton>
      {detail.link ? (
        <IconButton label="مشاركة" onPress={() => Share.share({ message: `${detail.title}\n${detail.link}` }).catch(() => {})}>
          <Share2 color={c.text} size={22} />
        </IconButton>
      ) : null}
    </>
  ) : null;

  return (
    <Screen title={detail?.title ?? ''} back actions={actionsBar} edges={['top', 'bottom']}>
      {!detail && file.isLoading ? (
        <View style={{ padding: space[4], gap: space[3] }}>
          <Skeleton height={24} style={{ width: 120 }} />
          <Skeleton height={420} />
        </View>
      ) : null}
      {!detail && file.isError ? <ErrorState message={file.error.message} onRetry={() => file.refetch()} /> : null}
      {detail ? <Reader detail={detail} /> : null}
    </Screen>
  );
}

function Reader({ detail }: { detail: FileDetail }) {
  const { c } = useTheme();
  const [pdfIndex, setPdfIndex] = useState(() => getState().progress[detail.id]?.pdfIndex ?? 0);
  const [showText, setShowText] = useState(false);
  const blocks = useMemo(() => htmlToBlocks(detail.html), [detail.html]);
  const pdf: PdfItem | undefined = detail.pdfs[Math.min(pdfIndex, detail.pdfs.length - 1)];

  if (!pdf) {
    return (
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }}>
        <View style={{ flexDirection: 'row' }}>
          <Badge name={detail.badge} color={detail.badge_color} />
        </View>
        {blocks.length ? <Blocks blocks={blocks} /> : <EmptyState title="لا يوجد ملف PDF في هذه الصفحة" body="يمكنك فتحها على الموقع." />}
        {detail.link ? <Button title="فتح على الموقع" variant="secondary" icon={<ExternalLink color={c.accent} size={18} />} onPress={() => Linking.openURL(detail.link)} /> : null}
        <ReportLink fileId={detail.id} />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {detail.pdfs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pdfTabs}>
          {detail.pdfs.map((p, i) => {
            const active = i === pdfIndex;
            return (
              <Pressable
                key={p.url}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setPdfIndex(i)}
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
      {showText ? (
        <ScrollView contentContainerStyle={{ padding: space[4] }}>
          <Blocks blocks={blocks} />
        </ScrollView>
      ) : (
        <PdfView key={pdf.url} detail={detail} pdf={pdf} pdfIndex={pdfIndex} onToggleText={blocks.length ? () => setShowText(true) : undefined} />
      )}
      {showText ? <Button title="العودة إلى الملف" variant="secondary" style={{ margin: space[3] }} onPress={() => setShowText(false)} /> : null}
      <AdBanner placement="banner_reader" />
    </View>
  );
}

function PdfView({ detail, pdf, pdfIndex, onToggleText }: { detail: FileDetail; pdf: PdfItem; pdfIndex: number; onToggleText?: () => void }) {
  const { c, dark } = useTheme();
  const saved = getState().progress[detail.id];
  const startPage = saved && saved.pdfIndex === pdfIndex ? saved.page : 1;
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(startPage);
  const [total, setTotal] = useState(saved?.total ?? 0);
  const [jumpTo, setJumpTo] = useState<number | undefined>(startPage > 1 ? startPage : undefined);
  const [askPage, setAskPage] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fitWidth = useStore((s) => s.settings.fitWidth);
  const { key } = localFileFor(detail.id, pdf.url, pdf.version);
  const pinned = useStore((s) => s.downloads[key]?.pinned ?? false);
  const handle = useRef<DownloadHandle | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setError(null);
    setProgress(0);
    handle.current = getPdf(detail.id, detail.title, pdf.url, pdf.version, setProgress);
    handle.current.promise.then(setUri).catch((e: Error) => {
      if (e.message !== 'cancelled') setError('تعذّر تنزيل الملف. تحقق من الاتصال ثم أعد المحاولة.');
    });
    return () => handle.current?.cancel();
  }, [detail.id, detail.title, pdf.url, pdf.version, attempt]);

  const onPage = (p: number, n: number) => {
    setPage(p);
    setTotal(n);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      actions.saveProgress({ fileId: detail.id, title: detail.title, badge: detail.badge, pdfIndex, page: p, total: n });
    }, 400);
  };

  if (error) {
    return (
      <EmptyState
        icon={<CloudOff color={c.textMuted} size={44} />}
        title="لم يكتمل التنزيل"
        body={error}
        action={<Button title="إعادة المحاولة" onPress={() => setAttempt((a) => a + 1)} />}
      />
    );
  }

  if (!uri) {
    return (
      <View style={styles.downloading} accessibilityLiveRegion="polite">
        <CloudDownload color={c.accent} size={44} />
        <Text weight="medium">جارٍ تجهيز الملف…</Text>
        <View style={[styles.track, { backgroundColor: c.border }]}>
          <View style={[styles.fill, { backgroundColor: c.accent, width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text size="sm" muted>
          {progress > 0 ? `${Math.round(progress * 100)}%` : ''} {pdf.size ? `من ${formatBytes(pdf.size)}` : ''}
        </Text>
        <Text size="xs" muted center>
          بعد أول فتح يبقى الملف على هاتفك ويعمل بدون إنترنت.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Pdf
        source={{ uri }}
        page={jumpTo}
        fitPolicy={fitWidth ? 0 : 2}
        minScale={1}
        maxScale={5}
        enableDoubleTapZoom
        enableAntialiasing
        spacing={8}
        style={{ flex: 1, backgroundColor: dark ? '#05080f' : c.surface }}
        onLoadComplete={(n) => setTotal(n)}
        onPageChanged={onPage}
        onError={() => setError('الملف تالف أو غير مكتمل. أعد تنزيله.')}
        renderActivityIndicator={() => <Text muted>…</Text>}
      />
      <View style={[styles.toolbar, { backgroundColor: c.bg, borderTopColor: c.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="الانتقال إلى صفحة" onPress={() => setAskPage(true)} style={styles.pageBtn}>
          <Hash color={c.text} size={18} />
          <Text size="sm" weight="medium">
            {page} / {total || '…'}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {onToggleText ? (
          <IconButton label="عرض النص" onPress={onToggleText}>
            <Type color={c.text} size={20} />
          </IconButton>
        ) : null}
        <IconButton
          label={pinned ? 'إلغاء الحفظ الدائم' : 'احفظه دائماً على الهاتف'}
          onPress={() => actions.setPinned(key, !pinned)}
        >
          {pinned ? <Pin color={c.accent} size={20} /> : <PinOff color={c.text} size={20} />}
        </IconButton>
        <IconButton label="الإبلاغ عن مشكلة" onPress={() => router.push({ pathname: '/report/[id]', params: { id: String(detail.id), page: String(page) } })}>
          <Flag color={c.text} size={20} />
        </IconButton>
      </View>
      <JumpDialog
        visible={askPage}
        total={total}
        onClose={() => setAskPage(false)}
        onGo={(p) => {
          setJumpTo(p);
          setAskPage(false);
        }}
      />
    </View>
  );
}

function JumpDialog({ visible, total, onClose, onGo }: { visible: boolean; total: number; onClose: () => void; onGo: (p: number) => void }) {
  const { c } = useTheme();
  const [value, setValue] = useState('');
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && (!total || n <= total);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: c.overlay }]} onPress={onClose}>
        <Pressable style={[styles.dialog, { backgroundColor: c.bg }]} onPress={() => {}}>
          <Text weight="bold">الانتقال إلى صفحة</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            autoFocus
            placeholder={total ? `1 – ${total}` : 'رقم الصفحة'}
            placeholderTextColor={c.textMuted}
            accessibilityLabel="رقم الصفحة"
            onSubmitEditing={() => valid && onGo(n)}
            style={[styles.input, { color: c.text, borderColor: c.borderInput }]}
          />
          <Button title="انتقال" disabled={!valid} onPress={() => onGo(n)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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

function ReportLink({ fileId }: { fileId: number }) {
  const { c } = useTheme();
  return (
    <Button
      title="الإبلاغ عن مشكلة"
      variant="ghost"
      icon={<Flag color={c.accent} size={18} />}
      onPress={() => router.push({ pathname: '/report/[id]', params: { id: String(fileId) } })}
    />
  );
}

const styles = StyleSheet.create({
  pdfTabs: { gap: space[2], padding: space[3] },
  chip: { paddingHorizontal: space[4], minHeight: 40, maxWidth: 240, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  downloading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] },
  track: { height: 8, width: '80%', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[2], borderTopWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 48, paddingHorizontal: space[3] },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  dialog: { width: '100%', maxWidth: 360, borderRadius: radius.lg, padding: space[5], gap: space[3] },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space[3], fontSize: 18, textAlign: 'center' },
});
