import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AquaCorner, Brand, PrimaryButton } from '../components/chrome';
import { saveProfileSetup } from '../lib/data';
import { colors, radius, spacing } from '../theme';

type Country = 'UK' | 'Ireland';
type PayFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'other';

const frequencies: Array<{ value: PayFrequency; label: string }> = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'other', label: 'Other' },
];

export function ProfileSetupScreen({
  userId,
  firstName,
  onComplete,
}: {
  userId: string;
  firstName: string | null | undefined;
  onComplete: () => Promise<void>;
}) {
  const [country, setCountry] = useState<Country | null>(null);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>('monthly');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!country) {
      Alert.alert('Choose your pay country', 'Select UK or Ireland to set the right currency for your payday plan.');
      return;
    }

    setSaving(true);
    try {
      await saveProfileSetup(userId, { country, payFrequency });
      await onComplete();
    } catch (error) {
      Alert.alert('We could not finish setup', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <AquaCorner />
      <View style={styles.header}><Brand compact /></View>
      <View style={styles.body}>
        <Text style={styles.kicker}>{firstName?.trim() ? `Nice to meet you, ${firstName.trim()}.` : 'A quick setup, then you’re in.'}</Text>
        <Text style={styles.title}>Where do you get paid?</Text>
        <Text style={styles.subtitle}>This sets the currency for your payslip and payday plan. We currently support the UK and Ireland.</Text>

        <View style={styles.countryChoices}>
          <CountryChoice country="UK" currency="GBP (£)" selected={country === 'UK'} onPress={() => setCountry('UK')} />
          <CountryChoice country="Ireland" currency="EUR (€)" selected={country === 'Ireland'} onPress={() => setCountry('Ireland')} />
        </View>

        <Text style={styles.sectionTitle}>How often do you get paid?</Text>
        <View style={styles.frequencyChoices}>
          {frequencies.map((frequency) => (
            <Pressable
              accessibilityRole="button"
              key={frequency.value}
              onPress={() => setPayFrequency(frequency.value)}
              style={({ pressed }) => [styles.frequencyChoice, payFrequency === frequency.value && styles.frequencyChoiceSelected, pressed && styles.choicePressed]}
            >
              <Text style={[styles.frequencyText, payFrequency === frequency.value && styles.frequencyTextSelected]}>{frequency.label}</Text>
              {payFrequency === frequency.value ? <Ionicons color={colors.violet} name="checkmark-circle" size={19} /> : null}
            </Pressable>
          ))}
        </View>

        <PrimaryButton disabled={saving} label={saving ? 'Saving your setup…' : 'Set up my payday view'} onPress={save} style={styles.primary} />
        <Text style={styles.note}>You can change these details later. Payslip Insights highlights things worth checking; it does not give tax or financial advice.</Text>
      </View>
    </ScrollView>
  );
}

function CountryChoice({
  country,
  currency,
  selected,
  onPress,
}: {
  country: Country;
  currency: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.countryChoice, selected && styles.countryChoiceSelected, pressed && styles.choicePressed]}
    >
      <View style={[styles.countryIcon, selected && styles.countryIconSelected]}>
        <Ionicons color={selected ? colors.violet : colors.navy} name="location-outline" size={25} />
      </View>
      <View style={styles.countryCopy}>
        <Text style={styles.countryName}>{country}</Text>
        <Text style={styles.countryCurrency}>{currency}</Text>
      </View>
      {selected ? <Ionicons color={colors.violet} name="checkmark-circle" size={23} /> : <Ionicons color={colors.muted} name="chevron-forward" size={20} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { backgroundColor: colors.background, flexGrow: 1, paddingBottom: spacing.xxl, position: 'relative' },
  header: { paddingHorizontal: spacing.lg, paddingTop: 64 },
  body: { paddingHorizontal: spacing.lg, paddingTop: 52 },
  kicker: { color: colors.violet, fontSize: 15, fontWeight: '800' },
  title: { color: colors.navy, fontSize: 39, fontWeight: '900', letterSpacing: -1.8, lineHeight: 43, marginTop: spacing.xs },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  countryChoices: { gap: spacing.sm, marginTop: spacing.xl },
  countryChoice: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.lavenderLine, borderRadius: radius.medium, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 78, paddingHorizontal: spacing.md },
  countryChoiceSelected: { backgroundColor: colors.lavender, borderColor: colors.violet, borderWidth: 2 },
  countryIcon: { alignItems: 'center', backgroundColor: colors.aquaSoft, borderRadius: radius.pill, height: 46, justifyContent: 'center', width: 46 },
  countryIconSelected: { backgroundColor: colors.white },
  countryCopy: { flex: 1 },
  countryName: { color: colors.navy, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  countryCurrency: { color: colors.muted, fontSize: 13, fontWeight: '700', marginTop: 2 },
  sectionTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', letterSpacing: -0.4, marginTop: spacing.xl },
  frequencyChoices: { gap: spacing.xs, marginTop: spacing.md },
  frequencyChoice: { alignItems: 'center', borderColor: colors.lavenderLine, borderRadius: radius.small, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, paddingHorizontal: spacing.md },
  frequencyChoiceSelected: { backgroundColor: colors.lavender, borderColor: colors.violet },
  frequencyText: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  frequencyTextSelected: { color: colors.violet },
  choicePressed: { opacity: 0.74 },
  primary: { marginTop: spacing.xl },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md, textAlign: 'center' },
});
