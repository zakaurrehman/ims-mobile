import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthContextProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import RootNavigator from './src/navigation/RootNavigator';
import Toast from './src/components/Toast';
import OfflineBanner from './src/components/OfflineBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthContextProvider>
          <OfflineBanner />
          <RootNavigator />
          <Toast />
          <StatusBar style="dark" />
        </AuthContextProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
