// DateRangeFilter — shared component replacing YearPicker on all data screens
// Supports: Year only | Year + Month | Custom start/end date range
// Matches web's DateRangePicker + MonthSelect behavior
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const pad = n => String(n).padStart(2, '0');
const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

export default function DateRangeFilter({ onFilterChange, initialYear }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear || currentYear);
  const [month, setMonth] = useState(null); // null = all year
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

  const onDateChange = (which, event, date) => {
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
              <Ionicons name="chevron-back" size={18} color="#0366ae" />
            </TouchableOpacity>
            <Text style={styles.yearText}>{year}</Text>
            <TouchableOpacity onPress={() => setYearAndEmit(1)} style={styles.arrowBtn}>
              <Ionicons name="chevron-forward" size={18} color="#0366ae" />
            </TouchableOpacity>
          </View>

          {/* Month chips */}
          <View style={styles.monthsRow}>
            {MONTHS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.monthBtn, month === i && styles.monthBtnActive]}
                onPress={() => selectMonth(i)}
              >
                <Text style={[styles.monthText, month === i && styles.monthTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        /* Custom date range */
        <View style={styles.customRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('start')}>
            <Ionicons name="calendar-outline" size={14} color="#0366ae" />
            <Text style={styles.dateBtnText}>{fmtDate(startDate)}</Text>
          </TouchableOpacity>
          <Text style={styles.dateArrow}>→</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker('end')}>
            <Ionicons name="calendar-outline" size={14} color="#0366ae" />
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
  root: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e3f0fb', paddingBottom: 8 },
  modeRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 8, gap: 8 },
  modeBtn: {
    flex: 1, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#b8ddf8', alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  modeBtnText: { fontSize: 11, fontWeight: '600', color: '#0366ae' },
  modeBtnTextActive: { color: '#fff' },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 16 },
  arrowBtn: { padding: 6 },
  yearText: { fontSize: 16, fontWeight: '700', color: '#103a7a', minWidth: 50, textAlign: 'center' },
  monthsRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, marginTop: 6, gap: 6 },
  monthBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#b8ddf8',
  },
  monthBtnActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  monthText: { fontSize: 10, fontWeight: '600', color: '#0366ae' },
  monthTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10, gap: 8 },
  dateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0f8ff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  dateBtnText: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  dateArrow: { fontSize: 16, color: '#9fb8d4' },
  pickerModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  pickerInner: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e3f0fb',
  },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#103a7a' },
  pickerDone: { fontSize: 15, fontWeight: '700', color: '#0366ae' },
});
