import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Spinner() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0366ae" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#BCE1FE',
  },
});
