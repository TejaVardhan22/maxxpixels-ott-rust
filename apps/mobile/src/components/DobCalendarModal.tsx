import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  AlertCircle,
} from 'lucide-react-native';
import { AppTheme } from '../core/theme';

interface DobCalendarModalProps {
  visible: boolean;
  initialDate?: string; // Format: YYYY-MM-DD
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  minAge?: number; // default 18
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS_HEADER = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DobCalendarModal: React.FC<DobCalendarModalProps> = ({
  visible,
  initialDate,
  onClose,
  onSelectDate,
  minAge = 18,
}) => {
  const today = useMemo(() => new Date(), []);
  const maxYear = today.getFullYear() - minAge;
  const minYear = today.getFullYear() - 100;

  // Initialize selected year, month, day
  const [selectedYear, setSelectedYear] = useState<number>(maxYear - 5);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0-indexed (Jan = 0)
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'calendar' | 'year' | 'month'>('calendar');

  useEffect(() => {
    if (visible) {
      if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
        const [y, m, d] = initialDate.split('-').map(Number);
        if (y >= minYear && y <= maxYear && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          setSelectedYear(y);
          setSelectedMonth(m - 1);
          setSelectedDay(d);
          setViewMode('calendar');
          return;
        }
      }
      // Default to 25 years old if no date provided
      setSelectedYear(today.getFullYear() - 25);
      setSelectedMonth(today.getMonth());
      setSelectedDay(15);
      setViewMode('calendar');
    }
  }, [visible, initialDate, maxYear, minYear, today]);

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // First day of selected month (0 = Sunday, 1 = Monday, ...)
  const firstDayOfMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 1).getDay();
  }, [selectedYear, selectedMonth]);

  // Generate Year Range (from maxYear down to minYear)
  const yearsList = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [maxYear, minYear]);

  // Calculate Age dynamically
  const computedAge = useMemo(() => {
    let age = today.getFullYear() - selectedYear;
    const m = today.getMonth() - selectedMonth;
    if (m < 0 || (m === 0 && today.getDate() < selectedDay)) {
      age--;
    }
    return age;
  }, [today, selectedYear, selectedMonth, selectedDay]);

  const isValidAge = computedAge >= minAge;

  const formattedDateStr = useMemo(() => {
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(Math.min(selectedDay, daysInMonth)).padStart(2, '0');
    return `${selectedYear}-${mm}-${dd}`;
  }, [selectedYear, selectedMonth, selectedDay, daysInMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      if (selectedYear > minYear) {
        setSelectedYear(selectedYear - 1);
        setSelectedMonth(11);
      }
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      if (selectedYear < maxYear) {
        setSelectedYear(selectedYear + 1);
        setSelectedMonth(0);
      }
    } else {
      if (selectedYear === maxYear) {
        // Ensure month doesn't exceed current month if year == maxYear
        const maxEligibleMonth = today.getMonth();
        if (selectedMonth < maxEligibleMonth) {
          setSelectedMonth(selectedMonth + 1);
        }
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const handleDayPress = (dayNum: number) => {
    setSelectedDay(dayNum);
  };

  const handleConfirm = () => {
    if (!isValidAge) return;
    const finalDay = Math.min(selectedDay, daysInMonth);
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const dd = String(finalDay).padStart(2, '0');
    onSelectDate(`${selectedYear}-${mm}-${dd}`);
    onClose();
  };

  // Calendar day cells
  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    // Padding before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }
    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [firstDayOfMonth, daysInMonth]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CalendarIcon size={20} color={AppTheme.primary} />
              <Text style={styles.headerTitle}>Select Date of Birth</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Date Preview & Age Badge */}
          <View style={styles.previewBar}>
            <View>
              <Text style={styles.previewLabel}>Selected Date</Text>
              <Text style={styles.previewDate}>
                {Math.min(selectedDay, daysInMonth)} {MONTH_SHORT[selectedMonth]} {selectedYear}
              </Text>
            </View>

            <View
              style={[
                styles.ageBadge,
                isValidAge ? styles.ageBadgeValid : styles.ageBadgeInvalid,
              ]}
            >
              {isValidAge ? (
                <Text style={styles.ageBadgeText}>{computedAge} Years Old (18+)</Text>
              ) : (
                <View style={styles.ageErrorRow}>
                  <AlertCircle size={12} color="#FF4D4D" />
                  <Text style={styles.ageErrorText}>Must be at least 18</Text>
                </View>
              )}
            </View>
          </View>

          {/* View Mode Selectors: Calendar vs Year vs Month */}
          <View style={styles.modeBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode(viewMode === 'year' ? 'calendar' : 'year')}
              style={[styles.selectorChip, viewMode === 'year' && styles.selectorChipActive]}
            >
              <Text style={[styles.selectorChipText, viewMode === 'year' && styles.selectorChipTextActive]}>
                Year: {selectedYear}
              </Text>
              <ChevronDown size={14} color={viewMode === 'year' ? '#FFFFFF' : '#94A3B8'} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setViewMode(viewMode === 'month' ? 'calendar' : 'month')}
              style={[styles.selectorChip, viewMode === 'month' && styles.selectorChipActive]}
            >
              <Text style={[styles.selectorChipText, viewMode === 'month' && styles.selectorChipTextActive]}>
                Month: {MONTH_SHORT[selectedMonth]}
              </Text>
              <ChevronDown size={14} color={viewMode === 'month' ? '#FFFFFF' : '#94A3B8'} />
            </TouchableOpacity>
          </View>

          {/* VIEW: YEAR SELECTION GRID */}
          {viewMode === 'year' && (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerHeading}>Select Birth Year (1925 - {maxYear})</Text>
              <ScrollView style={styles.yearScroll} showsVerticalScrollIndicator={true}>
                <View style={styles.yearGrid}>
                  {yearsList.map((y) => {
                    const isCurrent = y === selectedYear;
                    return (
                      <TouchableOpacity
                        key={y}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedYear(y);
                          setViewMode('calendar');
                        }}
                        style={[styles.yearGridItem, isCurrent && styles.yearGridItemActive]}
                      >
                        <Text style={[styles.yearGridText, isCurrent && styles.yearGridTextActive]}>
                          {y}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* VIEW: MONTH SELECTION GRID */}
          {viewMode === 'month' && (
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerHeading}>Select Birth Month</Text>
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((mName, idx) => {
                  const isCurrent = idx === selectedMonth;
                  return (
                    <TouchableOpacity
                      key={mName}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedMonth(idx);
                        setViewMode('calendar');
                      }}
                      style={[styles.monthGridItem, isCurrent && styles.monthGridItemActive]}
                    >
                      <Text style={[styles.monthGridText, isCurrent && styles.monthGridTextActive]}>
                        {mName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* VIEW: FULL CALENDAR GRID */}
          {viewMode === 'calendar' && (
            <View style={styles.calendarContainer}>
              {/* Month Navigator Header */}
              <View style={styles.monthNavigator}>
                <TouchableOpacity
                  onPress={handlePrevMonth}
                  style={styles.navArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setViewMode('month')}
                  style={styles.monthNavTitleWrap}
                >
                  <Text style={styles.monthNavTitle}>
                    {MONTH_NAMES[selectedMonth]} {selectedYear}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextMonth}
                  style={styles.navArrowBtn}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Day Headers (Su, Mo, Tu...) */}
              <View style={styles.weekDaysRow}>
                {DAYS_HEADER.map((dName) => (
                  <View key={dName} style={styles.weekDayCell}>
                    <Text style={styles.weekDayText}>{dName}</Text>
                  </View>
                ))}
              </View>

              {/* Day Grid Cells */}
              <View style={styles.daysGrid}>
                {calendarCells.map((dayNum, index) => {
                  if (dayNum === null) {
                    return <View key={`empty-${index}`} style={styles.dayCell} />;
                  }

                  const isSelected = dayNum === selectedDay;
                  // Check if this specific day exceeds max age limit
                  const cellDate = new Date(selectedYear, selectedMonth, dayNum);
                  const cellAgeYears = today.getFullYear() - selectedYear;
                  const isUnderage =
                    cellAgeYears < minAge ||
                    (cellAgeYears === minAge &&
                      (today.getMonth() < selectedMonth ||
                        (today.getMonth() === selectedMonth && today.getDate() < dayNum)));

                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      activeOpacity={0.7}
                      disabled={isUnderage}
                      onPress={() => handleDayPress(dayNum)}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isUnderage && styles.dayCellDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          isSelected && styles.dayCellTextSelected,
                          isUnderage && styles.dayCellTextDisabled,
                        ]}
                      >
                        {dayNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.cancelButton}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!isValidAge}
              style={[
                styles.confirmButton,
                !isValidAge && styles.confirmButtonDisabled,
              ]}
              activeOpacity={0.85}
            >
              <Check size={18} color="#FFFFFF" />
              <Text style={styles.confirmBtnText}>Set Birth Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161622',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#28283A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#252538',
    backgroundColor: '#101018',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 4,
  },
  previewBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: '#202030',
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  previewDate: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ageBadgeValid: {
    backgroundColor: 'rgba(0, 230, 118, 0.15)',
    borderWidth: 1,
    borderColor: '#00E676',
  },
  ageBadgeInvalid: {
    backgroundColor: 'rgba(255, 77, 77, 0.15)',
    borderWidth: 1,
    borderColor: '#FF4D4D',
  },
  ageBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00E676',
  },
  ageErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ageErrorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF4D4D',
  },
  modeBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#12121C',
  },
  selectorChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1E1E2E',
    borderWidth: 1,
    borderColor: '#2D2D42',
  },
  selectorChipActive: {
    backgroundColor: AppTheme.primary,
    borderColor: AppTheme.primary,
  },
  selectorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  selectorChipTextActive: {
    color: '#FFFFFF',
  },
  calendarContainer: {
    padding: 16,
  },
  monthNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1F1F30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthNavTitleWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  monthNavTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: AppTheme.primary,
  },
  dayCellDisabled: {
    opacity: 0.25,
  },
  dayCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dayCellTextDisabled: {
    color: '#64748B',
  },
  pickerContainer: {
    height: 270,
    padding: 16,
  },
  pickerHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 12,
    textAlign: 'center',
  },
  yearScroll: {
    flex: 1,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  yearGridItem: {
    width: '30%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D42',
  },
  yearGridItemActive: {
    backgroundColor: AppTheme.primary,
    borderColor: AppTheme.primary,
  },
  yearGridText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  yearGridTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  monthGridItem: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1E1E2E',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D42',
  },
  monthGridItemActive: {
    backgroundColor: AppTheme.primary,
    borderColor: AppTheme.primary,
  },
  monthGridText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  monthGridTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#252538',
    backgroundColor: '#101018',
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1F1F30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  confirmButton: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    backgroundColor: AppTheme.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
