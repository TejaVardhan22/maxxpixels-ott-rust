import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ToastAndroid,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { AppTheme } from '../core/theme';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  position?: 'top' | 'bottom';
}

type ToastListener = (options: ToastOptions | null) => void;

class ToastManager {
  private listener: ToastListener | null = null;

  public setListener(listener: ToastListener | null) {
    this.listener = listener;
  }

  public show(messageOrOptions: string | ToastOptions, type: ToastType = 'info', duration = 3000) {
    const options: ToastOptions =
      typeof messageOrOptions === 'string'
        ? { message: messageOrOptions, type, duration }
        : { type: 'info', duration: 3000, ...messageOrOptions };

    // Also trigger Android native toast if on Android
    if (Platform.OS === 'android') {
      try {
        const text = options.title ? `${options.title}: ${options.message}` : options.message;
        ToastAndroid.show(text, options.duration && options.duration > 3000 ? ToastAndroid.LONG : ToastAndroid.SHORT);
      } catch (e) {
        // ignore fallback error
      }
    }

    if (this.listener) {
      this.listener(options);
    }
  }

  public success(message: string, title?: string, duration = 3000) {
    this.show({ message, title, type: 'success', duration });
  }

  public error(message: string, title?: string, duration = 3500) {
    this.show({ message, title, type: 'error', duration });
  }

  public warning(message: string, title?: string, duration = 3000) {
    this.show({ message, title, type: 'warning', duration });
  }

  public info(message: string, title?: string, duration = 3000) {
    this.show({ message, title, type: 'info', duration });
  }

  public hide() {
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const Toast = new ToastManager();

export const ToastContainer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastOptions | null>(null);

  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Toast.setListener((newToast) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!newToast) {
        dismissToast();
        return;
      }

      setToast(newToast);

      // Animate in
      translateY.setValue(newToast.position === 'bottom' ? 100 : -100);
      opacity.setValue(0);
      scale.setValue(0.9);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 90,
          friction: 8,
        }),
      ]).start();

      const duration = newToast.duration || 3000;
      timerRef.current = setTimeout(() => {
        dismissToast();
      }, duration);
    });

    return () => {
      Toast.setListener(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dismissToast = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const isBottom = toast?.position === 'bottom';

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isBottom ? 100 : -100,
        duration: 200,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  };

  if (!toast) return null;

  const getThemeConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: '#0F291E',
          border: '#10B981',
          accent: '#10B981',
          Icon: CheckCircle2,
        };
      case 'error':
        return {
          bg: '#2C1217',
          border: '#EF4444',
          accent: '#EF4444',
          Icon: AlertCircle,
        };
      case 'warning':
        return {
          bg: '#2D230C',
          border: '#F59E0B',
          accent: '#F59E0B',
          Icon: AlertTriangle,
        };
      case 'info':
      default:
        return {
          bg: '#0E1E38',
          border: '#3B82F6',
          accent: '#3B82F6',
          Icon: Info,
        };
    }
  };

  const themeConfig = getThemeConfig();
  const IconComponent = themeConfig.Icon;
  const isBottom = toast.position === 'bottom';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        isBottom
          ? { bottom: Math.max(insets.bottom + 20, 30) }
          : { top: Math.max(insets.top + 10, 20) },
      ]}
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: themeConfig.bg,
            borderColor: themeConfig.border,
            transform: [{ translateY }, { scale }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={dismissToast}
          style={styles.innerContent}
        >
          <View style={[styles.iconContainer, { backgroundColor: themeConfig.accent + '22' }]}>
            <IconComponent size={20} color={themeConfig.accent} />
          </View>

          <View style={styles.textContainer}>
            {!!toast.title && <Text style={styles.titleText}>{toast.title}</Text>}
            <Text style={styles.messageText} numberOfLines={3}>
              {toast.message}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={dismissToast}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={16} color="#94A3B8" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  container: {
    width: width - 32,
    maxWidth: 480,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
});
