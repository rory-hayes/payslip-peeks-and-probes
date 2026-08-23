import type { ReactNode } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import aquaCorner from '../../assets/option-one-aqua-corner-v2.webp';
import brandMark from '../../assets/payslip-insights-mark.webp';
import payslipHero from '../../assets/option-one-payslip-check-hero-v1.webp';
import { colors, radius, spacing } from '../theme';

export function AquaCorner() {
  return <Image accessible={false} source={aquaCorner} resizeMode="cover" style={imageStyles.corner} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityRole="header" style={[styles.brand, compact && styles.brandCompact]}>
      <Image accessible={false} source={brandMark} style={[styles.brandMark, compact && styles.brandMarkCompact]} />
      <View style={[styles.brandWordmark, compact && styles.brandWordmarkCompact]}>
        <Text style={[styles.brandText, compact && styles.brandTextCompact]}>payslip</Text>
        <Text style={[styles.brandText, compact && styles.brandTextCompact]}>insights</Text>
      </View>
    </View>
  );
}

export function HeroIllustration({ size = 210 }: { size?: number }) {
  return <Image source={payslipHero} resizeMode="contain" style={{ height: size, width: size }} accessibilityLabel="A payslip being checked" />;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, disabled && styles.primaryDisabled, pressed && !disabled && styles.primaryPressed, style]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function QuietButton({
  label,
  onPress,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quietButton, disabled && styles.quietDisabled, pressed && !disabled && styles.quietPressed]}
    >
      <Text style={[styles.quietText, danger && styles.quietDanger]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

export function Notice({ children, tone = 'aqua' }: { children: ReactNode; tone?: 'aqua' | 'green' | 'coral' }) {
  return (
    <View style={[styles.notice, tone === 'green' && styles.noticeGreen, tone === 'coral' && styles.noticeCoral]}>
      {children}
    </View>
  );
}

export function CornerBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground source={aquaCorner} resizeMode="cover" style={styles.background} imageStyle={imageStyles.backgroundImage}>
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  brandCompact: {
    alignItems: 'center',
  },
  brandMark: {
    borderRadius: radius.small,
    height: 34,
    width: 34,
  },
  brandMarkCompact: {
    borderRadius: 9,
    height: 24,
    width: 24,
  },
  brandWordmark: {
    gap: 0,
  },
  brandWordmarkCompact: {
    flexDirection: 'row',
    gap: 4,
  },
  brandText: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 28,
  },
  brandTextCompact: {
    fontSize: 18,
    letterSpacing: -0.8,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    boxShadow: '0px 10px 16px rgba(255, 74, 11, 0.20)',
    borderRadius: radius.medium,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: spacing.lg,
  },
  primaryPressed: { backgroundColor: colors.orangePressed, transform: [{ scale: 0.99 }] },
  primaryDisabled: { backgroundColor: '#FFB294', boxShadow: 'none' },
  primaryText: { color: colors.white, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  quietButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingVertical: spacing.xs },
  quietDisabled: { opacity: 0.52 },
  quietPressed: { opacity: 0.6 },
  quietText: { color: colors.violet, fontSize: 15, fontWeight: '700' },
  quietDanger: { color: colors.coral },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitle: { color: colors.navy, fontSize: 23, fontWeight: '800', letterSpacing: -0.7 },
  notice: { backgroundColor: colors.aquaSoft, borderRadius: radius.medium, padding: spacing.md },
  noticeGreen: { backgroundColor: colors.greenSoft },
  noticeCoral: { backgroundColor: colors.coralSoft },
  background: { backgroundColor: colors.background, flex: 1 },
});

const imageStyles = StyleSheet.create({
  corner: {
    height: 210,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 420,
    zIndex: 0,
  } satisfies ImageStyle,
  backgroundImage: { alignSelf: 'flex-end', height: 250, top: 0, width: 580 } satisfies ImageStyle,
});
