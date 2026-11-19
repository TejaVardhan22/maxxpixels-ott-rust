import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AppTheme } from '../core/theme';

interface SelectionCapsuleProps {
  label: string;
  selected: boolean;
  onTap: () => void;
}

export const SelectionCapsule: React.FC<SelectionCapsuleProps> = ({ label, selected, onTap }) => {
  return (
    <Pressable
      onPress={onTap}
      style={[
        styles.capsule,
        {
          backgroundColor: selected ? AppTheme.primary : AppTheme.surface,
          borderColor: selected ? AppTheme.primary : AppTheme.surfaceElevated,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: selected ? '#FFFFFF' : '#CBD5E1',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  capsule: {
    marginRight: 8,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
  },
});
