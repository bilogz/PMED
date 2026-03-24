import {
  mdiAccountOutline,
  mdiAccountPlusOutline,
  mdiArrowDecisionOutline,
  mdiCalendarClockOutline,
  mdiChartLine,
  mdiChartBoxOutline,
  mdiClipboardTextOutline,
  mdiClipboardCheckOutline,
  mdiCogOutline,
  mdiDatabaseOutline,
  mdiFileChartOutline,
  mdiHospitalBoxOutline,
  mdiLogout,
  mdiViewDashboardOutline
} from '@mdi/js';

export interface menu {
  header?: string;
  title?: string;
  icon?: object | string;
  to?: string;
  action?: string;
  divider?: boolean;
  chip?: string;
  chipColor?: string;
  chipVariant?: string;
  chipIcon?: string;
  children?: menu[];
  disabled?: boolean;
  type?: string;
  subCaption?: string;
}

const sidebarItem: menu[] = [
  { header: 'PMED SYSTEM' },
  {
    title: 'Dashboard',
    icon: mdiViewDashboardOutline,
    to: '/pmed/dashboard'
  },
  { divider: true },
  { header: 'PMED MODULES' },
  {
    title: 'Planning',
    icon: mdiCalendarClockOutline,
    to: '/pmed/planning'
  },
  {
    title: 'Data Collection',
    icon: mdiDatabaseOutline,
    to: '/pmed/data-collection'
  },
  {
    title: 'Monitoring',
    icon: mdiChartLine,
    to: '/pmed/monitoring'
  },
  {
    title: 'Evaluation',
    icon: mdiClipboardTextOutline,
    to: '/pmed/evaluation'
  },
  {
    title: 'Reporting',
    icon: mdiFileChartOutline,
    to: '/pmed/reporting'
  },
  {
    title: 'Enrollment Statistics',
    icon: mdiChartBoxOutline,
    to: '/pmed/enrollment-statistics'
  },
  {
    title: 'Exchange Board',
    icon: mdiArrowDecisionOutline,
    to: '/pmed/exchange-board'
  },
  {
    title: 'COMLAB Verify',
    icon: mdiClipboardCheckOutline,
    to: '/pmed/comlab-report-verification'
  },
  {
    title: 'Clinic Health Reports',
    icon: mdiHospitalBoxOutline,
    to: '/pmed/clinic-health-reports',
    chip: 'Clinic',
    chipColor: 'error',
    chipVariant: 'flat'
  },
  {
    title: 'Request staff (HR)',
    icon: mdiAccountPlusOutline,
    to: '/pmed/hr-staff-request'
  },
  { divider: true },
  { header: 'SYSTEM' },
  {
    title: 'My Profile',
    icon: mdiAccountOutline,
    to: '/profile'
  },
  {
    title: 'Settings',
    icon: mdiCogOutline,
    to: '/profile?tab=preferences'
  },
  {
    title: 'Logout',
    icon: mdiLogout,
    action: 'logout'
  }
];

export default sidebarItem;
