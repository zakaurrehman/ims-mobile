// Role-based access control hook
// Derives permissions from userTitle (set via Firebase token claims)
// Roles: Admin > Manager > User > Viewer
import { useMemo } from 'react';
import { UserAuth } from '../../contexts/AuthContext';

export function usePermission() {
  const { userTitle } = UserAuth();

  return useMemo(() => {
    const role = (userTitle || 'Viewer').toLowerCase();
    const isAdmin = role === 'admin';
    const isManager = role === 'manager';
    const canEdit = isAdmin || isManager;
    const canDelete = isAdmin;
    return { isAdmin, isManager, canEdit, canDelete, role };
  }, [userTitle]);
}
