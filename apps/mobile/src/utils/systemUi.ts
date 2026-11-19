import { NativeModules, Platform, StatusBar } from 'react-native';

const { SystemUi } = NativeModules;

export const SystemUiUtil = {
  /**
   * Enables or disables screenshot & screen recording protection (FLAG_SECURE on Android)
   */
  setSecureScreen(enabled: boolean) {
    if (Platform.OS === 'android') {
      try {
        if (SystemUi && typeof SystemUi.setSecureScreen === 'function') {
          SystemUi.setSecureScreen(enabled);
        }
      } catch (e) {
        // Silently handle if native module not available
      }
    }
  },

  /**
   * Enables or disables full immersive sticky mode (hides/shows status bar and navigation bar)
   */
  setImmersive(enabled: boolean) {
    if (Platform.OS === 'android') {
      try {
        if (SystemUi && typeof SystemUi.setImmersive === 'function') {
          SystemUi.setImmersive(enabled);
        }
      } catch (e) {
        // Silently handle if native module not available
      }
    }
    StatusBar.setHidden(enabled, 'fade');
  },
};
