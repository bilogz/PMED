const MainRoutes = {
  path: '/main',
  meta: {
    requiresAuth: true
  },
  redirect: '/dashboard/default',
  component: () => import('@/layouts/full/FullLayout.vue'),
  children: [
    {
      name: 'Default',
      path: '/dashboard/default',
      component: () => import('@/views/dashboards/default/DefaultDashboard.vue')
    },
    {
      name: 'Patients Database',
      path: '/modules/patients',
      component: () => import('@/views/admin/modules/PatientsDatabasePage.vue')
    },
    {
      name: 'Registration',
      path: '/modules/registration',
      component: () => import('@/views/admin/modules/RegistrationPage.vue')
    },
    {
      name: 'Walk-In',
      path: '/modules/walk-in',
      component: () => import('@/views/admin/modules/WalkInPage.vue')
    },
    {
      name: 'Check-Up',
      path: '/modules/check-up',
      component: () => import('@/views/admin/modules/CheckUpPage.vue')
    },
    {
      name: 'Laboratory',
      path: '/modules/laboratory',
      component: () => import('@/views/admin/modules/LaboratoryPage.vue')
    },
    {
      name: 'Pharmacy',
      path: '/modules/pharmacy',
      component: () => import('@/views/admin/modules/PharmacyInventoryPage.vue')
    },
    {
      name: 'Mental Health & Addiction',
      path: '/modules/mental-health',
      component: () => import('@/views/admin/modules/MentalHealthAddictionPage.vue')
    },
    {
      name: 'Reports',
      path: '/modules/reports',
      component: () => import('@/views/admin/modules/ReportsPage.vue')
    },
    {
      name: 'Cashier Integration',
      path: '/modules/cashier',
      component: () => import('@/views/admin/modules/CashierIntegrationPage.vue')
    },
    {
      name: 'My Profile',
      path: '/profile',
      component: () => import('@/views/profile/MyProfilePage.vue')
    },
    {
      name: 'Appointments',
      path: '/appointments',
      component: () => import('@/views/appointments/AppointmentsPage.vue')
    }
  ]
};

export default MainRoutes;
