<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';

type StageKey = 'planning' | 'collection' | 'monitoring' | 'evaluation' | 'reporting';
type StageDefinition = { key: StageKey; label: string; question: string; route: string; icon: string };
type RequirementItem = { id: string; label: string; done: boolean };
type ActionItem = { label: string; icon: string; primary?: boolean };
type WorkforceStatus = 'Data Received' | 'Under Evaluation' | 'Feedback Sent' | 'Training Assigned';
type WorkforceTrend = 'Up' | 'Stable' | 'Needs Attention';
type WorkforceRecord = {
  id: string;
  employee: string;
  department: string;
  role: string;
  latestScore: number;
  trend: WorkforceTrend;
  status: WorkforceStatus;
  lastSync: string;
  evaluator: string;
};
type AuditLog = { time: string; actor: string; action: string; stage: StageKey };
type WorkflowLane = { title: string; count: number; detail: string; tone: 'primary' | 'success' | 'warning' | 'info' };

const router = useRouter();
const searchTerm = ref('');
const departmentFilter = ref<'all' | string>('all');
const activeStage = ref<StageKey>('collection');

const stages: StageDefinition[] = [
  { key: 'planning', label: 'Integration Setup', question: 'What HR data will PMED ingest?', route: '/pmed/planning', icon: 'mdi-connection' },
  { key: 'collection', label: 'Data Receipt', question: 'Which workforce records arrived?', route: '/pmed/data-collection', icon: 'mdi-database-import-outline' },
  { key: 'monitoring', label: 'Performance Analysis', question: 'Which trends need action?', route: '/pmed/monitoring', icon: 'mdi-chart-line' },
  { key: 'evaluation', label: 'Evaluation Review', question: 'Who is under evaluation?', route: '/pmed/evaluation', icon: 'mdi-clipboard-text-search-outline' },
  { key: 'reporting', label: 'Feedback and Training', question: 'What goes back to HR?', route: '/pmed/reporting', icon: 'mdi-account-arrow-right-outline' }
];

const requirements: Record<StageKey, RequirementItem[]> = {
  planning: [
    { id: 'plan-map', label: 'HR data map confirmed', done: true },
    { id: 'plan-fields', label: 'Required workforce fields approved', done: true },
    { id: 'plan-owners', label: 'PMED and HR owners assigned', done: true },
    { id: 'plan-policy', label: 'Evaluation policy attached', done: true }
  ],
  collection: [
    { id: 'collect-master', label: 'Employee masterfile imported', done: true },
    { id: 'collect-attendance', label: 'Attendance and productivity feed received', done: true },
    { id: 'collect-appraisal', label: 'HR appraisal dataset validated', done: true },
    { id: 'collect-missing', label: 'Incomplete profiles resolved', done: false }
  ],
  monitoring: [
    { id: 'monitor-baseline', label: 'Performance baseline generated', done: true },
    { id: 'monitor-outliers', label: 'Low-performing teams flagged', done: true },
    { id: 'monitor-watchlist', label: 'At-risk employee watchlist reviewed', done: false }
  ],
  evaluation: [
    { id: 'evaluate-score', label: 'Evaluation scorecards completed', done: true },
    { id: 'evaluate-comments', label: 'PMED remarks captured', done: false },
    { id: 'evaluate-approval', label: 'Final review approved for feedback release', done: false }
  ],
  reporting: [
    { id: 'feedback-drafts', label: 'Feedback memos prepared', done: true },
    { id: 'training-batch', label: 'Training assignments drafted', done: false },
    { id: 'feedback-dispatch', label: 'HR feedback dispatch completed', done: false }
  ]
};

const departmentOptions = ['Human Resources', 'Academics', 'Operations', 'Student Services', 'Finance'];

const workforceRecords = ref<WorkforceRecord[]>([
  { id: 'EMP-1024', employee: 'Maria Santos', department: 'Human Resources', role: 'HR Business Partner', latestScore: 92, trend: 'Up', status: 'Feedback Sent', lastSync: 'Mar 20, 2026 08:10', evaluator: 'PMED Review Desk' },
  { id: 'EMP-1088', employee: 'James Dela Cruz', department: 'Academics', role: 'Faculty Coordinator', latestScore: 74, trend: 'Needs Attention', status: 'Under Evaluation', lastSync: 'Mar 20, 2026 08:25', evaluator: 'Program Outcomes Team' },
  { id: 'EMP-1102', employee: 'Angela Reyes', department: 'Operations', role: 'Operations Analyst', latestScore: 81, trend: 'Stable', status: 'Data Received', lastSync: 'Mar 20, 2026 08:42', evaluator: 'HR Analytics Lead' },
  { id: 'EMP-1147', employee: 'Noel Garcia', department: 'Student Services', role: 'Guidance Associate', latestScore: 69, trend: 'Needs Attention', status: 'Training Assigned', lastSync: 'Mar 20, 2026 09:05', evaluator: 'PMED Capability Desk' },
  { id: 'EMP-1181', employee: 'Rica Mendoza', department: 'Finance', role: 'Payroll Specialist', latestScore: 88, trend: 'Up', status: 'Feedback Sent', lastSync: 'Mar 20, 2026 09:16', evaluator: 'HR Performance Team' },
  { id: 'EMP-1196', employee: 'Carlo Villanueva', department: 'Academics', role: 'Senior Instructor', latestScore: 77, trend: 'Stable', status: 'Under Evaluation', lastSync: 'Mar 20, 2026 09:27', evaluator: 'PMED Academic Review' },
  { id: 'EMP-1204', employee: 'Liza Torres', department: 'Operations', role: 'Procurement Officer', latestScore: 71, trend: 'Needs Attention', status: 'Under Evaluation', lastSync: 'Mar 20, 2026 09:40', evaluator: 'PMED Review Desk' },
  { id: 'EMP-1218', employee: 'Jerome Aquino', department: 'Human Resources', role: 'Recruitment Associate', latestScore: 85, trend: 'Up', status: 'Data Received', lastSync: 'Mar 20, 2026 09:58', evaluator: 'HR Analytics Lead' }
]);

const stageActions: Record<StageKey, ActionItem[]> = {
  planning: [
    { label: 'Import HR Data', icon: 'mdi-database-import-outline', primary: true },
    { label: 'Map Fields', icon: 'mdi-table-cog' },
    { label: 'Assign Owners', icon: 'mdi-account-switch-outline' },
    { label: 'Lock Criteria', icon: 'mdi-shield-check-outline' }
  ],
  collection: [
    { label: 'Import HR Data', icon: 'mdi-database-import-outline', primary: true },
    { label: 'Validate Records', icon: 'mdi-check-decagram-outline' },
    { label: 'Resolve Gaps', icon: 'mdi-clipboard-alert-outline' },
    { label: 'Queue Analysis', icon: 'mdi-chart-timeline-variant' }
  ],
  monitoring: [
    { label: 'Analyze', icon: 'mdi-chart-line', primary: true },
    { label: 'View Trends', icon: 'mdi-chart-bell-curve-cumulative' },
    { label: 'Flag Risks', icon: 'mdi-flag-outline' },
    { label: 'Open Watchlist', icon: 'mdi-account-search-outline' }
  ],
  evaluation: [
    { label: 'Analyze', icon: 'mdi-chart-line', primary: true },
    { label: 'Score Employees', icon: 'mdi-star-circle-outline' },
    { label: 'Send Feedback', icon: 'mdi-account-arrow-right-outline' },
    { label: 'Assign Training', icon: 'mdi-school-outline' }
  ],
  reporting: [
    { label: 'Send Feedback', icon: 'mdi-account-arrow-right-outline', primary: true },
    { label: 'Assign Training', icon: 'mdi-school-outline' },
    { label: 'Export Summary', icon: 'mdi-file-chart-outline' },
    { label: 'Close Cycle', icon: 'mdi-check-circle-outline' }
  ]
};

const workflowLanes: WorkflowLane[] = [
  { title: 'Import', count: 248, detail: 'Employee records synced from HRIS and payroll feed.', tone: 'info' },
  { title: 'Analyze', count: 154, detail: 'Profiles processed into PMED performance scoring.', tone: 'primary' },
  { title: 'Evaluate', count: 61, detail: 'Employees with active reviewer assignments.', tone: 'warning' },
  { title: 'Feedback', count: 98, detail: 'Cases already returned to HR with recommendations.', tone: 'success' }
];

const notifications = ref([
  { title: 'Missing HR Attachments', detail: '12 employee profiles still need competency documents before final evaluation.', type: 'warning' },
  { title: 'Performance Dip Detected', detail: 'Operations team average fell 6 points compared with February 2026.', type: 'info' },
  { title: 'Training Batch Ready', detail: 'Leadership coaching recommendations are ready to send to HR today.', type: 'primary' }
]);

const auditLogs = ref<AuditLog[]>([
  { time: '10:18', actor: 'PMED Review Desk', action: 'Sent feedback memo for Maria Santos to HR', stage: 'reporting' },
  { time: '09:54', actor: 'HR Analytics Lead', action: 'Imported latest workforce performance extract', stage: 'collection' },
  { time: '09:31', actor: 'Program Outcomes Team', action: 'Marked James Dela Cruz for coaching intervention', stage: 'evaluation' },
  { time: '09:12', actor: 'PMED System', action: 'Recomputed department trend scores for March 2026', stage: 'monitoring' },
  { time: '08:47', actor: 'Integration Admin', action: 'Validated HR field mapping for evaluation cycle', stage: 'planning' }
]);

const firstLockedIndex = computed(() => {
  const idx = stages.findIndex((stage) => !isStageComplete(stage.key));
  return idx === -1 ? stages.length : idx + 1;
});

const stageMeta = computed(() =>
  stages.map((stage, index) => ({
    ...stage,
    completion: getStageCompletion(stage.key),
    isCurrent: stage.key === activeStage.value,
    locked: index > firstLockedIndex.value
  }))
);

const totalCompletion = computed(() => {
  const values = stages.map((stage) => getStageCompletion(stage.key));
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
});

const actionCenterActions = computed(() => stageActions[activeStage.value]);
const missingRequirements = computed(() => requirements[activeStage.value].filter((item) => !item.done));

const filteredRecords = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();

  return workforceRecords.value.filter((record) => {
    const matchedDepartment = departmentFilter.value === 'all' || record.department === departmentFilter.value;
    if (!matchedDepartment) return false;
    if (!keyword) return true;

    return [record.employee, record.department, record.role, record.status, record.evaluator, record.trend]
      .join(' ')
      .toLowerCase()
      .includes(keyword);
  });
});

const dashboardCards = computed(() => [
  { title: 'Total Employees', value: '248', subtitle: 'Active workforce tracked in PMED-HR sync', className: 'analytics-card-green', icon: 'mdi-account-group-outline' },
  { title: 'Data Received', value: '214', subtitle: 'Profiles with imported HR performance data', className: 'analytics-card-blue', icon: 'mdi-database-check-outline' },
  { title: 'Under Evaluation', value: String(workforceRecords.value.filter((item) => item.status === 'Under Evaluation').length), subtitle: 'Employees in active PMED review', className: 'analytics-card-orange', icon: 'mdi-clipboard-text-search-outline' },
  { title: 'Feedback Sent', value: String(workforceRecords.value.filter((item) => item.status === 'Feedback Sent').length), subtitle: 'Cases already routed back to HR', className: 'analytics-card-purple', icon: 'mdi-account-arrow-right-outline' }
]);

const performanceTrendSeries = [
  { name: 'Average Performance Score', data: [72, 75, 77, 76, 79, 82] },
  { name: 'Evaluation Completion', data: [34, 42, 55, 59, 71, 83] }
];

const performanceTrendOptions = {
  chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit' },
  colors: ['#1e88e5', '#23ba63'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.3, opacityFrom: 0.28, opacityTo: 0.04, stops: [0, 95, 100] } },
  grid: { strokeDashArray: 4, borderColor: '#e5e7eb' },
  legend: { position: 'top', horizontalAlign: 'left' },
  xaxis: { categories: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'] },
  yaxis: { min: 0, max: 100, tickAmount: 5 },
  tooltip: { theme: 'light' }
};

const evaluationStatusSeries = [98, 61, 35, 54];
const evaluationStatusOptions = {
  chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit' },
  labels: ['Feedback Sent', 'Under Evaluation', 'Training Assigned', 'Data Received'],
  colors: ['#23ba63', '#ff9800', '#7a1fca', '#1e88e5'],
  legend: { position: 'bottom' },
  stroke: { colors: ['#ffffff'] },
  dataLabels: { enabled: false },
  plotOptions: { pie: { donut: { size: '72%' } } }
};

function isStageComplete(stage: StageKey): boolean {
  return requirements[stage].every((item) => item.done);
}

function getStageCompletion(stage: StageKey): number {
  const items = requirements[stage];
  if (!items.length) return 0;
  return Math.round((items.filter((item) => item.done).length / items.length) * 100);
}

function goToStage(stage: StageDefinition & { locked?: boolean }): void {
  if (stage.locked) return;
  activeStage.value = stage.key;
  void router.push(stage.route);
}

function moduleBadgeClass(stage: StageKey): string {
  return `stage-badge stage-${stage}`;
}

function rowStatusColor(status: WorkforceStatus): string {
  if (status === 'Feedback Sent') return 'success';
  if (status === 'Under Evaluation') return 'warning';
  if (status === 'Training Assigned') return 'secondary';
  return 'primary';
}

function trendChipColor(trend: WorkforceTrend): string {
  if (trend === 'Up') return 'success';
  if (trend === 'Stable') return 'info';
  return 'warning';
}

function laneClass(tone: WorkflowLane['tone']): string {
  return `lane-card lane-${tone}`;
}
</script>

<template>
  <div class="pmed-dashboard">
    <v-row class="mb-1">
      <v-col cols="12" lg="8">
        <v-card class="hero-card" variant="outlined">
          <v-card-text class="pa-5">
            <div class="hero-kicker">PMED-HR Integration</div>
            <h1 class="text-h4 font-weight-black mb-2">Workforce Performance and Feedback Dashboard</h1>
            <p class="text-medium-emphasis mb-4">
              The clinic-style PMED workspace is now focused on HR integration. Workforce data, evaluation progress, and feedback handoffs stay in one live dashboard.
            </p>
            <div class="d-flex flex-wrap align-center ga-2 mb-4">
              <v-btn
                to="/pmed/hr-staff-request"
                color="white"
                variant="flat"
                rounded="pill"
                prepend-icon="mdi-account-plus-outline"
                class="hero-cta-hr"
              >
                Request staff from HR
              </v-btn>
            </div>
            <div class="d-flex align-center justify-space-between flex-wrap ga-3">
              <div>
                <div class="text-caption text-medium-emphasis">Global Workflow Completion</div>
                <div class="text-h6 font-weight-bold">{{ totalCompletion }}%</div>
              </div>
              <div class="hero-chip-wrap">
                <v-chip v-for="step in stageMeta" :key="step.key" size="small" :class="moduleBadgeClass(step.key)" variant="outlined">
                  {{ step.label }} {{ step.completion }}%
                </v-chip>
              </div>
            </div>
            <v-progress-linear class="mt-3" color="primary" :model-value="totalCompletion" height="10" rounded />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card class="action-center-card" variant="outlined">
          <v-card-item>
            <v-card-title>Action Center</v-card-title>
            <v-card-subtitle>{{ stageMeta.find((item) => item.key === activeStage)?.label }} workflow actions</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                v-for="action in actionCenterActions"
                :key="action.label"
                size="small"
                :color="action.primary ? 'primary' : undefined"
                :variant="action.primary ? 'flat' : 'outlined'"
                :prepend-icon="action.icon"
              >
                {{ action.label }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <AnalyticsCardGrid :items="dashboardCards" md="6" lg="3" class="mb-4" />

    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="workflow-card">
          <v-card-item>
            <v-card-title>Integration Setup -> Data Receipt -> Performance Analysis -> Evaluation Review -> Feedback and Training</v-card-title>
            <v-card-subtitle>Each stage stays in the same clinic-style workflow shell, but the logic now follows PMED-to-HR operations.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-1">
            <div class="workflow-steps">
              <template v-for="(step, idx) in stageMeta" :key="step.key">
                <button
                  type="button"
                  class="workflow-step"
                  :class="{ current: step.isCurrent, locked: step.locked }"
                  @click="goToStage(step)"
                >
                  <div class="step-head">
                    <v-icon :icon="step.icon" size="18" />
                    <span class="step-title">{{ step.label }}</span>
                    <v-icon v-if="step.locked" icon="mdi-lock-outline" size="14" class="ml-1" />
                  </div>
                  <div class="text-caption text-medium-emphasis">{{ step.question }}</div>
                  <v-progress-linear class="mt-2" color="primary" :model-value="step.completion" height="6" rounded />
                </button>
                <v-icon v-if="idx < stageMeta.length - 1" icon="mdi-chevron-right" size="20" class="flow-arrow" />
              </template>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-1">
      <v-col cols="12" lg="8">
        <v-card variant="outlined">
          <v-card-text class="py-3">
            <div class="search-filter-row">
              <v-text-field
                v-model="searchTerm"
                density="compact"
                variant="outlined"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search employees, reviewers, departments"
              />
              <v-select
                v-model="departmentFilter"
                density="compact"
                variant="outlined"
                hide-details
                :items="[
                  { title: 'All Departments', value: 'all' },
                  ...departmentOptions.map((department) => ({ title: department, value: department }))
                ]"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="missing-card">
          <v-card-item>
            <v-card-title>Workflow Blockers</v-card-title>
            <v-card-subtitle>{{ stageMeta.find((item) => item.key === activeStage)?.label }}</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-list density="compact" class="py-0">
              <v-list-item v-for="item in missingRequirements" :key="item.id" class="px-0">
                <template #prepend>
                  <v-icon icon="mdi-alert-circle-outline" size="16" color="primary" />
                </template>
                <v-list-item-title class="text-body-2">{{ item.label }}</v-list-item-title>
              </v-list-item>
              <v-list-item v-if="!missingRequirements.length" class="px-0">
                <v-list-item-title class="text-body-2 text-medium-emphasis">No blockers in this stage.</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="mb-4">
          <v-card-item>
            <v-card-title>Performance Trend</v-card-title>
            <v-card-subtitle>Monthly workforce score movement and evaluation completion trend.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <apexchart type="area" height="320" :options="performanceTrendOptions" :series="performanceTrendSeries" />
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Employee Evaluation Queue</v-card-title>
            <v-card-subtitle>Current PMED review list based on imported HR performance signals.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Score</th>
                  <th>Trend</th>
                  <th>Status</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in filteredRecords.slice(0, 6)" :key="record.id">
                  <td>
                    <div class="font-weight-medium">{{ record.employee }}</div>
                    <div class="text-caption text-medium-emphasis">{{ record.role }}</div>
                  </td>
                  <td>{{ record.department }}</td>
                  <td class="font-weight-bold">{{ record.latestScore }}</td>
                  <td>
                    <v-chip size="x-small" :color="trendChipColor(record.trend)" variant="tonal">{{ record.trend }}</v-chip>
                  </td>
                  <td>
                    <v-chip size="x-small" :color="rowStatusColor(record.status)" variant="tonal">{{ record.status }}</v-chip>
                  </td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary">Review</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="mb-4">
          <v-card-item>
            <v-card-title>Evaluation Status</v-card-title>
            <v-card-subtitle>Distribution of current employee review outcomes.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <apexchart type="donut" height="300" :options="evaluationStatusOptions" :series="evaluationStatusSeries" />
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-item>
            <v-card-title>HR Feedback Workflow</v-card-title>
            <v-card-subtitle>Core handoff lanes after PMED analysis is complete.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <div class="lane-stack">
              <div v-for="lane in workflowLanes" :key="lane.title" :class="laneClass(lane.tone)">
                <div class="d-flex align-center justify-space-between ga-2">
                  <div class="font-weight-bold">{{ lane.title }}</div>
                  <v-chip size="x-small" color="primary" variant="outlined">{{ lane.count }}</v-chip>
                </div>
                <div class="text-body-2 text-medium-emphasis mt-1">{{ lane.detail }}</div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Recent Activity / Audit Logs</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-timeline density="compact" side="end" truncate-line="both">
              <v-timeline-item v-for="log in auditLogs" :key="`${log.time}-${log.actor}`" dot-color="primary" size="small">
                <div class="text-caption text-medium-emphasis">{{ log.time }} | {{ log.actor }}</div>
                <div class="text-body-2">{{ log.action }}</div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="h-100">
          <v-card-item>
            <v-card-title>Notifications and Alerts</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list density="compact">
              <v-list-item v-for="note in notifications" :key="note.title">
                <template #prepend>
                  <v-icon
                    :icon="note.type === 'warning' ? 'mdi-alert-outline' : note.type === 'info' ? 'mdi-information-outline' : 'mdi-bell-outline'"
                    color="primary"
                    size="18"
                  />
                </template>
                <v-list-item-title class="text-body-2">{{ note.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ note.detail }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="8">
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Workforce Integration Panel</v-card-title>
            <v-card-subtitle>PMED consumes HR records, evaluates employee performance, and pushes feedback or training actions back to HR.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Latest Score</th>
                  <th>Evaluation Status</th>
                  <th>Last Sync</th>
                  <th>Assigned Reviewer</th>
                  <th class="text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in filteredRecords" :key="record.id">
                  <td>
                    <div class="font-weight-medium">{{ record.employee }}</div>
                    <div class="text-caption text-medium-emphasis">{{ record.role }}</div>
                  </td>
                  <td>{{ record.department }}</td>
                  <td class="font-weight-bold">{{ record.latestScore }}</td>
                  <td>
                    <v-chip size="x-small" :color="rowStatusColor(record.status)" variant="tonal">{{ record.status }}</v-chip>
                  </td>
                  <td>{{ record.lastSync }}</td>
                  <td>{{ record.evaluator }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary">Import HR Data</v-btn>
                    <v-btn size="x-small" variant="text" color="primary">Send Feedback</v-btn>
                    <v-btn size="x-small" variant="text" color="primary">Assign Training</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-speed-dial location="bottom end" transition="fade-transition">
      <template #activator="{ props: activatorProps }">
        <v-btn v-bind="activatorProps" color="primary" icon="mdi-lightning-bolt-outline" size="large" elevation="6" />
      </template>
      <v-btn key="quick-hr-staff" to="/pmed/hr-staff-request" color="primary" icon="mdi-account-plus-outline" size="small" />
      <v-btn key="quick-import" color="primary" icon="mdi-database-import-outline" size="small" />
      <v-btn key="quick-analyze" color="primary" icon="mdi-chart-line" size="small" />
      <v-btn key="quick-feedback" color="primary" icon="mdi-account-arrow-right-outline" size="small" />
      <v-btn key="quick-training" color="primary" icon="mdi-school-outline" size="small" />
    </v-speed-dial>
  </div>
</template>

<style scoped>
.pmed-dashboard {
  --blue-700: #1565c0;
  --gray-900: #1f2937;
  --gray-700: #374151;
  --gray-500: #6b7280;
  --gray-300: #d1d5db;
}

.hero-card {
  border-radius: 16px;
  border-color: var(--gray-300) !important;
  background: linear-gradient(90deg, #29459d 0%, #3f67c3 52%, #56a3ee 100%);
  box-shadow: 0 18px 30px rgba(28, 58, 143, 0.2);
}

.hero-card :deep(h1),
.hero-card :deep(.text-h6),
.hero-card :deep(.text-caption),
.hero-card :deep(.text-medium-emphasis) {
  color: #fff !important;
}

.hero-cta-hr {
  color: var(--blue-700) !important;
  font-weight: 700;
  text-transform: none;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12) !important;
}

.hero-kicker {
  display: inline-flex;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 0.5px;
  font-weight: 700;
  color: #fff;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
}

.action-center-card,
.workflow-card,
.missing-card {
  border-radius: 16px;
}

.hero-chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stage-badge {
  border-color: #c8ddfb !important;
  color: var(--blue-700) !important;
  background: #f5f9ff;
}

.stage-badge.stage-collection,
.stage-badge.stage-monitoring,
.stage-badge.stage-evaluation,
.stage-badge.stage-reporting {
  border-color: var(--gray-300) !important;
  color: var(--gray-700) !important;
  background: #ffffff;
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 10px;
  align-items: center;
}

.workflow-step {
  grid-column: span 1;
  min-height: 106px;
  border: 1px solid var(--gray-300);
  background: #ffffff;
  border-radius: 12px;
  padding: 10px;
  text-align: left;
  transition: all 0.2s ease;
}

.workflow-step.current {
  border-color: #8ab8f6;
  box-shadow: 0 0 0 2px rgba(30, 136, 229, 0.14);
  background: #f7fbff;
}

.workflow-step.locked {
  opacity: 0.55;
  cursor: not-allowed;
}

.workflow-step:not(.locked):hover {
  border-color: #8ab8f6;
}

.step-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.step-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--gray-900);
}

.flow-arrow {
  grid-column: span 1;
  justify-self: center;
  color: var(--gray-500);
}

.search-filter-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

.lane-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lane-card {
  padding: 12px;
  border: 1px solid var(--gray-300);
  border-radius: 12px;
  background: #fcfdff;
}

.lane-primary {
  border-color: rgba(30, 136, 229, 0.22);
  background: rgba(30, 136, 229, 0.05);
}

.lane-success {
  border-color: rgba(35, 186, 99, 0.24);
  background: rgba(35, 186, 99, 0.06);
}

.lane-warning {
  border-color: rgba(255, 152, 0, 0.24);
  background: rgba(255, 152, 0, 0.07);
}

.lane-info {
  border-color: rgba(67, 56, 202, 0.2);
  background: rgba(67, 56, 202, 0.05);
}

@media (max-width: 1279px) {
  .workflow-steps {
    grid-template-columns: 1fr;
  }

  .flow-arrow {
    display: none;
  }

  .search-filter-row {
    grid-template-columns: 1fr;
  }
}
</style>
