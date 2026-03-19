<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import AnalyticsCardGrid from '@/components/shared/AnalyticsCardGrid.vue';
import { requestConfirmModal } from '@/composables/useConfirmModal';
import { useRealtimeWorkspace } from '@/composables/useRealtimeWorkspace';
import { emitSuccessModal } from '@/composables/useSuccessModal';
import { formatDateTimeWithTimezone } from '@/utils/dateTime';
import {
  fetchReportingWorkspace,
  runReportingAction,
  saveReportingRecord,
  type ReportingActivityLog,
  type ReportingChecklistItem,
  type ReportingRecord
} from '@/services/pmedReporting';

type DeliveryStatus = 'Awaiting Department' | 'Received' | 'Draft' | 'Awaiting Approval' | 'Collecting Exports' | 'Ready to Send' | 'Sent to Administration' | 'Archived';

type ReportRow = ReportingRecord & {
  deliveryStatus: DeliveryStatus;
};

const reports = ref<ReportRow[]>([]);
const dispatchChecklist = ref<ReportingChecklistItem[]>([]);
const activityLogs = ref<ReportingActivityLog[]>([]);
const isLoading = ref(false);
const currentPage = ref(1);
const rowsPerPage = 10;

const searchTerm = ref('');
const selectedStatus = ref<'All Statuses' | DeliveryStatus>('All Statuses');
const selectedReportId = ref('');
const reportDialog = ref(false);
const dialogMode = ref<'create' | 'edit' | 'request' | 'receive' | 'finalize'>('create');
const previewDialog = ref(false);
const previewTitle = ref('');
const previewUrl = ref('');

const form = reactive({
  reportReference: '',
  planReference: '',
  reportName: '',
  sourceDepartment: '',
  ownerName: '',
  exportFormat: 'PDF',
  fileUrl: ''
});

const exportFormats = ['PDF', 'Excel', 'PDF / Excel'];
const departmentOptions = ['Clinic', 'Cashier', 'Guidance', 'Prefect', 'Computer Laboratory', 'CRAD', 'HR'];
const statusOptions: Array<'All Statuses' | DeliveryStatus> = [
  'All Statuses',
  'Awaiting Department',
  'Received',
  'Draft',
  'Awaiting Approval',
  'Ready to Send',
  'Sent to Administration',
  'Archived'
];

const selectedReport = computed(() =>
  reports.value.find((item) => item.id === selectedReportId.value) || null
);
const selectedPackageSummary = computed(() => {
  const summary = selectedReport.value?.packageSummary;
  return summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : null;
});
const selectedPackageSections = computed(() => (Array.isArray(selectedReport.value?.packageSections) ? selectedReport.value?.packageSections : []));
const canEditSelectedReport = computed(() => selectedReport.value?.sourceDepartment === 'PMED' && !selectedReport.value?.isExternalDelivery);

const cards = computed(() => [
  {
    title: 'Essential Received',
    value: String(reports.value.filter((item) => item.sourceDepartment !== 'PMED' && item.deliveryStatus === 'Received').length),
    subtitle: 'Department reports in',
    className: 'analytics-card-blue',
    icon: 'mdi-inbox-arrow-down-outline'
  },
  {
    title: 'Pending Departments',
    value: String(reports.value.filter((item) => item.deliveryStatus === 'Awaiting Department').length),
    subtitle: 'Still expected',
    className: 'analytics-card-orange',
    icon: 'mdi-clock-outline'
  },
  {
    title: 'Final Ready',
    value: String(reports.value.filter((item) => item.sourceDepartment === 'PMED' && (item.deliveryStatus === 'Ready to Send' || item.deliveryStatus === 'Sent to Administration')).length),
    subtitle: 'PMED final outputs',
    className: 'analytics-card-green',
    icon: 'mdi-send-check-outline'
  },
  {
    title: 'Archived',
    value: String(reports.value.filter((item) => item.archiveStatus === 'Archived' || item.deliveryStatus === 'Archived').length),
    subtitle: 'Stored outputs',
    className: 'analytics-card-purple',
    icon: 'mdi-archive-outline'
  }
]);

const filteredReports = computed(() => {
  const keyword = searchTerm.value.trim().toLowerCase();
  return reports.value.filter((item) => {
    const matchesStatus = selectedStatus.value === 'All Statuses' || item.deliveryStatus === selectedStatus.value;
    const matchesSearch =
      !keyword ||
      [
        item.id,
        item.planReference,
        item.reportName,
        item.ownerName,
        item.exportFormat,
        item.deliveryStatus
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    return matchesStatus && matchesSearch;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredReports.value.length / rowsPerPage)));

const paginatedReports = computed(() => {
  const safePage = Math.min(currentPage.value, totalPages.value);
  const start = (safePage - 1) * rowsPerPage;
  return filteredReports.value.slice(start, start + rowsPerPage);
});

watch([searchTerm, selectedStatus], () => {
  resetPagination();
});

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value;
});

const nextWorkflowMessage = computed(() =>
  reports.value.some((item) => item.deliveryStatus === 'Awaiting Department' || item.deliveryStatus === 'Draft' || item.deliveryStatus === 'Awaiting Approval')
    ? 'School Administration dispatch should wait until the essential department reports are in and the final PMED report is ready.'
    : 'Reporting is ready for School Administration release and archival flow.'
);

function hydrateWorkspace(payload: {
  reports: ReportingRecord[];
  dispatchChecklist: ReportingChecklistItem[];
  activityLogs: ReportingActivityLog[];
}): void {
  reports.value = (payload.reports || []).map((item) => ({
    ...item,
    deliveryStatus: item.deliveryStatus as DeliveryStatus
  }));
  dispatchChecklist.value = payload.dispatchChecklist || [];
  activityLogs.value = payload.activityLogs || [];
  if (!selectedReportId.value && reports.value[0]) {
    selectedReportId.value = reports.value[0].id;
  } else if (selectedReportId.value && !reports.value.some((item) => item.id === selectedReportId.value)) {
    selectedReportId.value = reports.value[0]?.id || '';
  }
}

async function loadWorkspace(forceRefresh = false, options: { silent?: boolean } = {}): Promise<void> {
  if (!options.silent) isLoading.value = true;
  try {
    const payload = await fetchReportingWorkspace(forceRefresh);
    hydrateWorkspace(payload);
  } catch (error) {
    emitSuccessModal({
      title: 'Reporting Data Warning',
      message: error instanceof Error ? error.message : 'Unable to load PMED reporting workspace.',
      tone: 'warning'
    });
  } finally {
    if (!options.silent) isLoading.value = false;
  }
}

function resetPagination(): void {
  currentPage.value = 1;
}

function statusColor(value: string): string {
  if (value === 'Received') return 'success';
  if (value === 'Ready to Send' || value === 'Sent to Administration') return 'success';
  if (value === 'AwaitingDepartment' || value === 'Awaiting Department' || value === 'Awaiting Approval' || value === 'Draft') return 'warning';
  if (value === 'Archived') return 'secondary';
  return 'primary';
}

function toneColor(value: ReportingActivityLog['tone']): string {
  if (value === 'success') return 'success';
  if (value === 'warning') return 'warning';
  return 'primary';
}

function formatTimestamp(value: string): string {
  return formatDateTimeWithTimezone(value, { fallback: '--' });
}

function normalizeReportUrl(fileUrl: string): string {
  const value = String(fileUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value) || value.startsWith('blob:') || value.startsWith('data:')) return value;
  if (value.startsWith('/')) return `${window.location.origin}${value}`;
  return `${window.location.origin}/${value.replace(/^\.?\//, '')}`;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdfBlob(report: ReportRow): Blob {
  const lines = [
    'PMED REPORT DOCUMENT',
    '',
    `Report Reference: ${report.id}`,
    `Plan Reference: ${report.planReference || '--'}`,
    `Report Name: ${report.reportName}`,
    `Source Department: ${report.sourceDepartment}`,
    `Report Type: ${report.reportType}`,
    `Owner: ${report.ownerName}`,
    `Status: ${report.deliveryStatus}`,
    `Format: ${report.exportFormat || 'PDF'}`,
    `Updated: ${formatTimestamp(report.generatedAt)}`,
    '',
    'SUMMARY'
  ];

  const summary = report.packageSummary || {};
  const sectionCount = Number((summary as Record<string, unknown>).section_count || report.packageSections?.length || 0);
  const metricCount = Number((summary as Record<string, unknown>).metric_count || 0);
  const sources = Array.isArray((summary as Record<string, unknown>).sources)
    ? ((summary as Record<string, unknown>).sources as unknown[]).map((item) => String(item)).join(', ')
    : '';
  lines.push(`Sections: ${sectionCount}`);
  lines.push(`Metrics: ${metricCount}`);
  lines.push(`Sources: ${sources || report.sourceDepartment}`);
  lines.push('');
  lines.push('SECTIONS');

  (report.packageSections || []).forEach((section, index) => {
    lines.push(`${index + 1}. ${String(section.title || section.label || 'PMED Section')}`);
    lines.push(`   ${String(section.description || section.source || 'Department reporting package').slice(0, 110)}`);
  });

  if (!(report.packageSections || []).length) {
    lines.push('1. Consolidated reporting package ready for PMED review.');
  }

  const textCommands = lines
    .map((line, index) => `BT /F1 11 Tf 50 ${780 - index * 18} Td (${escapePdfText(line)}) Tj ET`)
    .join('\n');

  const stream = `${textCommands}\n`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}endstream endobj`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function resolveReportDocumentUrl(report: ReportRow): string {
  const directUrl = normalizeReportUrl(report.fileUrl);
  if (directUrl.toLowerCase().endsWith('.pdf')) return directUrl;
  return URL.createObjectURL(buildPdfBlob(report));
}

function openReportPreview(report: ReportRow): void {
  selectedReportId.value = report.id;
  previewTitle.value = report.reportName;
  previewUrl.value = resolveReportDocumentUrl(report);
  previewDialog.value = true;
}

function downloadReportPdf(report: ReportRow): void {
  const url = resolveReportDocumentUrl(report);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${report.reportName || report.id}`.replace(/[^\w.-]+/g, '_') + '.pdf';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function openPreviewInNewTab(): void {
  if (!previewUrl.value) return;
  window.open(previewUrl.value, '_blank', 'noopener');
}

function resetForm(): void {
  Object.assign(form, {
    reportReference: '',
    planReference: '',
    reportName: '',
    sourceDepartment: '',
    ownerName: '',
    exportFormat: 'PDF',
    fileUrl: ''
  });
}

function openCreateModal(mode: 'create' | 'request' | 'receive' | 'finalize'): void {
  dialogMode.value = mode;
  resetForm();
  form.reportReference = `RPT-${new Date().getFullYear()}-${String(reports.value.length + 1).padStart(3, '0')}`;
  reportDialog.value = true;
}

function openEditModal(row: ReportRow): void {
  if (row.isExternalDelivery) {
    selectedReportId.value = row.id;
    return;
  }
  dialogMode.value = 'edit';
  Object.assign(form, {
    reportReference: row.id,
    planReference: row.planReference,
    reportName: row.reportName,
    sourceDepartment: row.sourceDepartment === 'PMED' ? '' : row.sourceDepartment,
    ownerName: row.ownerName,
    exportFormat: row.exportFormat,
    fileUrl: row.fileUrl
  });
  selectedReportId.value = row.id;
  reportDialog.value = true;
}

function selectReport(row: ReportRow): void {
  selectedReportId.value = row.id;
}

async function saveReport(): Promise<void> {
  if (!form.reportReference.trim() || !form.reportName.trim()) {
    emitSuccessModal({ title: 'Missing Fields', message: 'Please complete the report reference and report name.', tone: 'warning' });
    return;
  }
  if ((dialogMode.value === 'request' || dialogMode.value === 'receive') && !form.sourceDepartment.trim()) {
    emitSuccessModal({ title: 'Missing Source Department', message: 'Select which department is sending this report to PMED.', tone: 'warning' });
    return;
  }
  try {
    const workspace = await saveReportingRecord({
      reportReference: form.reportReference.trim(),
      planReference: form.planReference.trim(),
      reportName: form.reportName.trim(),
      sourceDepartment: form.sourceDepartment.trim(),
      ownerName: form.ownerName.trim() || 'Reports Analyst',
      exportFormat: form.exportFormat.trim(),
      fileUrl: form.fileUrl.trim(),
      action:
        dialogMode.value === 'request'
          ? 'request_department_report'
          : dialogMode.value === 'receive'
            ? 'receive_department_report'
            : dialogMode.value === 'finalize'
              ? 'finalize_report'
              : 'upsert',
      reportType: form.sourceDepartment.trim() ? `${form.sourceDepartment.trim()} Report` : 'Consolidated PMED Report'
    });
    hydrateWorkspace(workspace);
    selectedReportId.value = form.reportReference.trim();
    reportDialog.value = false;
    emitSuccessModal({
      title:
        dialogMode.value === 'request'
          ? 'Department Report Requested'
          : dialogMode.value === 'receive'
            ? 'Department Report Received'
            : dialogMode.value === 'finalize'
              ? 'Consolidated Report Finalized'
            : dialogMode.value === 'create'
              ? 'Report Added'
              : 'Report Updated',
      message: `${form.reportName} is now updated in the reporting queue.`,
      tone: 'success'
    });
  } catch (error) {
    emitSuccessModal({
      title: 'Save Unavailable',
      message: error instanceof Error ? error.message : 'Unable to save this report.',
      tone: 'warning'
    });
  }
}

async function requestDepartmentReport(): Promise<void> {
  openCreateModal('request');
}

async function receiveDepartmentReport(): Promise<void> {
  openCreateModal('receive');
}

async function finalizeConsolidatedReport(target?: ReportRow | null): Promise<void> {
  const report = target || selectedReport.value;
  if (report && report.sourceDepartment === 'PMED') {
    openEditModal(report);
    dialogMode.value = 'finalize';
    return;
  }
  openCreateModal('finalize');
}

function resolveActionTarget(preferred?: ReportRow | null): ReportRow | null {
  if (preferred) return preferred;
  if (selectedReport.value?.sourceDepartment === 'PMED') return selectedReport.value;
  return filteredReports.value.find((item) => item.sourceDepartment === 'PMED') || selectedReport.value || filteredReports.value[0] || null;
}

async function sendToAdministration(target?: ReportRow | null): Promise<void> {
  const report = resolveActionTarget(target || null);
  if (!report) {
    emitSuccessModal({ title: 'No Report Selected', message: 'Choose a report before sending it to administration.', tone: 'warning' });
    return;
  }
  if (report.sourceDepartment !== 'PMED') {
    emitSuccessModal({ title: 'Finalize PMED Report First', message: 'Only the consolidated PMED report should be sent to School Administration.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Send Report to School Administration',
    message: `Send ${report.reportName} to School Administration now?`,
    confirmText: 'Send Report',
    tone: 'primary'
  });
  if (!confirmed) return;
  try {
    const workspace = await runReportingAction('send_to_administration', {
      reportReference: report.id,
      actor: 'Reports Analyst'
    });
    hydrateWorkspace(workspace);
    selectedReportId.value = report.id;
    emitSuccessModal({ title: 'Report Sent', message: `${report.reportName} was sent to School Administration.`, tone: 'success' });
  } catch (error) {
    emitSuccessModal({ title: 'Send Unavailable', message: error instanceof Error ? error.message : 'Unable to send this report.', tone: 'warning' });
  }
}

async function archiveReport(target?: ReportRow | null): Promise<void> {
  const report = resolveActionTarget(target || null);
  if (!report) {
    emitSuccessModal({ title: 'No Report Selected', message: 'Choose a report before archiving it.', tone: 'warning' });
    return;
  }
  const confirmed = await requestConfirmModal({
    title: 'Archive Report',
    message: `Archive ${report.reportName}?`,
    confirmText: 'Archive',
    tone: 'warning'
  });
  if (!confirmed) return;
  try {
    const workspace = await runReportingAction('archive_report', {
      reportReference: report.id,
      actor: 'Reports Analyst'
    });
    hydrateWorkspace(workspace);
    selectedReportId.value = report.id;
    emitSuccessModal({ title: 'Report Archived', message: `${report.reportName} is now archived.`, tone: 'warning' });
  } catch (error) {
    emitSuccessModal({ title: 'Archive Unavailable', message: error instanceof Error ? error.message : 'Unable to archive this report.', tone: 'warning' });
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
          <div class="page-kicker">Reporting</div>
          <h1 class="text-h4 font-weight-black mb-1">Department Report Inbox</h1>
          <p class="text-medium-emphasis mb-0">Receive essential reports from Clinic, Cashier, Guidance, Prefect, Computer Laboratory, CRAD, and HR, then finalize one PMED report for School Administration.</p>
        </div>
      </v-card-text>
    </v-card>

    <AnalyticsCardGrid :items="cards" md="6" lg="3" class="mt-4" />

    <v-row class="mt-4">
      <v-col cols="12" lg="8">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Essential Reports Queue</v-card-title>
            <v-card-subtitle>Inbound department reports are collected here first, then PMED prepares one final consolidated release.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="records-toolbar">
              <v-text-field
                v-model="searchTerm"
                variant="outlined"
                density="compact"
                hide-details
                prepend-inner-icon="mdi-magnify"
                placeholder="Search report reference or owner"
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
                <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-file-arrow-down-outline" @click="requestDepartmentReport()">Request Report</v-btn>
                <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-database-check-outline" @click="receiveDepartmentReport()">Receive Report</v-btn>
              </div>
            </div>
            <v-table density="comfortable" class="saas-table mt-3">
              <thead>
                <tr>
                  <th>Report Reference</th>
                  <th>Source</th>
                  <th>Report Name</th>
                  <th>Type</th>
                  <th>Owner</th>
                  <th>Delivery Status</th>
                  <th>Updated</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in paginatedReports"
                  :key="row.id"
                  :class="{ 'bg-grey-lighten-5': row.id === selectedReportId }"
                  @click="selectReport(row)"
                >
                  <td>
                    <div class="font-weight-bold">{{ row.id }}</div>
                    <div class="text-caption text-medium-emphasis">{{ row.planReference || 'reporting row' }}</div>
                  </td>
                  <td>{{ row.sourceDepartment }}</td>
                  <td>{{ row.reportName }}</td>
                  <td>{{ row.reportType }}</td>
                  <td>{{ row.ownerName }}</td>
                  <td><v-chip size="x-small" :color="statusColor(row.deliveryStatus)" variant="tonal">{{ row.deliveryStatus }}</v-chip></td>
                  <td>{{ formatTimestamp(row.generatedAt) }}</td>
                  <td class="text-right">
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openReportPreview(row)">View</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="downloadReportPdf(row)">Download PDF</v-btn>
                    <v-btn size="x-small" variant="text" color="primary" @click.stop="openEditModal(row)">{{ row.isExternalDelivery ? 'Details' : 'Open' }}</v-btn>
                    <v-btn v-if="row.sourceDepartment === 'PMED' && row.deliveryStatus !== 'Sent to Administration'" size="x-small" variant="text" color="primary" @click.stop="sendToAdministration(row)">Send Admin</v-btn>
                  </td>
                </tr>
                <tr v-if="!filteredReports.length">
                  <td colspan="8" class="text-center text-medium-emphasis py-6">No report records match the current filters.</td>
                </tr>
              </tbody>
            </v-table>
            <div class="d-flex align-center justify-space-between flex-wrap ga-3 mt-4">
              <div class="text-body-2 text-medium-emphasis">
                Showing {{ paginatedReports.length }} of {{ filteredReports.length }} reports
              </div>
              <v-pagination
                v-model="currentPage"
                :length="totalPages"
                :total-visible="5"
                density="comfortable"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" lg="4">
        <v-card variant="outlined" class="surface-card action-panel mb-4">
          <v-card-item>
            <v-card-title>Action Center</v-card-title>
            <v-card-subtitle>Only the essential reporting steps stay here: request, receive, finalize, send, and archive.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="action-stack">
              <v-btn color="primary" variant="flat" prepend-icon="mdi-file-arrow-down-outline" @click="requestDepartmentReport()">Request Department Report</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-database-check-outline" @click="receiveDepartmentReport()">Receive Department Report</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-file-document-check-outline" @click="finalizeConsolidatedReport()">Finalize PMED Report</v-btn>
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-send-outline" :disabled="!filteredReports.length" @click="sendToAdministration()">Send to School Administration</v-btn>
              <v-btn variant="outlined" prepend-icon="mdi-archive-outline" :disabled="!filteredReports.length" @click="archiveReport()">Archive Report</v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card mb-4">
          <v-card-item>
            <v-card-title>Essential Intake Checklist</v-card-title>
          </v-card-item>
          <v-card-text>
            <v-list density="compact">
              <v-list-item
                v-for="item in dispatchChecklist"
                :key="item.id"
                :title="item.label"
                :prepend-icon="item.done ? 'mdi-check-circle' : 'mdi-alert-circle-outline'"
              />
            </v-list>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Release Gate</v-card-title>
          </v-card-item>
          <v-card-text class="text-body-2 text-medium-emphasis">{{ nextWorkflowMessage }}</v-card-text>
        </v-card>

        <v-card v-if="selectedReport" variant="outlined" class="surface-card mt-4">
          <v-card-item>
            <v-card-title>Selected Report Package</v-card-title>
            <v-card-subtitle>{{ selectedReport.reportName }}</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div class="d-flex ga-2 flex-wrap">
              <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-eye-outline" @click="openReportPreview(selectedReport)">View PDF</v-btn>
              <v-btn size="small" color="primary" variant="outlined" prepend-icon="mdi-download-outline" @click="downloadReportPdf(selectedReport)">Download PDF</v-btn>
            </div>
            <div class="text-body-2">
              <strong>Source:</strong> {{ selectedReport.sourceDepartment }}
              <span class="text-medium-emphasis"> • {{ selectedReport.reportType }}</span>
            </div>
            <div class="text-body-2">
              <strong>Status:</strong> {{ selectedReport.deliveryStatus }}
            </div>
            <div v-if="selectedPackageSummary" class="kanban-card">
              <div class="text-caption text-medium-emphasis">Package Summary</div>
              <div class="text-body-2">Sections: {{ Number(selectedPackageSummary.section_count || 0) }}</div>
              <div class="text-body-2">Metrics: {{ Number(selectedPackageSummary.metric_count || 0) }}</div>
              <div class="text-body-2">Sources: {{ Array.isArray(selectedPackageSummary.sources) ? selectedPackageSummary.sources.join(', ') : '--' }}</div>
            </div>
            <div v-if="selectedPackageSections.length" class="d-flex flex-column ga-2">
              <div class="text-subtitle-2 font-weight-bold">PMED-needed sections</div>
              <div v-for="(section, index) in selectedPackageSections" :key="`${selectedReport.id}-section-${index}`" class="info-card">
                <div class="font-weight-bold">{{ String(section.title || section.label || 'PMED section') }}</div>
                <div class="text-body-2 text-medium-emphasis">{{ String(section.description || section.source || 'Clinic reporting package') }}</div>
                <div class="text-caption text-medium-emphasis">Metrics: {{ Array.isArray(section.metrics) ? section.metrics.length : 0 }}</div>
              </div>
            </div>
            <div v-if="selectedReport.isExternalDelivery && !selectedPackageSections.length" class="text-body-2 text-medium-emphasis">
              This report arrived from another system and is visible here as a read-only PMED intake record.
            </div>
            <div v-if="!canEditSelectedReport" class="text-caption text-medium-emphasis">
              External department deliveries are read-only here. PMED can finalize its own consolidated report after intake.
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Reporting Flow Logic</v-card-title>
            <v-card-subtitle>Department reports enter first, PMED finalizes next, then School Administration receives the consolidated release.</v-card-subtitle>
          </v-card-item>
          <v-card-text>
            <div class="kanban-row">
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Inbound Reports</div>
                <div class="text-h6 font-weight-bold">{{ reports.length }}</div>
                <div class="text-body-2">Department and PMED report rows currently visible in the shared queue.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Essential Received</div>
                <div class="text-h6 font-weight-bold">{{ reports.filter((item) => item.sourceDepartment !== 'PMED' && item.deliveryStatus === 'Received').length }}</div>
                <div class="text-body-2">Required department reports already in PMED hands.</div>
              </div>
              <div class="kanban-card">
                <div class="text-caption text-medium-emphasis">Final Dispatch</div>
                <div class="text-h6 font-weight-bold">{{ reports.filter((item) => item.deliveryStatus === 'Sent to Administration').length }}</div>
                <div class="text-body-2">Final PMED reports already released to School Administration.</div>
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" xl="6">
        <v-card variant="outlined" class="surface-card">
          <v-card-item>
            <v-card-title>Reporting Activity Logs</v-card-title>
            <v-card-subtitle>Recent generation, export, dispatch, and archive actions.</v-card-subtitle>
          </v-card-item>
          <v-card-text class="d-flex flex-column ga-3">
            <div v-for="log in activityLogs" :key="`${log.id}-${log.reference}`" class="info-card">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="font-weight-bold">{{ log.action }}</div>
                <v-chip size="x-small" :color="toneColor(log.tone)" variant="tonal">{{ formatTimestamp(log.createdAt) }}</v-chip>
              </div>
              <div class="text-body-2 mb-2">{{ log.detail }}</div>
              <div class="text-caption text-medium-emphasis">{{ log.actor }} • {{ log.reference || 'Reporting' }}</div>
            </div>
            <div v-if="!activityLogs.length" class="text-body-2 text-medium-emphasis">No reporting activity has been recorded yet.</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>


    <v-dialog v-model="previewDialog" max-width="980">
      <v-card class="surface-card">
        <v-card-item>
          <v-card-title>{{ previewTitle || 'Report Preview' }}</v-card-title>
          <v-card-subtitle>Preview and download the report in a SaaS-style document viewer.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <div class="d-flex ga-2 flex-wrap mb-4">
            <v-btn color="primary" variant="flat" prepend-icon="mdi-download-outline" :disabled="!selectedReport" @click="selectedReport && downloadReportPdf(selectedReport)">Download PDF</v-btn>
            <v-btn color="primary" variant="outlined" prepend-icon="mdi-open-in-new" :disabled="!previewUrl" @click="openPreviewInNewTab()">Open in New Tab</v-btn>
          </div>
          <div class="info-card" style="padding: 0; overflow: hidden">
            <iframe
              v-if="previewUrl"
              :src="previewUrl"
              title="Report Preview"
              style="width: 100%; height: 72vh; border: 0; background: #fff"
            />
          </div>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="previewDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="reportDialog" max-width="760">
      <v-card>
        <v-card-item>
          <v-card-title>
              {{
                dialogMode === 'create'
                  ? 'Create Report Record'
                : dialogMode === 'request'
                  ? 'Request Department Report'
                  : dialogMode === 'receive'
                    ? 'Receive Department Report'
                    : dialogMode === 'finalize'
                      ? 'Finalize PMED Report'
                    : 'Update Report'
              }}
            </v-card-title>
          <v-card-subtitle>Keep inbound department reports and the final PMED release aligned in one reporting workspace.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.reportReference" label="Report Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.planReference" label="Plan Reference" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="form.sourceDepartment" :items="departmentOptions" label="Source Department" variant="outlined" :disabled="dialogMode === 'finalize'" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.reportName" label="Report Name" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.ownerName" label="Owner" variant="outlined" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select v-model="form.exportFormat" :items="exportFormats" label="Format" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.fileUrl" label="File URL / Path" variant="outlined" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions class="justify-end">
          <v-btn variant="text" @click="reportDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveReport">
            {{
              dialogMode === 'request'
                ? 'Request Report'
                : dialogMode === 'receive'
                  ? 'Receive Report'
                  : dialogMode === 'finalize'
                    ? 'Finalize Report'
                  : dialogMode === 'create'
                    ? 'Create Report'
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








