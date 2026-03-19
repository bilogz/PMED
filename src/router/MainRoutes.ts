const PMED_ROUTES = [
  {
    name: 'PMED Dashboard',
    path: '/pmed/dashboard',
    component: () => import('@/views/dashboards/default/DefaultDashboard.vue')
  },
  {
    path: '/pmed',
    redirect: '/pmed/dashboard'
  },
  {
    name: 'PMED Planning',
    path: '/pmed/planning',
    component: () => import('@/views/pmed/PlanningPage.vue'),
    meta: {
      title: 'Planning',
      subtitle: 'What will we do?',
      description: 'Plan activities, schedules, targets, stakeholders, and resources for the PMED workflow.'
    }
  },
  {
    name: 'PMED Data Collection',
    path: '/pmed/data-collection',
    component: () => import('@/views/pmed/DataCollectionPage.vue'),
    meta: {
      title: 'Data Collection',
      subtitle: 'What happened?',
      description: 'Capture clinic activity outputs, forms, attendance/logs, and supporting records for PMED.'
    }
  },
  {
    name: 'PMED Monitoring',
    path: '/pmed/monitoring',
    component: () => import('@/views/pmed/MonitoringPage.vue'),
    meta: {
      title: 'Monitoring',
      subtitle: 'Are we on track?',
      description: 'Track progress, review statuses, and surface issues that may block PMED execution.'
    }
  },
  {
    name: 'PMED Evaluation',
    path: '/pmed/evaluation',
    component: () => import('@/views/pmed/EvaluationPage.vue'),
    meta: {
      title: 'Evaluation',
      subtitle: 'Did we succeed?',
      description: 'Compare targets vs actuals and summarize outcomes for PMED activities.'
    }
  },
  {
    name: 'PMED Reporting',
    path: '/pmed/reporting',
    component: () => import('@/views/pmed/ReportingPage.vue'),
    meta: {
      title: 'Reporting',
      subtitle: 'What are the results?',
      description: 'Generate summary/final reports and stakeholder-ready outputs for the PMED workflow.'
    }
  },
  {
    name: 'PMED Exchange Board',
    path: '/pmed/exchange-board',
    component: () => import('@/views/pmed/ExchangeBoardPage.vue'),
    meta: {
      title: 'Exchange Board',
      subtitle: 'Who is sending what?',
      description: 'Monitor inbound and outbound PMED exchanges across connected departments from one workspace.'
    }
  },
  {
    path: '/pmed/:pmedModule(planning|data-collection|monitoring|evaluation|reporting|exchange-board)/:pathMatch(.*)*',
    redirect: (to: any) => `/pmed/${String(to.params.pmedModule || 'planning')}`
  },
  {
    path: '/pmed/:pathMatch(.*)*',
    redirect: '/pmed/planning'
  }
];

const MainRoutes = {
  path: '/main',
  meta: {
    requiresAuth: true
  },
  redirect: '/pmed/dashboard',
  component: () => import('@/layouts/full/FullLayout.vue'),
  children: [
    {
      path: '/cashier/:pathMatch(.*)*',
      redirect: '/pmed/dashboard'
    },
    {
      path: '/modules/cashier',
      redirect: '/pmed/dashboard'
    },
    ...PMED_ROUTES,
    {
      name: 'My Profile',
      path: '/profile',
      component: () => import('@/views/profile/MyProfilePage.vue')
    }
  ]
};

export default MainRoutes;
