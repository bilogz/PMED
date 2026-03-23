<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import {
  fetchExchangeBoardWorkspace,
  runExchangeBoardAction,
  type ExchangeBoardActivityLog,
  type ExchangeBoardDepartment,
  type ExchangeBoardRecord
} from '@/services/pmedExchangeBoard';

type DirectionFilter = 'All Directions' | 'Inbound' | 'Outbound' | 'Internal';

const records = ref<ExchangeBoardRecord[]>([]);
const departments = ref<ExchangeBoardDepartment[]>([]);
const activityLogs = ref<ExchangeBoardActivityLog[]>([]);
const isLoading = ref(false);

const searchTerm = ref('');
const selectedDirection = ref<DirectionFilter>('All Directions');
const selectedRecordId = ref('');
const exchangeDialog = ref(false);
const dialogMode = ref<'request' | 'dispatch'>('request');

const form = reactive({
  recordReference: '',
  title: '',
  detail: '',
  stage: 'reporting',
  targetDepartment: '',
  requestType: 'general',
  essentialsCategory: '',
  quantity: ''
});

const directionOptions: DirectionFilter[] = ['All Directions', 'Inbound', 'Outbound', 'Internal'];
const departmentOptions = ['Clinic', 'Cashier', 'Guidance', 'Prefect', 'Computer Laboratory', 'CRAD', 'HR', 'School Administration'];
const requestTypeOptions = [
  { title: 'General Exchange', value: 'general' },
  { title: 'Employee Request (HR)', value: 'employee_request' },
  { title: 'ComLab Essentials Request', value: 'comlab_essentials' }
];
const essentialsCategoryOptions = ['Computer', 'Computer Parts', 'Chairs', 'Aircon', 'Others'];

const selectedRecord = computed(() => records.value.find((item) => item.id === selectedRecordId.value) || null);

const exchangeFlowSteps = computed(() => [
  {
    key: 'inbound',
    title: 'Inbound Intake',
    caption: `${records.value.filter((item) => item.direction === 'Inbound').length} records from partner departments`,
    active: records.value.some((item) => item.direction === 'Inbound')
  },
  {
    key: 'acknowledged',
    title: 'PMED Review',
    caption: `${records.value.filter((item) => item.direction === 'Inbound' && ['approved', 'received', 'synced'].includes(item.status.toLowerCase())).length} already acknowledged`,
    active: records.value.some((item) => item.direction === 'Inbound' && ['approved', 'received', 'synced'].includes(item.status.toLowerCase()))
  },
  {
    key: 'dispatch',
    title: 'Outbound Routing',
    caption: `${records.value.filter((item) => item.direction === 'Outbound').length} outbound exchanges tracked`,
    active: records.value.some((item) => item.direction === 'Outbound')
  }
]);

const cards = computed(() => [
  {
    title: 'Inbound',
    value: String(records.value.filter((item) => item.direction === 'Inbound').length),
    subtitle: 'Reports and records into PMED',
    className: 'analytics-card-blue',
    icon: 'mdi-arrow-down-bold-circle-outline'
  },
  {
    title: 'Outbound',
    value: String(records.value.filter((item) => item.direction === 'Outbound').length),
    subtitle: 'PMED handoffs out',
    className: 'analytics-card-green',
    icon: 'mdi-arrow-up-bold-circle-outline'
  },
  {
    title: 'Waiting',
    value: String(records.value.filter((item) => ['pending', 'awaiting department', 'awaiting approval', 'hold', 'needs attention'].includes(item.status.toLowerCase())).length),
    subtitle: 'Needs follow-up',
    className: 'analytics-card-orange',
    icon: 'mdi-timer-sand'
  },
  {
    title: 'Departments',
    value: String(departments.value.length),
    subtitle: 'Connected systems',
    className: 'analytics-card-purple',
    icon: 'mdi-source-branch'
  }
]);

const filteredRecords = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return records.value.filter((item) => {
    const matchesDirection = selectedDirection.value === 'All Directions' || item.direction === selectedDirection.value;
    const matchesSearch =
      !keyword ||
      [
        item.id,
        item.title,
        item.stage,
        item.sourceDepartment,
        item.targetDepartment,
        item.status,
        item.owner,
        item.detail
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesDirection && matchesSearch;
  });
});

const nextFlowMessage = computed(() =>
  records.value.some((item) => item.direction === 'Inbound' && ['pending', 'awaiting department', 'hold'].includes(item.status.toLowerCase()))
    ? 'Some inbound exchanges still need acknowledgement before PMED can fully trust the next workflow step.'
    : 'Exchange flow is stable and PMED can keep routing records across departments with less manual follow-up.'
);

function hydrateWorkspace(payload: {
  records: ExchangeBoardRecord[];
  departments: ExchangeBoardDepartment[];
  activityLogs: ExchangeBoardActivityLog[];
}): void {
  records.value = payload.records || [];
  departments.value = payload.departments || [];
  activityLogs.value = payload.activityLogs || [];
  if (!selectedRecordId.value && records.value[0]) {
    selectedRecordId.value = records.value[0].id;
  } else if (selectedRecordId.value && !records.value.some((item) => item.id === selectedRecordId.value)) {
    selectedRecordId.value = records.value[0]?.id || '';
  }
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchExchangeBoardWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Exchange Board Warning',
      message: error instanceof Error ? error.message : 'Unable to load the PMED exchange board.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function statusColor(value: string): string {
  const status = value.toLowerCase();
  if (['approved', 'received', 'ready to send', 'sent to administration', 'synced'].includes(status)) return 'success';
  if (['pending', 'awaiting department', 'awaiting approval', 'hold', 'needs attention'].includes(status)) return 'warning';
  return 'primary';
}

function toneColor(value: string): string {
  if (value.toLowerCase().includes('approved') || value.toLowerCase().includes('sent') || value.toLowerCase().includes('dispatched')) return 'success';
  if (value.toLowerCase().includes('requested') || value.toLowerCase().includes('acknowledged')) return 'primary';
  return 'warning';
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value || '--';
  return parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function resetForm(): void {
  Object.assign(form, {
    recordReference: '',
    title: '',
    detail: '',
    stage: 'reporting',
    targetDepartment: '',
    requestType: 'general',
    essentialsCategory: '',
    quantity: ''
  });
}

function openRequestDialog(mode: 'request' | 'dispatch'): void {
  dialogMode.value = mode;
  resetForm();
  form.recordReference = `EX-${new Date().getFullYear()}-${String(records.value.length + 1).padStart(3, '0')}`;
  exchangeDialog.value = true;
}

function selectRecord(record: ExchangeBoardRecord): void {
  selectedRecordId.value = record.id;
}

async function saveExchange(): Promise<void> {
  const resolvedTargetDepartment =
    form.requestType === 'employee_request'
      ? 'HR'
      : form.requestType === 'comlab_essentials'
        ? 'Computer Laboratory'
        : form.targetDepartment.trim();
  const normalizedQuantity = Number(form.quantity || 0);
  const normalizedDetails = [
    form.detail.trim(),
    form.requestType === 'comlab_essentials' && form.essentialsCategory
      ? `Item Category: ${form.essentialsCategory}`
      : '',
    form.requestType === 'comlab_essentials' && normalizedQuantity > 0 ? `Quantity: ${normalizedQuantity}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  if (!form.recordReference.trim() || !form.title.trim() || !resolvedTargetDepartment) {
    emitSuccessModal({ title: 'Missing Fields', message: 'Please complete the reference, title, and target department.', tone: 'warning' });
    return;
  }
  if (form.requestType === 'comlab_essentials' && !form.essentialsCategory.trim()) {
    emitSuccessModal({ title: 'Missing Item Category', message: 'Select a ComLab essentials category (computer, parts, chairs, aircon, or others).', tone: 'warning' });
    return;
  }
  if (form.requestType === 'comlab_essentials' && normalizedQuantity <= 0) {
    emitSuccessModal({ title: 'Invalid Quantity', message: 'Quantity for ComLab essentials must be greater than zero.', tone: 'warning' });
    return;
  }
  try {
    const workspace = await runExchangeBoardAction(dialogMode.value === 'request' ? 'request_exchange' : 'dispatch_exchange', {
      recordReference: form.recordReference.trim(),
      title: form.title.trim(),
      detail: normalizedDetails,
      stage: form.stage.trim(),
      targetDepartment: resolvedTargetDepartment,
      requestType: form.requestType,
      essentialsCategory: form.essentialsCategory.trim() || undefined,
      quantity: normalizedQuantity > 0 ? normalizedQuantity : undefined,
      actor: 'PMED Exchange Desk'
    });
    hydrateWorkspace(workspace);
    exchangeDialog.value = false;
    emitSuccessModal({
      title: dialogMode.value === 'request' ? 'Exchange Requested' : 'Exchange Dispatched',
      message: `${form.title} is now tracked in the exchange board.`,
      tone: 'success'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Exchange Action Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save this exchange action.',
      tone: 'warning'
    });
  }
}

async function acknowledgeRecord(target?: ExchangeBoardRecord | null): Promise<void> {
  const record = target || selectedRecord.value;
  if (!record) {
    emitSuccessModal({ title: 'No Record Selected', message: 'Choose an inbound record before acknowledging it.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Acknowledge Exchange',
    message: `Acknowledge ${record.title} from ${record.sourceDepartment}?`,
    confirmText: 'Acknowledge',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runExchangeBoardAction('acknowledge_exchange', {
      entityKey: record.entityKey || record.id,
      detail: `PMED acknowledged ${record.title} from ${record.sourceDepartment}.`,
      actor: 'PMED Exchange Desk'
    });
    hydrateWorkspace(workspace);
    emitSuccessModal({ title: 'Exchange Acknowledged', message: `${record.title} is now marked as received by PMED.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({
      title: 'Acknowledge Unavailable',
      message: error instanceof Error ? error.message : 'Unable to acknowledge this exchange record.',
      tone: 'warning'
    });
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
          <div class="page-kicker">Exchange Board</div>
          <h1 class="text-h4 font-weight-black mb-1">Cross-Department Exchange Board</h1>
          <p class="text-medium-emphasis mb-0">Monitor inbound and outbound PMED exchanges with Registrar, Cashier, Clinic, Guidance, Prefect, Computer Laboratory, CRAD, HR, and School Administration from one live workspace.</p>
        </div>
        <div class="hero-actions">
          <v-btn color="white" variant="flat" prepend-icon="mdi-tray-arrow-down" @click="openRequestDialog('request')">Request Intake</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-card variant="outlined" class="surface-card mt-4">
      <v-card-item>
        <v-card-title>Exchange Flow</v-card-title>
        <v-card-subtitle>Keep the handoff process visible from intake to dispatch so PMED can spot where the queue is stalling.</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <div class="workflow-grid">
          <div v-for="step in exchangeFlowSteps" :key="step.key" class="workflow-step" :class="{ active: step.active }">
            <div class="text-caption text-medium-emphasis">{{ step.title }}</div>
            <div class="text-body-2 mt-1">{{ step.caption }}</div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Exchange Records</v-card-title>
            <v-card-subtitle>Every inbound and outbound handoff that matters to PMED is visible here without opening several modules.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="records-toolbar">
              <v-text-field
                v-model="searchTerm"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search exchange, department, stage"
              />
              <div class="d-flex ga-2 flex-wrap">
                <v-select
                  v-model="selectedDirection"
                  :items="directionOptions"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="min-width: 180px"
                />
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-tray-arrow-down" @click="openRequestDialog('request')">Request Exchange</v-btn>
                <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-tray-arrow-up" @click="openRequestDialog('dispatch')">Dispatch Record</v-btn>
              </div>
            </div>

            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Direction</th>
                  <th>Source</th>
                  <th>Target</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in filteredRecords"
                  :key="row.id"
                  :class="{ 'bg-grey-lighten-5': row.id === selectedRecordId }"
                  @click="selectRecord(row)"
                >
                  <td>
                    <div class="font-weight-bold">{{ row.id }}</div>
                    <div class="text-caption text-medium-emphasis">{{ row.title }}</div>
                  </td>
                  <td>{{ row.direction }}</td>
                  <td>{{ row.sourceDepartment }}</td>
                  <td>{{ row.targetDepartment }}</td>
                  <td>{{ row.stage }}</td>
                  <td><v-chip size="x-small" :color="statusColor(row.status)" variant="tonal">{{ row.status }}</v-chip></td>
                  <td>{{ formatTimestamp(row.updatedAt) }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="selectRecord(row)">Open</v-btn>
                    <v-btn
                      v-if="row.direction === 'Inbound' && ['pending', 'awaiting department', 'hold'].includes(row.status.toLowerCase())"
                      size="x-small"
                      variant="text"
                      color="success"
                      @click.stop="acknowledgeRecord(row)"
                    >
                      Acknowledge
                    </v-btn>
                  </td>
                </tr>
                <tr v-if="!filteredRecords.length">
                  <td colspan="8" class="text-center text-medium-emphasis py-6">No exchange records match the current filters.</td>
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
            <v-card-subtitle>Keep the exchange board focused on the few actions PMED actually needs.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="flat" prepend-icon="mdi-tray-arrow-down" @click="openRequestDialog('request')">Request Department Exchange</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-check-decagram-outline" :disabled="!selectedRecord" @click="acknowledgeRecord()">Acknowledge Selected</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-tray-arrow-up" @click="openRequestDialog('dispatch')">Dispatch Outbound Record</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Selected Record</v-card-title>
            <v-card-subtitle>Use this quick detail panel to review the current handoff before you acknowledge or dispatch anything.</v-card-subtitle>
          </v-card-item>
          <v-card-text v-if="selectedRecord" class="d-flex flex-column ga-3">
            <div class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ selectedRecord.title }}</div>
                <v-chip size="x-small" :color="statusColor(selectedRecord.status)" variant="tonal">{{ selectedRecord.status }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ selectedRecord.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ selectedRecord.sourceDepartment }} to {{ selectedRecord.targetDepartment }}</div>
              <div class="text-caption text-medium-emphasis">{{ selectedRecord.stage }} • {{ selectedRecord.owner }}</div>
            </div>
          </v-card-text>
          <v-card-text v-else class="text-body-2 text-medium-emphasis">
            Select an exchange record to inspect its handoff context here.
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Department Watchlist</v-card-title>
            <v-card-subtitle>Quick counts help PMED see where the traffic is healthy and where follow-up is still needed.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div v-for="department in departments" :key="department.key" class="info-card mb-3">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ department.name }}</div>
                <v-chip size="x-small" :color="department.waiting > 0 ? 'warning' : 'success'" variant="tonal">
                  {{ department.waiting > 0 ? `${department.waiting} waiting` : 'clear' }}
                </v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ department.purpose }}</div>
              <div class="text-caption text-medium-emphasis">Inbound {{ department.inbound }} • Outbound {{ department.outbound }}</div>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Exchange Gate</v-card-title>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis">
            {{ nextFlowMessage }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Exchange Activity Logs</v-card-title>
            <v-card-subtitle>Recent PMED actions across requests, acknowledgements, and outbound handoffs.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div v-for="log in activityLogs" :key="`${log.id}-${log.reference}`" class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ log.action }}</div>
                <v-chip size="x-small" :color="toneColor(log.action)" variant="tonal">{{ formatTimestamp(log.createdAt) }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ log.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ log.actor }} • {{ log.reference || 'Exchange' }}</div>
            </div>
            <div v-if="!activityLogs.length" class="text-body-2 text-medium-emphasis">No exchange activity has been recorded yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="exchangeDialog" max-width="720">
      <v-card>
        <v-card-item>
          <v-card-title>{{ dialogMode === 'request' ? 'Request Department Exchange' : 'Dispatch Outbound Record' }}</v-card-title>
          <v-card-subtitle>Keep inbound and outbound PMED handoffs explicit, traceable, and easy to review.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.recordReference" label="Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.requestType"
                :items="requestTypeOptions"
                label="Request Type"
                item-title="title"
                item-value="value"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="form.targetDepartment"
                :items="departmentOptions"
                label="Target Department"
                variant="outlined"
                :disabled="form.requestType === 'employee_request' || form.requestType === 'comlab_essentials'"
                :hint="form.requestType === 'employee_request' ? 'Auto-routed to HR.' : form.requestType === 'comlab_essentials' ? 'Auto-routed to Computer Laboratory.' : ''"
                persistent-hint
              />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.title" label="Title" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.stage" label="Stage" variant="outlined" />
            </v-col>
            <v-col v-if="form.requestType === 'comlab_essentials'" cols="12" md="6">
              <v-select
                v-model="form.essentialsCategory"
                :items="essentialsCategoryOptions"
                label="ComLab Item Category"
                variant="outlined"
              />
            </v-col>
            <v-col v-if="form.requestType === 'comlab_essentials'" cols="12" md="6">
              <v-text-field
                v-model="form.quantity"
                label="Quantity"
                type="number"
                min="1"
                variant="outlined"
              />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.detail" label="Details" variant="outlined" rows="3" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="exchangeDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveExchange">{{ dialogMode === 'request' ? 'Request Exchange' : 'Dispatch Record' }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@import './shared-pmed.css';
</style>


