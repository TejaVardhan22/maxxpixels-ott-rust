import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Flame, User as UserIcon } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { HomeScreen } from '../HomeScreen/HomeScreen';
import { ExploreScreen } from '../ExploreScreen/ExploreScreen';
import { NewHotScreen } from '../NewHotScreen/NewHotScreen';
import { ProfileScreen } from '../ProfileScreen/ProfileScreen';

const Tab = createBottomTabNavigator();

interface MainScreenProps {
  route?: {
    params?: {
      initialTypeId?: number;
      initialLang?: string;
      lang?: string;
    };
  };
}

export const MainScreen: React.FC<MainScreenProps> = ({ route }) => {
  const insets = useSafeAreaInsets();
  const initialTypeId = route?.params?.initialTypeId ?? 0;
  const initialLang = route?.params?.initialLang || route?.params?.lang;
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            {
              height: 60 + bottomInset,
              paddingBottom: bottomInset,
            },
          ],
          tabBarActiveTintColor: AppTheme.primary,
          tabBarInactiveTintColor: '#8E8E93',
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          initialParams={{ initialTypeId, initialLang }}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color, size }) => <Home size={22} color={color} />,
          }}
        />

        <Tab.Screen
          name="SearchTab"
          component={ExploreScreen}
          options={{
            tabBarLabel: 'Search',
            tabBarIcon: ({ color, size }) => <Search size={22} color={color} />,
          }}
        />

        <Tab.Screen
          name="NewHotTab"
          component={NewHotScreen}
          options={{
            tabBarLabel: 'New & Hot',
            tabBarIcon: ({ color, size }) => <Flame size={22} color={color} />,
          }}
        />

        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            tabBarLabel: 'My Space',
            tabBarIcon: ({ color, size }) => <UserIcon size={22} color={color} />,
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

export default MainScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  tabBar: {
    backgroundColor: AppTheme.card,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
});
