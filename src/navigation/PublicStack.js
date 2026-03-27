// Public screens stack (not logged in)
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/public/HomeScreen';
import AboutScreen from '../screens/public/AboutScreen';
import FeaturesScreen from '../screens/public/FeaturesScreen';
import BlogScreen from '../screens/public/BlogScreen';
import SignInScreen from '../screens/public/SignInScreen';
import ContactScreen from '../screens/public/ContactScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/public/ForgotPasswordScreen';

const Stack = createNativeStackNavigator();

export default function PublicStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Features" component={FeaturesScreen} />
      <Stack.Screen name="Blog" component={BlogScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
}
