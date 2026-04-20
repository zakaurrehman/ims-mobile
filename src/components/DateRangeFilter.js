// DateRangeFilter — shared component replacing YearPicker on all data screens
// Supports: Year only | Year + Month | Custom start/end date range
// Matches web's DateRangePicker + MonthSelect behavior
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radius, space } from '../theme/spacing';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function DateRangeFilter({ onFilterChange, initialYear }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear || currentYear);
  const [month, setMonth] = useState(null);
  const [mode, setMode] = useState('year'); // 'year' | 'month' | 'custom'
  const [startDate, setStartDate] = useState(new Date(currentYear, 0, 1));
  const [endDate, setEndDate] = useState(new Date(currentYear, 11, 31));
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end'

  const emit = ({ y = year, m = month, md = mode, sd = startDate, ed = endDate }) => {
    let start, end;
    if (md === 'custom') {
      start = fmtDate(sd);
      end = fmtDate(ed);
    } else if (md === 'month' && m !== null) {
      const lastDay = new Date(y, m + 1, 0).getDate();
      start = `${y}-${pad(m + 1)}-01`;
      end = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    } else {
      start = `${y}-01-01`;
      end = `${y}-12-31`;
    }
    onFilterChange?.({ year: y, month: m, startDate: start, endDate: end });
  };

  const setYearAndEmit = delta => {
    const ny = year + delta;
    setYear(ny);
    setMonth(null);
    emit({ y: ny, m: null, md: mode });
  };

  const selectMonth = m => {
    const nm = month === m ? null : m;
    setMonth(nm);
    emit({ m: nm, md: nm !== null ? 'month' : 'year' });
    if (nm !== null) setMode('month'); else setMode('year');
  };

  const switchMode = md => {
    setMode(md);
    setMonth(null);
    emit({ md, m: null });
  };

  const onDateChange = (which, _event, date) => {
    if (Platform.OS === 'android') setShowPicker(null);
    if (!date) return;
    if (which === 'start') {
      setStartDate(date);
      emit({ md: 'custom', sd: date, ed: endDate });
    } else {
      setEndDate(date);
      emit({ md: 'custom', sd: startDate, ed: date });
    }
  };

  return (
    <View style={styles.root}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        {['year', 'custom'].map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            onPress={() => switchMode(m)}
          >
            <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
              {m === 'year' ? 'Year / Month' : 'Custom Range'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode !== 'custom' ? (
        <>
          {/* Year selector */}
          <View style={styles.yearRow}>
            <TouchableOpacity onPress={() => setYearAndEmit(-1)} style={styles.arrowBtn}>
              <Feather name="chevron-left" size={18} color={colors.accent} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{year}</Text>
            <TouchableOpacity onPress={() => setYearAndEmit(1)} style={styles.arrowBtn}>
              <Feather name="chevron-right" size={18} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Month chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.monthsRow}
          >
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthBtn, month === i && styles.monthBtnActive]}
                onPress={() => selectMonth(i)}
              >
                <Text style={[styles.monthText, month === i && styles.monthTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : (
        /* Custom date range */
        <View style={styles.customRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('start')}>
            <Feather name="calendar" size={14} color={colors.accent} />
            <Text style={styles.dateBtnText}>{fmtDate(startDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateArrow}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('end')}>
            <Feather name="calendar" size={14} color={colors.accent} />
            <Text style={styles.dateBtnText}>{fmtDate(endDate)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Date picker (Android: inline; iOS: modal) */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={showPicker === 'start' ? startDate : endDate}
          mode="date"
          display="default"
          onChange={(e, d) => onDateChange(showPicker, e, d)}
        />
      )}
      {showPicker && Platform.OS === 'ios' && (
        <Modal transparent animationType="slide">
          <View style={styles.pickerModal}>
            <View style={styles.pickerInner}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {showPicker === 'start' ? 'Start Date' : 'End Date'}
                </Text>
                <TouchableOpacity onPress={() => setShowPicker(null)}>
                  <Text style={styles.pickerDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={showPicker === 'start' ? startDate : endDate}
                mode="date"
                display="spinner"
                onChange={(e, d) => onDateChange(showPicker, e, d)}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
    paddingBottom: space.sm,
  },
  modeRow: {
    flexDirection: 'row',
    marginHorizontal: space.md,
    marginTop: space.sm,
    gap: space.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border1,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text2,
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
    gap: space.lg,
  },
  arrowBtn: {
    padding: 6,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
    minWidth: 50,
    textAlign: 'center',
  },
  monthsRow: {
    flexDirection: 'row',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  monthBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border1,
  },
  monthBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  monthText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text2,
  },
  monthTextActive: {
    color: '#fff',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.md,
    marginTop: space.md,
    gap: space.sm,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg3,
    borderWidth: 1,
    borderColor: colors.border1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  dateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text1,
  },
  dateArrow: {
    fontSize: 16,
    color: colors.text3,
  },
  pickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  pickerInner: {
    backgroundColor: colors.bg2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border1,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  pickerDone: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
});
