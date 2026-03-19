<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import {
  fetchEvaluationWorkspace,
  runEvaluationAction,
  saveEvaluationRecord,
  type EvaluationActivityLog,
  type EvaluationFinding,
  type EvaluationRecord
} from '@/services/pmedEvaluation';

type EvaluationDecision = 'Approved' | 'For Review' | 'Draft';

type EvaluationRow = EvaluationRecord & {
  decisionStatus: EvaluationDecision;
};

const evaluations = ref<EvaluationRow[]>([]);
const findings = ref<EvaluationFinding[]>([]);
const activityLogs = ref<EvaluationActivityLog[]>([]);
const isLoading = ref(false);

const searchTerm = ref('');
const selectedDecision = ref<'All Decisions' | EvaluationDecision>('All Decisions');
const selectedEvaluationId = ref('');
const evaluationDialog = ref(false);
const dialogMode = ref<'create' | 'edit' | 'score' | 'remarks'>('create');

const form = reactive({
  evaluationReference: '',
  planReference: '',
  departmentName: '',
  scoreValue: 0,
  targetResult: '',
  actualResult: '',
  decisionStatus: 'Draft' as EvaluationDecision,
  remarks: ''
});

const departmentOptions = ['Clinic', 'Guidance', 'HR', 'Cashier', 'Registrar', 'Prefect', 'CRAD', 'Computer Lab', 'PMED'];
const decisionOptions: Array<'All Decisions' | EvaluationDecision> = ['All Decisions', 'Approved', 'For Review', 'Draft'];

const selectedEvaluation = computed(() =>
  evaluations.value.find((item) => item.id === selectedEvaluationId.value) || null
);

const cards = computed(() => {
  const approved = evaluations.value.filter((item) => item.decisionStatus === 'Approved');
  const forReview = evaluations.value.filter((item) => item.decisionStatus === 'For Review');
  const finalizedScoreBase = evaluations.value.length || 1;
  return [
    {
      title: 'Targets Met',
      value: String(approved.length),
      subtitle: 'Completed objectives',
      className: 'analytics-card-green',
      icon: 'mdi-check-circle-outline'
    },
    {
      title: 'Needs Review',
      value: String(forReview.length),
      subtitle: 'Decision pending',
      className: 'analytics-card-orange',
      icon: 'mdi-clipboard-alert-outline'
    },
    {
      title: 'Findings',
      value: String(findings.value.length),
      subtitle: 'Evaluation insights',
      className: 'analytics-card-blue',
      icon: 'mdi-lightbulb-outline'
    },
    {
      title: 'Approval',
      value: `${Math.round((approved.length / finalizedScoreBase) * 100)}%`,
      subtitle: 'Scoring finalized',
      className: 'analytics-card-purple',
      icon: 'mdi-scale-balance'
    }
  ];
});

const filteredEvaluations = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return evaluations.value.filter((item) => {
    const matchesDecision = selectedDecision.value === 'All Decisions' || item.decisionStatus === selectedDecision.value;
    const matchesSearch =
      !keyword ||
      [
        item.id,
        item.planReference,
        item.department,
        item.targetResult,
        item.actualResult,
        item.reviewedBy,
        item.remarks
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesDecision && matchesSearch;
  });
});

const nextWorkflowMessage = computed(() =>
  evaluations.value.some((item) => item.decisionStatus === 'For Review' || item.decisionStatus === 'Draft')
    ? 'Reporting should stay on hold until all evaluation rows are scored, remarked, and approved.'
    : 'Evaluation is complete enough to support reporting and final PMED release.'
);

function hydrateWorkspace(payload: {
  evaluations: EvaluationRecord[];
  findings: EvaluationFinding[];
  activityLogs: EvaluationActivityLog[];
}): void {
  evaluations.value = (payload.evaluations || []).map((item) => ({
    ...item,
    decisionStatus: item.decisionStatus as EvaluationDecision
  }));
  findings.value = payload.findings || [];
  activityLogs.value = payload.activityLogs || [];
  if (!selectedEvaluationId.value && evaluations.value[0]) {
    selectedEvaluationId.value = evaluations.value[0].id;
  } else if (selectedEvaluationId.value && !evaluations.value.some((item) => item.id === selectedEvaluationId.value)) {
    selectedEvaluationId.value = evaluations.value[0]?.id || '';
  }
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchEvaluationWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Evaluation Data Warning',
      message: error instanceof Error ? error.message : 'Unable to load PMED evaluation workspace.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function statusColor(value: string): string {
  if (value === 'Approved') return 'success';
  if (value === 'For Review') return 'warning';
  return 'primary';
}

function toneColor(value: EvaluationActivityLog['tone']): string {
  if (value === 'success') return 'success';
  if (value === 'warning') return 'warning';
  return 'primary';
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function normalizeDecision(scoreValue: number): EvaluationDecision {
  if (scoreValue >= 85) return 'Approved';
  if (scoreValue >= 75) return 'For Review';
  return 'Draft';
}

function resetForm(): void {
  Object.assign(form, {
    evaluationReference: '',
    planReference: '',
    departmentName: '',
    scoreValue: 0,
    targetResult: '',
    actualResult: '',
    decisionStatus: 'Draft',
    remarks: ''
  });
}

function openCreateModal(mode: 'create' | 'score'): void {
  dialogMode.value = mode;
  resetForm();
  form.evaluationReference = `EVAL-${new Date().getFullYear()}-${String(evaluations.value.length + 1).padStart(3, '0')}`;
  evaluationDialog.value = true;
}

function openEditModal(row: EvaluationRow, mode: 'edit' | 'score' | 'remarks' = 'edit'): void {
  dialogMode.value = mode;
  Object.assign(form, {
    evaluationReference: row.id,
    planReference: row.planReference,
    departmentName: row.department,
    scoreValue: row.scoreValue,
    targetResult: row.targetResult,
    actualResult: row.actualResult,
    decisionStatus: row.decisionStatus,
    remarks: row.remarks
  });
  selectedEvaluationId.value = row.id;
  evaluationDialog.value = true;
}

function selectEvaluation(row: EvaluationRow): void {
  selectedEvaluationId.value = row.id;
}

async function saveEvaluation(): Promise<void> {
  if (!form.evaluationReference.trim() || !form.departmentName.trim()) {
    emitSuccessModal({ title: 'Missing Fields', message: 'Please complete the evaluation reference and department.', tone: 'warning' });
    return;
  }
  const scoreValue = Number(form.scoreValue || 0);
  const decisionStatus = dialogMode.value === 'remarks' ? form.decisionStatus : normalizeDecision(scoreValue);
  try {
    const workspace = await saveEvaluationRecord({
      evaluationReference: form.evaluationReference.trim(),
      planReference: form.planReference.trim(),
      departmentName: form.departmentName.trim(),
      scoreValue,
      targetResult: form.targetResult.trim(),
      actualResult: form.actualResult.trim(),
      decisionStatus,
      remarks: form.remarks.trim(),
      action:
        dialogMode.value === 'score'
          ? 'score_departments'
          : dialogMode.value === 'remarks'
            ? 'add_remarks'
            : dialogMode.value === 'create'
              ? 'evaluate_performance'
              : 'upsert'
    });
    hydrateWorkspace(workspace);
    selectedEvaluationId.value = form.evaluationReference.trim();
    evaluationDialog.value = false;
    emitSuccessModal({
      title:
        dialogMode.value === 'score'
          ? 'Department Scored'
          : dialogMode.value === 'remarks'
            ? 'Remarks Added'
            : dialogMode.value === 'create'
              ? 'Evaluation Created'
              : 'Evaluation Updated',
      message: `${form.departmentName} is now updated in the evaluation decision board.`,
      tone: 'success'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Save Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save this evaluation record.',
      tone: 'warning'
    });
  }
}

function resolveActionTarget(preferred?: EvaluationRow | null): EvaluationRow | null {
  if (preferred) return preferred;
  if (selectedEvaluation.value) return selectedEvaluation.value;
  return filteredEvaluations.value[0] || null;
}

async function approveEvaluation(target?: EvaluationRow | null): Promise<void> {
  const evaluation = resolveActionTarget(target || null);
  if (!evaluation) {
    emitSuccessModal({ title: 'No Evaluation Selected', message: 'Choose an evaluation row before approving.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Approve Evaluation',
    message: `Approve ${evaluation.department}'s evaluation and move it toward reporting?`,
    confirmText: 'Approve',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runEvaluationAction('approve_evaluation', {
      evaluationReference: evaluation.id,
      remarks: evaluation.remarks || `${evaluation.department} evaluation approved for reporting.`,
      actor: 'Evaluation Officer'
    });
    hydrateWorkspace(workspace);
    selectedEvaluationId.value = evaluation.id;
    emitSuccessModal({ title: 'Evaluation Approved', message: `${evaluation.department} is now approved.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Approval Unavailable', message: error instanceof Error ? error.message : 'Unable to approve this evaluation.', tone: 'warning' });
  }
}

async function compareResults(target?: EvaluationRow | null): Promise<void> {
  const evaluation = resolveActionTarget(target || null);
  try {
    const workspace = await runEvaluationAction('compare_results', {
      evaluationReference: evaluation?.id,
      remarks: evaluation ? `Comparison review completed for ${evaluation.department}.` : 'Evaluation comparison review completed.',
      actor: 'Review Board'
    });
    hydrateWorkspace(workspace);
    emitSuccessModal({ title: 'Results Compared', message: evaluation ? `${evaluation.department} comparison insights are ready.` : 'Evaluation comparison insights are ready.', tone: 'info' });
  } catch (error) {
    emitSuccessModal({ title: 'Compare Unavailable', message: error instanceof Error ? error.message : 'Unable to compare evaluation results.', tone: 'warning' });
  }
}

async function sendFeedbackToHr(target?: EvaluationRow | null): Promise<void> {
  const evaluation = resolveActionTarget(target || null);
  if (!evaluation) {
    emitSuccessModal({ title: 'No Evaluation Selected', message: 'Choose an evaluation row before sending feedback to HR.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Send Feedback to HR',
    message: `Send ${evaluation.department}'s evaluation feedback to HR now?`,
    confirmText: 'Send Feedback',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runEvaluationAction('send_feedback_hr', {
      evaluationReference: evaluation.id,
      remarks: evaluation.remarks || `${evaluation.department} feedback was routed from PMED to HR.`,
      actor: 'Evaluation Officer'
    });
    hydrateWorkspace(workspace);
    selectedEvaluationId.value = evaluation.id;
    emitSuccessModal({ title: 'Feedback Sent', message: `${evaluation.department} feedback was routed to HR.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Send Unavailable', message: error instanceof Error ? error.message : 'Unable to send feedback to HR.', tone: 'warning' });
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
          <div class="page-kicker">Evaluation</div>
          <h1 class="text-h4 font-weight-black mb-1">Outcome Review Workspace</h1>
          <p class="text-medium-emphasis mb-0">Measure effectiveness, compare outcomes, add findings, and finalize the PMED decision with a real evaluation workflow.</p>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Evaluation Decision Board</v-card-title>
            <v-card-subtitle>Monitoring results flow into scoring, remarks, approval, and release readiness.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="records-toolbar">
              <v-text-field
                v-model="searchTerm"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search evaluation or department"
              />
              <div class="d-flex ga-2 flex-wrap">
                <v-select
                  v-model="selectedDecision"
                  :items="decisionOptions"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="min-width: 180px"
                />
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-comment-text-outline" @click="selectedEvaluation ? openEditModal(selectedEvaluation, 'remarks') : openCreateModal('create')">Add Remarks</v-btn>
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-account-arrow-right-outline" :disabled="!filteredEvaluations.length" @click="sendFeedbackToHr()">Send HR Feedback</v-btn>
                <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-compare" @click="compareResults()">Compare Results</v-btn>
              </div>
            </div>
            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>Evaluation Reference</th>
                  <th>Department</th>
                  <th>Score</th>
                  <th>Target</th>
                  <th>Actual</th>
                  <th>Decision</th>
                  <th>Reviewed By</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredEvaluations"
                  :key="row.id"
                  :class="{ 'bg-grey-lighten-5': row.id === selectedEvaluationId }"
                  @click="selectEvaluation(row)"
                >
                  <td>
                    <div class="font-weight-bold">{{ row.id }}</div>
                    <div class="text-caption text-medium-emphasis">{{ row.planReference || 'evaluation row' }}</div>
                  </td>
                  <td>{{ row.department }}</td>
                  <td>{{ row.scoreValue }}</td>
                  <td>{{ row.targetResult }}</td>
                  <td>{{ row.actualResult }}</td>
                  <td><v-chip size="x-small" :color="statusColor(row.decisionStatus)" variant="tonal">{{ row.decisionStatus }}</v-chip></td>
                  <td>{{ row.reviewedBy }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row)">Open</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row, 'score')">Score</v-btn>
                    <v-btn size="x-small" variant="text" color="secondary" @click.stop="sendFeedbackToHr(row)">Send HR</v-btn>
                    <v-btn v-if="row.decisionStatus !== 'Approved'" size="x-small" variant="text" color="success" @click.stop="approveEvaluation(row)">Approve</v-btn>
                  </td>
                </tr>
                <tr v-if="!filteredEvaluations.length">
                  <td colspan="8" class="text-center text-medium-emphasis py-6">No evaluation records match the current filters.</td>
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
            <v-card-subtitle>Evaluation actions stay near findings, logs, and approval decisions.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="flat" prepend-icon="mdi-clipboard-check-outline" @click="openCreateModal('create')">Evaluate Performance</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-star-outline" @click="selectedEvaluation ? openEditModal(selectedEvaluation, 'score') : openCreateModal('score')">Score Departments</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-check-bold" :disabled="!filteredEvaluations.length" @click="approveEvaluation()">Approve Evaluation</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-account-arrow-right-outline" :disabled="!filteredEvaluations.length" @click="sendFeedbackToHr()">Send Feedback to HR</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-comment-text-outline" @click="selectedEvaluation ? openEditModal(selectedEvaluation, 'remarks') : openCreateModal('create')">Add Remarks</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Key Findings</v-card-title>
          </v-card-item>
          <v-card-text>
            <div v-for="item in findings" :key="`${item.id}-${item.title}`" class="info-card mb-3">
              <div class="font-weight-bold">{{ item.title }}</div>
              <div class="text-body-2 mt-1">{{ item.detail }}</div>
            </div>
            <div v-if="!findings.length" class="text-body-2 text-medium-emphasis">No findings have been recorded yet.</div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Workflow Gate</v-card-title>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis">
            {{ nextWorkflowMessage }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Evaluation Flow Logic</v-card-title>
            <v-card-subtitle>Scoring, findings, and approval now move together inside one workspace.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="kanban-row">
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Scored Records</div>
                <div class="text-h6 font-weight-bold">{{ evaluations.length }}</div>
                <div class="text-body-2">Evaluation records currently being scored or finalized.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Ready for Approval</div>
                <div class="text-h6 font-weight-bold">{{ evaluations.filter((item) => item.decisionStatus === 'For Review').length }}</div>
                <div class="text-body-2">Rows with enough scoring to move through approval review.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Approved Outcomes</div>
                <div class="text-h6 font-weight-bold">{{ evaluations.filter((item) => item.decisionStatus === 'Approved').length }}</div>
                <div class="text-body-2">Approved evaluation outcomes that can support reporting.</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Evaluation Activity Logs</v-card-title>
            <v-card-subtitle>Recent scoring, remark, comparison, and approval actions.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div v-for="log in activityLogs" :key="`${log.id}-${log.reference}`" class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ log.action }}</div>
                <v-chip size="x-small" :color="toneColor(log.tone)" variant="tonal">{{ formatTimestamp(log.createdAt) }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ log.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ log.actor }} • {{ log.reference || 'Evaluation' }}</div>
            </div>
            <div v-if="!activityLogs.length" class="text-body-2 text-medium-emphasis">No evaluation activity has been recorded yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="evaluationDialog" max-width="760">
      <v-card>
        <v-card-item>
          <v-card-title>
            {{
              dialogMode === 'create'
                ? 'Create Evaluation Record'
                : dialogMode === 'score'
                  ? 'Score Evaluation'
                  : dialogMode === 'remarks'
                    ? 'Add Evaluation Remarks'
                    : 'Update Evaluation'
            }}
          </v-card-title>
          <v-card-subtitle>Keep scoring, findings, and final approval aligned in a single evaluation flow.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.evaluationReference" label="Evaluation Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.planReference" label="Plan Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-combobox v-model="form.departmentName" :items="departmentOptions" label="Department" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.scoreValue" label="Score Value" type="number" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.targetResult" label="Target Result" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.actualResult" label="Actual Result" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.remarks" label="Remarks / Findings" variant="outlined" rows="3" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="evaluationDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveEvaluation">
            {{
              dialogMode === 'score'
                ? 'Save Score'
                : dialogMode === 'remarks'
                  ? 'Save Remarks'
                  : dialogMode === 'create'
                    ? 'Create Evaluation'
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

