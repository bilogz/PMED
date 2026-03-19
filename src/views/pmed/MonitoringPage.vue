<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import {
  fetchMonitoringWorkspace,
  runMonitoringAction,
  saveMonitoringSnapshot,
  type MonitoringActivityLog,
  type MonitoringAlert,
  type MonitoringSnapshot
} from '@/services/pmedMonitoring';

type MonitoringStatus = 'On Track' | 'Monitoring' | 'Needs Attention' | 'At Risk';

type SnapshotRecord = MonitoringSnapshot & {
  status: MonitoringStatus;
};

const snapshots = ref<SnapshotRecord[]>([]);
const alerts = ref<MonitoringAlert[]>([]);
const activityLogs = ref<MonitoringActivityLog[]>([]);
const isLoading = ref(false);

const searchTerm = ref('');
const selectedStatus = ref<'All Statuses' | MonitoringStatus>('All Statuses');
const selectedMonitorId = ref('');
const monitorDialog = ref(false);
const dialogMode = ref<'create' | 'edit' | 'track'>('create');

const form = reactive({
  monitorReference: '',
  planReference: '',
  departmentName: '',
  indicatorName: '',
  targetValue: 0,
  actualValue: 0,
  summary: ''
});

const statusOptions: Array<'All Statuses' | MonitoringStatus> = [
  'All Statuses',
  'On Track',
  'Monitoring',
  'Needs Attention',
  'At Risk'
];

const departmentOptions = ['Clinic', 'Guidance', 'HR', 'Cashier', 'Registrar', 'Prefect', 'CRAD', 'Computer Lab', 'PMED'];

const selectedSnapshot = computed(() =>
  snapshots.value.find((item) => item.id === selectedMonitorId.value) || null
);

const cards = computed(() => {
  const total = snapshots.value.length || 1;
  const onTrack = snapshots.value.filter((item) => item.status === 'On Track').length;
  const issueCount = snapshots.value.filter((item) => item.status === 'At Risk' || item.status === 'Needs Attention').length;
  const notificationCount = activityLogs.value.filter((item) => item.action.toLowerCase().includes('notification')).length;
  const escalations = snapshots.value.filter((item) => item.status === 'At Risk').length;
  return [
    {
      title: 'On Track',
      value: `${Math.round((onTrack / total) * 100)}%`,
      subtitle: 'Progress meeting plan',
      className: 'analytics-card-green',
      icon: 'mdi-chart-line'
    },
    {
      title: 'Open Issues',
      value: String(issueCount),
      subtitle: 'Need intervention',
      className: 'analytics-card-orange',
      icon: 'mdi-alert-outline'
    },
    {
      title: 'Notifications',
      value: String(notificationCount),
      subtitle: 'Realtime updates sent',
      className: 'analytics-card-blue',
      icon: 'mdi-bell-outline'
    },
    {
      title: 'Escalations',
      value: String(escalations),
      subtitle: 'Priority blockers',
      className: 'analytics-card-purple',
      icon: 'mdi-flag-outline'
    }
  ];
});

const recoveryCount = computed(() =>
  snapshots.value.filter((item) => item.status === 'Monitoring' || item.status === 'On Track').length
);

const filteredSnapshots = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return snapshots.value.filter((item) => {
    const matchesStatus = selectedStatus.value === 'All Statuses' || item.status === selectedStatus.value;
    const matchesSearch =
      !keyword ||
      [
        item.id,
        item.planReference,
        item.department,
        item.indicator,
        item.assignedTo,
        item.summary
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesStatus && matchesSearch;
  });
});

const nextWorkflowMessage = computed(() =>
  snapshots.value.some((item) => item.status === 'At Risk' || item.status === 'Needs Attention')
    ? 'Evaluation should wait until the at-risk indicators have intervention owners and updated actual values.'
    : 'Monitoring is stable enough for evaluation prep once the latest summaries are distributed.'
);

function hydrateWorkspace(payload: {
  snapshots: MonitoringSnapshot[];
  alerts: MonitoringAlert[];
  activityLogs: MonitoringActivityLog[];
}): void {
  snapshots.value = (payload.snapshots || []).map((item) => ({
    ...item,
    status: item.status as MonitoringStatus
  }));
  alerts.value = payload.alerts || [];
  activityLogs.value = payload.activityLogs || [];
  if (!selectedMonitorId.value && snapshots.value[0]) {
    selectedMonitorId.value = snapshots.value[0].id;
  } else if (selectedMonitorId.value && !snapshots.value.some((item) => item.id === selectedMonitorId.value)) {
    selectedMonitorId.value = snapshots.value[0]?.id || '';
  }
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchMonitoringWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Monitoring Data Warning',
      message: error instanceof Error ? error.message : 'Unable to load PMED monitoring workspace.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function statusColor(value: string): string {
  if (value === 'On Track') return 'success';
  if (value === 'Monitoring') return 'primary';
  if (value === 'Needs Attention') return 'warning';
  return 'error';
}

function toneColor(value: MonitoringActivityLog['tone']): string {
  if (value === 'success') return 'success';
  if (value === 'warning') return 'warning';
  return 'primary';
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000) return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(value);
  if (Number.isInteger(value)) return String(value);
  return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 }).format(value);
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function resetForm(): void {
  Object.assign(form, {
    monitorReference: '',
    planReference: '',
    departmentName: '',
    indicatorName: '',
    targetValue: 0,
    actualValue: 0,
    summary: ''
  });
}

function openCreateModal(mode: 'create' | 'track'): void {
  dialogMode.value = mode;
  resetForm();
  form.monitorReference = `MON-${new Date().getFullYear()}-${String(snapshots.value.length + 1).padStart(3, '0')}`;
  monitorDialog.value = true;
}

function openEditModal(snapshot: SnapshotRecord): void {
  dialogMode.value = 'edit';
  Object.assign(form, {
    monitorReference: snapshot.id,
    planReference: snapshot.planReference,
    departmentName: snapshot.department,
    indicatorName: snapshot.indicator,
    targetValue: snapshot.targetValue,
    actualValue: snapshot.actualValue,
    summary: snapshot.summary
  });
  selectedMonitorId.value = snapshot.id;
  monitorDialog.value = true;
}

function selectSnapshot(snapshot: SnapshotRecord): void {
  selectedMonitorId.value = snapshot.id;
}

async function saveSnapshot(): Promise<void> {
  if (!form.monitorReference.trim() || !form.departmentName.trim() || !form.indicatorName.trim()) {
    emitSuccessModal({ title: 'Missing Fields', message: 'Please complete the KPI reference, department, and indicator fields.', tone: 'warning' });
    return;
  }
  try {
    const workspace = await saveMonitoringSnapshot({
      monitorReference: form.monitorReference.trim(),
      planReference: form.planReference.trim(),
      departmentName: form.departmentName.trim(),
      indicatorName: form.indicatorName.trim(),
      targetValue: Number(form.targetValue || 0),
      actualValue: Number(form.actualValue || 0),
      summary: form.summary.trim(),
      action: dialogMode.value === 'track' ? 'track_progress' : 'upsert'
    });
    hydrateWorkspace(workspace);
    selectedMonitorId.value = form.monitorReference.trim();
    monitorDialog.value = false;
    emitSuccessModal({
      title: dialogMode.value === 'track' ? 'Progress Updated' : dialogMode.value === 'create' ? 'KPI Added' : 'KPI Updated',
      message: `${form.indicatorName} is now reflected in the monitoring board.`,
      tone: 'success'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Save Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save this monitoring item.',
      tone: 'warning'
    });
  }
}

function resolveActionTarget(preferred?: SnapshotRecord | null): SnapshotRecord | null {
  if (preferred) return preferred;
  if (selectedSnapshot.value) return selectedSnapshot.value;
  return filteredSnapshots.value[0] || null;
}

async function flagIssue(target?: SnapshotRecord | null): Promise<void> {
  const snapshot = resolveActionTarget(target || null);
  if (!snapshot) {
    emitSuccessModal({ title: 'No KPI Selected', message: 'Choose a KPI row before flagging an issue.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Flag Monitoring Issue',
    message: `Flag ${snapshot.department}'s indicator for intervention?`,
    confirmText: 'Flag Issue',
    tone: 'warning'
  });
  if (!confirmed) return;
  try {
    const workspace = await runMonitoringAction('flag_issue', {
      monitorReference: snapshot.id,
      actor: 'Monitoring Officer',
      summary: snapshot.summary || `${snapshot.indicator} now requires intervention.`
    });
    hydrateWorkspace(workspace);
    selectedMonitorId.value = snapshot.id;
    emitSuccessModal({ title: 'Issue Flagged', message: `${snapshot.indicator} now appears in the issue radar.`, tone: 'warning' });
  } catch (error) {
    emitSuccessModal({ title: 'Action Unavailable', message: error instanceof Error ? error.message : 'Unable to flag this issue.', tone: 'warning' });
  }
}

async function resolveIssue(target?: SnapshotRecord | null): Promise<void> {
  const snapshot = resolveActionTarget(target || null);
  if (!snapshot) {
    emitSuccessModal({ title: 'No KPI Selected', message: 'Choose a KPI row before resolving an issue.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Resolve Monitoring Issue',
    message: `Mark ${snapshot.department}'s indicator as resolved and return it to active monitoring?`,
    confirmText: 'Resolve',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runMonitoringAction('resolve_issue', {
      monitorReference: snapshot.id,
      actor: 'Monitoring Officer',
      status: snapshot.actualValue >= snapshot.targetValue ? 'On Track' : 'Monitoring',
      summary: `${snapshot.indicator} was reviewed and moved back into active monitoring.`
    });
    hydrateWorkspace(workspace);
    selectedMonitorId.value = snapshot.id;
    emitSuccessModal({ title: 'Issue Resolved', message: `${snapshot.indicator} has been returned to the active KPI flow.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Resolve Unavailable', message: error instanceof Error ? error.message : 'Unable to resolve this issue.', tone: 'warning' });
  }
}

async function sendNotification(target?: SnapshotRecord | null): Promise<void> {
  const snapshot = resolveActionTarget(target || null);
  try {
    const workspace = await runMonitoringAction('notify', {
      monitorReference: snapshot?.id,
      actor: 'PMED Notifications Desk',
      summary: snapshot ? `${snapshot.department} stakeholders were notified about ${snapshot.indicator}.` : 'Monitoring stakeholders were notified.'
    });
    hydrateWorkspace(workspace);
    emitSuccessModal({ title: 'Notification Sent', message: snapshot ? `${snapshot.department} was notified about the latest KPI update.` : 'Monitoring notifications were sent.', tone: 'info' });
  } catch (error) {
    emitSuccessModal({ title: 'Notification Unavailable', message: error instanceof Error ? error.message : 'Unable to send monitoring notifications.', tone: 'warning' });
  }
}

async function generateSummary(target?: SnapshotRecord | null): Promise<void> {
  const snapshot = resolveActionTarget(target || null);
  try {
    const workspace = await runMonitoringAction('generate_summary', {
      monitorReference: snapshot?.id,
      actor: 'Reports Analyst',
      summary: snapshot ? `${snapshot.indicator} summary generated for ${snapshot.department}.` : 'Monitoring summary generated.'
    });
    hydrateWorkspace(workspace);
    emitSuccessModal({ title: 'Summary Generated', message: snapshot ? `A summary for ${snapshot.indicator} is ready.` : 'Monitoring summary is ready.', tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Summary Unavailable', message: error instanceof Error ? error.message : 'Unable to generate a monitoring summary.', tone: 'warning' });
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
          <div class="page-kicker">Monitoring</div>
          <h1 class="text-h4 font-weight-black mb-1">Progress and KPI Desk</h1>
          <p class="text-medium-emphasis mb-0">Track actual delivery versus target, flag blockers, and move the workflow cleanly toward evaluation.</p>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Department Performance Tracker</v-card-title>
            <v-card-subtitle>KPI rows align with the monitoring dataflow from collected department inputs.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="records-toolbar">
              <v-text-field
                v-model="searchTerm"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search KPI, department, owner"
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
                <v-btn size="small" variant="outlined" prepend-icon="mdi-plus" @click="openCreateModal('create')">Add KPI</v-btn>
                <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-file-chart-outline" @click="generateSummary()">Generate Summary</v-btn>
              </div>
            </div>
            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>KPI Reference</th>
                  <th>Department</th>
                  <th>Indicator</th>
                  <th>Target</th>
                  <th>Actual</th>
                  <th>Status</th>
                  <th>Assigned</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredSnapshots"
                  :key="row.id"
                  :class="{ 'bg-grey-lighten-5': row.id === selectedMonitorId }"
                  @click="selectSnapshot(row)"
                >
                  <td>
                    <div class="font-weight-bold">{{ row.id }}</div>
                    <div class="text-caption text-medium-emphasis">{{ row.planReference || 'monitoring row' }}</div>
                  </td>
                  <td>{{ row.department }}</td>
                  <td>{{ row.indicator }}</td>
                  <td>{{ formatNumber(row.targetValue) }}</td>
                  <td>{{ formatNumber(row.actualValue) }}</td>
                  <td><v-chip size="x-small" :color="statusColor(row.status)" variant="tonal">{{ row.status }}</v-chip></td>
                  <td>{{ row.assignedTo }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row)">Open</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row); dialogMode = 'track'">Update</v-btn>
                    <v-btn
                      v-if="row.status === 'At Risk' || row.status === 'Needs Attention'"
                      size="x-small"
                      variant="text"
                      color="success"
                      @click.stop="resolveIssue(row)"
                    >
                      Resolve
                    </v-btn>
                    <v-btn
                      v-else
                      size="x-small"
                      variant="text"
                      color="warning"
                      @click.stop="flagIssue(row)"
                    >
                      Flag
                    </v-btn>
                  </td>
                </tr>
                <tr v-if="!filteredSnapshots.length">
                  <td colspan="8" class="text-center text-medium-emphasis py-6">No monitoring records match the current filters.</td>
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
            <v-card-subtitle>Monitoring actions are placed beside issue visibility and KPI tracking.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="outlined" prepend-icon="mdi-plus" @click="openCreateModal('create')">Add KPI</v-btn>
              <v-btn color="primary" variant="flat" prepend-icon="mdi-chart-timeline-variant" @click="openCreateModal('track')">Track Progress</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-flag-outline" :disabled="!filteredSnapshots.length" @click="flagIssue()">Flag Issue</v-btn>
              <v-btn variant="tonal" color="success" prepend-icon="mdi-check-circle-outline" :disabled="!filteredSnapshots.length" @click="resolveIssue()">Resolve Issue</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-bell-outline" @click="sendNotification()">Send Notification</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-file-chart-outline" @click="generateSummary()">Generate Summary</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card h-100">
          <v-card-item>
            <v-card-title>Issue Radar</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="alert in alerts"
                :key="`${alert.id}-${alert.message}`"
                :title="alert.message"
                :prepend-icon="alert.severity === 'At Risk' ? 'mdi-bell-alert-outline' : 'mdi-alert-circle-outline'"
              />
              <div v-if="!alerts.length" class="text-body-2 text-medium-emphasis">No monitoring alerts are open right now.</div>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>End-to-End Flow Logic</v-card-title>
            <v-card-subtitle>Monitoring determines whether PMED can safely move toward evaluation.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="kanban-row">
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Tracked KPIs</div>
                <div class="text-h6 font-weight-bold">{{ snapshots.length }}</div>
                <div class="text-body-2">Indicators actively monitored across PMED departments.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Flagged Issues</div>
                <div class="text-h6 font-weight-bold">{{ snapshots.filter((item) => item.status === 'At Risk' || item.status === 'Needs Attention').length }}</div>
                <div class="text-body-2">Records that still need intervention before evaluation.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Workflow Decision</div>
                <div class="text-h6 font-weight-bold">{{ snapshots.some((item) => item.status === 'At Risk') ? 'Hold' : 'Proceed' }}</div>
                <div class="text-body-2">{{ nextWorkflowMessage }}</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Recovered KPIs</div>
                <div class="text-h6 font-weight-bold">{{ recoveryCount }}</div>
                <div class="text-body-2">Indicators that are already back in active monitoring flow.</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Monitoring Activity Logs</v-card-title>
            <v-card-subtitle>Recent monitoring actions and workflow decisions.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div v-for="log in activityLogs" :key="`${log.id}-${log.reference}`" class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ log.action }}</div>
                <v-chip size="x-small" :color="toneColor(log.tone)" variant="tonal">{{ formatTimestamp(log.createdAt) }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ log.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ log.actor }} • {{ log.reference || 'Monitoring' }}</div>
            </div>
            <div v-if="!activityLogs.length" class="text-body-2 text-medium-emphasis">No monitoring activity has been recorded yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="monitorDialog" max-width="760">
      <v-card>
        <v-card-item>
          <v-card-title>
            {{
              dialogMode === 'create'
                ? 'Add KPI Monitor'
                : dialogMode === 'track'
                  ? 'Track KPI Progress'
                  : 'Update KPI Monitor'
            }}
          </v-card-title>
          <v-card-subtitle>Keep monitoring logic, actual values, and escalation notes aligned in one workspace.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.monitorReference" label="KPI Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.planReference" label="Plan Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox v-model="form.departmentName" :items="departmentOptions" label="Department" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.indicatorName" label="Indicator" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.targetValue" label="Target Value" type="number" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.actualValue" label="Actual Value" type="number" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.summary" label="Progress Summary" variant="outlined" rows="3" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="monitorDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveSnapshot">
            {{
              dialogMode === 'track'
                ? 'Save Progress'
                : dialogMode === 'create'
                  ? 'Add Monitor'
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

