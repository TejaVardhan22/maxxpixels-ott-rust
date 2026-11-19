import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SelectionCapsule } from './SelectionCapsule';

interface CategoryRowProps {
  categories: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const CategoryRow: React.FC<CategoryRowProps> = ({
  categories,
  selectedIndex,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => `${item}-${index}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <SelectionCapsule
            label={item}
            selected={selectedIndex === index}
            onTap={() => onSelect(index)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  listContent: {
    paddingHorizontal: 16,
  },
});
