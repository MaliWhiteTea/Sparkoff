import type { Permission, Tab } from '../shared/access';

type NavigationAccess = { user: { role: string }; tabs: Tab[]; permissions: Permission[] };

export function canOpenAdminAnnouncements(me: NavigationAccess): boolean {
  return ['announcements_view', 'announcements_create', 'staff_announcements_view', 'staff_announcements_create']
    .some(permission => me.permissions.includes(permission as Permission));
}

export function canOpenAdminInventory(me: NavigationAccess): boolean {
  return me.tabs.includes('inventory') && me.permissions.includes('inventory_view');
}

export function canOpenAdmin(me: NavigationAccess): boolean {
  return me.user.role === 'super_admin' || me.tabs.includes('board') || me.tabs.includes('members') ||
    canOpenAdminInventory(me) || canOpenAdminAnnouncements(me) ||
    ['feedback_view', 'workshop_settings_update', 'audit_logs_view', 'privacy_settings_update', 'system_settings_update']
      .some(permission => me.permissions.includes(permission as Permission));
}

export function firstAdminRoute(me: NavigationAccess): string {
  if (me.user.role === 'super_admin') return '/admin/overview';
  if (me.tabs.includes('members')) return '/admin/members';
  if (canOpenAdminAnnouncements(me)) return '/admin/announce';
  if (me.permissions.includes('feedback_view')) return '/admin/feedback';
  if (me.permissions.includes('workshop_settings_update')) return '/admin/workshop';
  if (me.permissions.includes('privacy_settings_update')) return '/admin/privacy';
  if (me.permissions.includes('system_settings_update')) return '/admin/booking-settings';
  if (me.permissions.includes('audit_logs_view')) return '/admin/system';
  if (me.tabs.includes('board')) return '/admin/overview';
  if (canOpenAdminInventory(me)) return '/admin/inventory';
  return '/admin/overview';
}
