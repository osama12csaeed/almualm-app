import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import * as Application from 'expo-application';
import { ChevronLeft } from 'lucide-react-native';
import { useConfigValue } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { SectionTitle, Text } from '@/components/ui';
import { actions, useStore, type ThemeChoice } from '@/store/store';
import { prune } from '@/store/pdfCache';
import { radius, space, useTheme } from '@/theme/theme';

export default function Settings() {
  const { c } = useTheme();
  const config = useConfigValue();
  const s = useStore((st) => st.settings);
  const curricula = config?.home.curricula ?? [];
  const links = config?.links;

  const themeOptions: { key: ThemeChoice; label: string }[] = [
    { key: null, label: 'تلقائي' },
    { key: 'light', label: 'فاتح' },
    { key: 'dark', label: 'داكن' },
  ];
  const caps = [200, 400, 800, 1500];

  return (
    <Screen title="الإعدادات">
      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: space[7] }}>
        {curricula.length > 1 ? (
          <>
            <SectionTitle title="المنهج" />
            <Segmented
              options={curricula.map((cu) => ({ key: cu.id, label: cu.title }))}
              value={s.rootId}
              onChange={(rootId) => actions.setSettings({ rootId, gradeId: null })}
            />
          </>
        ) : null}

        <SectionTitle title="المظهر" />
        <Segmented options={themeOptions} value={s.theme} onChange={(theme) => actions.setSettings({ theme })} />
        <Row label="ملاءمة الصفحة لعرض الشاشة" hint="أوضح للقراءة على الهاتف. أوقفه لعرض الصفحة كاملة.">
          <Switch value={s.fitWidth} onValueChange={(fitWidth) => actions.setSettings({ fitWidth })} trackColor={{ true: c.accent }} />
        </Row>

        <SectionTitle title="الإشعارات" />
        <Row label="تنبيهات الملفات الجديدة">
          <Switch value={s.notifications} onValueChange={(notifications) => actions.setSettings({ notifications })} trackColor={{ true: c.accent }} />
        </Row>

        <SectionTitle title="مساحة الملفات على الهاتف" />
        <Segmented
          options={caps.map((m) => ({ key: m, label: m >= 1000 ? `${m / 1000} ج.ب` : `${m} م.ب` }))}
          value={s.cacheCapMB}
          onChange={(cacheCapMB) => {
            actions.setSettings({ cacheCapMB });
            setTimeout(prune, 50);
          }}
        />

        <SectionTitle title="عن التطبيق" />
        {links?.contact ? <LinkRow label="تواصل معنا" url={links.contact} /> : null}
        {links?.telegram ? <LinkRow label="قناة تيليجرام" url={links.telegram} /> : null}
        {links?.whatsapp ? <LinkRow label="واتساب" url={links.whatsapp} /> : null}
        {links?.facebook ? <LinkRow label="فيسبوك" url={links.facebook} /> : null}
        {links?.privacy ? <LinkRow label="سياسة الخصوصية" url={links.privacy} /> : null}
        <Text size="xs" muted center style={{ marginTop: space[5] }}>
          {config?.look.app_name ?? 'المعلم التعليمي'} · الإصدار {Application.nativeApplicationVersion ?? '1.0.0'} ({Application.nativeBuildVersion ?? '1'})
        </Text>
      </ScrollView>
    </Screen>
  );
}

function Segmented<K extends string | number | null>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(o.key)}
            style={[styles.segmentItem, active && { backgroundColor: c.accent }]}
          >
            <Text size="sm" weight="medium" color={active ? c.onAccent : c.text} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: c.border }]}>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
        {hint ? (
          <Text size="xs" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url).catch(() => {})} style={[styles.row, { borderBottomColor: c.border }]}>
      <Text style={{ flex: 1 }}>{label}</Text>
      <ChevronLeft color={c.textMuted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, padding: 4, gap: 4 },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space[2] },
});
