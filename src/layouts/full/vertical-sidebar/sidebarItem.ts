import {
  mdiAccountOutline,
  mdiArrowDecisionOutline,
  mdiCalendarClockOutline,
  mdiChartLine,
  mdiClipboardTextOutline,
  mdiCogOutline,
  mdiDatabaseOutline,
  mdiFileChartOutline,
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
    title: 'Exchange Board',
    icon: mdiArrowDecisionOutline,
    to: '/pmed/exchange-board'
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
