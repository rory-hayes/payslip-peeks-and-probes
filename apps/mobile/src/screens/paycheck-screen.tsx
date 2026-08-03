import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Brand, HeroIllustration, PrimaryButton, QuietButton } from '../components/chrome';
import { LegalLinks } from '../components/legal-links';
import { beginManualPayslipReview, deleteFailedPayslip, type PickedPayslipFile, retryPayslipProcessing, uploadPayslip } from '../lib/data';
import { colors, radius, spacing } from '../theme';
import type { Payslip } from '../types/models';

type ProcessState = 'idle' | 'selected' | 'processing' | 'waiting' | 'success' | 'failed';
type RecoveryAction = 'manual' | 'removing';

export function PaycheckScreen({
  userId,
  onComplete,
  onRefresh,
  onReview,
  pendingPayslips,
}: {
  userId: string;
  onComplete: () => void | Promise<void>;
  onRefresh: () => Promise<void>;
  onReview: (payslipId: string) => void;
  pendingPayslips: Payslip[];
}) {
  const [state, setState] = useState<ProcessState>('idle');
  const [selected, setSelected] = useState<PickedPayslipFile | null>(null);
  const [failedPayslipId, setFailedPayslipId] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [recoveryAction, setRecoveryAction] = useState<{ payslipId: string; type: RecoveryAction } | null>(null);

  const selectFile = (file: PickedPayslipFile) => {
    setSelected(file);
    setFailedPayslipId(null);
    setFailureCode(null);
    setMessage('');
    setState('selected');
  };

  const chooseDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      selectFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, webFile: asset.file });
    } catch {
      setState('failed');
      setMessage('We could not open your files. Please try again or choose a photo instead.');
    }
  };

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photos permission', 'Allow access to choose a payslip photo, or use the document picker instead.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      selectFile({
        uri: asset.uri,
        name: asset.fileName || `payslip.${asset.mimeType?.split('/')[1] || 'jpg'}`,
        mimeType: asset.mimeType,
        size: asset.fileSize,
      });
    } catch {
      setState('failed');
      setMessage('We could not open your photos. Please try again or choose a PDF instead.');
    }
  };

  const handleResult = async (result: { payslipId: string; status: 'completed' | 'needs_review' | 'processing' | 'failed'; failureCode?: string | null }) => {
    if (result.status === 'completed') {
      setState('success');
      setMessage('Your payslip is ready. Your dashboard has been updated.');
      try {
        await onComplete();
      } catch {
        // Processing has already completed on the server. A missed dashboard
        // refresh must not make a confirmed payslip look like a failed upload.
        setMessage('Your payslip is ready. We could not refresh the dashboard yet, so pull to refresh when you are back on Home.');
      }
      return;
    }
    if (result.status === 'needs_review') {
      onReview(result.payslipId);
      return;
    }
    if (result.status === 'processing') {
      setState('waiting');
      setMessage('We’re waiting for this check to finish. You can return here to refresh its status, or try the saved upload again if it is still waiting.');
      return;
    }
    setState('failed');
    setFailedPayslipId(result.payslipId);
    setFailureCode(result.failureCode ?? null);
    setMessage(failureMessage(result.failureCode));
  };

  const processSelected = async () => {
    if (!selected) return;
    setState('processing');
    setMessage('Reading your payslip…');
    try {
      await handleResult(await uploadPayslip(userId, selected));
    } catch (error) {
      setState('failed');
      setMessage(error instanceof Error ? error.message : 'We couldn’t upload that payslip. Please try again.');
    }
  };

  const retry = async () => {
    if (!failedPayslipId) return;
    setState('processing');
    setMessage('Trying that payslip again…');
    try {
      await handleResult(await retryPayslipProcessing(failedPayslipId));
    } catch {
      setState('failed');
      setMessage('We couldn’t retry that payslip. You can upload a clearer copy instead.');
    }
  };

  const reset = () => {
    setSelected(null);
    setFailedPayslipId(null);
    setFailureCode(null);
    setMessage('');
    setState('idle');
  };

  const refreshPending = async () => {
    setState('waiting');
    setMessage('Refreshing the latest status…');
    try {
      await onRefresh();
      setMessage('');
      setState('idle');
    } catch {
      setMessage('We could not refresh this check just now. Check your connection and try again.');
    }
  };

  const retryPending = async (payslipId: string) => {
    setState('processing');
    setMessage('Trying that payslip again…');
    try {
      await handleResult(await retryPayslipProcessing(payslipId));
    } catch {
      setState('failed');
      setFailedPayslipId(payslipId);
      setMessage('We couldn’t retry that payslip. You can upload a clearer copy instead.');
    }
  };

  const startManualReview = async (payslipId: string) => {
    setRecoveryAction({ payslipId, type: 'manual' });
    let reviewReady = false;
    try {
      await beginManualPayslipReview(payslipId);
      await onRefresh();
      reviewReady = true;
    } catch (error) {
      Alert.alert(
        'We couldn’t open manual review',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setRecoveryAction(null);
    }
    if (reviewReady) onReview(payslipId);
  };

  const removeFailedUpload = async (payslipId: string) => {
    setRecoveryAction({ payslipId, type: 'removing' });
    try {
      await deleteFailedPayslip(userId, payslipId);
      await onRefresh();
      if (failedPayslipId === payslipId) reset();
    } catch (error) {
      Alert.alert(
        'We couldn’t remove this upload',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setRecoveryAction(null);
    }
  };

  const confirmRemoveFailedUpload = (payslipId: string) => {
    Alert.alert(
      'Remove this upload?',
      'This removes the saved file and its unfinished check. It cannot be undone.',
      [
        { text: 'Keep upload', style: 'cancel' },
        { text: 'Remove upload', style: 'destructive', onPress: () => void removeFailedUpload(payslipId) },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AquaCorner />
      <View style={styles.header}><Brand compact /></View>
      <View style={styles.body}>
        {state === 'idle' || state === 'selected' ? (
          <>
            {pendingPayslips.length > 0 ? (
              <View style={styles.pendingSection}>
                <Text style={styles.pendingTitle}>Continue a check</Text>
                <View style={styles.pendingList}>
                  {pendingPayslips.slice(0, 3).map((payslip) => (
                    <PendingCheck
                      key={payslip.id}
                      onReview={() => onReview(payslip.id)}
                      onRetry={() => void retryPending(payslip.id)}
                      onStartManualReview={() => void startManualReview(payslip.id)}
                      onRemove={() => confirmRemoveFailedUpload(payslip.id)}
                      payslip={payslip}
                      recoveryAction={recoveryAction?.payslipId === payslip.id ? recoveryAction.type : null}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            <Text style={styles.title}>Check my payslip</Text>
            <Text style={styles.subtitle}>Upload the pay statement you already have. We’ll point out changes and anything worth checking — never a verdict that it is wrong.</Text>
            <HeroIllustration size={220} />
            {selected ? (
              <View style={styles.fileChoice}>
                <View style={styles.fileIcon}><Ionicons color={colors.violet} name="document-text" size={27} /></View>
                <View style={styles.fileCopy}><Text numberOfLines={1} style={styles.fileName}>{selected.name}</Text><Text style={styles.fileMeta}>Ready to check</Text></View>
                <Pressable accessibilityLabel="Choose another file" onPress={reset}><Ionicons color={colors.muted} name="close-circle-outline" size={25} /></Pressable>
              </View>
            ) : (
              <View style={styles.choices}>
                <Choice icon="document-outline" label="Choose a PDF or image" onPress={chooseDocument} />
                <Choice icon="images-outline" label="Choose a photo" onPress={choosePhoto} />
              </View>
            )}
            <View style={styles.uploadDisclosure}>
              <Text style={styles.privacy}>Supported: PDF, PNG, JPG or WebP up to 10 MB. Your document uploads only when you choose to check it.</Text>
              <LegalLinks
                intro="Before uploading, read our"
                supportingCopy="We use your document to run the check you request. It can flag a change worth checking, not decide whether your pay is correct."
              />
            </View>
            {selected ? <PrimaryButton label="Check this payslip" onPress={processSelected} /> : null}
          </>
        ) : null}

        {state === 'processing' || state === 'waiting' ? (
          <View style={styles.centerState}>
            <View style={styles.processingIcon}>{state === 'processing' ? <ActivityIndicator color={colors.violet} size="large" /> : <Ionicons color={colors.violet} name="time-outline" size={36} />}</View>
            <Text style={styles.stateTitle}>{state === 'processing' ? 'Checking the details' : 'Still checking your payslip'}</Text>
            <Text style={styles.stateBody}>{message}</Text>
            {state === 'processing' ? <Text style={styles.stateFoot}>This usually takes a moment. Keep the app open while we finish.</Text> : null}
            {state === 'waiting' ? <PrimaryButton label="Refresh check" onPress={() => void refreshPending()} style={styles.actionButton} /> : null}
            {state === 'waiting' ? <QuietButton label="Check another payslip" onPress={reset} /> : null}
          </View>
        ) : null}

        {state === 'success' ? (
          <View style={styles.centerState}>
            <View style={[styles.processingIcon, styles.successIcon]}><Ionicons color={colors.green} name="checkmark" size={38} /></View>
            <Text style={styles.stateTitle}>Payslip checked</Text>
            <Text style={styles.stateBody}>{message}</Text>
            <PrimaryButton label="Check another payslip" onPress={reset} style={styles.actionButton} />
          </View>
        ) : null}

        {state === 'failed' ? (
          <View style={styles.centerState}>
            <View style={[styles.processingIcon, styles.failedIcon]}><Ionicons color={colors.coral} name="alert-circle" size={38} /></View>
            <Text style={styles.stateTitle}>That needs another try</Text>
            <Text style={styles.stateBody}>{message}</Text>
            {failedPayslipId ? (
              <PrimaryButton
                disabled={recoveryAction?.payslipId === failedPayslipId}
                label={recoveryAction?.payslipId === failedPayslipId && recoveryAction.type === 'removing' ? 'Removing upload…' : recoveryAction?.payslipId === failedPayslipId ? 'Opening review…' : 'Enter figures myself'}
                onPress={() => void startManualReview(failedPayslipId)}
                style={styles.actionButton}
              />
            ) : null}
            {failedPayslipId && canRetryFailure(failureCode) && recoveryAction?.payslipId !== failedPayslipId ? <QuietButton label="Retry processing" onPress={retry} /> : null}
            {recoveryAction?.payslipId !== failedPayslipId ? <QuietButton label="Upload a different copy" onPress={reset} /> : null}
            {failedPayslipId && recoveryAction?.payslipId !== failedPayslipId ? <QuietButton danger label="Remove this upload" onPress={() => confirmRemoveFailedUpload(failedPayslipId)} /> : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function PendingCheck({
  payslip,
  onReview,
  onRetry,
  onStartManualReview,
  onRemove,
  recoveryAction,
}: {
  payslip: Payslip;
  onReview: () => void;
  onRetry: () => void;
  onStartManualReview: () => void;
  onRemove: () => void;
  recoveryAction: RecoveryAction | null;
}) {
  if (payslip.status === 'failed') {
    return (
      <FailedPendingCheck
        onRemove={onRemove}
        onRetry={onRetry}
        onStartManualReview={onStartManualReview}
        payslip={payslip}
        recoveryAction={recoveryAction}
      />
    );
  }

  // A processing row may be a live request or an upload whose original
  // request never reached the processor. Retrying is safe: the server either
  // starts an unclaimed row or returns the current processing status.
  const action = payslip.status === 'needs_review' ? onReview : onRetry;
  const details = pendingDetails(payslip);
  return (
    <Pressable accessibilityRole="button" onPress={action} style={({ pressed }) => [styles.pendingCheck, pressed && styles.pendingCheckPressed]}>
      <View style={[styles.pendingIcon, { backgroundColor: details.surface }]}><Ionicons color={details.color} name={details.icon} size={22} /></View>
      <View style={styles.pendingCopy}>
        <Text style={styles.pendingCheckTitle}>{details.title}</Text>
        <Text numberOfLines={2} style={styles.pendingCheckBody}>{details.body}</Text>
      </View>
      <Ionicons color={details.color} name="chevron-forward" size={20} />
    </Pressable>
  );
}

function FailedPendingCheck({
  payslip,
  onRetry,
  onStartManualReview,
  onRemove,
  recoveryAction,
}: {
  payslip: Payslip;
  onRetry: () => void;
  onStartManualReview: () => void;
  onRemove: () => void;
  recoveryAction: RecoveryAction | null;
}) {
  const details = pendingDetails(payslip);
  const busy = recoveryAction !== null;
  return (
    <View style={[styles.pendingCheck, styles.pendingCheckFailed]}>
      <View style={styles.pendingCheckTopRow}>
        <View style={[styles.pendingIcon, { backgroundColor: details.surface }]}><Ionicons color={details.color} name={details.icon} size={22} /></View>
        <View style={styles.pendingCopy}>
          <Text style={styles.pendingCheckTitle}>{details.title}</Text>
          <Text style={styles.pendingCheckBody}>{details.body}</Text>
        </View>
      </View>
      <View style={styles.recoveryActions}>
        {canRetryFailure(payslip.processing_failure_code) ? (
          <RecoveryButton disabled={busy} label="Try again" onPress={onRetry} tone="quiet" />
        ) : null}
        <RecoveryButton disabled={busy} label={recoveryAction === 'manual' ? 'Opening review…' : 'Enter figures'} onPress={onStartManualReview} tone="primary" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={onRemove}
        style={({ pressed }) => [styles.removeUploadButton, busy && styles.recoveryDisabled, pressed && !busy && styles.removeUploadButtonPressed]}
      >
        <Text style={styles.removeUploadText}>{recoveryAction === 'removing' ? 'Removing upload…' : 'Remove this upload'}</Text>
      </Pressable>
    </View>
  );
}

function RecoveryButton({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone: 'primary' | 'quiet';
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.recoveryButton, tone === 'primary' ? styles.recoveryButtonPrimary : styles.recoveryButtonQuiet, disabled && styles.recoveryDisabled, pressed && !disabled && styles.recoveryButtonPressed]}
    >
      <Text style={[styles.recoveryButtonText, tone === 'primary' ? styles.recoveryButtonTextPrimary : styles.recoveryButtonTextQuiet]}>{label}</Text>
    </Pressable>
  );
}

function pendingDetails(payslip: Payslip) {
  if (payslip.status === 'needs_review') {
    return { title: 'Your review is ready', body: 'Check the extracted figures before they join your pay history.', icon: 'create-outline' as const, color: colors.violet, surface: colors.lavender };
  }
  if (payslip.status === 'failed') {
    return {
      title: payslip.processing_failure_code === 'monthly_upload_limit' ? 'Checks used for this month' : 'That check needs another try',
      body: payslip.processing_failure_code === 'monthly_upload_limit'
        ? 'This file is saved. You can add the figures you see yourself, or remove the upload.'
        : 'Your file is still saved. Retry it, add the figures yourself, or remove the upload.',
      icon: 'alert-circle-outline' as const,
      color: colors.coral,
      surface: colors.coralSoft,
    };
  }
  return { title: 'Still checking your payslip', body: 'Open it to check the latest status or safely try the saved upload again.', icon: 'time-outline' as const, color: '#0989A5', surface: colors.aquaSoft };
}

function canRetryFailure(code: string | null | undefined): boolean {
  return code !== 'monthly_upload_limit' && code !== 'processing_attempt_limit';
}

function failureMessage(code: string | null | undefined): string {
  if (code === 'monthly_upload_limit') return 'You’ve used the checks included in your current plan this month. You can add the figures you see yourself, or keep this file for later.';
  if (code === 'processing_stalled_after_dispatch') return 'That automatic check took longer than expected. You can add the figures you see, remove this upload, or choose to try the automatic check again.';
  if (code === 'rate_limited') return 'We need to pause new checks for a little while. Your file is still saved, so try again later.';
  if (code === 'processing_attempt_limit') return 'We could not read that file after several tries. You can add the figures you see, upload a clearer copy, or remove this upload.';
  return 'We couldn’t complete this check. You can retry it, add the figures you see yourself, or remove the upload.';
}

function Choice({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}>
      <View style={styles.choiceIcon}><Ionicons color={colors.violet} name={icon} size={25} /></View>
      <Text style={styles.choiceText}>{label}</Text>
      <Ionicons color={colors.violet} name="chevron-forward" size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, flexGrow: 1, position: 'relative' },
  header: { paddingHorizontal: spacing.lg, paddingTop: 64 },
  body: { flex: 1, padding: spacing.lg, paddingTop: 42 },
  title: { color: colors.navy, fontSize: 39, fontWeight: '900', letterSpacing: -1.8, lineHeight: 42 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.md },
  choices: { gap: spacing.sm, marginTop: spacing.sm },
  pendingSection: { gap: spacing.sm, marginBottom: spacing.xl },
  pendingTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  pendingList: { gap: spacing.xs },
  pendingCheck: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 76, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  pendingCheckFailed: { alignItems: 'stretch', flexDirection: 'column', gap: spacing.sm, padding: spacing.sm },
  pendingCheckTopRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  pendingCheckPressed: { backgroundColor: colors.lavender },
  pendingIcon: { alignItems: 'center', borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  pendingCopy: { flex: 1 },
  pendingCheckTitle: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  pendingCheckBody: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  recoveryActions: { flexDirection: 'row', gap: spacing.xs },
  recoveryButton: { alignItems: 'center', borderRadius: radius.small, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.xs },
  recoveryButtonPrimary: { backgroundColor: colors.orange },
  recoveryButtonQuiet: { backgroundColor: colors.lavender },
  recoveryButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  recoveryButtonText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  recoveryButtonTextPrimary: { color: colors.white },
  recoveryButtonTextQuiet: { color: colors.violet },
  recoveryDisabled: { opacity: 0.58 },
  removeUploadButton: { alignSelf: 'flex-start', minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.xs },
  removeUploadButtonPressed: { opacity: 0.62 },
  removeUploadText: { color: colors.coral, fontSize: 13, fontWeight: '800' },
  choice: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, paddingHorizontal: spacing.md },
  choicePressed: { backgroundColor: colors.lavender },
  choiceIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  choiceText: { color: colors.navy, flex: 1, fontSize: 16, fontWeight: '800' },
  fileChoice: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: radius.medium, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, padding: spacing.md },
  fileIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 999, height: 48, justifyContent: 'center', width: 48 },
  fileCopy: { flex: 1 },
  fileName: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  fileMeta: { color: colors.violet, fontSize: 13, fontWeight: '700', marginTop: 3 },
  uploadDisclosure: { gap: spacing.xs, marginTop: spacing.md },
  privacy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  centerState: { alignItems: 'center', justifyContent: 'center', minHeight: 540, paddingHorizontal: spacing.lg },
  processingIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 82, justifyContent: 'center', width: 82 },
  successIcon: { backgroundColor: colors.greenSoft },
  failedIcon: { backgroundColor: colors.coralSoft },
  stateTitle: { color: colors.navy, fontSize: 27, fontWeight: '900', letterSpacing: -1, marginTop: spacing.lg, textAlign: 'center' },
  stateBody: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm, textAlign: 'center' },
  stateFoot: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md, textAlign: 'center' },
  actionButton: { alignSelf: 'stretch', marginTop: spacing.xl },
});
