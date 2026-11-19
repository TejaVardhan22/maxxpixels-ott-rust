import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Film } from 'lucide-react-native';

export interface EmptyStateViewProps {
  icon?: React.ComponentType<{ size: number; color: string }>;
  title?: string;
  subtitle?: string;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  icon: IconComponent = Film,
  title = 'No Content Available',
  subtitle = 'Exciting new titles and releases are arriving soon!',
}) => {
  return (
    <View style={styles.container}>
      <IconComponent size={44} color="#64748B" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 56,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#F1F5F9',
    marginTop: 16,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94A3B8',
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});
