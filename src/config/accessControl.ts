import type { AdminUser } from '@/services/adminAuth';
import type { menu } from '@/layouts/full/vertical-sidebar/sidebarItem';

type ModuleKey =
  | 'appointments'
  | 'patients'
  | 'registration'
  | 'walkin'
  | 'checkup'
  | 'laboratory'
  | 'pharmacy'
  | 'mental_health'
  | 'reports';

const MODULE_ROUTE_MAP: Record<ModuleKey, string> = {
  appointments: '/appointments',
  patients: '/modules/patients',
  registration: '/modules/registration',
  walkin: '/modules/walk-in',
  checkup: '/modules/check-up',
  laboratory: '/modules/laboratory',
  pharmacy: '/modules/pharmacy',
  mental_health: '/modules/mental-health',
  reports: '/modules/reports'
};

const DEPARTMENT_MODULE_MAP: Array<{ matcher: RegExp; module: ModuleKey }> = [
  { matcher: /teacher|student|faculty|adviser/i, module: 'appointments' },
  { matcher: /appoint/i, module: 'appointments' },
  { matcher: /patient/i, module: 'patients' },
  { matcher: /registr/i, module: 'registration' },
  { matcher: /walk[\s-]*in/i, module: 'walkin' },
  { matcher: /check[\s-]*up/i, module: 'checkup' },
  { matcher: /laboratory|lab\b/i, module: 'laboratory' },
  { matcher: /pharmacy/i, module: 'pharmacy' },
  { matcher: /mental/i, module: 'mental_health' },
  { matcher: /report|finance/i, module: 'reports' }
];

const ROLE_MODULE_MAP: Array<{ matcher: RegExp; module: ModuleKey }> = [
  { matcher: /teacher|student|faculty|adviser/i, module: 'appointments' },
  { matcher: /appoint/i, module: 'appointments' },
  { matcher: /records|patient/i, module: 'patients' },
  { matcher: /registr/i, module: 'registration' },
  { matcher: /walk[\s-]*in/i, module: 'walkin' },
  { matcher: /check[\s-]*up|doctor/i, module: 'checkup' },
  { matcher: /lab/i, module: 'laboratory' },
  { matcher: /pharma/i, module: 'pharmacy' },
  { matcher: /mental|counsel/i, module: 'mental_health' },
  { matcher: /report|analyst|finance/i, module: 'reports' }
];

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeModuleName(value: string): ModuleKey | null {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw === 'appointments' || raw === 'appointment') return 'appointments';
  if (raw === 'patients' || raw === 'patient' || raw === 'patients_database') return 'patients';
  if (raw === 'registration' || raw === 'registrations') return 'registration';
  if (raw === 'walkin' || raw === 'walk-in' || raw === 'walk_in') return 'walkin';
  if (raw === 'checkup' || raw === 'check-up' || raw === 'check_up') return 'checkup';
  if (raw === 'laboratory' || raw === 'lab') return 'laboratory';
  if (raw === 'pharmacy' || raw === 'pharmacy_inventory' || raw === 'pharmacy-inventory') return 'pharmacy';
  if (raw === 'mental_health' || raw === 'mental-health' || raw === 'mentalhealth') return 'mental_health';
  if (raw === 'reports' || raw === 'report') return 'reports';
  return null;
}

function isSuperAdmin(user: AdminUser | null): boolean {
  if (!user) return false;
  return Boolean(user.isSuperAdmin) || normalize(user.role) === 'admin';
}

export function resolveModuleForUser(user: AdminUser | null): ModuleKey | null {
  if (!user) return null;
  if (isSuperAdmin(user)) return null;

  const department = String(user.department || '');
  for (const entry of DEPARTMENT_MODULE_MAP) {
    if (entry.matcher.test(department)) return entry.module;
  }

  const role = String(user.role || '');
  for (const entry of ROLE_MODULE_MAP) {
    if (entry.matcher.test(role)) return entry.module;
  }
  return null;
}

export function resolveAllowedModulesForUser(user: AdminUser | null): ModuleKey[] {
  if (!user) return [];
  if (isSuperAdmin(user)) return Object.keys(MODULE_ROUTE_MAP) as ModuleKey[];

  const allowed = new Set<ModuleKey>();
  const base = resolveModuleForUser(user);
  if (base) allowed.add(base);

  const exemptions = Array.isArray(user.accessExemptions) ? user.accessExemptions : [];
  exemptions.forEach((entry) => {
    const normalized = normalizeModuleName(entry);
    if (normalized) allowed.add(normalized);
  });

  if (!allowed.size) return ['appointments'];
  return Array.from(allowed);
}

export function defaultRouteForUser(user: AdminUser | null): string {
  if (!user) return '/admin/login';
  if (isSuperAdmin(user)) return '/dashboard/default';
  const modules = resolveAllowedModulesForUser(user);
  if (!modules.length) return '/appointments';
  return MODULE_ROUTE_MAP[modules[0]];
}

export function allowedModuleRoutesForUser(user: AdminUser | null): string[] {
  if (!user) return [];
  if (isSuperAdmin(user)) return Object.values(MODULE_ROUTE_MAP);
  const modules = resolveAllowedModulesForUser(user);
  return modules.map((module) => MODULE_ROUTE_MAP[module]);
}

function isRouteAlwaysAllowed(path: string): boolean {
  return (
    path === '/dashboard/default' ||
    path === '/profile' ||
    path.startsWith('/admin/') ||
    path === '/login' ||
    path === '/register' ||
    path === '/access-denied'
  );
}

export function canAccessPath(user: AdminUser | null, path: string): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  if (isRouteAlwaysAllowed(path)) return true;

  const allowedRoutes = allowedModuleRoutesForUser(user);
  return allowedRoutes.some((route) => path === route || path.startsWith(`${route}/`));
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
