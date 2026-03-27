// Adapted from ims-main/contexts/useAuthContext.js
// Removed: useRouter, usePathname (Next.js) — navigation handled by React Navigation
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../shared/firebase';
import { loadDataSettings } from '../shared/utils/firestore';
import { usePushNotifications } from '../shared/hooks/usePushNotifications';

const AuthContext = createContext();

export const AuthContextProvider = ({ children, onAuthReady }) => {
  const [user, setUser] = useState(undefined);
  const [err, setErr] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [uidCollection, setUidCollection] = useState(null);
  const [userTitle, setUserTitle] = useState(null);
  const [compData, setCompData] = useState({});
  const [settings, setSettings] = useState({});

  const gisAccount = uidCollection === 'aB3dE7FgHi9JkLmNoPqRsTuVwGIS';

  const createUser = async (email, password) => {
    try {
      setErr(null);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      return true;
    } catch (error) {
      setErr(error.message);
      throw error;
    }
  };

  const SignIn = async (email, password) => {
    try {
      setErr(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      return true;
    } catch (error) {
      setErr(error.message);
      return false;
    }
  };

  const SignOut = async () => {
    setUser(null);
    setUidCollection(null);
    setUserTitle(null);
    setCompData({});
    setSettings({});
    await signOut(auth).catch(() => {});
  };

  // Watch Firebase auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Get uidCollection + userTitle from token claims
  useEffect(() => {
    const getUidCollection = async () => {
      try {
        if (!user) {
          setUidCollection(null);
          setUserTitle(null);
          return;
        }
        const idTokenResult = await auth.currentUser.getIdTokenResult();
        setUidCollection(idTokenResult.claims.uidCollection);
        setUserTitle(idTokenResult.claims.title);
      } catch (error) {
        setUidCollection(null);
        setUserTitle(null);
      }
    };
    getUidCollection();
  }, [user]);

  // Load company + settings data once uidCollection is known
  useEffect(() => {
    const loadAppData = async () => {
      if (!uidCollection) return;
      const cmp = await loadDataSettings(uidCollection, 'cmpnyData');
      setCompData(cmp);
      const st = await loadDataSettings(uidCollection, 'settings');
      setSettings(st);
    };
    loadAppData();
  }, [uidCollection]);

  // Register push notifications once logged in
  usePushNotifications(uidCollection, user?.uid);

  // Stop loading spinner once auth + uidCollection resolved
  useEffect(() => {
    if (user === undefined) return;
    if (user && !uidCollection) return;
    setLoadingPage(false);
    if (onAuthReady) onAuthReady(!!user);
  }, [user, uidCollection]);

  return (
    <AuthContext.Provider
      value={{
        user, SignIn, SignOut, createUser, err, setErr,
        loadingPage, uidCollection, gisAccount, userTitle,
        compData, setCompData, settings, setSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const UserAuth = () => useContext(AuthContext);
