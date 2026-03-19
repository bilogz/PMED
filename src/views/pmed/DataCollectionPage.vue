<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import {
  fetchDataCollectionWorkspace,
  runDataCollectionAction,
  saveDataCollectionSubmission,
  type DataCollectionActivityLog,
  type DataCollectionDepartment,
  type DataCollectionSubmission
} from '@/services/pmedDataCollection';

type QueueStatus = 'Validated' | 'Pending Review' | 'Needs Correction' | 'Missing' | 'Submitted';

type SubmissionRecord = DataCollectionSubmission & {
  status: QueueStatus;
};

const submissions = ref<SubmissionRecord[]>([]);
const departments = ref<DataCollectionDepartment[]>([]);
const activityLogs = ref<DataCollectionActivityLog[]>([]);
const isLoading = ref(false);

const searchTerm = ref('');
const selectedStatus = ref<'All Statuses' | QueueStatus>('All Statuses');
const selectedSubmissionId = ref('');
const submissionDialog = ref(false);
const dialogMode = ref<'request' | 'edit' | 'import' | 'fetch'>('request');

const form = reactive({
  submissionReference: '',
  planReference: '',
  departmentName: '',
  feedType: '',
  coveragePeriod: '',
  sourceTable: '',
  sourceEndpoint: '',
  remarks: ''
});

const statusOptions: Array<'All Statuses' | QueueStatus> = [
  'All Statuses',
  'Pending Review',
  'Validated',
  'Needs Correction',
  'Missing',
  'Submitted'
];

const departmentOptions = ['Registrar', 'Cashier', 'Clinic', 'Guidance', 'Prefect', 'Computer Laboratory', 'CRAD', 'HR'];

const selectedSubmission = computed(() =>
  submissions.value.find((item) => item.id === selectedSubmissionId.value) || null
);

const cards = computed(() => [
  {
    title: 'For Verification',
    value: String(submissions.value.filter((item) => item.status === 'Pending Review' || item.status === 'Submitted').length),
    subtitle: 'Pending review',
    className: 'analytics-card-blue',
    icon: 'mdi-timer-sand'
  },
  {
    title: 'Needs Correction',
    value: String(submissions.value.filter((item) => item.status === 'Needs Correction').length),
    subtitle: 'Returned records',
    className: 'analytics-card-orange',
    icon: 'mdi-file-undo-outline'
  },
  {
    title: 'Validated Feeds',
    value: String(submissions.value.filter((item) => item.status === 'Validated').length),
    subtitle: 'Ready for monitoring',
    className: 'analytics-card-green',
    icon: 'mdi-check-decagram-outline'
  },
  {
    title: 'Missing Inputs',
    value: String(submissions.value.filter((item) => item.status === 'Missing').length),
    subtitle: 'Blocking next stage',
    className: 'analytics-card-purple',
    icon: 'mdi-alert-circle-outline'
  }
]);

const filteredSubmissions = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return submissions.value.filter((item) => {
    const matchesStatus = selectedStatus.value === 'All Statuses' || item.status === selectedStatus.value;
    const matchesSearch =
      !keyword ||
      [
        item.id,
        item.planReference,
        item.department,
        item.feedType,
        item.coveragePeriod,
        item.reviewerName,
        item.sourceTable,
        item.sourceEndpoint,
        item.remarks
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesStatus && matchesSearch;
  });
});

const dataflowStats = computed(() => ({
  requested: submissions.value.filter((item) => item.status === 'Missing' || item.status === 'Pending Review').length,
  submitted: submissions.value.filter((item) => item.status !== 'Missing').length,
  validated: submissions.value.filter((item) => item.status === 'Validated').length
}));

const collectionGates = computed(() => [
  {
    label: submissions.value.some((item) => item.department === 'Registrar' && item.status === 'Validated')
      ? 'Registrar validated'
      : 'Registrar still pending',
    icon: submissions.value.some((item) => item.department === 'Registrar' && item.status === 'Validated') ? 'mdi-check-circle' : 'mdi-alert-circle-outline'
  },
  {
    label: submissions.value.some((item) => item.department === 'Clinic' && item.status === 'Validated')
      ? 'Clinic validated'
      : 'Clinic still pending',
    icon: submissions.value.some((item) => item.department === 'Clinic' && item.status === 'Validated') ? 'mdi-check-circle' : 'mdi-alert-circle-outline'
  },
  {
    label: submissions.value.some((item) => item.status === 'Needs Correction')
      ? 'Some feeds need correction'
      : 'No correction blockers',
    icon: submissions.value.some((item) => item.status === 'Needs Correction') ? 'mdi-alert-circle-outline' : 'mdi-check-circle'
  },
  {
    label: submissions.value.some((item) => item.status === 'Missing')
      ? 'Missing inputs still block monitoring'
      : 'No missing inputs remain',
    icon: submissions.value.some((item) => item.status === 'Missing') ? 'mdi-alert-circle-outline' : 'mdi-check-circle'
  }
]);

const nextWorkflowMessage = computed(() =>
  submissions.value.some((item) => item.status === 'Missing' || item.status === 'Needs Correction' || item.status === 'Pending Review')
    ? 'Monitoring stays locked until missing or returned submissions are resolved.'
    : 'All visible collection feeds are ready to move forward into monitoring.'
);

function hydrateWorkspace(payload: {
  submissions: DataCollectionSubmission[];
  departments: DataCollectionDepartment[];
  activityLogs: DataCollectionActivityLog[];
}): void {
  submissions.value = (payload.submissions || []).map((item) => ({
    ...item,
    status: item.status as QueueStatus
  }));
  departments.value = payload.departments || [];
  activityLogs.value = payload.activityLogs || [];
  if (!selectedSubmissionId.value && submissions.value[0]) {
    selectedSubmissionId.value = submissions.value[0].id;
  } else if (selectedSubmissionId.value && !submissions.value.some((item) => item.id === selectedSubmissionId.value)) {
    selectedSubmissionId.value = submissions.value[0]?.id || '';
  }
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchDataCollectionWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Collection Data Warning',
      message: error instanceof Error ? error.message : 'Unable to load PMED data collection workspace.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function statusColor(value: string): string {
  if (value === 'Validated') return 'success';
  if (value === 'Pending Review' || value === 'Submitted') return 'warning';
  if (value === 'Needs Correction' || value === 'Missing') return 'error';
  return 'primary';
}

function toneColor(value: DataCollectionActivityLog['tone']): string {
  if (value === 'success') return 'success';
  if (value === 'warning') return 'warning';
  return 'primary';
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function resetForm(): void {
  Object.assign(form, {
    submissionReference: '',
    planReference: '',
    departmentName: '',
    feedType: '',
    coveragePeriod: '',
    sourceTable: '',
    sourceEndpoint: '',
    remarks: ''
  });
}

function openRequestModal(mode: 'request' | 'import' | 'fetch'): void {
  dialogMode.value = mode;
  resetForm();
  form.submissionReference = `SUB-${new Date().getFullYear()}-${String(submissions.value.length + 1).padStart(3, '0')}`;
  form.coveragePeriod = `Q${Math.max(1, Math.ceil((new Date().getMonth() + 1) / 3))} ${new Date().getFullYear()}`;
  submissionDialog.value = true;
}

function openEditModal(submission: SubmissionRecord): void {
  dialogMode.value = 'edit';
  Object.assign(form, {
    submissionReference: submission.id,
    planReference: submission.planReference,
    departmentName: submission.department,
    feedType: submission.feedType,
    coveragePeriod: submission.coveragePeriod,
    sourceTable: submission.sourceTable,
    sourceEndpoint: submission.sourceEndpoint,
    remarks: submission.remarks
  });
  selectedSubmissionId.value = submission.id;
  submissionDialog.value = true;
}

async function saveSubmission(): Promise<void> {
  if (!form.submissionReference.trim() || !form.departmentName.trim() || !form.feedType.trim() || !form.coveragePeriod.trim()) {
    emitSuccessModal({ title: 'Missing Fields', message: 'Please complete the reference, department, feed, and coverage fields.', tone: 'warning' });
    return;
  }

  try {
    const workspace = await saveDataCollectionSubmission({
      submissionReference: form.submissionReference.trim(),
      planReference: form.planReference.trim(),
      departmentName: form.departmentName.trim(),
      feedType: form.feedType.trim(),
      coveragePeriod: form.coveragePeriod.trim(),
      sourceTable: form.sourceTable.trim(),
      sourceEndpoint: form.sourceEndpoint.trim(),
      remarks: form.remarks.trim(),
      action:
        dialogMode.value === 'request'
          ? 'request'
          : dialogMode.value === 'import'
            ? 'import_data'
            : dialogMode.value === 'fetch'
              ? 'fetch_department_feed'
              : 'upsert'
    });
    hydrateWorkspace(workspace);
    submissionDialog.value = false;
    emitSuccessModal({
      title:
        dialogMode.value === 'request'
          ? 'Request Created'
          : dialogMode.value === 'import'
            ? 'Feed Imported'
            : dialogMode.value === 'fetch'
              ? 'Department Feed Fetched'
              : 'Submission Updated',
      message: `${form.departmentName} is now reflected in the live collection queue.`,
      tone: dialogMode.value === 'import' || dialogMode.value === 'fetch' ? 'success' : 'info'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Save Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save this collection item.',
      tone: 'warning'
    });
  }
}

function selectSubmission(submission: SubmissionRecord): void {
  selectedSubmissionId.value = submission.id;
}

function findActionTarget(preferred?: SubmissionRecord | null, mode: 'validate' | 'send_back' = 'validate'): SubmissionRecord | null {
  if (preferred) return preferred;
  if (selectedSubmission.value) return selectedSubmission.value;
  if (mode === 'validate') {
    return filteredSubmissions.value.find((item) => item.status === 'Pending Review' || item.status === 'Submitted') || null;
  }
  return filteredSubmissions.value.find((item) => item.status === 'Pending Review' || item.status === 'Needs Correction') || null;
}

async function validateSubmission(target?: SubmissionRecord | null): Promise<void> {
  const submission = findActionTarget(target || null, 'validate');
  if (!submission) {
    emitSuccessModal({ title: 'No Submission Ready', message: 'Select or load a submission that is ready for validation.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Validate Submission',
    message: `Validate ${submission.department}'s feed and unlock it for the next stage?`,
    confirmText: 'Validate',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runDataCollectionAction('validate', submission.id, {
      actor: 'PMED Validator',
      remarks: `Validated ${submission.feedType} for ${submission.coveragePeriod}.`
    });
    hydrateWorkspace(workspace);
    selectedSubmissionId.value = submission.id;
    emitSuccessModal({ title: 'Submission Validated', message: `${submission.department} is now cleared for monitoring.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Validation Unavailable', message: error instanceof Error ? error.message : 'Unable to validate this submission.', tone: 'warning' });
  }
}

async function sendBackSubmission(target?: SubmissionRecord | null): Promise<void> {
  const submission = findActionTarget(target || null, 'send_back');
  if (!submission) {
    emitSuccessModal({ title: 'No Submission Selected', message: 'Choose a submission to return for correction.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Send Back Submission',
    message: `Return ${submission.department}'s feed for revision?`,
    confirmText: 'Send Back',
    tone: 'warning'
  });
  if (!confirmed) return;
  try {
    const workspace = await runDataCollectionAction('send_back', submission.id, {
      actor: 'Quality Analyst',
      remarks: `Returned ${submission.feedType} to ${submission.department} for correction.`
    });
    hydrateWorkspace(workspace);
    selectedSubmissionId.value = submission.id;
    emitSuccessModal({ title: 'Sent Back for Revision', message: `${submission.department} now appears as a correction blocker.`, tone: 'warning' });
  } catch (error) {
    emitSuccessModal({ title: 'Send Back Unavailable', message: error instanceof Error ? error.message : 'Unable to return this submission.', tone: 'warning' });
  }
}

onMounted(async () => {
  await loadWorkspace();
});

useRealtimeWorkspace(() => loadWorkspace(true, { silent: true }), { intervalMs: 5_000 });
</script>

<template>
  <div class="pmed-page">
    <v-card class="hero-card" variant="outlined">
      <v-card-text class="hero-wrap">
        <div>
          <div class="page-kicker">Data Collection</div>
          <h1 class="text-h4 font-weight-black mb-1">Department Submission Hub</h1>
          <p class="text-medium-emphasis mb-0">Collect, fetch, review, validate, and route PMED department feeds through the shared integration workspace.</p>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Submission Dataflow</v-card-title>
            <v-card-subtitle>Incoming feeds move through request, import, review, correction, and validation.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="kanban-row">
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Requested</div>
                <div class="text-h6 font-weight-bold">{{ dataflowStats.requested }}</div>
                <div class="text-body-2">Feeds still waiting for upload or PMED review.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Submitted</div>
                <div class="text-h6 font-weight-bold">{{ dataflowStats.submitted }}</div>
                <div class="text-body-2">Departments already visible in the collection queue.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Validated</div>
                <div class="text-h6 font-weight-bold">{{ dataflowStats.validated }}</div>
                <div class="text-body-2">Validated records are ready for downstream monitoring.</div>
              </div>
            </div>

            <div class="records-toolbar mt-4">
              <v-text-field
                v-model="searchTerm"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search submission, department, feed"
              />
              <div class="d-flex ga-2 flex-wrap">
                <v-select
                  v-model="selectedStatus"
                  :items="statusOptions"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="min-width: 180px"
                />
                <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-plus" @click="openRequestModal('request')">New Request</v-btn>
              </div>
            </div>

            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>Submission Reference</th>
                  <th>Department</th>
                  <th>Feed</th>
                  <th>Coverage</th>
                  <th>Status</th>
                  <th>Reviewer</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredSubmissions"
                  :key="row.id"
                  :class="{ 'bg-grey-lighten-5': row.id === selectedSubmissionId }"
                  @click="selectSubmission(row)"
                >
                  <td>
                    <div class="font-weight-bold">{{ row.id }}</div>
                    <div class="text-caption text-medium-emphasis">{{ row.planReference || 'collection record' }}</div>
                  </td>
                  <td>{{ row.department }}</td>
                  <td>{{ row.feedType }}</td>
                  <td>{{ row.coveragePeriod }}</td>
                  <td><v-chip size="x-small" :color="statusColor(row.status)" variant="tonal">{{ row.status }}</v-chip></td>
                  <td>{{ row.reviewerName }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row)">Open</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="validateSubmission(row)">Review</v-btn>
                  </td>
                </tr>
                <tr v-if="!filteredSubmissions.length">
                  <td colspan="7" class="text-center text-medium-emphasis py-6">No collection records match the current filters.</td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="surface-card action-panel mb-4">
          <v-card-item>
            <v-card-title>Action Center</v-card-title>
            <v-card-subtitle>Collection actions stay beside the queue for faster review flow.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="flat" prepend-icon="mdi-send-outline" @click="openRequestModal('request')">Request Data</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-database-sync-outline" @click="openRequestModal('fetch')">Fetch Department Feed</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-database-import-outline" @click="openRequestModal('import')">Import Data</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-check-decagram-outline" :disabled="!filteredSubmissions.length" @click="validateSubmission()">Validate Queue</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-reply-outline" :disabled="!filteredSubmissions.length" @click="sendBackSubmission()">Send Back for Revision</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Collection Gates</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list density="compact">
              <v-list-item v-for="gate in collectionGates" :key="gate.label" :title="gate.label" :prepend-icon="gate.icon" />
            </v-list>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Next Workflow Move</v-card-title>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis">
            {{ nextWorkflowMessage }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" xl="7">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Department Integration Visibility</v-card-title>
            <v-card-subtitle>Live department cards make blockers visible without crowding the workspace.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-row>
              <v-col v-for="department in departments" :key="department.name" cols="12" md="6">
                <div class="info-card">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <div class="font-weight-bold">{{ department.name }}</div>
                    <v-chip size="x-small" :color="statusColor(department.status)" variant="tonal">{{ department.status }}</v-chip>
                  </div>
                  <div class="text-body-2">{{ department.note }}</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" xl="5">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Collection Activity Logs</v-card-title>
            <v-card-subtitle>Recent PMED collection actions and review outcomes.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div v-for="log in activityLogs" :key="`${log.id}-${log.reference}`" class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ log.action }}</div>
                <v-chip size="x-small" :color="toneColor(log.tone)" variant="tonal">{{ formatTimestamp(log.createdAt) }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ log.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ log.actor }} • {{ log.reference || 'PMED collection' }}</div>
            </div>
            <div v-if="!activityLogs.length" class="text-body-2 text-medium-emphasis">No collection activity has been recorded yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="submissionDialog" max-width="720">
      <v-card>
        <v-card-item>
          <v-card-title>
              {{
                dialogMode === 'request'
                  ? 'Request Department Feed'
                  : dialogMode === 'fetch'
                    ? 'Fetch Department Feed'
                  : dialogMode === 'import'
                    ? 'Import Submission Feed'
                    : 'Update Submission'
              }}
          </v-card-title>
          <v-card-subtitle>Capture the collection details and keep the queue current.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.submissionReference" label="Submission Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.planReference" label="Plan Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox v-model="form.departmentName" :items="departmentOptions" label="Department" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.coveragePeriod" label="Coverage Period" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.feedType" label="Feed / Dataset" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.sourceTable" label="Source Table" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.sourceEndpoint" label="Source Endpoint" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.remarks" label="Remarks" variant="outlined" rows="3" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="submissionDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveSubmission">
            {{
              dialogMode === 'request'
                ? 'Send Request'
                : dialogMode === 'fetch'
                  ? 'Fetch Feed'
                : dialogMode === 'import'
                  ? 'Import Feed'
                  : 'Save Changes'
            }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@import './shared-pmed.css';
</style>

