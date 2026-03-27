import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToastState] = useState({ show: false, text: '', clr: 'success' });

  const setToast = useCallback((t) => {
    setToastState({ ...t, show: true });
    setTimeout(() => setToastState((prev) => ({ ...prev, show: false })), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast, setToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
