import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Application from 'expo-application';
import { CheckCircle2 } from 'lucide-react-native';
import { sendReport, useFile } from '@/api/hooks';
import { Screen } from '@/components/screen';
import { Button, EmptyState, Text } from '@/components/ui';
import { radius, space, useTheme } from '@/theme/theme';

const QUICK = ['صفحة ناقصة', 'إجابة خاطئة', 'الملف لا يفتح', 'الملف لمادة أخرى'];

export default function Report() {
  const params = useLocalSearchParams<{ id: string; page?: string }>();
  const id = Number(params.id);
  const page = params.page ? Number(params.page) : undefined;
  const file = useFile(id);
  const { c } = useTheme();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      await sendReport({ file_id: id, page, message: message.trim(), app_version: `${Application.nativeApplicationVersion ?? ''} (${Application.nativeBuildVersion ?? ''})` });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen title="الإبلاغ عن مشكلة" back>
        <EmptyState
          icon={<CheckCircle2 color={c.success} size={48} />}
          title="شكراً، وصلنا بلاغك"
          body="سنراجع الملف ونصلحه. التصحيح يظهر في التطبيق تلقائياً."
          action={<Button title="العودة" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen title="الإبلاغ عن مشكلة" back>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={{ padding: space[4], gap: space[3] }} keyboardShouldPersistTaps="handled">
          <Text weight="medium" numberOfLines={2}>
            {file.data?.title ?? ''}
          </Text>
          {page ? (
            <Text size="sm" muted>
              الصفحة {page}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {QUICK.map((q) => (
              <Button key={q} title={q} variant="secondary" onPress={() => setMessage((m) => (m ? `${m}، ${q}` : q))} style={{ minHeight: 40, paddingHorizontal: space[3] }} />
            ))}
          </View>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={2000}
            placeholder="اكتب ما المشكلة (مثلاً: سؤال 4 صفحة 38 حله خطأ)"
            placeholderTextColor={c.textMuted}
            accessibilityLabel="وصف المشكلة"
            style={[styles.input, { color: c.text, borderColor: c.borderInput, backgroundColor: c.surface }]}
          />
          {error ? (
            <Text size="sm" color={c.danger}>
              {error}
            </Text>
          ) : null}
          <Button title="إرسال" loading={sending} disabled={message.trim().length < 3} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 140, borderWidth: 1, borderRadius: radius.md, padding: space[3], fontSize: 16, fontFamily: 'Cairo_400Regular', textAlignVertical: 'top', textAlign: 'right' },
});
