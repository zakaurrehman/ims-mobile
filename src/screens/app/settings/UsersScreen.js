// Users Management — matches web's settings/tabs/users.js (Admin only)
// Shows all users for the uidCollection, with display name, email, title, last login
// Supports: edit role, disable/enable account, delete user
import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Modal, TextInput, Alert, ScrollView,
  Switch, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserAuth } from '../../../contexts/AuthContext';
import { loadDataSettings, saveDataSettings } from '../../../shared/utils/firestore';
import { SETTINGS_DOCS } from '../../../constants/collections';
import { usePermission } from '../../../shared/hooks/usePermission';
import { useToast } from '../../../contexts/ToastContext';
import { hapticSuccess, hapticWarning } from '../../../shared/utils/haptics';
import AppHeader from '../../../components/AppHeader';
import Spinner from '../../../components/Spinner';
import ErrorState from '../../../components/ErrorState';

const TITLES = ['Admin', 'Manager', 'User', 'Viewer'];

export default function UsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { uidCollection, userTitle } = UserAuth();
  const { canEdit } = usePermission();
  const { setToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (userTitle && userTitle !== 'Admin') {
      Alert.alert('Access Denied', 'Only administrators can manage users.');
      navigation.goBack();
    }
  }, [userTitle]);

  const loadUsers = async () => {
    if (!uidCollection) return;
    try {
      setError(null);
      const data = await loadDataSettings(uidCollection, SETTINGS_DOCS.USERS);
      const arr = Object.entries(data || {}).map(([id, val]) => ({ id, ...val }));
      setUsers(arr);
    } catch (e) {
      console.error('UsersScreen:', e);
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(); }, [uidCollection]);

  const onRefresh = () => { setRefreshing(true); loadUsers(); };

  const persistUsers = async (updatedList) => {
    const obj = Object.fromEntries(updatedList.map(({ id, ...rest }) => [id, rest]));
    await saveDataSettings(uidCollection, SETTINGS_DOCS.USERS, obj);
  };

  const handleSaveUser = async () => {
    if (!editUser?.id) return;
    setSaving(true);
    try {
      const updated = users.map(u => u.id === editUser.id ? { ...u, displayName: editUser.displayName || '', title: editUser.title || 'User' } : u);
      await persistUsers(updated);
      setUsers(updated);
      setEditUser(null);
      hapticSuccess();
      setToast({ text: 'User updated.', clr: 'success' });
    } catch (e) {
      hapticWarning();
      setToast({ text: 'Failed to update user.', clr: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (user) => {
    try {
      const newDisabled = !user.disabled;
      const updated = users.map(u => u.id === user.id ? { ...u, disabled: newDisabled } : u);
      await persistUsers(updated);
      setUsers(updated);
      hapticSuccess();
      setToast({ text: newDisabled ? 'User disabled.' : 'User enabled.', clr: 'success' });
    } catch (e) {
      hapticWarning();
      setToast({ text: 'Failed to update user.', clr: 'error' });
    }
  };

  const handleDelete = (user) => {
    Alert.alert('Delete User', `Remove "${user.displayName || user.email}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const updated = users.filter(u => u.id !== user.id);
            await persistUsers(updated);
            setUsers(updated);
            hapticSuccess();
            setToast({ text: 'User removed.', clr: 'success' });
          } catch (e) {
            hapticWarning();
            setToast({ text: 'Failed to delete user.', clr: 'error' });
          }
        },
      },
    ]);
  };

  const fmtDate = ts => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleDateString(); }
    catch { return '—'; }
  };

  const renderUser = ({ item }) => (
    <View style={[styles.card, item.disabled && styles.cardDisabled]}>
      <View style={[styles.avatar, item.disabled && styles.avatarDisabled]}>
        <Text style={styles.avatarText}>
          {(item.displayName || item.email || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.displayName || 'No name'}</Text>
        <Text style={styles.email}>{item.email || ''}</Text>
        <View style={styles.tagRow}>
          <View style={styles.titleTag}>
            <Text style={styles.titleTagText}>{item.title || 'User'}</Text>
          </View>
          {item.disabled && (
            <View style={styles.disabledTag}>
              <Text style={styles.disabledTagText}>Disabled</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta}>Last login: {fmtDate(item.lastLogedIn)}</Text>
      </View>
      {canEdit && (
        <View style={styles.rowActions}>
          <Switch
            value={!item.disabled}
            onValueChange={() => handleToggleDisabled(item)}
            trackColor={{ false: '#fca5a5', true: '#86efac' }}
            thumbColor={item.disabled ? '#dc2626' : '#16a34a'}
            style={styles.toggle}
          />
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditUser({ ...item })}>
            <Ionicons name="pencil-outline" size={16} color="#0366ae" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); loadUsers(); }} />;
  if (!loading && users.length === 0) return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="User Management" navigation={navigation} showBack />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <Ionicons name="people-outline" size={48} color="#b8ddf8" />
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#103a7a', marginTop: 16, textAlign: 'center' }}>User Management</Text>
        <Text style={{ fontSize: 13, color: '#9fb8d4', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          User management requires server-side access and is only available on the web app.{'\n\n'}Please use the web portal to manage users.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <AppHeader title="User Management" navigation={navigation} showBack />

      <FlatList
        data={users}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        keyExtractor={(item, i) => item.id || String(i)}
        renderItem={renderUser}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No users found</Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0366ae" />
        }
      />

      {/* Edit User Modal */}
      <Modal visible={!!editUser} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={() => setEditUser(null)}>
                <Ionicons name="close" size={22} color="#103a7a" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.emailDisplay}>{editUser?.email || ''}</Text>

              <Text style={styles.fieldLabel}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={editUser?.displayName || ''}
                onChangeText={v => setEditUser(p => ({ ...p, displayName: v }))}
                placeholder="Full name"
                placeholderTextColor="#b8ddf8"
              />

              <Text style={styles.fieldLabel}>Role / Title</Text>
              <View style={styles.titlesRow}>
                {TITLES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.titleBtn, editUser?.title === t && styles.titleBtnActive]}
                    onPress={() => setEditUser(p => ({ ...p, title: t }))}
                  >
                    <Text style={[styles.titleBtnText, editUser?.title === t && styles.titleBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveUser}
                disabled={saving}
              >
                {saving
                  ? null
                  : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f8ff' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#b8ddf8',
    padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  cardDisabled: { opacity: 0.6, borderColor: '#fca5a5' },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0366ae',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarDisabled: { backgroundColor: '#9ca3af' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '700', color: '#103a7a' },
  email: { fontSize: 12, color: '#9fb8d4' },
  tagRow: { flexDirection: 'row', marginTop: 4, gap: 6 },
  titleTag: { backgroundColor: '#ebf2fc', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  titleTagText: { fontSize: 10, fontWeight: '700', color: '#0366ae' },
  disabledTag: { backgroundColor: '#fef2f2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  disabledTagText: { fontSize: 10, fontWeight: '700', color: '#dc2626' },
  meta: { fontSize: 10, color: '#b8ddf8', marginTop: 2 },
  rowActions: { alignItems: 'center', gap: 6 },
  toggle: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  editBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#ebf2fc', justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#9fb8d4', marginTop: 40, fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#e3f0fb',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#103a7a' },
  modalBody: { padding: 20, gap: 12, paddingBottom: 32 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#103a7a', textTransform: 'uppercase' },
  emailDisplay: { fontSize: 14, color: '#9fb8d4', marginBottom: 4 },
  input: {
    backgroundColor: '#f7fbff', borderWidth: 1, borderColor: '#b8ddf8',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#103a7a',
  },
  titlesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  titleBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: '#b8ddf8', backgroundColor: '#f0f8ff',
  },
  titleBtnActive: { backgroundColor: '#0366ae', borderColor: '#0366ae' },
  titleBtnText: { fontSize: 12, fontWeight: '600', color: '#0366ae' },
  titleBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#0366ae', borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
