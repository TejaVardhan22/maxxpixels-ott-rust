import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react-native';
import { AppTheme } from '../core/theme';

export type SweetAlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface SweetAlertOptions {
  type?: SweetAlertType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type AlertListener = (options: SweetAlertOptions | null) => void;

class SweetAlertManager {
  private listener: AlertListener | null = null;

  public setListener(listener: AlertListener | null) {
    this.listener = listener;
  }

  public show(options: SweetAlertOptions): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.listener) {
        this.listener({
          ...options,
          onConfirm: () => {
            if (options.onConfirm) options.onConfirm();
            resolve(true);
          },
          onCancel: () => {
            if (options.onCancel) options.onCancel();
            resolve(false);
          },
        });
      } else {
        resolve(false);
      }
    });
  }

  public success(title: string, message?: string, confirmText = 'Great!') {
    return this.show({ type: 'success', title, message, confirmText });
  }

  public error(title: string, message?: string, confirmText = 'Dismiss') {
    return this.show({ type: 'error', title, message, confirmText });
  }

  public warning(title: string, message?: string, confirmText = 'Understood') {
    return this.show({ type: 'warning', title, message, confirmText });
  }

  public info(title: string, message?: string, confirmText = 'OK') {
    return this.show({ type: 'info', title, message, confirmText });
  }

  public confirm(
    title: string,
    message?: string,
    confirmText = 'Yes, Proceed',
    cancelText = 'Cancel'
  ): Promise<boolean> {
    return this.show({
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
    });
  }

  public hide() {
    if (this.listener) {
      this.listener(null);
    }
  }
}

export const SweetAlert = new SweetAlertManager();

export const SweetAlertContainer: React.FC = () => {
  const [currentAlert, setCurrentAlert] = useState<SweetAlertOptions | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SweetAlert.setListener((alert) => {
      if (alert) {
        setCurrentAlert(alert);
        scaleAnim.setValue(0.7);
        opacityAnim.setValue(0);
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 50,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.85,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setCurrentAlert(null);
        });
      }
    });

    return () => {
      SweetAlert.setListener(null);
    };
  }, [scaleAnim, opacityAnim]);

  if (!currentAlert) return null;

  const type = currentAlert.type || 'info';

  const getThemeDetails = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={44} color="#10B981" />,
          accentColor: '#10B981',
          bgGlow: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          btnColor: '#10B981',
        };
      case 'error':
        return {
          icon: <AlertCircle size={44} color="#EF4444" />,
          accentColor: '#EF4444',
          bgGlow: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          btnColor: '#EF4444',
        };
      case 'warning':
      case 'confirm':
        return {
          icon: <AlertTriangle size={44} color="#F59E0B" />,
          accentColor: '#F59E0B',
          bgGlow: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          btnColor: '#F59E0B',
        };
      case 'info':
      default:
        return {
          icon: <Info size={44} color="#3B82F6" />,
          accentColor: '#3B82F6',
          bgGlow: 'rgba(59, 130, 246, 0.12)',
          borderColor: 'rgba(59, 130, 246, 0.3)',
          btnColor: AppTheme.primary,
        };
    }
  };

  const theme = getThemeDetails();

  const handleConfirm = () => {
    const cb = currentAlert.onConfirm;
    SweetAlert.hide();
    if (cb) cb();
  };

  const handleCancel = () => {
    const cb = currentAlert.onCancel;
    SweetAlert.hide();
    if (cb) cb();
  };

  return (
    <Modal transparent visible={!!currentAlert} animationType="none" statusBarTranslucent>
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  borderColor: theme.borderColor,
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              {/* Close Icon Top Right */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleCancel}
                style={styles.closeBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Glowing Icon Header */}
              <View style={[styles.iconCircle, { backgroundColor: theme.bgGlow, borderColor: theme.borderColor }]}>
                {theme.icon}
              </View>

              {/* Content Header */}
              <Text style={styles.titleText}>{currentAlert.title}</Text>
              {currentAlert.message ? (
                <Text style={styles.messageText}>{currentAlert.message}</Text>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {currentAlert.showCancel && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleCancel}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>
                      {currentAlert.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleConfirm}
                  style={[styles.confirmButton, { backgroundColor: theme.btnColor }]}
                >
                  <Text style={styles.confirmButtonText}>
                    {currentAlert.confirmText || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: Math.min(SCREEN_WIDTH - 40, 360),
    backgroundColor: AppTheme.surface,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1.5,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  messageText: {
    color: '#94A3B8',
    fontSize: 13.5,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
