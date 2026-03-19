export type PmedStageKey = 'planning' | 'collection' | 'monitoring' | 'evaluation' | 'reporting';

export type PmedFlowStep = {
  key: PmedStageKey;
  title: string;
  subtitle: string;
  completion: number;
};

export type PmedSummary = {
  plannedActivities: number;
  collectedRecords: number;
  monitoringItems: number;
  evaluationsCompleted: number;
  reportsGenerated: number;
};

export type PmedDashboardMock = {
  generatedAt: string;
  flowProgress: number;
  flowSteps: PmedFlowStep[];
  summary: PmedSummary;
  department: {
    receives: Array<{ source: string; detail: string }>;
    sends: Array<{ target: string; detail: string }>;
    dataSources: Array<{ name: string; feed: string; stage: string }>;
  };
  planning: {
    targets: Array<{ label: string; value: string; status: string }>;
    schedules: Array<{ label: string; date: string; owner: string }>;
    stakeholders: Array<{ name: string; role: string; status: string }>;
    resources: Array<{ label: string; amount: string }>;
  };
  dataCollection: {
    recentRecords: Array<{ id: string; type: string; source: string; receivedAt: string; status: string }>;
    sources: Array<{ name: string; total: number }>;
    trend: Array<{ label: string; total: number }>;
  };
  monitoring: {
    progress: Array<{ label: string; target: number; actual: number }>;
    alerts: Array<{ title: string; detail: string; severity: string }>;
  };
  evaluation: {
    outcomes: Array<{ label: string; total: number }>;
    comparisons: Array<{ metric: string; target: number; actual: number }>;
    notes: string[];
  };
  reporting: {
    queue: Array<{ title: string; owner: string; due: string; status: string }>;
    summaries: Array<{ label: string; value: string }>;
  };
  stakeholders: Array<{ name: string; role: string; contribution: string }>;
  mapping: Array<{ source: string; pmedStage: string; note: string }>;
};

export const pmedDashboardMock: PmedDashboardMock = {
  generatedAt: '2026-03-18T09:45:00.000Z',
  flowProgress: 68,
  flowSteps: [
    { key: 'planning', title: 'Planning', subtitle: 'Targets, schedules, resources', completion: 82 },
    { key: 'collection', title: 'Data Collection', subtitle: 'Intake, consultations, records', completion: 74 },
    { key: 'monitoring', title: 'Monitoring', subtitle: 'Track activity against plan', completion: 63 },
    { key: 'evaluation', title: 'Evaluation', subtitle: 'Compare outcomes vs targets', completion: 52 },
    { key: 'reporting', title: 'Reporting', subtitle: 'Compile PMED outputs', completion: 39 }
  ],
  summary: {
    plannedActivities: 18,
    collectedRecords: 462,
    monitoringItems: 27,
    evaluationsCompleted: 11,
    reportsGenerated: 6
  },
  department: {
    receives: [
      { source: 'Registrar', detail: 'Enrollment statistics' },
      { source: 'Clinic', detail: 'Health service reports' },
      { source: 'Guidance', detail: 'Counseling reports' },
      { source: 'Prefect', detail: 'Discipline statistics' },
      { source: 'Computer Lab', detail: 'Laboratory usage reports' },
      { source: 'CRAD', detail: 'Program activity reports' },
      { source: 'HR', detail: 'Employee performance reports' }
    ],
    sends: [{ target: 'School Administration', detail: 'Evaluation reports' }],
    dataSources: [
      { name: 'Registrar', feed: 'Enrollment & attendance', stage: 'Data Collection' },
      { name: 'HR', feed: 'Budget & staffing signals', stage: 'Planning' },
      { name: 'Clinic', feed: 'Health services & case studies', stage: 'Data Collection' },
      { name: 'Guidance', feed: 'Counseling outcomes', stage: 'Evaluation' },
      { name: 'Prefect', feed: 'Discipline updates', stage: 'Monitoring' },
      { name: 'Computer Lab', feed: 'Usage logs', stage: 'Data Collection' },
      { name: 'CRAD', feed: 'Program activity', stage: 'Monitoring' },
      { name: 'School Admin', feed: 'Policy targets & directives', stage: 'Planning' }
    ]
  },
  planning: {
    targets: [
      { label: 'Health Program Sessions', value: '18 Planned', status: 'On Track' },
      { label: 'Student Coverage', value: '1,200 Target', status: 'In Progress' },
      { label: 'Staff Wellness Checks', value: '140 Target', status: 'Scheduled' }
    ],
    schedules: [
      { label: 'School Health Week', date: 'Apr 04, 2026', owner: 'Clinic Core' },
      { label: 'Immunization Drive', date: 'Apr 10, 2026', owner: 'Registrar' },
      { label: 'Mental Health Forum', date: 'Apr 15, 2026', owner: 'Guidance Office' }
    ],
    stakeholders: [
      { name: 'Clinic', role: 'Core Delivery', status: 'Confirmed' },
      { name: 'Registrar', role: 'Student Data Source', status: 'Confirmed' },
      { name: 'HR', role: 'Staffing & Admin Support', status: 'Confirmed' }
    ],
    resources: [
      { label: 'Supplies Budget', amount: 'PHP 185,000' },
      { label: 'Staff Hours', amount: '480 hrs' },
      { label: 'Partner Clinics', amount: '3 Coordinated' }
    ]
  },
  dataCollection: {
    recentRecords: [
      { id: 'REC-1021', type: 'Walk-In Intake', source: 'Clinic', receivedAt: 'Mar 18, 2026 08:40', status: 'Tagged' },
      { id: 'REC-1019', type: 'Consultation Record', source: 'Check-Up', receivedAt: 'Mar 18, 2026 08:10', status: 'Verified' },
      { id: 'REC-1017', type: 'Lab Result', source: 'ComLab', receivedAt: 'Mar 17, 2026 17:25', status: 'Filed' },
      { id: 'REC-1012', type: 'Pharmacy Request', source: 'Pharmacy', receivedAt: 'Mar 17, 2026 16:40', status: 'Pending' }
    ],
    sources: [
      { name: 'Clinic', total: 182 },
      { name: 'Registrar', total: 96 },
      { name: 'HR', total: 44 },
      { name: 'ComLab', total: 72 },
      { name: 'CRAD', total: 68 }
    ],
    trend: [
      { label: 'Week 1', total: 72 },
      { label: 'Week 2', total: 86 },
      { label: 'Week 3', total: 93 },
      { label: 'Week 4', total: 108 },
      { label: 'Week 5', total: 101 },
      { label: 'Week 6', total: 114 }
    ]
  },
  monitoring: {
    progress: [
      { label: 'Health Programs Delivered', target: 18, actual: 12 },
      { label: 'Student Consultations', target: 420, actual: 318 },
      { label: 'Incident Follow-Ups', target: 60, actual: 41 }
    ],
    alerts: [
      { title: 'Immunization Drive', detail: 'Consent collection below target (68%)', severity: 'High' },
      { title: 'Mental Health Forum', detail: 'Needs facilitator confirmation', severity: 'Medium' },
      { title: 'Supplies Inventory', detail: 'First-aid kits at 32% stock', severity: 'Medium' }
    ]
  },
  evaluation: {
    outcomes: [
      { label: 'Targets Met', total: 7 },
      { label: 'Partially Met', total: 3 },
      { label: 'Needs Intervention', total: 2 }
    ],
    comparisons: [
      { metric: 'Student Coverage', target: 1200, actual: 860 },
      { metric: 'Staff Wellness', target: 140, actual: 104 },
      { metric: 'Lab Turnaround (hrs)', target: 24, actual: 28 }
    ],
    notes: [
      'Counseling attendance improved after peer referrals.',
      'Lab turnaround slipped during supply shortage.',
      'Engagement highest in grade 9 and 10 cohorts.'
    ]
  },
  reporting: {
    queue: [
      { title: 'Monthly Clinic Performance Report', owner: 'Clinic Admin', due: 'Mar 20, 2026', status: 'Drafting' },
      { title: 'Quarterly PMED Summary', owner: 'Quality Office', due: 'Mar 28, 2026', status: 'Collecting Data' },
      { title: 'Stakeholder Feedback Digest', owner: 'Prefect Office', due: 'Apr 02, 2026', status: 'Awaiting Inputs' }
    ],
    summaries: [
      { label: 'Monitoring Summary', value: '63% on track' },
      { label: 'Evaluation Summary', value: '7 targets met' },
      { label: 'Reporting Status', value: '6 reports generated' }
    ]
  },
  stakeholders: [
    { name: 'Clinic', role: 'Primary service delivery', contribution: 'Consultations, triage, follow-ups' },
    { name: 'Registrar', role: 'Student data source', contribution: 'Enrollment + attendance feeds' },
    { name: 'HR', role: 'Staff and admin support', contribution: 'Staffing KPIs and performance signals' },
    { name: 'ComLab', role: 'Laboratory analytics', contribution: 'Diagnostics and lab results' },
    { name: 'CRAD', role: 'Risk advisory', contribution: 'Incident and compliance updates' },
    { name: 'Prefect', role: 'Student conduct', contribution: 'Behavioral and incident logs' }
  ],
  mapping: [
    { source: 'Patient Registration / Intake', pmedStage: 'Data Collection', note: 'Feeds raw patient records' },
    { source: 'Clinic Scheduling / Activity Setup', pmedStage: 'Planning', note: 'Defines program targets' },
    { source: 'Active Case Tracking', pmedStage: 'Monitoring', note: 'Progress vs plan' },
    { source: 'Outcome Review', pmedStage: 'Evaluation', note: 'Target vs actual metrics' },
    { source: 'Summary Printouts & Analytics', pmedStage: 'Reporting', note: 'Final PMED outputs' }
  ]
};
