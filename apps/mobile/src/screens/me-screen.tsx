import type { User } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AquaCorner, Brand, PrimaryButton, QuietButton, SectionHeading } from '../components/chrome';
import { AccountDeletionBlockedError, AccountDeletionPendingError, deleteCurrentAccount, type AccountDeletionResult } from '../lib/delete-account';
import { saveProfileSetup } from '../lib/data';
import { supabase } from '../lib/supabase';
import { colors, radius, spacing } from '../theme';
import type { Profile } from '../types/models';

type AccountUser = Pick<User, 'id' | 'email' | 'created_at'>;

export function MeScreen({
  user,
  profile,
  onSignOut,
  onAccountDeleted,
  onProfileChanged,
}: {
  user: AccountUser;
  profile: Profile | null;
  onSignOut: () => Promise<void>;
  onAccountDeleted: (result: AccountDeletionResult) => Promise<void>;
  onProfileChanged: () => Promise<void>;
}) {
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [payCountry, setPayCountry] = useState<'UK' | 'Ireland'>(profile?.country === 'Ireland' ? 'Ireland' : 'UK');
  const [payFrequency, setPayFrequency] = useState<NonNullable<Profile['pay_frequency']>>(profile?.pay_frequency ?? 'monthly');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      Alert.alert('We could not sign you out', 'Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteConfirmation('');
    setDeletionError(null);
  };

  const openProfile = () => {
    setPayCountry(profile?.country === 'Ireland' ? 'Ireland' : 'UK');
    setPayFrequency(profile?.pay_frequency ?? 'monthly');
    setProfileError(null);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    if (savingProfile) return;
    setProfileOpen(false);
    setProfileError(null);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await saveProfileSetup(user.id, { country: payCountry, payFrequency });
      await onProfileChanged();
      setProfileOpen(false);
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'We could not save your pay settings. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== 'DELETE' || deleting) return;

    setDeleting(true);
    setDeletionError(null);
    try {
      const deletion = await deleteCurrentAccount();

      // The server has already confirmed deletion at this point. This callback
      // clears the local session, then lets the authenticated app shell show
      // any safe billing follow-up after leaving this sensitive screen.
      try {
        await onAccountDeleted(deletion);
      } catch {
        await supabase?.auth.signOut({ scope: 'local' });
      }
    } catch (cause) {
      setDeleting(false);
      setDeletionError(
        cause instanceof AccountDeletionPendingError || cause instanceof AccountDeletionBlockedError
          ? cause.message
          : 'We could not confirm that deletion completed. Please try again or contact support.',
      );
    }
  };

  const name = profile?.first_name?.trim() || null;
  const accountLabel = name ? `${name}'s account` : 'My account';

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AquaCorner />
        <View style={styles.header}>
          <Brand compact />
          <View style={styles.avatar} accessibilityLabel={name ? `${name}'s account` : 'Account'}>
            <Text style={styles.avatarText}>{initialFor(name, user.email)}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{accountLabel}</Text>
          <Text style={styles.subtitle}>Your settings and the data connected to this account.</Text>

          <View style={styles.section}>
            <SectionHeading action={<QuietButton label="Edit" onPress={openProfile} />} title="Profile" />
            <View style={styles.card}>
              <AccountRow icon="mail-outline" label="Email" value={user.email || 'Not available'} />
              <Divider />
              <AccountRow icon="location-outline" label="Pay country" value={profile?.country || 'Not set'} />
              <Divider />
              <AccountRow icon="repeat-outline" label="Pay frequency" value={formatFrequency(profile?.pay_frequency)} />
              <Divider />
              <AccountRow icon="cash-outline" label="Currency" value={profile?.currency || 'Not set'} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading title="Your payslip data" />
            <View style={styles.privacyCard}>
              <View style={styles.privacyIcon}><Ionicons color="#0989A5" name="shield-checkmark-outline" size={24} /></View>
              <View style={styles.privacyCopy}>
                <Text style={styles.privacyTitle}>Check before you confirm</Text>
                <Text style={styles.privacyText}>
                  When you ask us to check a payslip, it is sent through the app’s configured extraction processor to read it. Compare every extracted figure with your document before confirming it.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeading title="Session" />
            <View style={styles.card}>
              <View style={styles.sessionRow}>
                <View style={styles.sessionIcon}><Ionicons color={colors.green} name="checkmark-circle" size={21} /></View>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionTitle}>Signed in</Text>
                  <Text style={styles.sessionText}>{memberSince(user.created_at)}</Text>
                </View>
              </View>
              <View style={styles.sessionAction}>
                {signingOut ? <ActivityIndicator color={colors.violet} /> : <QuietButton label="Sign out" onPress={handleSignOut} />}
              </View>
            </View>
          </View>

          <View style={styles.dangerSection}>
            <Text style={styles.dangerTitle}>Delete account</Text>
            <Text style={styles.dangerText}>Permanently remove this account and the data connected to it.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens a confirmation step before account deletion"
              onPress={() => setDeleteOpen(true)}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
            >
              <Ionicons color={colors.coral} name="trash-outline" size={19} />
              <Text style={styles.deleteButtonText}>Delete my account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal animationType="slide" transparent visible={deleteOpen} onRequestClose={closeDelete}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalIcon}><Ionicons color={colors.coral} name="warning-outline" size={31} /></View>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalText}>
              This sends a deletion request to the server. It removes your app data and cancels any verified active subscription. It cannot be undone.
            </Text>
            <Text style={styles.confirmLabel}>Type DELETE to continue</Text>
            <TextInput
              accessibilityLabel="Type DELETE to confirm account deletion"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE"
              placeholderTextColor={colors.placeholder}
              style={styles.confirmInput}
              value={deleteConfirmation}
            />
            {deletionError ? <Text accessibilityRole="alert" style={styles.errorText}>{deletionError}</Text> : null}
            <PrimaryButton
              disabled={deleteConfirmation !== 'DELETE' || deleting}
              label={deleting ? 'Deleting account…' : 'Permanently delete account'}
              onPress={handleDelete}
              style={styles.deletePrimary}
            />
            {!deleting ? <Pressable accessibilityRole="button" onPress={closeDelete} style={styles.cancelButton}><Text style={styles.cancelText}>Keep my account</Text></Pressable> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" transparent visible={profileOpen} onRequestClose={closeProfile}>
        <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.profileModalIcon}><Ionicons color={colors.violet} name="options-outline" size={30} /></View>
            <Text style={styles.modalTitle}>Pay settings</Text>
            <Text style={styles.modalText}>Choose the country and pay rhythm used for your payslip history and tax-year guide.</Text>

            <Text style={styles.confirmLabel}>Where are you paid?</Text>
            <View style={styles.settingChoices}>
              <SettingChoice label="UK · GBP (£)" selected={payCountry === 'UK'} onPress={() => setPayCountry('UK')} />
              <SettingChoice label="Ireland · EUR (€)" selected={payCountry === 'Ireland'} onPress={() => setPayCountry('Ireland')} />
            </View>

            <Text style={styles.confirmLabel}>How often are you paid?</Text>
            <View style={styles.settingChoices}>
              <SettingChoice label="Weekly" selected={payFrequency === 'weekly'} onPress={() => setPayFrequency('weekly')} />
              <SettingChoice label="Every two weeks" selected={payFrequency === 'fortnightly'} onPress={() => setPayFrequency('fortnightly')} />
              <SettingChoice label="Monthly" selected={payFrequency === 'monthly'} onPress={() => setPayFrequency('monthly')} />
              <SettingChoice label="Other" selected={payFrequency === 'other'} onPress={() => setPayFrequency('other')} />
            </View>

            {profileError ? <Text accessibilityRole="alert" style={styles.errorText}>{profileError}</Text> : null}
            <PrimaryButton disabled={savingProfile} label={savingProfile ? 'Saving settings…' : 'Save pay settings'} onPress={() => void saveProfile()} style={styles.deletePrimary} />
            {!savingProfile ? <Pressable accessibilityRole="button" onPress={closeProfile} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function initialFor(name: string | null, email: string | undefined): string {
  const candidate = name || email || '?';
  return candidate.slice(0, 1).toUpperCase();
}

function formatFrequency(value: Profile['pay_frequency'] | undefined): string {
  if (!value) return 'Not set';
  if (value === 'fortnightly') return 'Every two weeks';
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function memberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Current session';
  return `Member since ${new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(date)}`;
}

function AccountRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.accountRow}>
      <View style={styles.accountIcon}><Ionicons color={colors.violet} name={icon} size={19} /></View>
      <View style={styles.accountCopy}>
        <Text style={styles.accountLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.accountValue}>{value}</Text>
      </View>
    </View>
  );
}

function SettingChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.settingChoice, selected && styles.settingChoiceSelected, pressed && styles.settingChoicePressed]}>
      <Text style={[styles.settingChoiceText, selected && styles.settingChoiceTextSelected]}>{label}</Text>
      {selected ? <Ionicons color={colors.violet} name="checkmark-circle" size={21} /> : null}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, paddingBottom: 48, position: 'relative' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 64 },
  avatar: { alignItems: 'center', backgroundColor: colors.lavender, borderColor: colors.white, borderRadius: 999, borderWidth: 3, boxShadow: '0px 5px 10px rgba(23, 21, 93, 0.12)', height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: colors.violet, fontSize: 18, fontWeight: '800' },
  body: { paddingHorizontal: spacing.lg, paddingTop: 42 },
  title: { color: colors.navy, fontSize: 39, fontWeight: '900', letterSpacing: -1.8, lineHeight: 43 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm, maxWidth: 320 },
  section: { marginTop: spacing.xl },
  card: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 16px rgba(23, 21, 93, 0.06)', overflow: 'hidden', paddingHorizontal: spacing.md },
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 69 },
  accountIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 37, justifyContent: 'center', width: 37 },
  accountCopy: { flex: 1 },
  accountLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  accountValue: { color: colors.navy, fontSize: 16, fontWeight: '800', marginTop: 2 },
  divider: { backgroundColor: colors.lavenderLine, height: 1, marginLeft: 49 },
  privacyCard: { alignItems: 'flex-start', backgroundColor: colors.aquaSoft, borderRadius: radius.large, flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  privacyIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  privacyText: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  sessionRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  sessionIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  sessionCopy: { flex: 1 },
  sessionTitle: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  sessionText: { color: colors.muted, fontSize: 13, marginTop: 2 },
  sessionAction: { alignItems: 'flex-start', borderTopColor: colors.lavenderLine, borderTopWidth: 1, marginTop: spacing.md, paddingBottom: spacing.xs, paddingTop: spacing.xs },
  dangerSection: { backgroundColor: colors.coralSoft, borderRadius: radius.large, marginTop: spacing.xl, padding: spacing.lg },
  dangerTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  dangerText: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4, maxWidth: 280 },
  deleteButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.white, borderColor: '#F1C2B9', borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, minHeight: 45, paddingHorizontal: spacing.md },
  deleteButtonPressed: { backgroundColor: '#FFE5DF' },
  deleteButtonText: { color: colors.coral, fontSize: 14, fontWeight: '800' },
  modalOverlay: { backgroundColor: 'rgba(23, 21, 93, 0.42)', flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.large, borderTopRightRadius: radius.large, padding: spacing.lg, paddingBottom: 36 },
  modalHandle: { alignSelf: 'center', backgroundColor: colors.lavenderLine, borderRadius: 999, height: 5, marginBottom: spacing.lg, width: 44 },
  modalIcon: { alignItems: 'center', backgroundColor: colors.coralSoft, borderRadius: 999, height: 58, justifyContent: 'center', width: 58 },
  profileModalIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 58, justifyContent: 'center', width: 58 },
  modalTitle: { color: colors.navy, fontSize: 28, fontWeight: '900', letterSpacing: -1, marginTop: spacing.md },
  modalText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
  confirmLabel: { color: colors.navy, fontSize: 14, fontWeight: '800', marginTop: spacing.lg },
  settingChoices: { gap: spacing.xs, marginTop: spacing.sm },
  settingChoice: { alignItems: 'center', borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 47, paddingHorizontal: spacing.md },
  settingChoiceSelected: { backgroundColor: colors.lavender, borderColor: colors.violet },
  settingChoicePressed: { opacity: 0.72 },
  settingChoiceText: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  settingChoiceTextSelected: { color: colors.violet },
  confirmInput: { borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, color: colors.navy, fontSize: 17, fontWeight: '700', marginTop: spacing.xs, minHeight: 52, paddingHorizontal: spacing.md },
  errorText: { color: colors.coral, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  deletePrimary: { marginTop: spacing.md },
  cancelButton: { alignItems: 'center', minHeight: 50, justifyContent: 'center', marginTop: spacing.xs },
  cancelText: { color: colors.violet, fontSize: 16, fontWeight: '800' },
});
