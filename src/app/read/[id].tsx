import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useFile } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { ErrorState, Skeleton } from '@/components/ui';
import { PdfReader } from '@/components/PdfReader';
import { AdBanner } from '@/ads/ads';
import { useStore } from '@/store/store';

/** «ملء الشاشة»: the PDF on its own, continuous vertical reading. */
export default function ReadScreen() {
  const params = useLocalSearchParams<{ id: string; pdf?: string }>();
  const id = Number(params.id);
  const index = Number(params.pdf ?? 0) || 0;
  const file = useFile(id);
  const offline = useStore((s) => Object.values(s.downloads).find((d) => d.fileId === id));
  const detail =
    file.data ??
    (offline
      ? { id, title: offline.title, badge: 'ملف', badge_color: null, thumb: null, modified: null, date: null, html: '', link: '', pdfs: [{ url: offline.url, name: offline.title, size: offline.size, version: offline.version }] }
      : undefined);
  const pdf = detail?.pdfs[Math.min(index, (detail?.pdfs.length ?? 1) - 1)];

  return (
    <Screen title={detail?.title ?? ''} back edges={['top', 'bottom']}>
      {!detail && file.isLoading ? <Skeleton height={500} style={{ margin: 16 }} /> : null}
      {!detail && file.isError ? <ErrorState message={file.error.message} onRetry={() => file.refetch()} /> : null}
      {detail && pdf ? <PdfReader key={pdf.url} detail={detail} pdf={pdf} pdfIndex={index} /> : null}
      <AdBanner placement="banner_reader" />
    </Screen>
  );
}
