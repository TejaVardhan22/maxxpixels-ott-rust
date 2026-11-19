import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { AppTheme } from '../core/theme';

export default function UnavailableScreen({
  title,
  message,
  action,
  onAction,
}: {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { paddingTop: insets.top + 16 }]}>
      <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Back">
        <ArrowLeft color="#FFFFFF" />
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {action && onAction && (
          <Pressable onPress={onAction} style={styles.button}>
            <Text style={styles.btnText}>{action}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: AppTheme.background, padding: 24 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { color: AppTheme.textPrimary, fontSize: 20, fontWeight: '700' },
  message: { color: AppTheme.textSecondary, textAlign: 'center', lineHeight: 24 },
  button: { paddingVertical: 14, paddingHorizontal: 24, backgroundColor: AppTheme.primary, borderRadius: 10 },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
