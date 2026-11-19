import { AppTheme } from '../core/theme';
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

// Screens
import SplashScreen from '../screens/SplashScreen/SplashScreen';
import PortalSelectionScreen from '../screens/PortalSelectionScreen/PortalSelectionScreen';
import MainScreen from '../screens/MainScreen/MainScreen';
import HomeScreen from '../screens/HomeScreen/HomeScreen';
import ExploreScreen from '../screens/ExploreScreen/ExploreScreen';
import NewHotScreen from '../screens/NewHotScreen/NewHotScreen';
import ProfileScreen from '../screens/ProfileScreen/ProfileScreen';
import DetailsScreen from '../screens/DetailsScreen/DetailsScreen';
import PlayerScreen from '../screens/PlayerScreen/PlayerScreen';
import LoginScreen from '../screens/LoginScreen/LoginScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen/SubscriptionScreen';
import CategoryContentScreen from '../screens/CategoryContentScreen/CategoryContentScreen';
import AccountScreen from '../screens/AccountScreen/AccountScreen';
import RentalsScreen from '../screens/RentalsScreen/RentalsScreen';
import ShortsScreen from '../screens/ShortsScreen/ShortsScreen';
import MaxxShoppingScreen from '../screens/MaxxShoppingScreen/MaxxShoppingScreen';
import SettingsScreen from '../screens/SettingsScreen/SettingsScreen';
import PreferencesScreen from '../screens/PreferencesScreen/PreferencesScreen';
import StorageScreen from '../screens/StorageScreen/StorageScreen';
import DownloadsScreen from '../screens/DownloadsScreen/DownloadsScreen';
import MyDownloadsScreen from '../screens/MyDownloadsScreen/MyDownloadsScreen';
import PrivacyLegalScreen from '../screens/PrivacyLegalScreen/PrivacyLegalScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen/HelpSupportScreen';
import NotificationsScreen from '../screens/NotificationsScreen/NotificationsScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen/ComingSoonScreen';
import GamesWebViewScreen from '../screens/GamesWebViewScreen/GamesWebViewScreen';
import GamesWalletScreen from '../screens/GamesWalletScreen/GamesWalletScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTheme.background },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="PortalSelection" component={PortalSelectionScreen} />
      <Stack.Screen name="Main" component={MainScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Explore" component={ExploreScreen} />
      <Stack.Screen name="NewHot" component={NewHotScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Details" component={DetailsScreen} />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{
          orientation: 'landscape',
          animation: 'fade',
        }}
      />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="CategoryContent" component={CategoryContentScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Rentals" component={RentalsScreen} />
      <Stack.Screen name="Shorts" component={ShortsScreen} />
      <Stack.Screen name="MaxxShopping" component={MaxxShoppingScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
      <Stack.Screen name="MyDownloads" component={MyDownloadsScreen} />
      <Stack.Screen name="PrivacyLegal" component={PrivacyLegalScreen} />
      <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
      <Stack.Screen name="GamesWebView" component={GamesWebViewScreen} />
<Stack.Screen name="GamesWallet" component={GamesWalletScreen} />
    </Stack.Navigator>
  );
};
