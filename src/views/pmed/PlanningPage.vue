<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import { fetchPlanningWorkspace, runPlanningWorkspaceAction, savePlanningWorkspacePlan, type PlanningWorkspaceDepartment, type PlanningWorkspaceLog } from '@/services/pmedPlanning';

type PlanStatus = 'Draft' | 'For Review' | 'Approved' | 'Archived';

type PlanRecord = {
  id: string;
  program: string;
  lead: string;
  schedule: string;
  scheduleStart: string;
  scheduleEnd: string;
  budget: number;
  status: PlanStatus;
  targetCount: number;
  departments: string[];
  requirementsAttached: boolean;
};

const workflow = [
  { label: 'Planning', active: true, locked: false, progress: 100 },
  { label: 'Data Collection', active: false, locked: false, progress: 72 },
  { label: 'Monitoring', active: false, locked: true, progress: 0 },
  { label: 'Evaluation', active: false, locked: true, progress: 0 },
  { label: 'Reporting', active: false, locked: true, progress: 0 }
];

const plans = ref<PlanRecord[]>([]);
const activityLogs = ref<PlanningWorkspaceLog[]>([]);
const departments = ref<PlanningWorkspaceDepartment[]>([]);
const isLoading = ref(false);

const searchTerm = ref('');
const selectedStatus = ref<'All Statuses' | PlanStatus>('All Statuses');
const planDialog = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const selectedPlanId = ref<string | null>(null);

const form = reactive({
  id: '',
  program: '',
  lead: '',
  schedule: '',
  budget: 0,
  status: 'Draft' as PlanStatus,
  targetCount: 0,
  departments: [] as string[],
  requirementsAttached: false
});

const departmentOptions = ['Clinic', 'Registrar', 'HR', 'Guidance', 'Prefect', 'CRAD', 'Computer Lab', 'Cashier'];

const summary = computed(() => [
  {
    title: 'Active Plans',
    value: String(plans.value.filter((item) => item.status !== 'Archived').length),
    subtitle: 'Approved PMED initiatives',
    className: 'analytics-card-green',
    icon: 'mdi-clipboard-text-clock-outline'
  },
  {
    title: 'Targets',
    value: String(plans.value.reduce((sum, item) => sum + item.targetCount, 0)),
    subtitle: 'Linked to departments',
    className: 'analytics-card-blue',
    icon: 'mdi-target'
  },
  {
    title: 'For Review',
    value: String(plans.value.filter((item) => item.status === 'For Review').length),
    subtitle: 'Need leadership sign-off',
    className: 'analytics-card-orange',
    icon: 'mdi-clipboard-alert-outline'
  },
  {
    title: 'Resources',
    value: `PHP ${formatCompactCurrency(plans.value.reduce((sum, item) => sum + item.budget, 0))}`,
    subtitle: 'Allocated for execution',
    className: 'analytics-card-purple',
    icon: 'mdi-cash-multiple'
  }
]);

const filteredPlans = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();

  return plans.value.filter((plan) => {
    const matchesStatus = selectedStatus.value === 'All Statuses' || plan.status === selectedStatus.value;
    const matchesSearch =
      !keyword ||
      [plan.id, plan.program, plan.lead, plan.schedule, ...plan.departments]
        .join(' ')
        .toLowerCase()
        .includes(keyword);

    return matchesStatus && matchesSearch;
  });
});

const hasBlockingRequirements = computed(() =>
  plans.value.some((item) => item.status !== 'Archived' && !item.requirementsAttached)
);

function statusColor(value: string): string {
  if (value === 'Approved' || value === 'Assigned') return 'success';
  if (value === 'Draft' || value === 'For Review') return 'warning';
  if (value === 'Archived') return 'secondary';
  return 'primary';
}

function toneIcon(tone: PlanningWorkspaceLog['tone']): string {
  if (tone === 'success') return 'mdi-check-circle-outline';
  if (tone === 'warning') return 'mdi-alert-circle-outline';
  return 'mdi-information-outline';
}

function toneColor(tone: PlanningWorkspaceLog['tone']): string {
  if (tone === 'success') return 'success';
  if (tone === 'warning') return 'warning';
  return 'primary';
}

function formatActivityTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return String(value);
}

function formatScheduleRange(start: string, end: string): string {
  if (!start) return '';
  const startDate = new Date(start);
  const endDate = new Date(end || start);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return start;
  const startText = startDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const endText = endDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  if (start === end || startText === endText) return endText;
  return `${startText} to ${endText}`;
}

function parseScheduleInput(input: string): { start: string; end: string } {
  const trimmed = input.trim();
  if (!trimmed) return { start: '', end: '' };
  if (!trimmed.includes(' to ')) return { start: trimmed, end: trimmed };
  const [startPart, endPart] = trimmed.split(' to ');
  const yearMatch = endPart.match(/\b\d{4}\b/);
  const year = yearMatch ? yearMatch[0] : new Date().getFullYear().toString();
  return {
    start: `${startPart}, ${year}`.replace(/\s+,/g, ','),
    end: endPart
  };
}

function hydrateWorkspace(payload: { plans: any[]; activityLogs: PlanningWorkspaceLog[]; departments: PlanningWorkspaceDepartment[] }): void {
  plans.value = payload.plans.map((plan) => ({
    id: plan.id,
    program: plan.program,
    lead: plan.lead,
    schedule: formatScheduleRange(plan.scheduleStart, plan.scheduleEnd),
    scheduleStart: plan.scheduleStart,
    scheduleEnd: plan.scheduleEnd,
    budget: plan.budget,
    status: plan.status as PlanStatus,
    targetCount: plan.targetCount,
    departments: Array.isArray(plan.departments) ? plan.departments : [],
    requirementsAttached: Boolean(plan.requirementsAttached)
  }));
  activityLogs.value = payload.activityLogs || [];
  departments.value = payload.departments || [];
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchPlanningWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Planning Data Warning',
      message: error instanceof Error ? error.message : 'Unable to load PMED planning data.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function openCreateModal(): void {
  dialogMode.value = 'create';
  selectedPlanId.value = null;
  Object.assign(form, {
    id: `PLN-2026-00${plans.value.length + 1}`,
    program: '',
    lead: '',
    schedule: '',
    scheduleStart: '',
    scheduleEnd: '',
    budget: 0,
    status: 'Draft',
    targetCount: 0,
    departments: [],
    requirementsAttached: false
  });
  planDialog.value = true;
}

function openEditModal(plan: PlanRecord): void {
  dialogMode.value = 'edit';
  selectedPlanId.value = plan.id;
  Object.assign(form, {
    ...plan,
    departments: [...plan.departments]
  });
  planDialog.value = true;
}

function closeModal(): void {
  planDialog.value = false;
}

async function savePlan(): Promise<void> {
  const parsedSchedule = parseScheduleInput(form.schedule);
  const payload: PlanRecord = {
    id: form.id.trim(),
    program: form.program.trim(),
    lead: form.lead.trim(),
    schedule: form.schedule.trim(),
    scheduleStart: parsedSchedule.start,
    scheduleEnd: parsedSchedule.end,
    budget: Number(form.budget || 0),
    status: form.status,
    targetCount: Number(form.targetCount || 0),
    departments: [...form.departments],
    requirementsAttached: form.requirementsAttached
  };

  if (!payload.program || !payload.lead || !payload.scheduleStart || !payload.scheduleEnd) return;

  try {
    const workspace = await savePlanningWorkspacePlan({
      planReference: payload.id,
      programTitle: payload.program,
      leadDepartment: payload.lead,
      scheduleStart: payload.scheduleStart,
      scheduleEnd: payload.scheduleEnd,
      budgetAmount: payload.budget,
      status: payload.status,
      targetCount: payload.targetCount,
      departments: payload.departments,
      requirementsAttached: payload.requirementsAttached,
      actor: 'PMED Admin',
      isEdit: dialogMode.value === 'edit'
    });
    hydrateWorkspace(workspace);
    emitSuccessModal({
      title: dialogMode.value === 'create' ? 'Plan Created' : 'Plan Updated',
      message: dialogMode.value === 'create' ? `${payload.program} is now part of the PMED planning queue.` : `${payload.program} has been updated successfully.`,
      tone: dialogMode.value === 'create' ? 'success' : 'info'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Save Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save planning data.',
      tone: 'warning'
    });
  }

  closeModal();
}

async function submitPlan(plan: PlanRecord): Promise<void> {
  if (!plan.requirementsAttached) {
    emitSuccessModal({ title: 'Requirements Missing', message: 'Attach requirements before sending a plan for review.', tone: 'warning' });
    return;
  }

  try {
    hydrateWorkspace(await runPlanningWorkspaceAction('submit', plan.id, 'Planning Officer'));
    emitSuccessModal({ title: 'Plan Submitted', message: `${plan.program} is now waiting for approval.`, tone: 'info' });
  } catch (error) {
    emitSuccessModal({ title: 'Submit Unavailable', message: error instanceof Error ? error.message : 'Unable to submit plan.', tone: 'warning' });
  }
}

async function archivePlan(plan: PlanRecord): Promise<void> {
  const confirmed = await requestConfirmModal({
    title: 'Archive Plan',
    message: `Archive ${plan.program}? This removes it from the active planning queue.`,
    confirmText: 'Archive',
    tone: 'warning'
  });

  if (!confirmed) return;

  try {
    hydrateWorkspace(await runPlanningWorkspaceAction('archive', plan.id, 'PMED Admin'));
    emitSuccessModal({ title: 'Plan Archived', message: `${plan.program} has been archived.`, tone: 'warning' });
  } catch (error) {
    emitSuccessModal({ title: 'Archive Unavailable', message: error instanceof Error ? error.message : 'Unable to archive plan.', tone: 'warning' });
  }
}

async function quickAttachRequirements(): Promise<void> {
  const draft = plans.value.find((item) => item.status === 'Draft');
  if (!draft) return;
  try {
    hydrateWorkspace(await runPlanningWorkspaceAction('attach_requirements', draft.id, 'Operations'));
    emitSuccessModal({ title: 'Requirements Attached', message: `${draft.program} now includes the required planning package.`, tone: 'info' });
  } catch (error) {
    emitSuccessModal({ title: 'Action Unavailable', message: error instanceof Error ? error.message : 'Unable to attach requirements.', tone: 'warning' });
  }
}

async function quickAssignDepartments(): Promise<void> {
  const draft = plans.value.find((item) => item.status === 'Draft');
  if (!draft) return;
  if (!draft.departments.length) {
    draft.departments = ['Clinic', 'Guidance'];
  }
  try {
    hydrateWorkspace(
      await savePlanningWorkspacePlan({
        planReference: draft.id,
        programTitle: draft.program,
        leadDepartment: draft.lead,
        scheduleStart: draft.scheduleStart,
        scheduleEnd: draft.scheduleEnd,
        budgetAmount: draft.budget,
        status: draft.status,
        targetCount: draft.targetCount,
        departments: draft.departments,
        requirementsAttached: draft.requirementsAttached,
        actor: 'Operations',
        isEdit: true
      })
    );
    emitSuccessModal({ title: 'Departments Assigned', message: `${draft.program} is now linked to responsible departments.`, tone: 'info' });
  } catch (error) {
    emitSuccessModal({ title: 'Action Unavailable', message: error instanceof Error ? error.message : 'Unable to assign departments.', tone: 'warning' });
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
          <div class="page-kicker">Planning</div>
          <h1 class="text-h4 font-weight-black mb-1">Planning Command Center</h1>
          <p class="text-medium-emphasis mb-0">Build the PMED plan, assign departments, and lock the workflow before collection starts.</p>
        </div>
      </v-card-text>
    </v-card>

    <v-card variant="outlined" class="mt-4 flow-card">
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-3">Workflow Logic</div>
        <div class="workflow-grid">
          <div v-for="step in workflow" :key="step.label" class="workflow-step" :class="{ active: step.active, locked: step.locked }">
            <div class="d-flex align-center justify-space-between">
              <div class="font-weight-bold text-body-2">{{ step.label }}</div>
              <v-icon v-if="step.locked" icon="mdi-lock-outline" size="14" />
            </div>
            <v-progress-linear class="mt-3" :model-value="step.progress" color="primary" height="6" rounded />
          </div>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="summary" md="6" lg="3" class="mt-4" />

    <v-row class="mt-1">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Plan Dataflow</v-card-title>
            <v-card-subtitle>PMED setup moves from plan drafting to approved inputs for the next stage.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="dataflow-grid mb-4">
              <div class="flow-state-card">
                <div class="text-caption text-medium-emphasis">Draft Queue</div>
                <div class="text-h6 font-weight-bold">{{ plans.filter((item) => item.status === 'Draft').length }}</div>
                <div class="text-body-2">Plans still being refined and attached to requirements.</div>
              </div>
              <div class="flow-state-card">
                <div class="text-caption text-medium-emphasis">For Review</div>
                <div class="text-h6 font-weight-bold">{{ plans.filter((item) => item.status === 'For Review').length }}</div>
                <div class="text-body-2">Submitted plans waiting for leadership approval.</div>
              </div>
              <div class="flow-state-card">
                <div class="text-caption text-medium-emphasis">Ready for Collection</div>
                <div class="text-h6 font-weight-bold">{{ plans.filter((item) => item.status === 'Approved').length }}</div>
                <div class="text-body-2">Approved plans that unlock downstream collection work.</div>
              </div>
            </div>

            <div class="records-toolbar">
              <div class="records-toolbar-left">
                <v-text-field
                  v-model="searchTerm"
                  variant="outlined"
                  density="compact"
                  hide-details
                  prepend-inner-icon="mdi-magnify"
                  placeholder="Search plan reference or program"
                />
                <v-select
                  v-model="selectedStatus"
                  :items="['All Statuses', 'Draft', 'For Review', 'Approved', 'Archived']"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="status-select"
                />
              </div>
              <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-plus" @click="openCreateModal">Add Plan</v-btn>
            </div>

            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>Plan Reference</th>
                  <th>Program</th>
                  <th>Lead</th>
                  <th>Schedule</th>
                  <th>Budget</th>
                  <th>Status</th>
                  <th>Targets</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="plan in filteredPlans" :key="plan.id">
                  <td>
                    <div class="font-weight-bold">{{ plan.id }}</div>
                    <div class="text-caption text-medium-emphasis">planning record</div>
                  </td>
                  <td>{{ plan.program }}</td>
                  <td>{{ plan.lead }}</td>
                  <td>{{ plan.schedule }}</td>
                  <td>{{ formatMoney(plan.budget) }}</td>
                  <td><v-chip size="x-small" :color="statusColor(plan.status)" variant="tonal">{{ plan.status }}</v-chip></td>
                  <td>{{ plan.targetCount }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click="openEditModal(plan)">Edit</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click="submitPlan(plan)">Submit</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click="archivePlan(plan)">Archive</v-btn>
                  </td>
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
            <v-card-subtitle>Planning actions are grouped here to keep the header clean.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="flat" prepend-icon="mdi-plus-circle-outline" @click="openCreateModal">Create New Plan</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-target" @click="openCreateModal">Set Targets</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-send-outline" @click="plans[0] && submitPlan(plans[0])">Submit Plan</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-account-group-outline" @click="quickAssignDepartments">Assign Departments</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-paperclip" @click="quickAttachRequirements">Attach Requirements</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Planning Checklist</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list density="compact">
              <v-list-item title="Goals and timeline defined" prepend-icon="mdi-check-circle" />
              <v-list-item title="Budget allocated" prepend-icon="mdi-check-circle" />
              <v-list-item title="Departments assigned" prepend-icon="mdi-check-circle" />
              <v-list-item :title="hasBlockingRequirements ? 'Requirements still missing on some plans' : 'Requirements attached'" :prepend-icon="hasBlockingRequirements ? 'mdi-alert-circle-outline' : 'mdi-check-circle'" />
            </v-list>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Stage Outcome</v-card-title>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis">
            Planning is complete when plan records, targets, budget, and department ownership are approved for collection.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-1">
      <v-col cols="12" lg="7">
        <v-card variant="outlined" class="surface-card h-100">
          <v-card-item>
            <v-card-title>Activity Logs</v-card-title>
            <v-card-subtitle>Every planning action writes to the monitoring log for audit visibility.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-timeline density="compact" side="end" truncate-line="both">
              <v-timeline-item v-for="log in activityLogs" :key="log.id" :dot-color="toneColor(log.tone)" size="small">
                <div class="text-caption text-medium-emphasis">{{ formatActivityTime(log.createdAt) }} | {{ log.actor }}</div>
                <div class="text-body-2 font-weight-medium">{{ log.action }}</div>
                <div class="text-body-2 text-medium-emphasis">{{ log.detail }}</div>
              </v-timeline-item>
            </v-timeline>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <v-card variant="outlined" class="surface-card h-100">
          <v-card-item>
            <v-card-title>Department Ownership Board</v-card-title>
            <v-card-subtitle>Who contributes data and who owns each planning requirement.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <v-row>
              <v-col v-for="department in departments" :key="department.name" cols="12" md="6">
                <div class="info-card">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <div class="font-weight-bold">{{ department.name }}</div>
                    <v-chip size="x-small" :color="statusColor(department.status)" variant="tonal">{{ department.status }}</v-chip>
                  </div>
                  <div class="text-body-2">{{ department.role }}</div>
                  <div class="text-caption text-medium-emphasis mt-2">Owner: {{ department.owner }}</div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="planDialog" max-width="760">
      <v-card class="planning-modal-card">
        <v-card-item>
          <v-card-title>{{ dialogMode === 'create' ? 'Create Planning Record' : 'Edit Planning Record' }}</v-card-title>
          <v-card-subtitle>Use the PMED planning modal to manage targets, departments, and readiness state.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.id" label="Plan Reference" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="form.status" :items="['Draft', 'For Review', 'Approved', 'Archived']" label="Status" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.program" label="Program" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.lead" label="Lead" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.schedule" label="Schedule" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.budget" type="number" label="Budget" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.targetCount" type="number" label="Target Count" variant="outlined" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.departments"
                :items="departmentOptions"
                label="Departments"
                variant="outlined"
                density="comfortable"
                multiple
                chips
              />
            </v-col>
            <v-col cols="12">
              <v-checkbox v-model="form.requirementsAttached" label="Requirements attached and ready for submission" color="primary" hide-details />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end pa-4">
          <v-btn variant="text" @click="closeModal">Cancel</v-btn>
          <v-btn color="primary" variant="flat" @click="savePlan">{{ dialogMode === 'create' ? 'Create Plan' : 'Save Changes' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@import './shared-pmed.css';

.dataflow-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.flow-state-card {
  padding: 14px;
  border: 1px solid rgba(30, 136, 229, 0.12);
  border-radius: 12px;
  background: #fbfdff;
}

.records-toolbar-left {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
  flex: 1;
}

.status-select {
  min-width: 180px;
}

.planning-modal-card {
  border-radius: 18px;
}

@media (max-width: 960px) {
  .records-toolbar-left {
    grid-template-columns: 1fr;
  }
}
</style>

