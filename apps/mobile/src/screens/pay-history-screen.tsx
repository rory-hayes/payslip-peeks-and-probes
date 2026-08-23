import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Notice, SectionHeading } from '../components/chrome';
import { confirmedPayslipAmount, currencyForPayslip } from '../lib/pay-history';
import { formatDate, formatShortMoney } from '../lib/format';
import { colors, radius, spacing } from '../theme';
import type { ConfirmedPayslip, CurrencyCode } from '../types/models';

export function PayHistoryScreen({
  currency,
  payslips,
  onClose,
  onOpenPayslip,
}: {
  currency: CurrencyCode;
  payslips: ConfirmedPayslip[];
  onClose: () => void;
  onOpenPayslip: (payslipId: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <AquaCorner />
      <View style={styles.header}>
        <Pressable
          accessibilityHint="Returns to your payday overview"
          accessibilityLabel="Back to home"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons color={colors.violet} name="chevron-back" size={22} />
          <Text style={styles.backText}>Home</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Pay history</Text>
        <Text style={styles.intro}>Open a confirmed payslip to see the figures you checked and a simple comparison with the previous payslip from the same country.</Text>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Confirmed payslips" />
        <View style={styles.historyCard}>
          {payslips.map((payslip, index) => (
            <HistoryRow
              currency={currencyForPayslip(payslip.country, currency)}
              isLast={index === payslips.length - 1}
              key={payslip.id}
              onPress={() => onOpenPayslip(payslip.id)}
              payslip={payslip}
            />
          ))}
        </View>
      </View>

      <View style={styles.note}>
        <Notice tone="aqua">
          <View style={styles.noteRow}>
            <Ionicons color="#0989A5" name="shield-checkmark-outline" size={25} />
            <Text style={styles.noteText}>This is read-only history. A payslip only appears here after you have reviewed and confirmed its figures.</Text>
          </View>
        </Notice>
      </View>
      <Text style={styles.disclaimer}>Payslip Insights highlights historical figures and changes to help you check your pay. It does not give tax or financial advice.</Text>
    </ScrollView>
  );
}

function HistoryRow({
  currency,
  isLast,
  onPress,
  payslip,
}: {
  currency: CurrencyCode;
  isLast: boolean;
  onPress: () => void;
  payslip: ConfirmedPayslip;
}) {
  const netPay = confirmedPayslipAmount(payslip, 'net_pay');
  const country = payslip.country === 'Ireland' ? 'Ireland' : payslip.country === 'UK' ? 'UK' : 'Country not set';

  return (
    <Pressable
      accessibilityHint={`Opens the confirmed payslip from ${formatDate(payslip.pay_date)}`}
      accessibilityLabel={`Confirmed payslip, ${formatDate(payslip.pay_date)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.historyRow, !isLast && styles.historyRowBorder, pressed && styles.historyRowPressed]}
    >
      <View style={styles.historyIcon}><Ionicons color={colors.green} name="checkmark" size={18} /></View>
      <View style={styles.historyCopy}>
        <Text style={styles.historyDate}>{formatDate(payslip.pay_date)}</Text>
        <Text style={styles.historyStatus}>{country} · Confirmed</Text>
      </View>
      <View style={styles.historyValue}>
        {netPay === null ? <Text style={styles.historyUnavailable}>Figures unavailable</Text> : <Text style={styles.historyAmount}>{formatShortMoney(netPay, currency)}</Text>}
        <Ionicons color={colors.muted} name="chevron-forward" size={20} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, minHeight: '100%', paddingBottom: 36, position: 'relative' },
  header: { paddingHorizontal: spacing.lg, paddingTop: 30 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: 44, paddingRight: spacing.sm },
  backButtonPressed: { opacity: 0.62 },
  backText: { color: colors.violet, fontSize: 15, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 37, fontWeight: '900', letterSpacing: -1.7, marginTop: spacing.md },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm, maxWidth: 430 },
  section: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  historyCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, overflow: 'hidden', paddingHorizontal: spacing.md },
  historyRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 76 },
  historyRowBorder: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth },
  historyRowPressed: { backgroundColor: colors.lavender },
  historyIcon: { alignItems: 'center', backgroundColor: colors.greenSoft, borderRadius: 999, height: 38, justifyContent: 'center', width: 38 },
  historyCopy: { flex: 1 },
  historyDate: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  historyStatus: { color: colors.muted, fontSize: 13, marginTop: 3 },
  historyValue: { alignItems: 'center', flexDirection: 'row', gap: spacing.xxs },
  historyAmount: { color: colors.navy, fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  historyUnavailable: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  note: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  noteRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  noteText: { color: colors.muted, flex: 1, fontSize: 14, lineHeight: 20 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginHorizontal: spacing.lg, marginTop: spacing.xl, textAlign: 'center' },
});
