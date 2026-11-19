import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Play, Film } from 'lucide-react-native';
import { CatalogItem, getBackgroundUrl, getPosterUrl } from '../types';
import { AppTheme } from '../core/theme';

interface ShortVideoPlayerProps {
  item: CatalogItem;
  isActive: boolean;
  onPressPlay?: () => void;
}

export const ShortVideoPlayer: React.FC<ShortVideoPlayerProps> = ({
  item,
  isActive,
  onPressPlay,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const imageUrl = getPosterUrl(item) || getBackgroundUrl(item);

  return (
    <View style={styles.container}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <Film size={64} color="rgba(255,255,255,0.3)" />
        </View>
      )}

      {/* Dark gradient overlay */}
      <View style={styles.overlay} />

      {/* Play / Action indicator */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          setIsPlaying(!isPlaying);
          if (onPressPlay) onPressPlay();
        }}
        style={styles.playButton}
      >
        <Play size={44} color="#FFFFFF" fill="#FFFFFF" />
      </TouchableOpacity>

      {/* Item info overlay */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  infoContainer: {
    position: 'absolute',
    bottom: 30,
    left: 16,
    right: 70,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  description: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
