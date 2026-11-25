import type { Permission, Tab } from '../shared/access';

type NavigationAccess = { user: { role: string }; tabs: Tab[]; permissions: Permission[] };

export function canOpenAdminAnnouncements(me: NavigationAccess): boolean {
  return ['announcements_view', 'announcements_create', 'staff_announcements_view', 'staff_announcements_create']
    .some(permission => me.permissions.includes(permission as Permission));
}

export function canOpenAdminInventory(me: NavigationAccess): boolean {
  return me.tabs.includes('inventory') && me.permissions.includes('inventory_view');
}

export function canOpenAdminMembers(me: NavigationAccess): boolean {
  return me.tabs.includes('members') && (
    ['users_view', 'roles_view', 'roles_create', 'units_manage'].some(permission => me.permissions.includes(permission as Permission)) ||
    me.permissions.includes('users_create') && me.permissions.includes('roles_assign')
  );
}

export function canOpenAdminPrinters(me: NavigationAccess): boolean {
  return ['printers_view', 'printers_create', 'printers_manage_schedule', 'printers_manage_hours', 'printers_manage_filaments', 'appointments_view']
    .some(permission => me.permissions.includes(permission as Permission));
}

export function canOpenAdmin(me: NavigationAccess): boolean {
  return me.user.role === 'super_admin' || me.tabs.includes('board') || canOpenAdminMembers(me) ||
    canOpenAdminInventory(me) || canOpenAdminAnnouncements(me) || canOpenAdminPrinters(me) ||
    ['feedback_view', 'workshop_settings_update', 'audit_logs_view', 'privacy_settings_update', 'system_settings_update']
      .some(permission => me.permissions.includes(permission as Permission));
}

export function firstAdminRoute(me: NavigationAccess): string {
  if (me.user.role === 'super_admin') return '/admin/overview';
  if (canOpenAdminMembers(me)) return '/admin/members';
  if (canOpenAdminAnnouncements(me)) return '/admin/announce';
  if (me.permissions.includes('feedback_view')) return '/admin/feedback';
  if (me.permissions.includes('workshop_settings_update')) return '/admin/workshop';
  if (me.permissions.includes('privacy_settings_update')) return '/admin/privacy';
  if (me.permissions.includes('system_settings_update')) return '/admin/booking-settings';
  if (me.permissions.includes('audit_logs_view')) return '/admin/system';
  if (canOpenAdminPrinters(me)) return '/admin/printers';
  if (me.tabs.includes('board')) return '/admin/overview';
  if (canOpenAdminInventory(me)) return '/admin/inventory';
  return '/admin/overview';
}
