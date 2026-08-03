import { useState, type ComponentProps } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand, HeroIllustration, PrimaryButton } from '../components/chrome';
import { LegalLinks } from '../components/legal-links';
import { EMAIL_CONFIRMATION_REDIRECT_URL, PASSWORD_RESET_REDIRECT_URL } from '../lib/deep-links';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';

export function AuthScreen() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const submit = async () => {
    if (!hasSupabaseConfig || !supabase) {
      Alert.alert('Connect this build first', 'Add the public Supabase URL and publishable key to apps/mobile/.env, then restart Expo.');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Add your details', 'Enter your email address and password to continue.');
      return;
    }
    if (mode === 'sign-up' && !firstName.trim()) {
      Alert.alert('What should we call you?', 'Add your first name to create an account.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'sign-in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { first_name: firstName.trim() },
            emailRedirectTo: EMAIL_CONFIRMATION_REDIRECT_URL,
          },
        });
        if (error) throw error;
        if (!data.session) {
          Alert.alert('Check your email', 'Confirm your email address, then return here to sign in.');
          setMode('sign-in');
        }
      }
    } catch {
      Alert.alert(
        mode === 'sign-in' ? 'We could not sign you in' : 'We could not create your account',
        'Check your details and try again. If you just created an account, confirm your email first.',
      );
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async () => {
    if (!hasSupabaseConfig || !supabase) {
      Alert.alert('Connect this build first', 'Add the public Supabase URL and publishable key to apps/mobile/.env, then restart Expo.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Add your email address', 'Enter the email address you use for Payslip Insights, then request a reset link.');
      return;
    }

    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: PASSWORD_RESET_REDIRECT_URL,
      });
      if (error) throw error;
      setPasswordResetOpen(false);
      Alert.alert(
        'Check your email',
        'If an account exists for that email address, we’ve sent a secure reset link. Check your inbox and spam folder, then follow the link to continue.',
      );
    } catch {
      Alert.alert('We could not send the reset email', 'Check your connection and try again in a moment.');
    } finally {
      setResettingPassword(false);
    }
  };

  const chooseMode = (nextMode: 'sign-in' | 'sign-up') => {
    setMode(nextMode);
    setPasswordResetOpen(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.top}>
          <Brand />
          <View style={styles.heroCopy}>
            <Text style={styles.title}>{mode === 'sign-in' ? 'Your payday, clear.' : 'Make payday feel simpler.'}</Text>
            <Text style={styles.subtitle}>Check what changed, then make a plan for the money you have until the next pay day.</Text>
          </View>
          <HeroIllustration size={190} />
        </View>

        <View style={styles.form}>
          <View style={styles.switcher}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'sign-in' }} onPress={() => chooseMode('sign-in')} style={[styles.switch, mode === 'sign-in' && styles.switchActive]}>
              <Text style={[styles.switchText, mode === 'sign-in' && styles.switchTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'sign-up' }} onPress={() => chooseMode('sign-up')} style={[styles.switch, mode === 'sign-up' && styles.switchActive]}>
              <Text style={[styles.switchText, mode === 'sign-up' && styles.switchTextActive]}>Create account</Text>
            </Pressable>
          </View>

          {mode === 'sign-up' ? (
            <Field label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
          ) : null}
          <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType={mode === 'sign-up' ? 'newPassword' : 'password'} />

          {mode === 'sign-in' ? (
            <>
              <Pressable
                accessibilityHint="Shows a button to send a password-reset email"
                accessibilityRole="button"
                accessibilityState={{ expanded: passwordResetOpen }}
                onPress={() => setPasswordResetOpen((open) => !open)}
                style={({ pressed }) => [styles.forgotPassword, pressed && styles.forgotPasswordPressed]}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </Pressable>
              {passwordResetOpen ? (
                <View accessibilityLabel="Password reset" style={styles.passwordResetCard}>
                  <Text style={styles.passwordResetTitle}>Reset your password</Text>
                  <Text style={styles.passwordResetCopy}>We’ll send a secure reset link to the email address above if it matches an account.</Text>
                  <PrimaryButton
                    accessibilityHint="Sends a password-reset link to the email address above"
                    disabled={loading || resettingPassword}
                    label={resettingPassword ? 'Sending link…' : 'Send reset link'}
                    onPress={() => void requestPasswordReset()}
                    style={styles.passwordResetButton}
                  />
                </View>
              ) : null}
            </>
          ) : null}

          {mode === 'sign-up' ? (
            <LegalLinks
              intro="Before creating an account, read our"
              supportingCopy="Payslip Insights can flag a change worth checking. It does not provide tax, payroll, legal or financial advice."
            />
          ) : null}
          <PrimaryButton
            disabled={loading || resettingPassword}
            label={loading ? 'One moment…' : mode === 'sign-in' ? 'Sign in' : 'Create my account'}
            onPress={submit}
          />
          {mode === 'sign-in' ? <Text style={styles.privacy}>We only use a payslip when you choose to upload it. Review extracted figures before you rely on them.</Text> : null}
          {!hasSupabaseConfig ? <Text style={styles.configNote}>This development build still needs its public Supabase connection settings.</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...inputProps }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        placeholderTextColor={colors.placeholder}
        style={styles.field}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  scroll: { flexGrow: 1 },
  top: { alignItems: 'center', minHeight: 430, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingTop: 70 },
  heroCopy: { alignSelf: 'stretch', marginTop: spacing.xxl },
  title: { color: colors.navy, fontSize: 39, fontWeight: '800', letterSpacing: -1.8, lineHeight: 42, maxWidth: 310 },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: spacing.md, maxWidth: 325 },
  form: { backgroundColor: colors.white, borderTopColor: colors.lavenderLine, borderTopWidth: 1, gap: spacing.md, padding: spacing.lg },
  switcher: { backgroundColor: colors.lavender, borderRadius: radius.pill, flexDirection: 'row', marginBottom: spacing.xs, padding: 4 },
  switch: { alignItems: 'center', borderRadius: radius.pill, flex: 1, minHeight: 42, justifyContent: 'center' },
  switchActive: { backgroundColor: colors.white, boxShadow: '0px 2px 8px rgba(23, 21, 93, 0.10)' },
  switchText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  switchTextActive: { color: colors.navy },
  fieldWrap: { gap: spacing.xs },
  fieldLabel: { color: colors.navy, fontSize: 14, fontWeight: '700' },
  field: { borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, color: colors.navy, fontSize: 17, minHeight: 54, paddingHorizontal: spacing.md },
  forgotPassword: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: -4, paddingHorizontal: spacing.xs },
  forgotPasswordPressed: { opacity: 0.62 },
  forgotPasswordText: { color: colors.violet, fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  passwordResetCard: { backgroundColor: colors.aquaSoft, borderRadius: radius.medium, gap: spacing.xs, padding: spacing.md },
  passwordResetTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  passwordResetCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  passwordResetButton: { marginTop: spacing.xs, minHeight: 50 },
  privacy: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingHorizontal: spacing.sm, textAlign: 'center' },
  configNote: { color: colors.coral, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
