import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  Film,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  PieChart,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { Toast } from '../../components/Toast';
import { InvestorDashboardData, InvestorService } from '../../services/investorService';

export const InvestorDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [data, setData] = useState<InvestorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    InvestorService.getDashboard()
      .then((res) => setData(res))
      .catch(() => Toast.error('Investor information is unavailable. Please try again later.'))
      .finally(() => setLoading(false));
  }, []);

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
        <Text style={styles.headerTitle}>Investor Portal</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <TrendingUp size={12} color="#34D399" />
              <Text style={styles.badgeText}>FILM FUNDING & RETURNS</Text>
            </View>
          </View>
          <Text style={styles.introTitle}>Co-Produce Kannada Cinema</Text>
          <Text style={styles.introSub}>
            Invest directly into verified Kannada feature films, track real-time
            box office analytics, and earn projected returns.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Pool Raised</Text>
                <Text style={styles.kpiValue}>₹{(data.totalInvestment / 100000).toFixed(1)}L</Text>
                <Text style={styles.kpiSub}>Across active projects</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Expected Returns</Text>
                <Text style={[styles.kpiValue, { color: '#34D399' }]}>
                  ₹{(data.expectedReturns / 100000).toFixed(1)}L
                </Text>
                <Text style={styles.kpiSub}>As reported by the project</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Active Projects</Text>
                <Text style={styles.kpiValue}>{data.activeProjects}</Text>
                <Text style={styles.kpiSub}>In production</Text>
              </View>

              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Co-Investors</Text>
                <Text style={styles.kpiValue}>{data.totalInvestors}</Text>
                <Text style={styles.kpiSub}>Active members</Text>
              </View>
            </View>

            {/* Live Film Investment Opportunities */}
            <Text style={styles.sectionHeading}>ACTIVE OPPORTUNITIES</Text>
            <View style={styles.projectList}>
              {data.projects.map((proj) => (
                <View key={proj.id} style={styles.projectCard}>
                  <Image source={{ uri: proj.posterUrl }} style={styles.projectPoster} />
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectTitle}>{proj.title}</Text>
                    <Text style={styles.projectRoi}>Target ROI: {proj.roi}</Text>

                    {/* Progress bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${proj.progressPercentage}%` },
                        ]}
                      />
                    </View>

                    <View style={styles.progressTextRow}>
                      <Text style={styles.progressText}>
                        ₹{(proj.collectedAmount / 100000).toFixed(1)}L / ₹
                        {(proj.targetAmount / 100000).toFixed(1)}L
                      </Text>
                      <Text style={styles.percentText}>
                        {proj.progressPercentage}%
                      </Text>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        Toast.success(
                          `Thank you for your interest in "${proj.title}". An investment portfolio manager will contact you.`,
                          'Interest Expressed'
                        )
                      }
                      style={styles.investBtn}
                    >
                      <Text style={styles.investBtnText}>Invest in Project</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default InvestorDashboardScreen;

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
  introCard: {
    backgroundColor: '#081D1A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginVertical: 12,
  },
  badgeRow: {
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  introTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  introSub: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginVertical: 14,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  kpiLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  kpiValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  kpiSub: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 16,
  },
  projectList: {
    gap: 16,
  },
  projectCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  projectPoster: {
    width: '100%',
    height: 140,
  },
  projectInfo: {
    padding: 16,
  },
  projectTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  projectRoi: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: AppTheme.surfaceElevated,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  percentText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  investBtn: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  investBtnText: {
    color: AppTheme.background,
    fontSize: 13,
    fontWeight: '900',
  },
});
