/* eslint-env jest */
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(),
  initializeApp: jest.fn(),
}));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({
    onMessage: jest.fn(() => jest.fn()),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    getToken: jest.fn(() => Promise.resolve('mock-token')),
  })),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-razorpay', () => ({
  open: jest.fn(),
}));
jest.mock('react-native-google-mobile-ads', () => {
  const mockMobileAds = () => ({
    initialize: jest.fn(() => Promise.resolve([])),
    setRequestConfiguration: jest.fn(() => Promise.resolve()),
  });
  return {
    __esModule: true,
    default: mockMobileAds,
    BannerAd: () => null,
    BannerAdSize: {
      ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
      BANNER: 'BANNER',
      FULL_BANNER: 'FULL_BANNER',
      LARGE_BANNER: 'LARGE_BANNER',
      MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
    },
    TestIds: {
      BANNER: 'ca-app-pub-3940256099942544/6300978111',
      ADAPTIVE_BANNER: 'ca-app-pub-3940256099942544/9214589741',
      INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
      REWARDED: 'ca-app-pub-3940256099942544/5224354917',
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => ({
        load: jest.fn(),
        show: jest.fn(() => Promise.resolve()),
        addAdEventListener: jest.fn(() => jest.fn()),
        loaded: false,
      })),
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => ({
        load: jest.fn(),
        show: jest.fn(() => Promise.resolve()),
        addAdEventListener: jest.fn(() => jest.fn()),
        loaded: false,
      })),
    },
    AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed', OPENED: 'opened' },
    RewardedAdEventType: { LOADED: 'loaded', EARNED_REWARD: 'earned_reward' },
    MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
  };
});

