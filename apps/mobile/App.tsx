import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, getStateFromPath } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SweetAlertContainer, SweetAlert } from './src/components/SweetAlert';
import { ToastContainer } from './src/components/Toast';
import { ErrorTracker } from './src/services/errorTrackerService';
import { onForegroundMessage } from './src/services/pushNotificationService';
import { ScreenSecurityGuard } from './src/components/ScreenSecurityGuard';
import { AdMobService } from './src/services/adMobService';
import { ErrorBoundary } from './src/components/ErrorBoundary';

function titleFromSlug(slug?: string): string {
  if (!slug) return 'MaxxPixels Title';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function captureReferralCodeFromUrl(rawUrlOrPath: string) {
  try {
    const match = rawUrlOrPath.match(/[?&](?:ref|reference_code|referral)=([^&#]+)/i);
    if (match && match[1]) {
      const code = decodeURIComponent(match[1]).trim();
      if (code) {
        AsyncStorage.setItem('pending_referral_code', code).catch(() => {});
        AsyncStorage.setItem('@maxx_referral_code', code).catch(() => {});
      }
    }
  } catch {}
}

const linking = {
  prefixes: ['maxxpixels://', 'https://maxxpixels.com', 'http://localhost:3000'],
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => {
      captureReferralCodeFromUrl(url);
      listener(url);
    };

    const subscription = Linking.addEventListener('url', onReceiveURL);

    Linking.getInitialURL().then((url) => {
      if (url) captureReferralCodeFromUrl(url);
    });

    return () => {
      subscription.remove();
    };
  },
  getStateFromPath(path: string, options: any) {
    captureReferralCodeFromUrl(path);

    const [cleanPath] = path.replace(/^\/+/, '').split('?');
    const segments = cleanPath.split('/').filter(Boolean);

    // Watch routes: /movies/:slug/:id/watch, /shows/:slug/:id/watch, /movies/:slug/watch
    if (
      (segments[0] === 'movies' || segments[0] === 'shows') &&
      segments[segments.length - 1] === 'watch'
    ) {
      const isShow = segments[0] === 'shows';
      const slug = segments[1] || 'watch';
      const id = segments.length >= 4 ? segments[2] : slug;
      const title = titleFromSlug(slug);
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'Player',
            params: {
              videoId: id,
              videoType: isShow ? 2 : 1,
              title,
              item: {
                id,
                slug,
                name: title,
                videoType: isShow ? 2 : 1,
                typeId: isShow ? 2 : 1,
              },
            },
          },
        ],
      };
    }

    if (segments[0] === 'watch' && segments[1]) {
      const slug = segments[1];
      const title = titleFromSlug(slug);
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'Player',
            params: {
              videoId: slug,
              videoType: 1,
              title,
              item: { id: slug, slug, name: title, videoType: 1, typeId: 1 },
            },
          },
        ],
      };
    }

    // Movies: /movies/:slug/:id, /movies/:slug, /movie/:slug
    if (segments[0] === 'movies' || segments[0] === 'movie') {
      const slug = segments[1] || '';
      const id = segments[2] || slug;
      if (slug || id) {
        const title = titleFromSlug(slug);
        return {
          routes: [
            { name: 'Main' },
            {
              name: 'Details',
              params: {
                movie: {
                  id: /^\d+$/.test(id) ? Number(id) : id,
                  slug,
                  name: title,
                  videoType: 1,
                  typeId: 1,
                },
              },
            },
          ],
        };
      }
    }

    // Shows: /shows/:slug/:id, /shows/:slug, /series/:slug
    if (segments[0] === 'shows' || segments[0] === 'series') {
      const slug = segments[1] || '';
      const id = segments[2] || slug;
      if (slug || id) {
        const title = titleFromSlug(slug);
        return {
          routes: [
            { name: 'Main' },
            {
              name: 'Details',
              params: {
                movie: {
                  id: /^\d+$/.test(id) ? Number(id) : id,
                  slug,
                  name: title,
                  videoType: 2,
                  typeId: 2,
                },
              },
            },
          ],
        };
      }
    }

    // Legacy stream title: /stream/title/:id
    if (segments[0] === 'stream' && segments[1] === 'title' && segments[2]) {
      const id = segments[2];
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'Details',
            params: {
              movie: {
                id: /^\d+$/.test(id) ? Number(id) : id,
                name: 'Watch Title',
                videoType: 1,
                typeId: 1,
              },
            },
          },
        ],
      };
    }

    // Shorts: /shorts/:id, /short/:id
    if ((segments[0] === 'shorts' || segments[0] === 'short') && segments[1]) {
      return {
        routes: [
          { name: 'Main' },
          { name: 'Shorts' },
        ],
      };
    }

    // Genres & Categories: /genres/:slug, /category/:slug
    if ((segments[0] === 'genres' || segments[0] === 'category') && segments[1]) {
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'CategoryContent',
            params: {
              title: titleFromSlug(segments[1]),
            },
          },
        ],
      };
    }

    // Languages: /languages/:slug
    if (segments[0] === 'languages' && segments[1]) {
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'CategoryContent',
            params: {
              title: `${titleFromSlug(segments[1])} Cinema`,
            },
          },
        ],
      };
    }

    // Channels: /channels/:slug
    if (segments[0] === 'channels' && segments[1]) {
      return {
        routes: [
          { name: 'Main' },
          {
            name: 'CategoryContent',
            params: {
              title: titleFromSlug(segments[1]),
            },
          },
        ],
      };
    }

    return getStateFromPath(path, options);
  },
  config: {
    screens: {
      Main: '',
      Home: 'home',
      Explore: 'search',
      Details: {
        path: 'details/:videoType/:typeId/:videoId/:slug?',
        parse: {
          movie: (pathParams: any) => ({
            id: pathParams?.videoId ?? 0,
            slug: pathParams?.slug,
            videoType: Number(pathParams?.videoType ?? 1),
            typeId: Number(pathParams?.typeId ?? 1),
            name: pathParams?.slug ? String(pathParams.slug).replace(/-/g, ' ') : 'Title',
          }),
        },
      },
      Subscription: 'subscription',
      Notifications: 'notifications',
      Shorts: 'shorts',
      Settings: 'settings',
      Account: 'account',
      Rentals: 'rentals',
    },
  },
};

function App() {
  useEffect(() => {
    ErrorTracker.init();
    AdMobService.init().catch(() => {});

    // Listen for foreground push notifications and display in-app banner
    const unsubscribe = onForegroundMessage((message) => {
      if (message.title || message.body) {
        SweetAlert.show({
          type: 'info',
          title: message.title || 'MaxxPixels Notification',
          message: message.body || 'You have received a new update from MaxxPixels.',
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar barStyle="light-content" />
            <View style={styles.container}>
              <ErrorBoundary>
                <RootNavigator />
              </ErrorBoundary>
              <SweetAlertContainer />
              <ToastContainer />
            </View>
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A15',
  },
});

export default App;
