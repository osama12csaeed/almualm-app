import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import * as Application from 'expo-application';
import { useQueryClient } from '@tanstack/react-query';
import { keys, postComment, sendReport, useComments } from '@/api/hooks';
import type { Comment } from '@/api/types';
import { Button, Text } from './ui';
import { SiteHeading } from './site';
import { actions, useStore } from '@/store/store';
import { relativeDate } from '@/lib/core';
import { font, radius, space, useTheme } from '@/theme/theme';

/** The post's comments, as on the website: read them, reply, and add new ones. */
export function Comments({ fileId, title }: { fileId: number; title: string }) {
  const { c } = useTheme();
  const comments = useComments(fileId);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showAll, setShowAll] = useState(false);

  const threads = useMemo(() => {
    const list = comments.data?.comments ?? [];
    const byParent = new Map<number, Comment[]>();
    list.forEach((cm) => byParent.set(cm.parent, [...(byParent.get(cm.parent) ?? []), cm]));
    const ids = new Set(list.map((cm) => cm.id));
    // Top-level = no parent, or a parent that isn't visible (e.g. held for moderation).
    const tops = list.filter((cm) => cm.parent === 0 || !ids.has(cm.parent));
    return { tops, byParent };
  }, [comments.data]);

  const data = comments.data;
  const shown = showAll ? threads.tops : threads.tops.slice(0, 5);

  return (
    <View style={{ gap: space[3] }}>
      <SiteHeading title={data ? `${data.count} تعليق` : title} size={20} />

      {shown.map((cm) => (
        <View key={cm.id} style={{ gap: space[2] }}>
          <CommentCard comment={cm} fileId={fileId} onReply={data?.open ? () => setReplyTo(cm) : undefined} />
          {(threads.byParent.get(cm.id) ?? [])
            .slice()
            .reverse()
            .map((r) => (
              <View key={r.id} style={{ marginStart: space[5] }}>
                <CommentCard comment={r} fileId={fileId} />
              </View>
            ))}
        </View>
      ))}
      {threads.tops.length > 5 && !showAll ? (
        <Button title={`عرض كل التعليقات (${threads.tops.length})`} variant="secondary" onPress={() => setShowAll(true)} />
      ) : null}

      {data?.open ? (
        <CommentForm
          fileId={fileId}
          requireEmail={data.require_name_email}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      ) : data ? (
        <Text size="sm" muted>
          التعليقات مغلقة على هذا الملف.
        </Text>
      ) : null}
    </View>
  );
}

function CommentCard({ comment, fileId, onReply }: { comment: Comment; fileId: number; onReply?: () => void }) {
  const { c, dark } = useTheme();
  const [reported, setReported] = useState(false);
  // Google Play: users must be able to report offensive comments from inside the app.
  const report = () =>
    Alert.alert('الإبلاغ عن تعليق', 'هل هذا التعليق مسيء أو غير مناسب؟ سيراجعه فريق الموقع.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إبلاغ',
        style: 'destructive',
        onPress: () => {
          setReported(true);
          sendReport({
            file_id: fileId,
            message: `تعليق مسيء رقم ${comment.id} (${comment.author}): ${comment.content.slice(0, 300)}`,
            app_version: Application.nativeApplicationVersion ?? '',
          }).catch(() => setReported(false));
        },
      },
    ]);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: comment.by_site ? c.accent : dark ? c.border : '#efefef' }]}>
      <Text style={{ fontSize: 17, lineHeight: 26, color: c.text }} numberOfLines={1}>
        {comment.author}
        {comment.by_site ? ' · الموقع' : ''}
      </Text>
      <Text style={{ fontSize: 12, color: c.textMuted }}>{relativeDate(comment.date)}</Text>
      <Text style={{ fontSize: 14, lineHeight: 24, color: c.text, marginTop: 6 }}>{comment.content}</Text>
      <View style={styles.actionsRow}>
        {onReply ? (
          <Pressable accessibilityRole="button" onPress={onReply} style={styles.reply} hitSlop={8}>
            <Text style={{ fontSize: 16, color: c.text, textDecorationLine: 'underline' }}>رد</Text>
          </Pressable>
        ) : null}
        {!comment.by_site ? (
          <Pressable accessibilityRole="button" accessibilityLabel="الإبلاغ عن هذا التعليق" disabled={reported} onPress={report} style={styles.reply} hitSlop={8}>
            <Text style={{ fontSize: 13, color: c.textMuted }}>{reported ? 'تم الإبلاغ، شكراً' : 'إبلاغ'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function AgeScreen() {
  const { c } = useTheme();
  const [year, setYear] = useState('');
  const now = new Date().getFullYear();
  const n = Number(year);
  const valid = /^\d{4}$/.test(year) && n >= now - 100 && n <= now;
  return (
    <View style={[styles.form, { borderColor: c.border }]}>
      <Text style={{ color: c.heading, fontSize: 20, lineHeight: 30 }}>اترك تعليقاً</Text>
      <Text size="sm">ما سنة ميلادك؟</Text>
      <TextInput
        value={year}
        onChangeText={(t) => setYear(t.replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).slice(0, 4))}
        placeholder="مثال: 2008"
        placeholderTextColor={c.textMuted}
        keyboardType="number-pad"
        accessibilityLabel="سنة الميلاد"
        style={[styles.input, { color: c.text, borderColor: c.borderInput, backgroundColor: c.bg, fontFamily: font.regular }]}
      />
      <Pressable
        accessibilityRole="button"
        disabled={!valid}
        onPress={() => actions.setSettings({ birthYear: n })}
        style={({ pressed }) => [styles.submit, { backgroundColor: c.accent, opacity: !valid ? 0.5 : pressed ? 0.8 : 1 }]}
      >
        <Text style={{ color: '#ffffff', fontSize: 15 }}>متابعة</Text>
      </Pressable>
    </View>
  );
}

function CommentForm({ fileId, requireEmail, replyTo, onCancelReply }: { fileId: number; requireEmail: boolean; replyTo: Comment | null; onCancelReply: () => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const saved = useStore((s) => s.settings);
  const [name, setName] = useState(saved.commentName);
  const [email, setEmail] = useState(saved.commentEmail);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const emailOk = !requireEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = name.trim().length >= 2 && text.trim().length >= 2 && emailOk;

  const send = async () => {
    setSending(true);
    setMsg(null);
    try {
      const r = await postComment(fileId, { author: name.trim(), email: email.trim(), content: text.trim(), parent: replyTo?.id });
      actions.setSettings({ commentName: name.trim(), commentEmail: email.trim() });
      setText('');
      onCancelReply();
      setMsg({ ok: true, text: r.status === 'approved' ? 'تم نشر تعليقك.' : 'شكراً، تعليقك بانتظار المراجعة وسيظهر بعد الموافقة.' });
      qc.invalidateQueries({ queryKey: keys.comments(fileId) });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const input = [styles.input, { color: c.text, borderColor: c.borderInput, backgroundColor: c.bg }];
  // Neutral age screen (Google Play Families policy): asked once, before the first comment.
  // Under 13: comments can be read but not written, so no name or email is collected from children.
  if (saved.birthYear === null) return <AgeScreen />;
  if (new Date().getFullYear() - saved.birthYear < 13) {
    return (
      <View style={[styles.form, { borderColor: c.border }]}>
        <Text size="sm" muted>
          كتابة التعليقات متاحة لمن أعمارهم 13 سنة فأكثر. يمكنك قراءة التعليقات، أو اطلب من أحد والديك أو معلمك كتابة سؤالك.
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.form, { borderColor: c.border }]}>
      <Text style={{ color: c.heading, fontSize: 20, lineHeight: 30 }}>{replyTo ? `رد على ${replyTo.author}` : 'اترك تعليقاً'}</Text>
      {replyTo ? (
        <Pressable onPress={onCancelReply} accessibilityRole="button">
          <Text size="xs" color={c.accent}>
            إلغاء الرد
          </Text>
        </Pressable>
      ) : null}
      <TextInput value={name} onChangeText={setName} placeholder="الاسم" placeholderTextColor={c.textMuted} accessibilityLabel="الاسم" style={input} />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={requireEmail ? 'البريد الإلكتروني (لن يُنشر)' : 'البريد الإلكتروني (اختياري، لن يُنشر)'}
        placeholderTextColor={c.textMuted}
        accessibilityLabel="البريد الإلكتروني"
        keyboardType="email-address"
        autoCapitalize="none"
        style={[input, { textAlign: 'left' }]}
      />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="اكتب تعليقك…"
        placeholderTextColor={c.textMuted}
        accessibilityLabel="التعليق"
        multiline
        maxLength={3000}
        style={[input, { minHeight: 100, textAlignVertical: 'top' }]}
      />
      {msg ? (
        <Text size="sm" color={msg.ok ? c.success : c.danger}>
          {msg.text}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid || sending, busy: sending }}
        disabled={!valid || sending}
        onPress={send}
        style={({ pressed }) => [styles.submit, { backgroundColor: c.accent, opacity: !valid ? 0.5 : pressed || sending ? 0.8 : 1 }]}
      >
        <Text style={{ color: '#ffffff', fontSize: 15 }}>{sending ? 'جارٍ الإرسال…' : 'إرسال التعليق'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 5, borderWidth: 1, gap: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  submit: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 22, borderRadius: 5, justifyContent: 'center' },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  form: { gap: space[2], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[3] },
  input: { borderWidth: 1, borderRadius: 0, minHeight: 48, paddingHorizontal: space[3], fontSize: 16, fontFamily: font.regular, textAlign: 'right' },
});
