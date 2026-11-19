import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface FeaturedHeadingRowProps {
  title: string;
  onUpgradePress?: () => void;
  upgradeButtonText?: string;
}

export const FeaturedHeadingRow: React.FC<FeaturedHeadingRowProps> = ({
  title,
  onUpgradePress,
  upgradeButtonText = 'UPGRADE',
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onUpgradePress && (
        <TouchableOpacity
          onPress={onUpgradePress}
          accessibilityRole="button"
          activeOpacity={0.8}
          style={styles.upgradeButton}
        >
          <Text style={styles.upgradeText}>{upgradeButtonText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 22,
  },
  title: {
    color: '#F5F5F7',
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  upgradeButton: {
    borderWidth: 1,
    borderColor: '#B99452',
    borderRadius: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  upgradeText: {
    color: '#E8C784',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
