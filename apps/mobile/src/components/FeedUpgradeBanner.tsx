import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface FeedUpgradeBannerProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  onSubscribePress?: () => void;
}

export const FeedUpgradeBanner: React.FC<FeedUpgradeBannerProps> = ({
  title = 'Your MaxxPixels Entertainment Feed',
  subtitle = 'Discover exclusive movies, podcasts, music, and originals',
  buttonText = 'Subscribe',
  onSubscribePress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {onSubscribePress && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onSubscribePress}
          style={styles.subscribeButton}
        >
          <Text style={styles.subscribeText}>{buttonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 14,
    backgroundColor: '#0B1224',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.28)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    color: '#93A4BD',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  subscribeButton: {
    backgroundColor: '#F6C85F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  subscribeText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '900',
  },
});
