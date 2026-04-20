import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { type } from '../../theme/typography';
import { space } from '../../theme/spacing';

export default function SectionHeader({ title, action, onAction }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.title}>{title}</Text>
        {action ? (
          <TouchableOpacity
            onPress={onAction}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.action}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  title: { ...type.sectionLabel },
  action: {
    ...type.caption,
    color: colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border1,
  },
});
