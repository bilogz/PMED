<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';

type StageKey = 'planning' | 'collection' | 'monitoring' | 'evaluation' | 'reporting';
type DataStatus = 'Missing' | 'Pending' | 'Completed';

type StageDefinition = {
  key: StageKey;
  label: string;
  question: string;
  route: string;
  icon: string;
};

type RequirementItem = {
  id: string;
  label: string;
  done: boolean;
};

type ModuleSection = {
  title: string;
  items: string[];
};

type ModuleAction = {
  label: string;
  primary?: boolean;
};

type ModuleConfig = {
  key: StageKey;
  title: string;
  question: string;
  sections: ModuleSection[];
  logic: string[];
  actions: ModuleAction[];
};

type DepartmentFeed = {
  name: string;
  dataFeed: string;
  status: DataStatus;
  submittedAt: string;
  validation: string;
};

type AuditLog = {
  time: string;
  actor: string;
  action: string;
  stage: StageKey;
};

const router = useRouter();
const searchTerm = ref('');
const stageFilter = ref<'all' | StageKey>('all');
const activeStage = ref<StageKey>('collection');

const stages: StageDefinition[] = [
  { key: 'planning', label: 'Planning', question: 'What will we do?', route: '/pmed/planning', icon: 'mdi-calendar-clock-outline' },
  { key: 'collection', label: 'Data Collection', question: 'What happened?', route: '/pmed/data-collection', icon: 'mdi-database-outline' },
  { key: 'monitoring', label: 'Monitoring', question: 'Are we on track?', route: '/pmed/monitoring', icon: 'mdi-chart-line' },
  { key: 'evaluation', label: 'Evaluation', question: 'Did we succeed?', route: '/pmed/evaluation', icon: 'mdi-clipboard-text-outline' },
  { key: 'reporting', label: 'Reporting', question: 'What are the results?', route: '/pmed/reporting', icon: 'mdi-file-chart-outline' }
];

const requirements: Record<StageKey, RequirementItem[]> = {
  planning: [
    { id: 'plan-goals', label: 'Goals and timeline defined', done: true },
    { id: 'plan-departments', label: 'Departments assigned', done: true },
    { id: 'plan-requirements', label: 'Requirements attached', done: true },
    { id: 'plan-budget', label: 'Budget allocation approved', done: true }
  ],
  collection: [
    { id: 'collect-registrar', label: 'Registrar submission validated', done: true },
    { id: 'collect-cashier', label: 'Cashier submission validated', done: true },
    { id: 'collect-clinic', label: 'Clinic submission validated', done: true },
    { id: 'collect-guidance', label: 'Guidance submission validated', done: false },
    { id: 'collect-prefect', label: 'Prefect submission validated', done: true },
    { id: 'collect-comlab', label: 'Computer Lab submission validated', done: false },
    { id: 'collect-crad', label: 'CRAD submission validated', done: true },
    { id: 'collect-hr', label: 'HR submission validated', done: true }
  ],
  monitoring: [
    { id: 'monitor-kpi', label: 'KPI tracker initialized', done: false },
    { id: 'monitor-risks', label: 'Issue risk log updated', done: false },
    { id: 'monitor-summary', label: 'Progress summary generated', done: false }
  ],
  evaluation: [
    { id: 'eval-kpi', label: 'Targets vs results compared', done: false },
    { id: 'eval-scoring', label: 'Department scoring completed', done: false },
    { id: 'eval-approval', label: 'Evaluation approved', done: false }
  ],
  reporting: [
    { id: 'report-compile', label: 'Final report compiled', done: false },
    { id: 'report-export', label: 'PDF/Excel export prepared', done: false },
    { id: 'report-admin', label: 'Administration delivery completed', done: false }
  ]
};

const moduleConfigs: ModuleConfig[] = [
  {
    key: 'planning',
    title: 'Planning Module',
    question: 'What will we do?',
    sections: [
      { title: 'Planning Overview', items: ['Active Plans', 'Targets', 'Resources cards'] },
      { title: 'Purpose / Includes / Output', items: ['Purpose alignment', 'Scope inclusions', 'Expected outputs'] },
      { title: 'Primary Data Sources', items: ['Registrar', 'Clinic', 'HR', 'School Administration'] },
      { title: 'Flow Context', items: ['Current stage context', 'Dependencies to proceed'] }
    ],
    logic: [
      'Define PMED goals, timeline, and stakeholders.',
      'Assign responsible departments and required data inputs.',
      'Cannot proceed unless plan requirements are complete.'
    ],
    actions: [
      { label: 'Create New Plan', primary: true },
      { label: 'Edit Plan' },
      { label: 'Set Targets' },
      { label: 'Allocate Budget' },
      { label: 'Assign Departments' },
      { label: 'Attach Requirements' },
      { label: 'Save Draft' },
      { label: 'Submit Plan' },
      { label: 'Move to Data Collection' }
    ]
  },
  {
    key: 'collection',
    title: 'Data Collection Module',
    question: 'What happened?',
    sections: [
      { title: 'Department Submissions Panel', items: ['Registrar, Cashier, Clinic, Guidance, Prefect, Computer Lab, CRAD, HR'] },
      { title: 'Data Status Table', items: ['Not Submitted', 'Pending', 'Validated'] },
      { title: 'Missing Data Alerts', items: ['Late submissions', 'Validation blockers'] }
    ],
    logic: [
      'Track submission status per department and validate data quality.',
      'Show Not Submitted, Pending, and Validated states clearly.',
      'Cannot proceed if required department data is incomplete.'
    ],
    actions: [
      { label: 'Request Data', primary: true },
      { label: 'Import Data' },
      { label: 'View Submission' },
      { label: 'Validate Data' },
      { label: 'Approve Data' },
      { label: 'Reject Data' },
      { label: 'Send Back for Revision' },
      { label: 'Mark as Complete' },
      { label: 'Move to Monitoring' }
    ]
  },
  {
    key: 'monitoring',
    title: 'Monitoring Module',
    question: 'Are we on track?',
    sections: [
      { title: 'KPI Dashboard', items: ['Target completion', 'At-risk flags', 'Completion ratio'] },
      { title: 'Progress Tracking Charts', items: ['Planned vs actual', 'Trend line', 'Time variance'] },
      { title: 'Department Performance Tracker', items: ['Per department performance', 'Issue ownership'] }
    ],
    logic: [
      'Compare actual performance vs planned targets.',
      'Highlight delays and unresolved issues.',
      'Support real-time status updates and notifications.'
    ],
    actions: [
      { label: 'Track Progress', primary: true },
      { label: 'Update Status' },
      { label: 'Flag Issues' },
      { label: 'Send Notification' },
      { label: 'Adjust Targets' },
      { label: 'Generate Progress Summary' },
      { label: 'Move to Evaluation' }
    ]
  },
  {
    key: 'evaluation',
    title: 'Evaluation Module',
    question: 'Did we succeed?',
    sections: [
      { title: 'Performance Analysis', items: ['Outcome analysis', 'Effectiveness scoring'] },
      { title: 'KPI Comparison', items: ['Target vs actual', 'Gap analysis'] },
      { title: 'Success Metrics', items: ['Success rate', 'Intervention needs'] },
      { title: 'Department Evaluation Results', items: ['Scored results', 'Remarks and recommendations'] }
    ],
    logic: [
      'Measure outcomes and effectiveness across departments.',
      'Identify strengths and weaknesses from validated monitoring data.',
      'Approve or request re-evaluation before reporting.'
    ],
    actions: [
      { label: 'Evaluate Performance', primary: true },
      { label: 'Compare Targets vs Results' },
      { label: 'Score Departments' },
      { label: 'Add Remarks' },
      { label: 'Approve Evaluation' },
      { label: 'Request Re-evaluation' },
      { label: 'Move to Reporting' }
    ]
  },
  {
    key: 'reporting',
    title: 'Reporting Module',
    question: 'What are the results?',
    sections: [
      { title: 'Final Reports Dashboard', items: ['Report generation queue', 'Readiness status'] },
      { title: 'Summary Cards', items: ['Top metrics', 'Department outcomes'] },
      { title: 'Export Panel', items: ['Export PDF', 'Export Excel', 'Archive and share'] }
    ],
    logic: [
      'Compile final outputs from all PMED modules.',
      'Generate administration-ready reports and exports.',
      'Send and archive reports for institutional records.'
    ],
    actions: [
      { label: 'Generate Report', primary: true },
      { label: 'Export PDF' },
      { label: 'Export Excel' },
      { label: 'Share Report' },
      { label: 'Send to Administration' },
      { label: 'Archive Report' }
    ]
  }
];

const departmentFeeds = ref<DepartmentFeed[]>([
  { name: 'Registrar', dataFeed: 'Enrollment stats, student records', status: 'Completed', submittedAt: 'Mar 18, 2026 08:50', validation: 'Validated' },
  { name: 'Cashier', dataFeed: 'Financial reports', status: 'Completed', submittedAt: 'Mar 18, 2026 09:10', validation: 'Validated' },
  { name: 'Clinic', dataFeed: 'Health reports', status: 'Completed', submittedAt: 'Mar 18, 2026 09:22', validation: 'Validated' },
  { name: 'Guidance', dataFeed: 'Counseling reports', status: 'Pending', submittedAt: 'Mar 18, 2026 10:02', validation: 'Review Needed' },
  { name: 'Prefect', dataFeed: 'Discipline records', status: 'Completed', submittedAt: 'Mar 18, 2026 10:11', validation: 'Validated' },
  { name: 'Computer Lab', dataFeed: 'Usage reports', status: 'Missing', submittedAt: '-', validation: 'Not Submitted' },
  { name: 'CRAD', dataFeed: 'Activity records', status: 'Completed', submittedAt: 'Mar 18, 2026 10:34', validation: 'Validated' },
  { name: 'HR', dataFeed: 'Employee performance', status: 'Completed', submittedAt: 'Mar 18, 2026 11:15', validation: 'Validated' }
]);

const notifications = ref([
  { title: 'Missing Data Alert', detail: 'Computer Lab has not submitted this cycle.', type: 'warning', stage: 'collection' },
  { title: 'Validation Queue', detail: 'Guidance report is pending review.', type: 'info', stage: 'collection' },
  { title: 'Upcoming Deadline', detail: 'Monitoring summary due on Mar 20, 2026.', type: 'primary', stage: 'monitoring' }
]);

const auditLogs = ref<AuditLog[]>([
  { time: '11:30', actor: 'PMED Admin', action: 'Validated Registrar submission', stage: 'collection' },
  { time: '11:12', actor: 'Cashier Office', action: 'Uploaded financial report batch', stage: 'collection' },
  { time: '10:55', actor: 'PMED Planning Lead', action: 'Approved budget allocation', stage: 'planning' },
  { time: '10:41', actor: 'Clinic Coordinator', action: 'Submitted health outcomes', stage: 'collection' },
  { time: '10:19', actor: 'PMED System', action: 'Generated planning audit snapshot', stage: 'planning' }
]);

const firstLockedIndex = computed(() => {
  const idx = stages.findIndex((stage) => !isStageComplete(stage.key));
  return idx === -1 ? stages.length : idx + 1;
});

const stageMeta = computed(() =>
  stages.map((stage, index) => {
    const completion = getStageCompletion(stage.key);
    const isCurrent = stage.key === activeStage.value;
    const locked = index > firstLockedIndex.value;

    return {
      ...stage,
      completion,
      isCurrent,
      locked
    };
  })
);

const totalCompletion = computed(() => {
  const values = stages.map((stage) => getStageCompletion(stage.key));
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
});

const activeModule = computed(() => moduleConfigs.find((item) => item.key === activeStage.value) || moduleConfigs[0]);

const missingRequirements = computed(() => requirements[activeStage.value].filter((item) => !item.done));

const filteredModules = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();

  return moduleConfigs.filter((module) => {
    const matchedStage = stageFilter.value === 'all' || module.key === stageFilter.value;
    if (!matchedStage) return false;

    if (!keyword) return true;

    const searchable = [
      module.title,
      module.question,
      ...module.sections.flatMap((section) => [section.title, ...section.items]),
      ...module.actions.map((action) => action.label)
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes(keyword);
  });
});

const filteredDepartments = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  if (!keyword) return departmentFeeds.value;

  return departmentFeeds.value.filter((dept) => {
    return [dept.name, dept.dataFeed, dept.status, dept.validation].join(' ').toLowerCase().includes(keyword);
  });
});

const actionCenterActions = computed(() => {
  return activeModule.value.actions.slice(0, 5);
});

const dashboardCards = computed(() => [
  { title: 'Planning Ready', value: '18', subtitle: 'Approved plans', className: 'analytics-card-green', icon: 'mdi-clipboard-check-outline' },
  { title: 'Collection Queue', value: '8', subtitle: 'Department feeds', className: 'analytics-card-blue', icon: 'mdi-database-outline' },
  { title: 'Issues Flagged', value: '9', subtitle: 'Monitoring blockers', className: 'analytics-card-orange', icon: 'mdi-alert-outline' },
  { title: 'Reports Drafted', value: '6', subtitle: 'Pending release', className: 'analytics-card-purple', icon: 'mdi-file-chart-outline' }
]);

function isStageComplete(stage: StageKey): boolean {
  return requirements[stage].every((item) => item.done);
}

function getStageCompletion(stage: StageKey): number {
  const items = requirements[stage];
  if (!items.length) return 0;

  const done = items.filter((item) => item.done).length;
  return Math.round((done / items.length) * 100);
}

function goToStage(stage: StageDefinition & { locked?: boolean }): void {
  if (stage.locked) return;
  activeStage.value = stage.key;
  void router.push(stage.route);
}

function moduleBadgeClass(stage: StageKey): string {
  return `stage-badge stage-${stage}`;
}

function statusClass(status: DataStatus): string {
  if (status === 'Completed') return 'status-dot completed';
  if (status === 'Pending') return 'status-dot pending';
  return 'status-dot missing';
}

function statusVariant(status: DataStatus): 'flat' | 'outlined' {
  return status === 'Completed' ? 'flat' : 'outlined';
}
</script>

<template>
  <div class="pmed-dashboard">
    <v-row class="mb-1">
      <v-col cols="12" lg="8">
        <v-card class="hero-card" variant="outlined">
          <v-card-text class="pa-5">
            <div class="hero-kicker">PMED Full System</div>
            <h1 class="text-h4 font-weight-black mb-2">PMED End-to-End Workflow Dashboard</h1>
            <p class="text-medium-emphasis mb-4">
              Planning to reporting is fully connected. Every module has requirements, actions, and stage-lock logic to keep PMED execution aligned.
            </p>
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
            <v-card-subtitle>{{ activeModule.title }} - {{ activeModule.question }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <div class="d-flex flex-wrap ga-2">
              <v-btn
                v-for="action in actionCenterActions"
                :key="action.label"
                size="small"
                :color="action.primary ? 'primary' : undefined"
                :variant="action.primary ? 'flat' : 'outlined'"
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
            <v-card-title>Planning -> Data Collection -> Monitoring -> Evaluation -> Reporting</v-card-title>
            <v-card-subtitle>Current stage is highlighted. Future stages lock until requirements are complete.</v-card-subtitle>
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
                placeholder="Search modules, actions, departments"
              />
              <v-select
                v-model="stageFilter"
                density="compact"
                variant="outlined"
                hide-details
                :items="[
                  { title: 'All Modules', value: 'all' },
                  { title: 'Planning', value: 'planning' },
                  { title: 'Data Collection', value: 'collection' },
                  { title: 'Monitoring', value: 'monitoring' },
                  { title: 'Evaluation', value: 'evaluation' },
                  { title: 'Reporting', value: 'reporting' }
                ]"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="missing-card">
          <v-card-item>
            <v-card-title>Missing Requirements</v-card-title>
            <v-card-subtitle>{{ activeModule.title }}</v-card-subtitle>
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
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>PMED Modules and Actions</v-card-title>
            <v-card-subtitle>Every module includes sections, logic, and execution actions.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-1">
            <div class="module-list">
              <v-card
                v-for="module in filteredModules"
                :key="module.key"
                variant="outlined"
                class="module-card"
                :class="{ active: module.key === activeStage }"
              >
                <v-card-text>
                  <div class="module-header">
                    <div>
                      <div class="text-subtitle-1 font-weight-bold">{{ module.title }}</div>
                      <div class="text-caption text-medium-emphasis">{{ module.question }}</div>
                    </div>
                    <v-chip size="small" :class="moduleBadgeClass(module.key)" variant="outlined">
                      {{ getStageCompletion(module.key) }}% Complete
                    </v-chip>
                  </div>

                  <v-row class="mt-1">
                    <v-col cols="12" md="7">
                      <div class="text-caption text-medium-emphasis mb-2">UI Sections</div>
                      <div v-for="section in module.sections" :key="section.title" class="module-section-item">
                        <div class="text-body-2 font-weight-medium">{{ section.title }}</div>
                        <div class="text-caption text-medium-emphasis">{{ section.items.join(' | ') }}</div>
                      </div>
                    </v-col>
                    <v-col cols="12" md="5">
                      <div class="text-caption text-medium-emphasis mb-2">Module Logic</div>
                      <v-list density="compact" class="py-0">
                        <v-list-item v-for="rule in module.logic" :key="rule" class="px-0">
                          <template #prepend>
                            <v-icon icon="mdi-check-circle-outline" size="16" color="primary" />
                          </template>
                          <v-list-item-title class="text-body-2">{{ rule }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-col>
                  </v-row>

                  <v-divider class="my-3" />

                  <div class="text-caption text-medium-emphasis mb-2">Action Buttons</div>
                  <div class="d-flex flex-wrap ga-2">
                    <v-btn
                      v-for="action in module.actions"
                      :key="action.label"
                      size="small"
                      :color="action.primary ? 'primary' : undefined"
                      :variant="action.primary ? 'flat' : 'outlined'"
                    >
                      {{ action.label }}
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="mb-4">
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

        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Recent Activity / Audit Logs</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-timeline density="compact" side="end" truncate-line="both">
              <v-timeline-item
                v-for="log in auditLogs"
                :key="`${log.time}-${log.actor}`"
                dot-color="primary"
                size="small"
              >
                <div class="text-caption text-medium-emphasis">{{ log.time }} | {{ log.actor }}</div>
                <div class="text-body-2">{{ log.action }}</div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card variant="outlined">
          <v-card-item>
            <v-card-title>Cross-Department Integration Panel</v-card-title>
            <v-card-subtitle>Submission status, validation state, and quick integration actions.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="pt-2">
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Integrated Data</th>
                  <th>Submission Status</th>
                  <th>Date Submitted</th>
                  <th>Validation Status</th>
                  <th class="text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="department in filteredDepartments" :key="department.name">
                  <td class="font-weight-medium">{{ department.name }}</td>
                  <td>{{ department.dataFeed }}</td>
                  <td>
                    <div class="d-flex align-center ga-2">
                      <span :class="statusClass(department.status)"></span>
                      <v-chip size="x-small" color="primary" :variant="statusVariant(department.status)">
                        {{ department.status }}
                      </v-chip>
                    </div>
                  </td>
                  <td>{{ department.submittedAt }}</td>
                  <td>{{ department.validation }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary">View</v-btn>
                    <v-btn size="x-small" variant="text" color="primary">Validate</v-btn>
                    <v-btn size="x-small" variant="text" color="primary">Notify</v-btn>
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
      <v-btn key="quick-plan" color="primary" icon="mdi-plus" size="small" />
      <v-btn key="quick-request" color="primary" icon="mdi-send-outline" size="small" />
      <v-btn key="quick-report" color="primary" icon="mdi-file-chart-outline" size="small" />
    </v-speed-dial>
  </div>
</template>

<style scoped>
.pmed-dashboard {
  --blue-900: #0f2b6f;
  --blue-700: #1565c0;
  --blue-500: #1e88e5;
  --blue-100: #e8f1fd;
  --gray-900: #1f2937;
  --gray-700: #374151;
  --gray-500: #6b7280;
  --gray-300: #d1d5db;
  --gray-100: #f3f4f6;
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

.module-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.module-card {
  border-radius: 14px;
}

.module-card.active {
  border-color: #8ab8f6 !important;
  box-shadow: 0 0 0 2px rgba(30, 136, 229, 0.12);
}

.module-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.module-section-item {
  padding: 8px;
  border: 1px solid var(--gray-300);
  border-radius: 10px;
  background: #fcfdff;
  margin-bottom: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.completed {
  background: #1f9d55;
}

.status-dot.pending {
  background: #d39b00;
}

.status-dot.missing {
  background: #d64545;
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
