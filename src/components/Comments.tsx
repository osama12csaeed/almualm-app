import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Reply } from 'lucide-react-native';
import { keys, postComment, useComments } from '@/api/hooks';
import type { Comment } from '@/api/types';
import { Button, Text } from './ui';
import { actions, useStore } from '@/store/store';
import { relativeDate } from '@/lib/core';
import { radius, space, useTheme } from '@/theme/theme';

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
      <View style={styles.head}>
        <MessageCircle color={c.text} size={20} />
        <Text size="lg" weight="bold">
          {data ? `${data.count} تعليق` : title}
        </Text>
      </View>

      {shown.map((cm) => (
        <View key={cm.id} style={{ gap: space[2] }}>
          <CommentCard comment={cm} onReply={data?.open ? () => setReplyTo(cm) : undefined} />
          {(threads.byParent.get(cm.id) ?? [])
            .slice()
            .reverse()
            .map((r) => (
              <View key={r.id} style={{ marginStart: space[5] }}>
                <CommentCard comment={r} />
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

function CommentCard({ comment, onReply }: { comment: Comment; onReply?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: comment.by_site ? c.accent : c.border }]}>
      <View style={styles.cardHead}>
        <Text weight="bold" size="sm" style={{ flex: 1 }} numberOfLines={1}>
          {comment.author}
          {comment.by_site ? ' · الموقع' : ''}
        </Text>
        <Text size="xs" muted>
          {relativeDate(comment.date)}
        </Text>
      </View>
      <Text size="sm">{comment.content}</Text>
      {onReply ? (
        <Pressable accessibilityRole="button" onPress={onReply} style={styles.reply} hitSlop={8}>
          <Reply color={c.accent} size={16} />
          <Text size="xs" weight="medium" color={c.accent}>
            رد
          </Text>
        </Pressable>
      ) : null}
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
  return (
    <View style={[styles.form, { borderColor: c.border }]}>
      <Text weight="bold">{replyTo ? `رد على ${replyTo.author}` : 'أضف تعليقاً'}</Text>
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
      <Button title="إرسال التعليق" loading={sending} disabled={!valid} onPress={send} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  card: { padding: space[3], borderRadius: radius.md, borderWidth: 1, gap: space[1] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  reply: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  form: { gap: space[2], borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[3] },
  input: { borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: space[3], fontSize: 16, fontFamily: 'Cairo_400Regular', textAlign: 'right' },
});
