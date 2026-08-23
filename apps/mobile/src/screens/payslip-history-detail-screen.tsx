import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Notice, SectionHeading } from '../components/chrome';
import { formatDate, formatMoney, formatShortMoney } from '../lib/format';
import { buildPayHistoryComparison, currencyForPayslip, type PayHistoryMetric } from '../lib/pay-history';
import { colors, radius, spacing } from '../theme';
import type { ConfirmedPayslip, CurrencyCode } from '../types/models';

export function PayslipHistoryDetailScreen({
  currency,
  payslip,
  payslips,
  onClose,
}: {
  currency: CurrencyCode;
  payslip: ConfirmedPayslip;
  payslips: ConfirmedPayslip[];
  onClose: () => void;
}) {
  const payslipCurrency = currencyForPayslip(payslip.country, currency);
  const comparison = buildPayHistoryComparison(payslip, payslips);
  const netPay = comparison.metrics.find((metric) => metric.id === 'net_pay')?.current ?? null;
  const confirmedFigures = comparison.metrics.filter((metric) => metric.current !== null);
  const country = payslip.country === 'Ireland' ? 'Ireland' : payslip.country === 'UK' ? 'UK' : 'this country';

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <AquaCorner />
      <View style={styles.header}>
        <Pressable
          accessibilityHint="Returns to your confirmed payslip history"
          accessibilityLabel="Back to pay history"
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons color={colors.violet} name="chevron-back" size={22} />
          <Text style={styles.backText}>History</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>Payslip detail</Text>
        <Text style={styles.date}>{formatDate(payslip.pay_date)} · {country}</Text>
      </View>

      <View style={styles.payCard}>
        <Text style={styles.payLabel}>Confirmed net pay</Text>
        <Text style={styles.payAmount}>{netPay === null ? 'Not available' : formatMoney(netPay, payslipCurrency)}</Text>
        <Text style={styles.payHelper}>This is the figure you confirmed during review.</Text>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Previous confirmed payslip" />
        {comparison.previousPayslip ? (
          <ComparisonCard
            currency={payslipCurrency}
            metrics={comparison.metrics}
            previousDate={comparison.previousPayslip.pay_date}
          />
        ) : (
          <Notice tone="aqua">
            <View style={styles.emptyComparisonRow}>
              <Ionicons color="#0989A5" name="time-outline" size={25} />
              <View style={styles.emptyComparisonCopy}>
                <Text style={styles.emptyComparisonTitle}>No earlier confirmed {country} payslip yet</Text>
                <Text style={styles.emptyComparisonBody}>When you confirm another payslip from the same country, this view will show the factual changes side by side.</Text>
              </View>
            </View>
          </Notice>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading title="Confirmed figures" />
        {confirmedFigures.length ? (
          <View style={styles.figuresCard}>
            {confirmedFigures.map((metric, index) => (
              <FigureRow currency={payslipCurrency} isLast={index === confirmedFigures.length - 1} key={metric.id} metric={metric} />
            ))}
          </View>
        ) : (
          <Notice tone="coral">
            <Text style={styles.unavailableTitle}>Figures unavailable in this view</Text>
            <Text style={styles.unavailableBody}>Pull to refresh your payday view, then try again. Nothing has been changed.</Text>
          </Notice>
        )}
      </View>

      <Text style={styles.disclaimer}>This history is read-only. Payslip Insights helps you spot figures and changes worth checking; it does not give tax or financial advice.</Text>
    </ScrollView>
  );
}

function ComparisonCard({
  currency,
  metrics,
  previousDate,
}: {
  currency: CurrencyCode;
  metrics: PayHistoryMetric[];
  previousDate: string | null;
}) {
  const comparable = metrics.filter((metric) => metric.current !== null && metric.previous !== null);
  const headline = metrics.find((metric) => metric.id === 'net_pay');
  const netDifference = headline?.difference ?? null;

  return (
    <View style={styles.comparisonCard}>
      <View style={styles.comparisonHeader}>
        <View style={styles.comparisonIcon}><Ionicons color={colors.violet} name="swap-vertical-outline" size={22} /></View>
        <View style={styles.comparisonCopy}>
          <Text style={styles.comparisonTitle}>Compared with {formatDate(previousDate)}</Text>
          <Text style={styles.comparisonSubtitle}>Both payslips were confirmed before they entered your history.</Text>
        </View>
      </View>
      {netDifference !== null ? <DifferenceHeadline currency={currency} difference={netDifference} /> : null}
      {comparable.length ? (
        <View style={styles.comparisonRows}>
          {comparable.slice(0, 3).map((metric, index) => (
            <ComparisonRow currency={currency} isLast={index === Math.min(comparable.length, 3) - 1} key={metric.id} metric={metric} />
          ))}
        </View>
      ) : <Text style={styles.noFigureComparison}>The confirmed figures are not available for a side-by-side comparison yet.</Text>}
    </View>
  );
}

function DifferenceHeadline({ currency, difference }: { currency: CurrencyCode; difference: number }) {
  const direction = difference > 0 ? 'more' : difference < 0 ? 'less' : 'the same';
  const icon = difference > 0 ? 'arrow-up' : difference < 0 ? 'arrow-down' : 'remove';
  const tone = difference > 0 ? colors.green : difference < 0 ? colors.coral : colors.violet;
  const surface = difference > 0 ? colors.greenSoft : difference < 0 ? colors.coralSoft : colors.lavender;
  return (
    <View style={[styles.differenceHeadline, { backgroundColor: surface }]}>
      <Ionicons color={tone} name={icon} size={18} />
      <Text style={styles.differenceHeadlineText}>
        <Text style={{ color: tone, fontWeight: '900' }}>{difference === 0 ? 'Your net pay was unchanged' : `${formatShortMoney(Math.abs(difference), currency)} ${direction} in net pay`}</Text>
      </Text>
    </View>
  );
}

function ComparisonRow({ currency, isLast, metric }: { currency: CurrencyCode; isLast: boolean; metric: PayHistoryMetric }) {
  const difference = metric.difference ?? 0;
  const change = difference === 0 ? 'No change' : `${difference > 0 ? '+' : '−'}${formatShortMoney(Math.abs(difference), currency)}`;
  return (
    <View style={[styles.comparisonRow, !isLast && styles.comparisonRowBorder]}>
      <Text style={styles.comparisonLabel}>{metric.label}</Text>
      <View style={styles.comparisonAmounts}>
        <Text style={styles.comparisonCurrent}>{formatShortMoney(metric.current, currency)}</Text>
        <Text style={[styles.comparisonDifference, difference > 0 ? styles.comparisonDifferenceUp : difference < 0 ? styles.comparisonDifferenceDown : null]}>{change}</Text>
      </View>
    </View>
  );
}

function FigureRow({ currency, isLast, metric }: { currency: CurrencyCode; isLast: boolean; metric: PayHistoryMetric }) {
  return (
    <View style={[styles.figureRow, !isLast && styles.figureRowBorder]}>
      <Text style={styles.figureLabel}>{metric.label}</Text>
      <Text style={styles.figureValue}>{formatMoney(metric.current, currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, minHeight: '100%', paddingBottom: 36, position: 'relative' },
  header: { paddingHorizontal: spacing.lg, paddingTop: 30 },
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', minHeight: 44, paddingRight: spacing.sm },
  backButtonPressed: { opacity: 0.62 },
  backText: { color: colors.violet, fontSize: 15, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 37, fontWeight: '900', letterSpacing: -1.7, marginTop: spacing.md },
  date: { color: colors.muted, fontSize: 16, marginTop: spacing.xs },
  payCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, boxShadow: '0px 8px 18px rgba(23, 21, 93, 0.08)', marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg },
  payLabel: { color: colors.muted, fontSize: 16, fontWeight: '700' },
  payAmount: { color: colors.navy, fontSize: 38, fontWeight: '900', letterSpacing: -1.8, marginTop: 5 },
  payHelper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  section: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  comparisonCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, overflow: 'hidden', padding: spacing.md },
  comparisonHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  comparisonIcon: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: 999, height: 42, justifyContent: 'center', width: 42 },
  comparisonCopy: { flex: 1 },
  comparisonTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  comparisonSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  differenceHeadline: { alignItems: 'center', borderRadius: radius.medium, flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md, padding: spacing.sm },
  differenceHeadlineText: { color: colors.navy, flex: 1, fontSize: 14 },
  comparisonRows: { marginTop: spacing.sm },
  comparisonRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48 },
  comparisonRowBorder: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth },
  comparisonLabel: { color: colors.muted, flex: 1, fontSize: 14, fontWeight: '700' },
  comparisonAmounts: { alignItems: 'flex-end', gap: 2 },
  comparisonCurrent: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  comparisonDifference: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  comparisonDifferenceUp: { color: colors.green },
  comparisonDifferenceDown: { color: colors.coral },
  noFigureComparison: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  emptyComparisonRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  emptyComparisonCopy: { flex: 1 },
  emptyComparisonTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  emptyComparisonBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  figuresCard: { backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.large, borderWidth: 1, overflow: 'hidden', paddingHorizontal: spacing.md },
  figureRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 56 },
  figureRowBorder: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth },
  figureLabel: { color: colors.muted, flex: 1, fontSize: 15, fontWeight: '700' },
  figureValue: { color: colors.navy, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  unavailableTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  unavailableBody: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginHorizontal: spacing.lg, marginTop: spacing.xl, textAlign: 'center' },
});
