// Root navigator — switches between Public and App based on auth state
import { NavigationContainer } from '@react-navigation/native';
import { View } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { UserAuth } from '../contexts/AuthContext';
import PublicStack from './PublicStack';
import AppTabs from './AppTabs';
import Spinner from '../components/Spinner';
import OfflineBanner from '../components/OfflineBanner';

export default function RootNavigator() {
  const { user, loadingPage } = UserAuth();

  if (loadingPage) return <Spinner />;

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {user ? <AppTabs /> : <PublicStack />}
      </NavigationContainer>
      <OfflineBanner />
    </View>
  );
}
