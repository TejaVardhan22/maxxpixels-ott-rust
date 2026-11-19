import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, StyleSheet, Text, View } from 'react-native';

interface ScreenSecurityGuardProps {
  children: React.ReactNode;
}

export const ScreenSecurityGuard: React.FC<ScreenSecurityGuardProps> = ({ children }) => {
  const [isProtectedScreen, setIsProtectedScreen] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // Obscure app contents when app moves out of active state (prevents app switcher screenshots)
      if (nextAppState === 'inactive' || nextAppState === 'background') {
        setIsProtectedScreen(true);
      } else if (nextAppState === 'active') {
        setIsProtectedScreen(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.flexOne}>
      {children}
      {isProtectedScreen && (
        <View style={styles.overlay}>
          <Text style={styles.title}>Protected Content</Text>
          <Text style={styles.subtitle}>
            Screen recording, screen sharing, and screenshots are disabled for security reasons.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 999999,
  },
  title: {
    color: '#FF4D4D',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#CCCCCC',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
