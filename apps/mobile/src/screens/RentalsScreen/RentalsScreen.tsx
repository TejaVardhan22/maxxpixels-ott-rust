import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Clapperboard, Film, ShoppingBag, Check } from 'lucide-react-native';
import { AppTheme } from '../../core/theme';
import { CatalogService } from '../../services/catalogService';
import { CatalogItem, getPosterUrl, getBackgroundUrl } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AdMobBanner } from '../../components/AdMobBanner';

export const RentalsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'available' | 'myRentals'>('available');
  const [availableItems, setAvailableItems] = useState<CatalogItem[]>([]);
  const [myRentals, setMyRentals] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [avail, rented] = await Promise.all([
        CatalogService.getRentableContent(),
        user?.id ? CatalogService.getMyRentals(user.id) : Promise.resolve([]),
      ]);
      setAvailableItems(avail);
      setMyRentals(rented);
    } catch {
      setAvailableItems([]);
      setMyRentals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const currentList = activeTab === 'available' ? availableItems : myRentals;

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
        <Text style={styles.headerTitle}>Movie Rentals</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('available')}
          style={[styles.tabBtn, activeTab === 'available' && styles.activeTabBtn]}
        >
          <Text
            style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}
          >
            Available to Rent
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('myRentals')}
          style={[styles.tabBtn, activeTab === 'myRentals' && styles.activeTabBtn]}
        >
          <Text
            style={[styles.tabText, activeTab === 'myRentals' && styles.activeTabText]}
          >
            My Rentals ({myRentals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* AdMob Banner for Rentals */}
      <AdMobBanner style={{ marginVertical: 6 }} />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={AppTheme.primary} />
        </View>
      ) : currentList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Clapperboard size={48} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>
            {activeTab === 'available' ? 'No Rentals Available' : 'No Active Rentals'}
          </Text>
          <Text style={styles.emptySub}>
            {activeTab === 'available'
              ? 'Check back later for new theatrical premieres available for rent.'
              : 'You have not rented any movies yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentList}
          numColumns={2}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const poster = getPosterUrl(item) || getBackgroundUrl(item);

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('Details', { movie: item })}
                style={styles.card}
              >
                {poster ? (
                  <Image
                    source={{ uri: poster }}
                    style={styles.cardImage}
                    resizeMode="cover"
                    fadeDuration={0}
                  />
                ) : (
                  <View style={styles.placeholder}>
                    <Film size={32} color="rgba(255,255,255,0.25)" />
                  </View>
                )}
                {(() => {
                  const isRented = activeTab === 'myRentals' || item.isRented === 1 || item.rentBuy === 1 || (item as any).is_rented === 1;
                  return isRented ? (
                    <View style={styles.rentedCardBadge}>
                      <Check size={11} color="#FFFFFF" />
                      <Text style={styles.rentedCardBadgeText}>RENTED</Text>
                    </View>
                  ) : (
                    <View style={styles.rentCardFlag}>
                      <ShoppingBag size={11} color="#0F172A" />
                      <Text style={styles.rentCardFlagText}>RENT · ₹{item.rentPrice || 0}</Text>
                    </View>
                  );
                })()}
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.rentExpiryDate
                    ? `Valid until ${isNaN(Date.parse(item.rentExpiryDate)) ? item.rentExpiryDate : new Date(item.rentExpiryDate).toLocaleDateString()}`
                    : `₹${item.rentPrice || 0} • ${item.rentDay || 2} days access`}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

export default RentalsScreen;

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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: AppTheme.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabBtn: {
    backgroundColor: AppTheme.primary,
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: '48%',
  },
  cardImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: AppTheme.surface,
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: AppTheme.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  cardMeta: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  rentCardFlag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F59E0B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  rentCardFlagText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  rentedCardBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 10,
  },
  rentedCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
