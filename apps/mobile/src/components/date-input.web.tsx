import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

type FieldProvenance = {
  label: string;
  tone: 'auto' | 'edited' | 'missing' | 'manual';
};

export function DateInput({
  label,
  value,
  onChangeText,
  editable = true,
  provenance,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable?: boolean;
  provenance?: FieldProvenance;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {provenance ? <Text style={[styles.provenance, provenanceStyle(provenance.tone)]}>{provenance.label}</Text> : <Text style={styles.hint}>{editable ? 'YYYY-MM-DD' : 'Confirmed payslip'}</Text>}
      </View>
      <View style={[styles.inputWrap, !editable && styles.inputReadOnly]}>
        <TextInput
          accessibilityLabel={provenance ? `${label}, ${provenance.label}` : label}
          autoCapitalize="none"
          autoCorrect={false}
          editable={editable}
          maxLength={10}
          onChangeText={onChangeText}
          placeholder="2026-08-28"
          placeholderTextColor={colors.placeholder}
          style={[styles.input, !editable && styles.readOnlyText]}
          value={value}
        />
        <Ionicons color={editable ? colors.violet : colors.muted} name="calendar-outline" size={21} />
      </View>
    </View>
  );
}

function provenanceStyle(tone: FieldProvenance['tone']) {
  if (tone === 'edited') return styles.provenanceEdited;
  if (tone === 'missing') return styles.provenanceMissing;
  if (tone === 'manual') return styles.provenanceManual;
  return styles.provenanceAuto;
}

const styles = StyleSheet.create({
  field: { borderBottomColor: colors.lavenderLine, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  labelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  provenance: { borderRadius: radius.pill, color: colors.navy, fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: spacing.xs, paddingVertical: 3 },
  provenanceAuto: { backgroundColor: colors.aquaSoft },
  provenanceEdited: { backgroundColor: colors.lavender },
  provenanceMissing: { backgroundColor: colors.coralSoft },
  provenanceManual: { backgroundColor: colors.greenSoft },
  inputWrap: { alignItems: 'center', backgroundColor: colors.lavender, borderRadius: radius.small, flexDirection: 'row', minHeight: 49, paddingHorizontal: spacing.sm },
  inputReadOnly: { backgroundColor: colors.aquaSoft },
  input: { color: colors.navy, flex: 1, fontSize: 17, fontWeight: '700', minHeight: 49, paddingHorizontal: 0 },
  readOnlyText: { color: colors.muted },
});
