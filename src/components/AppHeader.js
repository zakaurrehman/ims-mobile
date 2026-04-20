import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { type } from '../theme/typography';
import { space } from '../theme/spacing';

export default function AppHeader({
  title,
  navigation,
  showBack = false,
  rightActions,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="chevron-left" size={24} color={colors.text1} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}

        <Text style={styles.title} numberOfLines={1}>{title}</Text>

        <View style={styles.right}>
          {rightActions}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.bg0,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    ...type.heading,
    flex: 1,
    textAlign: 'center',
  },
  right: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
});
