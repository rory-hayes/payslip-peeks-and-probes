import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const PRIVACY_POLICY_URL = 'https://payslipinsights.com/privacy';
const TERMS_OF_SERVICE_URL = 'https://payslipinsights.com/terms';

export function LegalLinks({
  intro = 'Before you continue, read our',
  supportingCopy,
}: {
  intro?: string;
  supportingCopy?: string;
}) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.copy}>
        {intro}{' '}
        <Text
          accessibilityHint="Opens the Privacy Policy in your browser"
          accessibilityLabel="Open Privacy Policy"
          accessibilityRole="link"
          onPress={() => void openLegalDocument(PRIVACY_POLICY_URL, 'Privacy Policy')}
          style={styles.link}
        >
          Privacy Policy
        </Text>
        {' and '}
        <Text
          accessibilityHint="Opens the Terms of Service in your browser"
          accessibilityLabel="Open Terms of Service"
          accessibilityRole="link"
          onPress={() => void openLegalDocument(TERMS_OF_SERVICE_URL, 'Terms of Service')}
          style={styles.link}
        >
          Terms of Service
        </Text>
        .
      </Text>
      {supportingCopy ? <Text style={styles.supportingCopy}>{supportingCopy}</Text> : null}
    </View>
  );
}

async function openLegalDocument(url: string, label: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(`Could not open ${label}`, 'Please check your connection and try again.');
  }
}

const styles = StyleSheet.create({
  wrapper: { gap: 4 },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  link: { color: colors.violet, fontWeight: '800', textDecorationLine: 'underline' },
  supportingCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
