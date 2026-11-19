import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Check, Sparkles } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { CatalogService } from '../../services/catalogService';
import { Toast } from '../../components/Toast';

export const PreferencesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [languages, setLanguages] = useState<string[]>(['Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Hindi', 'English']);
  const [genres, setGenres] = useState<string[]>([
    'Action',
    'Drama',
    'Comedy',
    'Thriller',
    'Romantic',
    'Mystery',
    'Horror',
    'Sci-Fi',
    'Family',
  ]);

  useEffect(() => {
    Promise.all([
      CatalogService.getLanguages().catch(() => []),
      CatalogService.getCategories().catch(() => []),
    ]).then(([langs, cats]) => {
      if (langs && langs.length > 0) {
        setLanguages(langs.map((l) => l.name).filter(Boolean));
      }
      if (cats && cats.length > 0) {
        setGenres(cats.map((c) => c.name).filter(Boolean));
      }
    });
  }, []);

  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());
  const [selectedGenres, setSelectedGenres] = useState<Set<string>>(new Set());

  const toggleLang = (lang: string) => {
    setSelectedLangs((prev) => {
      const next = new Set(prev);
      if (next.has(lang)) {
        if (next.size > 1) next.delete(lang);
      } else {
        next.add(lang);
      }
      return next;
    });
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = new Set(prev);
      if (next.has(genre)) {
        if (next.size > 1) next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  };

  const handleSave = () => {
    Toast.success('Your personalized feed will now reflect your selections.', 'Preferences Saved');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Preferences</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>PREFERRED LANGUAGES</Text>
        <Text style={styles.sectionSub}>Select the audio languages you watch the most</Text>
        <View style={styles.chipsWrap}>
          {languages.map((lang) => {
            const isSelected = selectedLangs.has(lang);
            return (
              <TouchableOpacity
                key={lang}
                activeOpacity={0.8}
                onPress={() => toggleLang(lang)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                {isSelected && <Check size={14} color="#FFFFFF" style={{ marginRight: 6 }} />}
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {lang}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionHeading, { marginTop: 28 }]}>FAVORITE GENRES</Text>
        <Text style={styles.sectionSub}>We will tailor your home feed and suggestions</Text>
        <View style={styles.chipsWrap}>
          {genres.map((genre) => {
            const isSelected = selectedGenres.has(genre);
            return (
              <TouchableOpacity
                key={genre}
                activeOpacity={0.8}
                onPress={() => toggleGenre(genre)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                {isSelected && <Check size={14} color="#FFFFFF" style={{ marginRight: 6 }} />}
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {genre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleSave}
          style={styles.saveBtn}
        >
          <Sparkles size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>Save Preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default PreferencesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeading: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },
  sectionSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
  },
  chipSelected: {
    backgroundColor: AppTheme.primary,
    borderColor: AppTheme.primary,
  },
  chipText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 36,
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
