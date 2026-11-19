import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { AppTheme } from '../core/theme';

export interface PillItem {
  id: string | number;
  label: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  iconColor?: string;
  badge?: string | number;
  [key: string]: any;
}

export interface FilterPillProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ComponentType<{ size: number; color: string }>;
  iconColor?: string;
  size?: 'small' | 'normal' | 'large';
  variant?: 'primary' | 'secondary' | 'subFilter';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeStyle?: StyleProp<ViewStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  badge?: string | number;
}

export const FilterPill: React.FC<FilterPillProps> = ({
  label,
  selected = false,
  onPress,
  icon: IconComponent,
  iconColor,
  size = 'normal',
  variant = 'primary',
  style,
  textStyle,
  activeStyle,
  activeTextStyle,
  badge,
}) => {
  const iconSize = size === 'small' ? 11 : size === 'large' ? 16 : 13;
  const defaultIconColor = selected ? '#FFFFFF' : iconColor || (variant === 'subFilter' ? '#94A3B8' : '#FF3B44');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.pillBase,
        variant === 'subFilter' ? styles.pillSubFilter : styles.pillNormal,
        size === 'small' && styles.pillSmall,
        size === 'large' && styles.pillLarge,
        selected && styles.pillActive,
        selected && activeStyle,
        style,
      ]}
    >
      {IconComponent && (
        <IconComponent
          size={iconSize}
          color={selected ? '#FFFFFF' : defaultIconColor}
        />
      )}
      <Text
        numberOfLines={1}
        style={[
          styles.textBase,
          variant === 'subFilter' ? styles.textSubFilter : styles.textNormal,
          size === 'small' && styles.textSmall,
          size === 'large' && styles.textLarge,
          selected && styles.textActive,
          selected && activeTextStyle,
          textStyle,
        ]}
      >
        {label}
      </Text>
      {badge !== undefined && badge !== null && (
        <View style={[styles.badge, selected && styles.badgeActive]}>
          <Text style={[styles.badgeText, selected && styles.badgeTextActive]}>
            {badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export interface FilterPillBarProps<T extends PillItem = PillItem> {
  items: T[];
  selectedId: string | number | null | undefined;
  onSelect: (item: T) => void;
  size?: 'small' | 'normal' | 'large';
  variant?: 'primary' | 'secondary' | 'subFilter';
  containerStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  pillStyle?: StyleProp<ViewStyle>;
  activePillStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  activeTextStyle?: StyleProp<TextStyle>;
  leadingComponent?: React.ReactNode;
  trailingComponent?: React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  getItemLabel?: (item: T) => string;
  isItemSelected?: (item: T, selectedId: string | number | null | undefined) => boolean;
}

export function FilterPillBar<T extends PillItem = PillItem>({
  items,
  selectedId,
  onSelect,
  size = 'normal',
  variant = 'primary',
  containerStyle,
  contentContainerStyle,
  pillStyle,
  activePillStyle,
  textStyle,
  activeTextStyle,
  leadingComponent,
  trailingComponent,
  getItemKey = (item, index) => item.id ?? index,
  getItemLabel = (item) => item.label || item.name || '',
  isItemSelected,
}: FilterPillBarProps<T>): React.ReactElement {
  return (
    <View style={[styles.barContainer, containerStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      >
        {leadingComponent}

        {items.map((item, index) => {
          const isSelected = isItemSelected
            ? isItemSelected(item, selectedId)
            : String(item.id).toLowerCase() === String(selectedId).toLowerCase();

          return (
            <FilterPill
              key={String(getItemKey(item, index))}
              label={getItemLabel(item)}
              selected={isSelected}
              onPress={() => onSelect(item)}
              icon={item.icon}
              iconColor={item.iconColor}
              badge={item.badge}
              size={size}
              variant={variant}
              style={pillStyle}
              activeStyle={activePillStyle}
              textStyle={textStyle}
              activeTextStyle={activeTextStyle}
            />
          );
        })}

        {trailingComponent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
  },
  pillBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginRight: 8,
    gap: 6,
  },
  pillNormal: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillSubFilter: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 6,
  },
  pillSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 6,
    gap: 4,
  },
  pillLarge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 10,
    gap: 8,
  },
  pillActive: {
    backgroundColor: '#E50914',
    borderColor: '#E50914',
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  textBase: {
    color: '#CBD5E1',
    letterSpacing: 0.3,
  },
  textNormal: {
    fontSize: 13,
    fontWeight: '700',
  },
  textSubFilter: {
    fontSize: 12,
    fontWeight: '700',
  },
  textSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  textLarge: {
    fontSize: 15,
    fontWeight: '800',
  },
  textActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  badgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  badgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
});

export default FilterPillBar;
