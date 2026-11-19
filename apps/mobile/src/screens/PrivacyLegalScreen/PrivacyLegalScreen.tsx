import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { PageService } from '../../services/pageService';
import { AdminPage } from '../../types';

export const PrivacyLegalScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [pages, setPages] = useState<AdminPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<AdminPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    PageService.getPages()
      .then((res) => {
        setPages(res);
        if (res.length > 0) setSelectedPage(res[0]);
      })
      .catch(() => {
        const fallbacks = PageService.fallbackLegalPages();
        setPages(fallbacks);
        setSelectedPage(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (selectedPage && pages.length > 1) {
              // Toggle or back
              navigation.goBack();
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Legal & Policies</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {pages.map((p) => {
            const isSelected = selectedPage?.id === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.8}
                onPress={() => setSelectedPage(p)}
                style={[styles.tabChip, isSelected && styles.tabChipSelected]}
              >
                <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
                  {p.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={AppTheme.primary} />
          </View>
        ) : selectedPage ? (
          <View style={styles.contentBox}>
            <Text style={styles.pageTitle}>{selectedPage.title}</Text>
            {selectedPage.subtitle ? (
              <Text style={styles.pageSubtitle}>{selectedPage.subtitle}</Text>
            ) : null}
            <Text style={styles.pageBody}>
              {selectedPage.description.replace(/<[^>]*>/g, '')}
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No legal information available.</Text>
        )}
      </ScrollView>
    </View>
  );
};

export default PrivacyLegalScreen;

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
  tabScrollWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  tabScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: AppTheme.surfaceElevated,
  },
  tabChipSelected: {
    backgroundColor: AppTheme.primary,
    borderColor: AppTheme.primary,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextSelected: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  contentBox: {
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  pageSubtitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
  },
  pageBody: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    marginTop: 40,
  },
});
