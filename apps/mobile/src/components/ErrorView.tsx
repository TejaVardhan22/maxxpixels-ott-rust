import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WifiOff, AlertCircle, LogIn, RefreshCw } from 'lucide-react-native';
import { AppTheme } from '../core/theme';

interface ErrorViewProps {
  message?: string;
  title?: string;
  onRetry: () => void;
  onNavigateLogin?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  message = 'Something went wrong while reaching the MaxxPixels network. Please try again.',
  title = 'Could Not Load Content',
  onRetry,
  onNavigateLogin,
}) => {
  const isOffline =
    message.toLowerCase().includes('socket') ||
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('internet') ||
    message.toLowerCase().includes('timed out');

  const needsLogin =
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('sign in') ||
    message.toLowerCase().includes('login');

  const displayTitle = isOffline ? 'No Internet Connection' : needsLogin ? 'Sign in to continue' : title;

  const displayMessage = isOffline
    ? 'Please check your network settings and try again.'
    : needsLogin
    ? 'Please sign in to enjoy this feature and keep your MaxxPixels experience secure.'
    : message.replace(/^Exception:\s*/i, '');

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {isOffline ? (
          <WifiOff size={56} color={AppTheme.primary} />
        ) : (
          <AlertCircle size={56} color={AppTheme.primary} />
        )}
      </View>

      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={needsLogin && onNavigateLogin ? onNavigateLogin : onRetry}
        style={styles.button}
      >
        {needsLogin ? (
          <LogIn size={18} color="#06111F" />
        ) : (
          <RefreshCw size={18} color="#06111F" />
        )}
        <Text style={styles.buttonText}>{needsLogin ? 'Sign in' : 'Retry'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#06111F',
    fontSize: 14,
    fontWeight: '900',
  },
});
