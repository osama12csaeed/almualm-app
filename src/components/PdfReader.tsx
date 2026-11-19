import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Pdf, { type PdfRef } from 'react-native-pdf';
import { CloudDownload, CloudOff, Flag, Hash, Pin, PinOff, Type } from 'lucide-react-native';
import type { FileDetail, Pdf as PdfItem } from '@/api/types';
import { Button, EmptyState, IconButton, Text } from '@/components/ui';
import { actions, getState, useStore } from '@/store/store';
import { getPdf, localFileFor, type DownloadHandle } from '@/store/pdfCache';
import { formatBytes } from '@/lib/core';
import { radius, space, useTheme } from '@/theme/theme';

/** Full-screen, vertical, continuous reader: resume page, jump to page, keep offline, report. */
export function PdfReader({ detail, pdf, pdfIndex, onToggleText }: { detail: FileDetail; pdf: PdfItem; pdfIndex: number; onToggleText?: () => void }) {
  const { c, dark } = useTheme();
  const saved = getState().progress[detail.id];
  const startPage = saved && saved.pdfIndex === pdfIndex ? saved.page : 1;
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(startPage);
  const [total, setTotal] = useState(saved?.total ?? 0);
  const pdfRef = useRef<PdfRef>(null);
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
        ref={pdfRef}
        source={{ uri }}
        page={startPage}
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
          pdfRef.current?.setPage(p);
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

const styles = StyleSheet.create({
  downloading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[6] },
  track: { height: 8, width: '80%', borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[2], borderTopWidth: StyleSheet.hairlineWidth, minHeight: 52 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 48, paddingHorizontal: space[3] },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[5] },
  dialog: { width: '100%', maxWidth: 360, borderRadius: radius.lg, padding: space[5], gap: space[3] },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space[3], fontSize: 18, textAlign: 'center' },
});
