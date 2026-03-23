<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import {
  fetchPmedComlabVerificationWorkspace,
  runPmedComlabVerificationAction,
  type PmedComlabVerificationRecord
} from '@/services/pmedComlabReportVerification';

const isLoading = ref(false);
const records = ref<PmedComlabVerificationRecord[]>([]);
const summary = ref({
  total: 0,
  pendingVerification: 0,
  verified: 0,
  returned: 0,
  closed: 0
});
const search = ref('');

const cards = computed(() => [
  {
    title: 'Total Reports',
    value: String(summary.value.total),
    subtitle: 'COMLAB reports in PMED lane',
    className: 'analytics-card-blue',
    icon: 'mdi-file-document-multiple-outline'
  },
  {
    title: 'Pending PMED Verify',
    value: String(summary.value.pendingVerification),
    subtitle: 'Need PMED validation',
    className: 'analytics-card-orange',
    icon: 'mdi-clipboard-clock-outline'
  },
  {
    title: 'Returned to COMLAB',
    value: String(summary.value.returned),
    subtitle: 'Waiting COMLAB confirmation',
    className: 'analytics-card-purple',
    icon: 'mdi-tray-arrow-left'
  },
  {
    title: 'Closed by COMLAB',
    value: String(summary.value.closed),
    subtitle: 'Confirmed and archived',
    className: 'analytics-card-green',
    icon: 'mdi-check-decagram-outline'
  }
]);

const filteredRecords = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  if (!keyword) return records.value;
  return records.value.filter((record) =>
    [
      record.documentId,
      record.title,
      record.subjectRef,
      record.reportCategory,
      record.itemReference,
      record.status,
      record.workflowLabel,
      record.details
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  );
});

function categoryLabel(value: string): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'missing_computer') return 'Missing Computer';
  if (normalized === 'computer_sent') return 'Computer Sent';
  if (normalized === 'computer_received') return 'Computer Received';
  return 'Operations Report';
}

function statusColor(value: string): string {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'sent') return 'warning';
  if (normalized === 'acknowledged') return 'primary';
  if (normalized === 'received') return 'info';
  if (normalized === 'archived') return 'success';
  return 'secondary';
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const data = await fetchPmedComlabVerificationWorkspace(forceRefresh);
    records.value = data.records || [];
    summary.value = data.summary || summary.value;
  } catch (error) {
    emitSuccessModal({
      title: 'PMED Verification Unavailable',
      message: error instanceof Error ? error.message : 'Unable to load COMLAB report verification workspace.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

async function applyAction(record: PmedComlabVerificationRecord, action: 'pmed_verify_report' | 'pmed_return_report'): Promise<void> {
  const actionLabel = action === 'pmed_verify_report' ? 'Verify in PMED' : 'Return to COMLAB';
  const confirmed = await requestConfirmModal({
    title: actionLabel,
    message: `${actionLabel} for ${record.title}?`,
    confirmText: action === 'pmed_verify_report' ? 'Verify' : 'Return',
    tone: 'primary'
  });
  if (!confirmed) return;

  const notes = window.prompt('Add note (optional):', '') || '';
  try {
    const data = await runPmedComlabVerificationAction(action, {
      documentId: record.documentId,
      notes
    });
    records.value = data.records || [];
    summary.value = data.summary || summary.value;
    emitSuccessModal({
      title: action === 'pmed_verify_report' ? 'Report Verified' : 'Report Returned',
      message: action === 'pmed_verify_report'
        ? 'PMED verification was recorded successfully.'
        : 'Report was returned to COMLAB for confirmation.',
      tone: 'success'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Action Failed',
      message: error instanceof Error ? error.message : 'Unable to update this COMLAB report workflow.',
      tone: 'warning'
    });
  }
}

onMounted(async () => {
  await loadWorkspace();
});

useRealtimeWorkspace(() => loadWorkspace(true, { silent: true }), { intervalMs: 6_000 });
</script>

<template>
  <div class="pmed-page">
    <v-card class="hero-card" variant="outlined">
      <v-card-text class="hero-wrap">
        <div>
          <div class="page-kicker">COMLAB Integration</div>
          <h1 class="text-h4 font-weight-black mb-1">COMLAB Report Verification</h1>
          <p class="text-medium-emphasis mb-0">
            PMED verifies COMLAB reports (missing/sent/received computers), returns them to COMLAB, and tracks closure status.
          </p>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-card variant="outlined" class="surface-card mt-4">
      <v-card-item>
        <v-card-title>PMED Verification Queue</v-card-title>
        <v-card-subtitle>Verify and return COMLAB reports directly from PMED.</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-text-field
          v-model="search"
          variant="outlined"
          density="compact"
          hide-details
          prepend-inner-icon="mdi-magnify"
          placeholder="Search report title, reference, category, status"
        />

        <v-table density="comfortable" class="saas-table mt-3">
          <thead>
            <tr>
              <th>Document</th>
              <th>Category</th>
              <th>Item Ref / Qty</th>
              <th>Status</th>
              <th>Workflow</th>
              <th>Updated</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredRecords" :key="row.documentId">
              <td>
                <div class="font-weight-bold">{{ row.title }}</div>
                <div class="text-caption text-medium-emphasis">{{ row.documentId }}</div>
                <div v-if="row.subjectRef" class="text-caption text-medium-emphasis">Ref: {{ row.subjectRef }}</div>
              </td>
              <td>
                <v-chip size="x-small" color="primary" variant="tonal">{{ categoryLabel(row.reportCategory) }}</v-chip>
              </td>
              <td>
                <div>{{ row.itemReference || '--' }}</div>
                <div class="text-caption text-medium-emphasis">Qty: {{ row.quantity || 1 }}</div>
              </td>
              <td>
                <v-chip size="x-small" :color="statusColor(row.status)" variant="tonal">{{ row.status }}</v-chip>
              </td>
              <td>
                <div class="font-weight-medium">{{ row.workflowLabel }}</div>
                <div v-if="row.details" class="text-caption text-medium-emphasis">{{ row.details }}</div>
              </td>
              <td>{{ row.updatedAt }}</td>
              <td class="text-right">
                <div class="d-flex ga-1 justify-end">
                  <v-btn
                    v-if="row.canVerify"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    @click="applyAction(row, 'pmed_verify_report')"
                  >
                    Verify
                  </v-btn>
                  <v-btn
                    v-if="row.canReturn"
                    size="x-small"
                    color="success"
                    variant="tonal"
                    @click="applyAction(row, 'pmed_return_report')"
                  >
                    Return
                  </v-btn>
                </div>
              </td>
            </tr>
            <tr v-if="!isLoading && !filteredRecords.length">
              <td colspan="7" class="text-center text-medium-emphasis py-6">No COMLAB reports found in PMED verification queue.</td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
@import './shared-pmed.css';
</style>
