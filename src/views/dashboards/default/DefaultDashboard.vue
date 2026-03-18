<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { fetchClinicDashboard, type ClinicDashboardPayload } from '@/services/clinicDashboard';
import { useRealtimeListSync } from '@/composables/useRealtimeListSync';
import { REALTIME_POLICY } from '@/config/realtimePolicy';
import {
  appointmentBookingRoleColor,
  appointmentBookingRoleLabel,
  fetchAppointmentMonitor,
  type AppointmentMonitorRow,
  type AppointmentMonitorSummary
} from '@/services/appointmentMonitor';

const loading = ref(false);
const loadError = ref('');
const viewActive = ref(true);
const realtime = useRealtimeListSync();
const monitorSummary = ref<AppointmentMonitorSummary>({
  totalAppointments: 0,
  studentAppointed: 0,
  teacherAppointed: 0,
  fullyAppointed: 0,
  unassigned: 0
});
const monitorByBookingId = ref<Record<string, AppointmentMonitorRow>>({});
const dashboard = ref<ClinicDashboardPayload>({
  generatedAt: '',
  summary: {
    totalPatients: 0,
    totalAppointments: 0,
    todayAppointments: 0,
    pendingAppointments: 0,
    completedToday: 0,
    newPatientsThisMonth: 0
  },
  appointmentsTrend: [],
  statusBreakdown: [],
  departmentBreakdown: [],
  upcomingAppointments: [],
  recentPatients: []
});

const summaryCards = computed(() => {
  return [
    {
      key: 'appointments',
      title: 'Total Appointments',
      subtitle: 'All booking entries',
      value: dashboard.value.summary.totalAppointments,
      icon: '$accountGroupOutline',
      cardClass: 'analytics-card-green'
    },
    {
      key: 'student-appointed',
      title: 'Student Appointed',
      subtitle: 'Student linked to booking',
      value: monitorSummary.value.studentAppointed,
      icon: '$calendarCheckOutline',
      cardClass: 'analytics-card-blue'
    },
    {
      key: 'teacher-appointed',
      title: 'Booked by Teacher',
      subtitle: 'Appointments created by teachers',
      value: monitorSummary.value.teacherAppointed,
      icon: '$calendarToday',
      cardClass: 'analytics-card-orange'
    },
    {
      key: 'fully-appointed',
      title: 'Doctor Assigned',
      subtitle: 'Appointments with doctor assignment',
      value: monitorSummary.value.fullyAppointed,
      icon: '$timerSand',
      cardClass: 'analytics-card-purple'
    }
  ];
});

const appointmentsChartSeries = computed(() => {
  return [
    {
      name: 'Appointments',
      data: dashboard.value.appointmentsTrend.map((item) => item.total)
    }
  ];
});

const appointmentsChartOptions = computed(() => {
  return {
    chart: {
      type: 'line',
      height: 300,
      toolbar: { show: false },
      fontFamily: 'inherit'
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    colors: ['#1e88e5'],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.2,
        opacityFrom: 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    dataLabels: {
      enabled: false
    },
    markers: {
      size: 4
    },
    grid: {
      borderColor: '#eceff5'
    },
    xaxis: {
      categories: dashboard.value.appointmentsTrend.map((item) => item.label)
    },
    yaxis: {
      labels: {
        formatter: (value: number) => Math.round(value).toString()
      }
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} appointments`
      }
    }
  };
});

const statusChartSeries = computed(() => dashboard.value.statusBreakdown.map((item) => item.total));
const statusChartLabels = computed(() => dashboard.value.statusBreakdown.map((item) => item.label));
const hasStatusData = computed(() => statusChartSeries.value.reduce((sum, value) => sum + value, 0) > 0);

const statusChartOptions = computed(() => {
  return {
    chart: {
      type: 'donut',
      fontFamily: 'inherit'
    },
    labels: statusChartLabels.value,
    legend: {
      position: 'bottom'
    },
    colors: ['#5e35b1', '#1e88e5', '#26a69a', '#fb8c00', '#e53935', '#78909c'],
    dataLabels: {
      enabled: true
    },
    tooltip: {
      y: {
        formatter: (value: number) => `${value} appointments`
      }
    }
  };
});

const generatedAtText = computed(() => {
  if (!dashboard.value.generatedAt) {
    return 'Not available';
  }

  return formatDateTime(dashboard.value.generatedAt);
});

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(parsed);
}

function formatDateTime(value: string): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(parsed);
}

function statusColor(status: string): string {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes('complete')) return 'success';
  if (normalized.includes('appoint')) return 'success';
  if (normalized.includes('accept') || normalized.includes('confirm')) return 'primary';
  if (normalized.includes('pending') || normalized.includes('await')) return 'warning';
  if (normalized.includes('cancel') || normalized.includes('reject') || normalized.includes('no show')) return 'error';
  return 'secondary';
}

function assignmentLabelForBooking(bookingId: string): string {
  const row = monitorByBookingId.value[bookingId];
  return row ? appointmentBookingRoleLabel(row.bookedByRole) : 'Booked by Unknown';
}

function assignmentColorForBooking(bookingId: string): string {
  const row = monitorByBookingId.value[bookingId];
  return appointmentBookingRoleColor(row?.bookedByRole || 'unknown');
}

async function loadDashboard(options: { silent?: boolean } = {}): Promise<void> {
  const payload = await realtime.runLatest(
    async () => {
      const [dashboardPayload, monitorPayload] = await Promise.all([
        fetchClinicDashboard(),
        fetchAppointmentMonitor({ period: 'Upcoming', page: 1, perPage: 100 })
      ]);
      return { dashboardPayload, monitorPayload };
    },
    {
      silent: options.silent,
      onStart: () => {
        loading.value = true;
        loadError.value = '';
      },
      onFinish: () => {
        if (!viewActive.value) return;
        loading.value = false;
      },
      onError: (error) => {
        if (!viewActive.value) return;
        loadError.value = error instanceof Error ? error.message : 'Unable to load clinic dashboard data.';
      }
    }
  );
  if (!payload || !viewActive.value) return;
  dashboard.value = payload.dashboardPayload;
  monitorSummary.value = payload.monitorPayload.summary;
  monitorByBookingId.value = payload.monitorPayload.items.reduce<Record<string, AppointmentMonitorRow>>((acc, item) => {
    if (item.bookingId) acc[item.bookingId] = item;
    return acc;
  }, {});
}

onMounted(() => {
  void loadDashboard();
  realtime.startPolling(() => {
    void loadDashboard({ silent: true });
  }, REALTIME_POLICY.polling.reportsMs);
});

onBeforeUnmount(() => {
  viewActive.value = false;
  realtime.stopPolling();
  realtime.invalidatePending();
});
</script>

<template>
  <v-card class="hero-banner mb-4" elevation="0">
    <v-card-text class="pa-5">
      <div class="d-flex flex-wrap align-center justify-space-between ga-4">
        <div>
          <div class="hero-kicker">Clinic Operations</div>
          <h1 class="text-h4 font-weight-black mb-1">Appointment Monitoring Dashboard</h1>
          <p class="hero-subtitle mb-0">Live summary of appointments booked by students and teachers, with doctor assignment visibility.</p>
        </div>
        <div class="hero-side-card">
          <div class="hero-side-label">Latest Sync</div>
          <div class="hero-side-value">{{ generatedAtText }}</div>
          <v-btn color="primary" variant="flat" class="mt-2" :loading="loading" @click="loadDashboard">Refresh Data</v-btn>
        </div>
      </div>
    </v-card-text>
  </v-card>

  <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">{{ loadError }}</v-alert>

  <v-row>
    <v-col v-for="card in summaryCards" :key="card.key" cols="12" sm="6" lg="3">
      <v-card :class="['h-100 analytics-card', card.cardClass]" elevation="0">
        <v-card-text class="pa-5">
          <div class="d-flex align-start justify-space-between mb-3">
            <div class="analytics-card-title">{{ card.title }}</div>
            <v-btn icon size="small" variant="outlined" class="analytics-card-icon">
              <v-icon :icon="card.icon" size="18"></v-icon>
            </v-btn>
          </div>
          <div class="analytics-card-value">{{ formatNumber(card.value) }}</div>
          <div class="analytics-card-subtitle">
            {{ card.subtitle }}
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="8">
      <v-card variant="outlined" class="h-100">
        <v-card-item>
          <v-card-title>Appointment Trend</v-card-title>
          <v-card-subtitle>Last 6 months</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-skeleton-loader v-if="loading" type="image" class="mx-2"></v-skeleton-loader>
          <apexchart v-else type="line" height="300" :options="appointmentsChartOptions" :series="appointmentsChartSeries"></apexchart>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="4">
      <v-card variant="outlined" class="h-100">
        <v-card-item>
          <v-card-title>Appointment Status</v-card-title>
          <v-card-subtitle>Current distribution</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-skeleton-loader v-if="loading" type="image"></v-skeleton-loader>
          <div v-else>
            <apexchart v-if="hasStatusData" type="donut" height="240" :options="statusChartOptions" :series="statusChartSeries"></apexchart>
            <v-alert v-else type="info" variant="tonal">No appointment status data yet.</v-alert>

            <v-divider class="my-4"></v-divider>
            <div class="text-subtitle-2 mb-2">Top Departments</div>
            <v-list density="compact" class="py-0">
              <v-list-item v-for="dept in dashboard.departmentBreakdown" :key="dept.label">
                <v-list-item-title>{{ dept.label }}</v-list-item-title>
                <template v-slot:append>
                  <span class="font-weight-bold">{{ formatNumber(dept.total) }}</span>
                </template>
              </v-list-item>
              <v-list-item v-if="dashboard.departmentBreakdown.length === 0">
                <v-list-item-title class="text-medium-emphasis">No department data available.</v-list-item-title>
              </v-list-item>
            </v-list>
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="7">
      <v-card variant="outlined">
        <v-card-item>
          <v-card-title>Upcoming Appointments</v-card-title>
          <v-card-subtitle>Next active bookings</v-card-subtitle>
        </v-card-item>
        <v-card-text class="pt-2">
          <v-skeleton-loader v-if="loading" type="table"></v-skeleton-loader>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>Student</th>
                <th>Doctor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Booked By</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="appointment in dashboard.upcomingAppointments" :key="appointment.bookingId">
                <td>
                  <div class="font-weight-medium">{{ appointment.patientName }}</div>
                  <div class="text-caption text-medium-emphasis">{{ appointment.department }}</div>
                </td>
                <td>{{ appointment.doctorName }}</td>
                <td>{{ formatDate(appointment.appointmentDate) }}</td>
                <td>{{ appointment.preferredTime || 'TBA' }}</td>
                <td>
                  <v-chip size="small" :color="statusColor(appointment.status)" variant="tonal">
                    {{ appointment.status }}
                  </v-chip>
                </td>
                <td>
                  <v-chip size="small" :color="assignmentColorForBooking(appointment.bookingId)" variant="tonal">
                    {{ assignmentLabelForBooking(appointment.bookingId) }}
                  </v-chip>
                </td>
              </tr>
              <tr v-if="dashboard.upcomingAppointments.length === 0">
                <td colspan="6" class="text-center text-medium-emphasis py-4">No upcoming appointments found.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="5">
      <v-card variant="outlined" class="h-100">
        <v-card-item>
          <v-card-title>Recent Students</v-card-title>
          <v-card-subtitle>Latest student records</v-card-subtitle>
        </v-card-item>
        <v-card-text class="pt-2">
          <v-skeleton-loader v-if="loading" type="table"></v-skeleton-loader>
          <v-table v-else density="comfortable">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="patient in dashboard.recentPatients" :key="patient.patientId">
                <td class="font-weight-medium">{{ patient.patientName }}</td>
                <td>{{ patient.patientGender || 'Unspecified' }}</td>
                <td>{{ formatDateTime(patient.createdAt) }}</td>
              </tr>
              <tr v-if="dashboard.recentPatients.length === 0">
                <td colspan="3" class="text-center text-medium-emphasis py-4">No student records found.</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <div class="text-caption text-medium-emphasis mt-3">Last updated: {{ generatedAtText }}</div>
</template>

<style scoped>
.hero-banner {
  border-radius: 16px;
  color: #fff;
  background: linear-gradient(120deg, #162d84 0%, #2f63cc 54%, #3ea8f0 100%);
  box-shadow: 0 14px 30px rgba(19, 45, 126, 0.22);
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  margin-bottom: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.32);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.55px;
  text-transform: uppercase;
}

.hero-subtitle {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(8, 20, 52, 0.35);
}

.hero-side-card {
  min-width: 240px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  color: #14316e;
}

.hero-side-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.hero-side-value {
  margin-top: 4px;
  font-weight: 700;
}

.analytics-card {
  color: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(12, 31, 60, 0.18);
}

.analytics-card-green {
  background: linear-gradient(135deg, #23ba63 0%, #129a51 100%);
}

.analytics-card-blue {
  background: linear-gradient(135deg, #40a9f2 0%, #357adf 100%);
}

.analytics-card-orange {
  background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
}

.analytics-card-purple {
  background: linear-gradient(135deg, #a82cf0 0%, #7a1fca 100%);
}

.analytics-card-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.analytics-card-value {
  font-size: 38px;
  line-height: 1.1;
  font-weight: 700;
  margin-top: 6px;
}

.analytics-card-subtitle {
  margin-top: 4px;
  font-size: 14px;
  opacity: 0.95;
}

.analytics-card-icon {
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.55) !important;
  background-color: rgba(255, 255, 255, 0.12) !important;
}
</style>
