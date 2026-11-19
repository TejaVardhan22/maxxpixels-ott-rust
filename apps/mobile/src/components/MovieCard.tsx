import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Film } from 'lucide-react-native';
import { CatalogItem, getPosterUrl } from '../types';
import { AppTheme } from '../core/theme';

interface MovieCardProps {
  movie: CatalogItem;
  width?: number;
  height?: number;
  onPress?: () => void;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  width = 120,
  height = 180,
  onPress,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const imageUrl = getPosterUrl(movie);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[
        styles.container,
        { width, height },
      ]}
    >
      <View style={styles.imageContainer}>
        {imageUrl && !imageError ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
            fadeDuration={0}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Film size={32} color="rgba(255,255,255,0.25)" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: AppTheme.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E222A',
  },
});
