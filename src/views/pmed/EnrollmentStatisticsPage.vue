<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import {
  fetchEnrollmentStatisticsWorkspace,
  type EnrollmentStatisticsRecord
} from '@/services/pmedEnrollmentStatistics';

type SourceFilter = 'All Sources' | string;
type ReportTypeFilter = 'All Report Types' | string;

const records = ref<EnrollmentStatisticsRecord[]>([]);
const isLoading = ref(false);
const searchTerm = ref('');
const selectedSource = ref<SourceFilter>('All Sources');
const selectedReportType = ref<ReportTypeFilter>('All Report Types');
const selectedRecordId = ref('');
const availableSources = ref<string[]>([]);
const availableReportTypes = ref<string[]>([]);
const summary = ref({
  totalRecords: 0,
  totalValue: 0,
  activeBatches: 0,
  sourceCount: 0
});
const lastSentAt = ref('');

const selectedRecord = computed(
  () => records.value.find((item) => item.id === selectedRecordId.value) || null
);

const cards = computed(() => [
  {
    title: 'Feed Records',
    value: String(summary.value.totalRecords),
    subtitle: 'Rows available for PMED',
    className: 'analytics-card-blue',
    icon: 'mdi-database-outline'
  },
  {
    title: 'Enrollment Total',
    value: formatNumber(summary.value.totalValue),
    subtitle: 'Sum of current values',
    className: 'analytics-card-green',
    icon: 'mdi-account-group-outline'
  },
  {
    title: 'Batches',
    value: String(summary.value.activeBatches),
    subtitle: 'Distinct registrar batches',
    className: 'analytics-card-orange',
    icon: 'mdi-layers-triple-outline'
  },
  {
    title: 'Sources',
    value: String(summary.value.sourceCount),
    subtitle: 'Connected feed sources',
    className: 'analytics-card-purple',
    icon: 'mdi-source-branch'
  }
]);

const sourceOptions = computed(() => ['All Sources', ...availableSources.value]);
const reportTypeOptions = computed(() => ['All Report Types', ...availableReportTypes.value]);

const filteredRecords = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return records.value.filter((item) => {
    const matchesSource = selectedSource.value === 'All Sources' || item.source === selectedSource.value;
    const matchesReportType = selectedReportType.value === 'All Report Types' || item.reportType === selectedReportType.value;
    const matchesSearch =
      !keyword ||
      [
        item.batchId,
        item.source,
        item.office,
        item.metric,
        item.reportType,
        item.currentValue
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesSource && matchesReportType && matchesSearch;
  });
});

const groupedMetrics = computed(() => {
  const groups = new Map<string, { metric: string; total: number; offices: Set<string>; reports: Set<string> }>();
  for (const record of filteredRecords.value) {
    const current = groups.get(record.metric) || {
      metric: record.metric,
      total: 0,
      offices: new Set<string>(),
      reports: new Set<string>()
    };
    current.total += Number(record.currentValue || 0);
    if (record.office) current.offices.add(record.office);
    if (record.reportType) current.reports.add(record.reportType);
    groups.set(record.metric, current);
  }
  return Array.from(groups.values()).sort((left, right) => right.total - left.total);
});

const prettyPayload = computed(() => {
  if (!selectedRecord.value?.payload) return '{}';
  return JSON.stringify(selectedRecord.value.payload, null, 2);
});

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchEnrollmentStatisticsWorkspace(forceRefresh);
    records.value = payload.records || [];
    availableSources.value = payload.availableSources || [];
    availableReportTypes.value = payload.availableReportTypes || [];
    summary.value = payload.summary || summary.value;
    lastSentAt.value = payload.lastSentAt || '';
    if (!selectedRecordId.value && records.value[0]) {
      selectedRecordId.value = records.value[0].id;
    } else if (selectedRecordId.value && !records.value.some((item) => item.id === selectedRecordId.value)) {
      selectedRecordId.value = records.value[0]?.id || '';
    }
  } catch (error) {
    emitSuccessModal({
      title: 'Enrollment Feed Warning',
      message: error instanceof Error ? error.message : 'Unable to load the PMED enrollment statistics feed.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function selectRecord(record: EnrollmentStatisticsRecord): void {
  selectedRecordId.value = record.id;
}

onMounted(async () => {
  await loadWorkspace();
});

useRealtimeWorkspace(() => loadWorkspace(true, { silent: true }), { intervalMs: 10_000 });
</script>

<template>
  <v-container fluid class="pa-0">
    <div class="d-flex flex-column flex-lg-row align-start align-lg-center justify-space-between ga-4 mb-6">
      <div>
        <div class="text-overline text-primary font-weight-bold">PMED Intake</div>
        <h1 class="text-h4 font-weight-bold mb-1">Enrollment Statistics Feed</h1>
        <p class="text-medium-emphasis mb-0">
          Review registrar batches sent into PMED from <code>public.pmed_enrollment_statistics_feed</code>.
        </p>
      </div>
      <v-chip color="primary" variant="tonal" prepend-icon="mdi-clock-outline">
        Last received: {{ lastSentAt ? formatTimestamp(lastSentAt) : 'No feed received yet' }}
      </v-chip>
    </div>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mb-6" />

    <v-row class="mb-4">
      <v-col cols="12" md="5">
        <v-text-field
          v-model="searchTerm"
          label="Search metric, batch, office"
          variant="outlined"
          density="comfortable"
          hide-details
          prepend-inner-icon="mdi-magnify"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          v-model="selectedSource"
          :items="sourceOptions"
          label="Source"
          variant="outlined"
          density="comfortable"
          hide-details
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="selectedReportType"
          :items="reportTypeOptions"
          label="Report Type"
          variant="outlined"
          density="comfortable"
          hide-details
        />
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" lg="7">
        <v-card rounded="xl" elevation="0" class="border-sm">
          <v-card-item>
            <template #title>Feed Records</template>
            <template #subtitle>{{ filteredRecords.length }} row(s) matched</template>
          </v-card-item>
          <v-divider />
          <v-progress-linear v-if="isLoading" indeterminate color="primary" />
          <v-table v-if="filteredRecords.length" hover class="enrollment-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>Source</th>
                <th>Batch</th>
                <th>Sent</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="record in filteredRecords"
                :key="record.id"
                :class="{ 'selected-row': record.id === selectedRecordId }"
                @click="selectRecord(record)"
              >
                <td>
                  <div class="font-weight-medium">{{ record.metric || 'Unlabeled metric' }}</div>
                  <div class="text-caption text-medium-emphasis">{{ record.office || 'Office not tagged' }}</div>
                </td>
                <td class="font-weight-bold">{{ formatNumber(record.currentValue) }}</td>
                <td>
                  <div>{{ record.source || '--' }}</div>
                  <div class="text-caption text-medium-emphasis">{{ record.reportType || '--' }}</div>
                </td>
                <td>{{ record.batchId || '--' }}</td>
                <td>{{ record.sentAt ? formatTimestamp(record.sentAt) : '--' }}</td>
              </tr>
            </tbody>
          </v-table>
          <div v-else class="pa-8 text-center text-medium-emphasis">
            No enrollment statistics have been pushed into PMED yet.
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card rounded="xl" elevation="0" class="border-sm mb-4">
          <v-card-item>
            <template #title>Metric Rollup</template>
            <template #subtitle>Grouped totals from the current filter</template>
          </v-card-item>
          <v-divider />
          <v-list lines="two" density="comfortable">
            <v-list-item v-for="group in groupedMetrics" :key="group.metric">
              <template #title>{{ group.metric }}</template>
              <template #subtitle>
                {{ group.offices.size }} office(s) · {{ group.reports.size }} report type(s)
              </template>
              <template #append>
                <v-chip color="primary" variant="tonal">{{ formatNumber(group.total) }}</v-chip>
              </template>
            </v-list-item>
            <v-list-item v-if="!groupedMetrics.length">
              <template #title>No metrics yet</template>
              <template #subtitle>The feed is connected, but there are no rows to summarize.</template>
            </v-list-item>
          </v-list>
        </v-card>

        <v-card rounded="xl" elevation="0" class="border-sm">
          <v-card-item>
            <template #title>Selected Payload</template>
            <template #subtitle>{{ selectedRecord?.batchId || 'Choose a record to inspect raw payload data' }}</template>
          </v-card-item>
          <v-divider />
          <div v-if="selectedRecord" class="pa-5">
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip color="primary" variant="tonal">{{ selectedRecord.source || 'Unknown source' }}</v-chip>
              <v-chip color="secondary" variant="tonal">{{ selectedRecord.reportType || 'No report type' }}</v-chip>
              <v-chip color="success" variant="tonal">{{ formatNumber(selectedRecord.currentValue) }}</v-chip>
            </div>
            <pre class="payload-block">{{ prettyPayload }}</pre>
          </div>
          <div v-else class="pa-8 text-center text-medium-emphasis">
            Select a feed row to inspect its JSON payload.
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.border-sm {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.enrollment-table tbody tr {
  cursor: pointer;
}

.selected-row {
  background: rgba(var(--v-theme-primary), 0.08);
}

.payload-block {
  margin: 0;
  padding: 16px;
  border-radius: 16px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 0.84rem;
  line-height: 1.5;
  overflow: auto;
  max-height: 360px;
}
</style>
