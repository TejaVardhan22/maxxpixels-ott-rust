import React, { useState } from 'react';
import {
  Alert,
  Linking,
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
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { Toast } from '../../components/Toast';

interface FaqItem {
  question: string;
  answer: string;
}

export const HelpSupportScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs: FaqItem[] = [
    {
      question: 'How do I download movies for offline viewing?',
      answer:
        'Tap the Download button on any supported movie or episode details page. Once downloaded, you can access your videos from the "My Space > My Downloads" screen without an internet connection.',
    },
    {
      question: 'How does movie rental work?',
      answer:
        'Rentals allow pay-per-view access to select theatrical titles. Once rented, you have 30 days to start watching and 48 hours to complete playback after pressing Play.',
    },
    {
      question: 'How many screens can stream simultaneously?',
      answer:
        'VIP plans allow streaming on up to 2 to 4 screens at the same time depending on your active plan tier.',
    },
    {
      question: 'How do I cancel my VIP subscription?',
      answer:
        'You can manage and cancel auto-renewals from your account settings at any time. Your subscription will remain active until the end of the billing period.',
    },
  ];

  const handleContactEmail = () => {
    Linking.openURL('mailto:support@maxxpixels.com?subject=MaxxPixels Support Request').catch(
      () => {
        Toast.info('Please write to us at support@maxxpixels.com', 'Support Contact');
      }
    );
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
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>FREQUENTLY ASKED QUESTIONS</Text>

        <View style={styles.faqList}>
          {faqs.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={index} style={styles.faqCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  style={styles.faqHeader}
                >
                  <Text style={styles.questionText}>{faq.question}</Text>
                  {isExpanded ? (
                    <ChevronUp size={20} color="#60A5FA" />
                  ) : (
                    <ChevronDown size={20} color="#64748B" />
                  )}
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.faqAnswerWrap}>
                    <Text style={styles.answerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Contact Support */}
        <Text style={[styles.sectionHeading, { marginTop: 28 }]}>STILL NEED HELP?</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleContactEmail}
          style={styles.contactBtn}
        >
          <Mail size={18} color="#FFFFFF" />
          <Text style={styles.contactBtnText}>Contact Support Team</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default HelpSupportScreen;

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
    color: '#64748B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 14,
  },
  faqList: {
    gap: 12,
  },
  faqCard: {
    backgroundColor: AppTheme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  questionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
    marginRight: 10,
  },
  faqAnswerWrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 10,
  },
  answerText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  contactBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
