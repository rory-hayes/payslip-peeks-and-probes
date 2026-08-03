import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AquaCorner, Brand, Notice, PrimaryButton, QuietButton } from '../components/chrome';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

export function PasswordResetScreen({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void | Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!supabase) return;
    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Those passwords do not match yet.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      Alert.alert('Password updated', 'Your new password is ready to use.');
      onComplete();
    } catch {
      setError('We could not update your password. Request a fresh reset link and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AquaCorner />
          <View style={styles.header}><Brand /></View>
          <View style={styles.content}>
            <Text style={styles.title}>Set a new password.</Text>
            <Text style={styles.subtitle}>Use a password you do not use elsewhere. You’ll stay signed in when you finish.</Text>
            <View style={styles.card}>
              <Field label="New password" value={password} onChangeText={setPassword} />
              <Field label="Confirm new password" value={confirmation} onChangeText={setConfirmation} />
            </View>
            {error ? <Notice tone="coral"><Text style={styles.error}>{error}</Text></Notice> : null}
            <PrimaryButton disabled={saving} label={saving ? 'Updating…' : 'Save new password'} onPress={() => void save()} />
            <QuietButton disabled={saving} label="Cancel and sign out" onPress={() => void onCancel()} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        secureTextEntry
        style={styles.field}
        textContentType="newPassword"
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xxl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  content: { gap: spacing.lg, marginTop: 118, paddingHorizontal: spacing.lg },
  title: { color: colors.navy, fontSize: 38, fontWeight: '900', letterSpacing: -1.8, lineHeight: 42, maxWidth: 330 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: -spacing.sm, maxWidth: 350 },
  card: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  field: { borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, color: colors.navy, fontSize: 17, minHeight: 54, paddingHorizontal: spacing.md },
  error: { color: colors.navy, fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
