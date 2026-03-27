// Firestore helpers — copied from ims-main/utils/utils.js (Firebase calls only)
import { db } from '../firebase';
import {
  setDoc, doc, getDoc, collection, getDocs,
  query, where, updateDoc, deleteDoc,
} from 'firebase/firestore';

// ─── Load a single settings doc ────────────────────────────────────────────
export const loadDataSettings = async (uidCollection, category) => {
  try {
    const docRef = doc(db, uidCollection, category);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : {};
  } catch (e) {
    console.error('loadDataSettings', e);
    return {};
  }
};

// ─── Load a collection filtered by date range (year-based subcollections) ──
// Path: /{uidCollection}/data/{category}_{year}/
// Matches web app's loadData in utils/utils.js
export const loadData = async (uidCollection, category, dateSelect) => {
  try {
    const now = new Date();
    const start = dateSelect?.start || `${now.getFullYear()}-01-01`;
    const end = dateSelect?.end || `${now.getFullYear()}-12-31`;

    const startYr = Number(start.substring(0, 4));
    const endYr = Number(end.substring(0, 4));

    let arr = [];
    for (let i = startYr; i <= endYr; i++) {
      const col = collection(db, uidCollection, 'data', `${category}_${i}`);
      const q = query(
        col,
        where('date', '>=', start),
        where('date', '<=', end),
      );
      const snap = await getDocs(q);
      const tmp = snap.docs
        .filter((d) => !d.empty)
        .map((d) => d.data());
      arr = [...arr, ...tmp];
    }
    return arr;
  } catch (e) {
    console.error('loadData', e);
    return [];
  }
};

// ─── Update specific fields on a contract document ─────────────────────────
// Mirrors web's updateContractField in utils/utils.js
export const updateContractField = async (uidCollection, contractId, contractDate, fields) => {
  try {
    const year = String(contractDate || '').substring(0, 4) || String(new Date().getFullYear());
    const docRef = doc(db, uidCollection, 'data', `contracts_${year}`, contractId);
    await updateDoc(docRef, fields);
    return true;
  } catch (e) {
    console.error('updateContractField', e);
    return false;
  }
};

// ─── Load all stock movements (not year-based) ─────────────────────────────
// Path: /{uidCollection}/data/stocks/
export const loadAllStockData = async (uidCollection) => {
  try {
    const col = collection(db, uidCollection, 'data', 'stocks');
    const snap = await getDocs(col);
    return snap.docs.filter(d => !d.empty).map(d => d.data());
  } catch (e) {
    console.error('loadAllStockData', e);
    return [];
  }
};

// ─── Load margins for a year ───────────────────────────────────────────────
// Path: /{uidCollection}/margins/{year}/{month}
export const loadMargins = async (uidCollection, year) => {
  try {
    const col = collection(db, uidCollection, 'margins', String(year));
    const snap = await getDocs(col);
    return snap.docs.filter(d => !d.empty).map(d => d.data());
  } catch (e) {
    console.error('loadMargins', e);
    return [];
  }
};

// ─── Save a month's margin data ────────────────────────────────────────────
export const saveMarginMonth = async (uidCollection, year, monthData) => {
  try {
    const docRef = doc(db, uidCollection, 'margins', String(year), String(monthData.month));
    await setDoc(docRef, monthData, { merge: true });
    return true;
  } catch (e) {
    console.error('saveMarginMonth', e);
    return false;
  }
};

// ─── Save a data document to a year-based subcollection ───────────────────
// Path: /{uidCollection}/data/{category}_{year}/{id}
export const saveDataDoc = async (uidCollection, category, year, id, data) => {
  try {
    const docRef = doc(db, uidCollection, 'data', `${category}_${year}`, id);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (e) {
    console.error('saveDataDoc', e);
    return false;
  }
};

// ─── Delete a data document ────────────────────────────────────────────────
export const deleteDataDoc = async (uidCollection, category, year, id) => {
  try {
    const docRef = doc(db, uidCollection, 'data', `${category}_${year}`, id);
    await deleteDoc(docRef);
    return true;
  } catch (e) {
    console.error('deleteDataDoc', e);
    return false;
  }
};

// ─── Save settings doc ─────────────────────────────────────────────────────
export const saveDataSettings = async (uidCollection, category, data) => {
  try {
    const docRef = doc(db, uidCollection, category);
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (e) {
    console.error('saveDataSettings', e);
    return false;
  }
};
