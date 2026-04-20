import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export default function Spinner() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg0,
  },
});
