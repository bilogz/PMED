import type { AdminUser } from '@/services/adminAuth';
import type { menu } from '@/layouts/full/vertical-sidebar/sidebarItem';

const DEFAULT_APP_ROUTE = '/pmed/dashboard';

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isSuperAdmin(user: AdminUser | null): boolean {
  if (!user) return false;
  return Boolean(user.isSuperAdmin) || normalize(user.role) === 'admin';
}

export function defaultRouteForUser(user: AdminUser | null): string {
  if (!user) return '/admin/login';
  return DEFAULT_APP_ROUTE;
}

function isRouteAlwaysAllowed(path: string): boolean {
  return (
    path.startsWith('/pmed') ||
    path === '/profile' ||
    path.startsWith('/admin/') ||
    path === '/login' ||
    path === '/register' ||
    path === '/access-denied'
  );
}

export function canAccessPath(user: AdminUser | null, path: string): boolean {
  if (!user) return false;
  if (isRouteAlwaysAllowed(path)) return true;
  return isSuperAdmin(user);
}

function filterMenu(items: menu[], user: AdminUser | null): menu[] {
  return items
    .map((item) => {
      if (item.header || item.divider) return item;
      if (item.children?.length) {
        const children = filterMenu(item.children, user);
        if (!children.length) return null;
        return { ...item, children };
      }
      if (item.to && !canAccessPath(user, item.to)) return null;
      return item;
    })
    .filter(Boolean) as menu[];
}

export function filterSidebarItemsByAccess(items: menu[], user: AdminUser | null): menu[] {
  return filterMenu(items, user);
}
