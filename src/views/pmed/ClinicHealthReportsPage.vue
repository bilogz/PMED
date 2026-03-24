<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { formatDateTimeWithTimezone } from '@/utils/dateTime';
import {
  fetchClinicHealthReports,
  type ClinicHealthReport,
  type HealthReportSeverity
} from '@/services/clinicHealthReports';

const SEVERITY_OPTIONS = ['all', 'low', 'moderate', 'high', 'emergency'] as const;
const STUDENT_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Student', value: 'student' },
  { label: 'Teacher / Staff', value: 'teacher' }
];

const reports = ref<ClinicHealthReport[]>([]);
const total = ref(0);
const totalPages = ref(1);
const loading = ref(false);
const page = ref(1);
const perPage = 15;

const search = ref('');
const severityFilter = ref<string>('all');
const typeFilter = ref('');
const selectedReport = ref<ClinicHealthReport | null>(null);
const detailDialog = ref(false);
const dataSource = ref<string>('');

watch([search, severityFilter, typeFilter], () => {
  page.value = 1;
  void load(true);
});

const kpiCards = computed(() => [
  {
    title: 'Total Reports',
    value: total.value,
    subtitle: 'Clinic health reports received',
    className: 'analytics-card-blue',
    icon: 'mdi-medical-bag'
  },
  {
    title: 'Emergency',
    value: reports.value.filter((r) => r.severity === 'emergency').length,
    subtitle: 'Highest priority cases',
    className: 'analytics-card-red',
    icon: 'mdi-ambulance'
  },
  {
    title: 'High Severity',
    value: reports.value.filter((r) => r.severity === 'high').length,
    subtitle: 'Needs close follow-up',
    className: 'analytics-card-orange',
    icon: 'mdi-alert-outline'
  },
  {
    title: 'With Medicine',
    value: reports.value.filter((r) => r.medicinesUsed?.length > 0).length,
    subtitle: 'Medicine dispensed',
    className: 'analytics-card-green',
    icon: 'mdi-pill'
  }
]);

function severityColor(value: string): string {
  if (value === 'emergency') return 'error';
  if (value === 'high') return 'deep-orange';
  if (value === 'moderate') return 'warning';
  return 'success';
}

function severityIcon(value: string): string {
  if (value === 'emergency') return 'mdi-ambulance';
  if (value === 'high') return 'mdi-alert-outline';
  if (value === 'moderate') return 'mdi-alert-circle-outline';
  return 'mdi-check-circle-outline';
}

function formatDate(value: string): string {
  return formatDateTimeWithTimezone(value, { fallback: '—' });
}

function medicinesSummary(medicines: ClinicHealthReport['medicinesUsed']): string {
  if (!medicines?.length) return 'None';
  return medicines
    .slice(0, 3)
    .map((m) => [m.name, m.dose].filter(Boolean).join(' '))
    .join(', ') + (medicines.length > 3 ? ` +${medicines.length - 3} more` : '');
}

function openDetail(row: ClinicHealthReport): void {
  selectedReport.value = row;
  detailDialog.value = true;
}

async function load(forceRefresh = false): Promise<void> {
  loading.value = true;
  try {
    const result = await fetchClinicHealthReports({
      search: search.value || undefined,
      severity: (severityFilter.value !== 'all' ? severityFilter.value : undefined) as HealthReportSeverity | undefined,
      studentType: (typeFilter.value || undefined) as any,
      page: page.value,
      perPage,
      forceRefresh
    });
    reports.value = result?.items ?? [];
    total.value = result?.meta?.total ?? 0;
    totalPages.value = result?.meta?.totalPages ?? 1;
  } catch {
    reports.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load(true));
useRealtimeWorkspace(() => load(true), { intervalMs: 10_000 });
</script>

<template>
  <div class="pmed-page">
    <!-- Hero -->
    <v-card class="hero-card" variant="outlined">
      <v-card-text class="hero-wrap">
        <div>
          <div class="page-kicker">Clinic → PMED</div>
          <h1 class="text-h4 font-weight-black mb-1">Clinic Health Reports</h1>
          <p class="text-medium-emphasis mb-0">
            Student and patient health issue reports sent by the Clinic — including the health problem, first aid, and medicines dispensed.
          </p>
        </div>
        <div class="hero-actions">
          <v-chip
            v-if="dataSource === 'module_activity_logs_fallback'"
            size="small"
            color="warning"
            variant="tonal"
            prepend-icon="mdi-information-outline"
          >
            Reading from activity log (table sync pending)
          </v-chip>
          <v-chip
            v-if="total"
            size="small"
            color="white"
            variant="outlined"
            prepend-icon="mdi-medical-bag"
          >
            {{ total }} report{{ total !== 1 ? 's' : '' }}
          </v-chip>
          <v-btn
            size="small"
            variant="tonal"
            color="white"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="load(true)"
          >
            Refresh
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- KPI cards -->
    <AnalyticsCardGrid :items="kpiCards" md="6" lg="3" class="mt-4" />

    <!-- Filters + table -->
    <v-card variant="outlined" class="surface-card mt-4">
      <v-card-item>
        <v-card-title>Health Issue Inbox</v-card-title>
        <v-card-subtitle>All clinic health reports pushed to PMED — read-only view.</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <!-- Toolbar -->
        <div class="records-toolbar mb-4">
          <v-text-field
            v-model="search"
            variant="outlined"
            density="compact"
            hide-details
            prepend-inner-icon="mdi-magnify"
            placeholder="Search by name, ID, or health issue…"
            clearable
            style="max-width: 360px;"
          />
          <div class="d-flex ga-2 flex-wrap">
            <v-btn-toggle
              v-model="severityFilter"
              density="compact"
              variant="outlined"
              rounded="lg"
              mandatory
            >
              <v-btn
                v-for="s in SEVERITY_OPTIONS"
                :key="s"
                :value="s"
                size="small"
                class="text-capitalize"
              >
                {{ s === 'all' ? 'All Severity' : s }}
              </v-btn>
            </v-btn-toggle>
            <v-select
              v-model="typeFilter"
              :items="STUDENT_TYPE_OPTIONS"
              item-title="label"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              style="min-width: 150px;"
            />
          </div>
        </div>

        <v-progress-linear v-if="loading" color="primary" indeterminate rounded class="mb-3" />

        <!-- Table -->
        <v-table density="comfortable" class="saas-table" hover>
          <thead>
            <tr>
              <th>REPORT CODE</th>
              <th>PATIENT</th>
              <th>HEALTH ISSUE</th>
              <th style="width:110px;">SEVERITY</th>
              <th>MEDICINE / FIRST AID</th>
              <th>ATTENDING STAFF</th>
              <th style="width:140px;">DATE RECEIVED</th>
              <th class="text-right" style="width:80px;">ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in reports"
              :key="row.reportCode"
              style="cursor:pointer;"
              @click="openDetail(row)"
            >
              <td>
                <code class="text-caption">{{ row.reportCode }}</code>
              </td>
              <td>
                <div class="font-weight-bold">{{ row.studentName }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ [row.studentId, row.gradeSection].filter(Boolean).join(' · ') || row.studentType }}
                  <span v-if="row.age"> · Age {{ row.age }}</span>
                  <span v-if="row.sex"> · {{ row.sex }}</span>
                </div>
              </td>
              <td>
                <div class="text-body-2" style="max-width:240px; white-space:pre-wrap;">{{ row.healthIssue }}</div>
                <div v-if="row.symptoms" class="text-caption text-medium-emphasis" style="max-width:240px;">
                  {{ row.symptoms.slice(0, 80) }}{{ row.symptoms.length > 80 ? '…' : '' }}
                </div>
              </td>
              <td>
                <v-chip
                  :color="severityColor(row.severity)"
                  :prepend-icon="severityIcon(row.severity)"
                  size="small"
                  variant="flat"
                  class="text-capitalize"
                >
                  {{ row.severity }}
                </v-chip>
              </td>
              <td>
                <div class="text-body-2 text-truncate" style="max-width:220px;">
                  {{ medicinesSummary(row.medicinesUsed) }}
                </div>
                <div v-if="row.firstAidGiven" class="text-caption text-medium-emphasis">
                  <v-icon size="12" class="mr-1">mdi-bandage</v-icon>
                  {{ row.firstAidGiven.slice(0, 60) }}{{ row.firstAidGiven.length > 60 ? '…' : '' }}
                </div>
              </td>
              <td>
                <div class="text-body-2">{{ row.attendingStaff || '—' }}</div>
              </td>
              <td>
                <div class="text-caption">{{ formatDate(row.createdAt) }}</div>
              </td>
              <td class="text-right">
                <v-btn size="x-small" variant="tonal" color="primary" @click.stop="openDetail(row)">
                  View
                </v-btn>
              </td>
            </tr>
            <tr v-if="!loading && !reports.length">
              <td colspan="8" class="text-center text-medium-emphasis py-8">
                <v-icon size="40" class="mb-2" opacity="0.4">mdi-medical-bag</v-icon>
                <div>No clinic health reports received yet.</div>
                <div class="text-caption mt-1">Reports sent from the Clinic will appear here automatically.</div>
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="d-flex align-center justify-space-between flex-wrap ga-3 mt-4">
          <div class="text-body-2 text-medium-emphasis">
            Showing {{ reports.length }} of {{ total }} reports
          </div>
          <v-pagination
            v-model="page"
            :length="totalPages"
            :total-visible="5"
            density="comfortable"
            @update:model-value="load(true)"
          />
        </div>
      </v-card-text>
    </v-card>

    <!-- Detail dialog -->
    <v-dialog v-model="detailDialog" max-width="720" scrollable>
      <v-card v-if="selectedReport" rounded="xl">
        <!-- Header -->
        <div class="detail-header">
          <div class="detail-header-icon">
            <v-icon size="26" color="white">mdi-medical-bag</v-icon>
          </div>
          <div class="flex-grow-1 min-w-0">
            <div class="detail-kicker">Clinic Health Report</div>
            <div class="text-h6 font-weight-black text-white">{{ selectedReport.studentName }}</div>
            <div class="text-white" style="opacity:.82; font-size:13px;">
              {{ [selectedReport.studentId, selectedReport.gradeSection].filter(Boolean).join(' · ') || selectedReport.studentType }}
              <span v-if="selectedReport.age"> · Age {{ selectedReport.age }}</span>
              <span v-if="selectedReport.sex"> · {{ selectedReport.sex }}</span>
            </div>
          </div>
          <v-chip
            :color="severityColor(selectedReport.severity)"
            :prepend-icon="severityIcon(selectedReport.severity)"
            variant="flat"
            class="text-capitalize"
          >
            {{ selectedReport.severity }}
          </v-chip>
        </div>

        <v-card-text class="pt-4">
          <v-row dense>
            <v-col cols="12">
              <div class="detail-section-label">Health Issue / Chief Complaint</div>
              <div class="detail-value">{{ selectedReport.healthIssue }}</div>
            </v-col>
            <v-col v-if="selectedReport.symptoms" cols="12">
              <div class="detail-section-label">Symptoms Observed</div>
              <div class="detail-value">{{ selectedReport.symptoms }}</div>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <v-row dense>
            <v-col v-if="selectedReport.firstAidGiven" cols="12" sm="6">
              <div class="detail-section-label">
                <v-icon size="14" color="green" class="mr-1">mdi-bandage</v-icon>First Aid Given
              </div>
              <div class="detail-value">{{ selectedReport.firstAidGiven }}</div>
            </v-col>
            <v-col v-if="selectedReport.treatmentGiven" cols="12" sm="6">
              <div class="detail-section-label">
                <v-icon size="14" color="teal" class="mr-1">mdi-clipboard-pulse</v-icon>Treatment / Clinical Notes
              </div>
              <div class="detail-value">{{ selectedReport.treatmentGiven }}</div>
            </v-col>
          </v-row>

          <template v-if="selectedReport.medicinesUsed?.length">
            <v-divider class="my-4" />
            <div class="detail-section-label mb-3">
              <v-icon size="14" color="indigo" class="mr-1">mdi-pill</v-icon>Medicines / Supplies Used
            </div>
            <v-table density="compact" class="medicines-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Medicine / Supply</th>
                  <th>Dose / Instructions</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(med, idx) in selectedReport.medicinesUsed" :key="idx">
                  <td class="text-medium-emphasis">{{ idx + 1 }}</td>
                  <td class="font-weight-bold">{{ med.name }}</td>
                  <td>{{ med.dose || '—' }}</td>
                  <td>{{ med.quantity || '—' }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>

          <v-divider class="my-4" />

          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="detail-section-label">Attending Staff</div>
              <div class="detail-value">{{ selectedReport.attendingStaff || '—' }}</div>
            </v-col>
            <v-col v-if="selectedReport.remarks" cols="12" sm="6">
              <div class="detail-section-label">Remarks / Follow-up</div>
              <div class="detail-value">{{ selectedReport.remarks }}</div>
            </v-col>
          </v-row>

          <v-divider class="my-4" />

          <v-row dense>
            <v-col cols="12" sm="6">
              <div class="detail-section-label">Report Code</div>
              <code class="detail-value">{{ selectedReport.reportCode }}</code>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="detail-section-label">Date Received by PMED</div>
              <div class="detail-value">{{ formatDate(selectedReport.pmedSentAt || selectedReport.createdAt) }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="detail-section-label">PMED Entity Key</div>
              <div class="detail-value text-medium-emphasis text-caption">{{ selectedReport.pmedEntityKey || '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="detail-section-label">Patient Type</div>
              <v-chip size="small" color="info" variant="tonal" class="text-capitalize">{{ selectedReport.studentType }}</v-chip>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="justify-end px-6 pb-4">
          <v-btn variant="text" @click="detailDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@import './shared-pmed.css';

.detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background: linear-gradient(120deg, #b71c1c 0%, #c62828 50%, #e53935 100%);
  color: #fff;
}

.detail-header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.18);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-kicker {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  opacity: 0.75;
  margin-bottom: 2px;
}

.detail-section-label {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: rgba(0, 0, 0, 0.5);
  margin-bottom: 4px;
}

.detail-value {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  margin-bottom: 8px;
}

.medicines-table :deep(th) {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: rgba(0, 0, 0, 0.5);
}
</style>
