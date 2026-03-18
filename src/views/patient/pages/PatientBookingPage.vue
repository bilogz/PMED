<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import bcpClinicLogo from '@/assets/images/logos/bcp-olp-logo-mini2.png';
import PatientBookingModal from '@/views/patient/components/PatientBookingModal.vue';
import PatientAuthModal from '@/views/patient/components/PatientAuthModal.vue';
import PatientProfileModal from '@/views/patient/components/PatientProfileModal.vue';
import { fetchPatientSession, logoutPatientAccount, type PatientAccount, type PatientSessionResponse } from '@/services/patientAuth';
import { fetchPatientPortal, type PatientPortalData } from '@/services/patientPortal';

type NavLink = {
  id: string;
  label: string;
};

const navLinks: NavLink[] = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'doctors', label: 'Doctors' },
  { id: 'contact', label: 'Contact Us' },
  { id: 'portal', label: 'Clinic Portal' }
];

const doctorDirectory = ref(['Dr. Humour', 'Dr. Jenni', 'Dr. Rivera', 'Dr. Morco', 'Dr. Molina', 'Dr. B. Martinez']);
const bookingDialog = ref(false);
const authDialog = ref(false);
const profileDialog = ref(false);
const activeSection = ref('home');
const route = useRoute();
const router = useRouter();
let observer: IntersectionObserver | null = null;

const patientAccount = ref<PatientAccount | null>(null);
const portalData = ref<PatientPortalData | null>(null);
const loadingSession = ref(false);
const loadingPortal = ref(false);
const portalError = ref('');
const authMode = ref<'login' | 'signup'>('login');

const isAuthenticated = computed(() => Boolean(patientAccount.value));

function openBookingModal(): void {
  bookingDialog.value = true;
}

function openAuth(mode: 'login' | 'signup'): void {
  authMode.value = mode;
  authDialog.value = true;
}

function scrollToSection(id: string, pushHash = true): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  activeSection.value = id;
  if (pushHash) {
    void router.replace({ path: '/student/', hash: id === 'home' ? '' : `#${id}` });
  }
}

function bindSectionObserver(): void {
  observer?.disconnect();
  const sections = navLinks.map((item) => document.getElementById(item.id)).filter((item): item is HTMLElement => Boolean(item));

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible?.target?.id) return;
      activeSection.value = visible.target.id;
    },
    {
      root: null,
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0.2, 0.4, 0.6]
    }
  );

  sections.forEach((section) => observer?.observe(section));
}

async function loadPatientSession(): Promise<void> {
  loadingSession.value = true;
  try {
    const session = await fetchPatientSession();
    patientAccount.value = session.authenticated ? session.account : null;
    if (session.authenticated) {
      await loadPatientPortal();
    } else {
      portalData.value = null;
    }
  } catch {
    patientAccount.value = null;
    portalData.value = null;
  } finally {
    loadingSession.value = false;
  }
}

async function loadPatientPortal(): Promise<void> {
  if (!patientAccount.value) return;
  loadingPortal.value = true;
  portalError.value = '';
  try {
    portalData.value = await fetchPatientPortal();
  } catch (error) {
    portalError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loadingPortal.value = false;
  }
}

async function handleAuthSuccess(session: PatientSessionResponse): Promise<void> {
  patientAccount.value = session.authenticated ? session.account : null;
  if (patientAccount.value) {
    await loadPatientPortal();
    await nextTick();
    scrollToSection('portal');
  }
}

function handleProfileUpdated(account: PatientAccount): void {
  patientAccount.value = account;
  void loadPatientPortal();
}

async function handleLogout(): Promise<void> {
  try {
    await logoutPatientAccount();
  } finally {
    patientAccount.value = null;
    portalData.value = null;
    portalError.value = '';
  }
}

watch(
  () => route.hash,
  async (hash) => {
    if (!hash) {
      activeSection.value = 'home';
      return;
    }
    await nextTick();
    const section = hash.replace('#', '');
    scrollToSection(section, false);
  }
);

onMounted(async () => {
  await nextTick();
  bindSectionObserver();
  const section = route.hash.replace('#', '') || 'home';
  scrollToSection(section, false);
  await loadPatientSession();
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="patient-page" id="home">
    <div class="patient-topbar">
      <div class="patient-topbar-inner">
        <div class="topbar-meta">
          <span><v-icon icon="mdi-phone" size="14" class="mr-1" /> Call: +01 1234567890</span>
          <span><v-icon icon="mdi-email" size="14" class="mr-1" /> demo@gmail.com</span>
          <span><v-icon icon="mdi-map-marker" size="14" class="mr-1" /> Bestlink College Campus Clinic</span>
        </div>
        <div class="topbar-auth">
          <template v-if="!isAuthenticated">
            <button type="button" class="topbar-auth-btn" @click="openAuth('login')">Login</button>
            <button type="button" class="topbar-auth-btn topbar-auth-btn-primary" @click="openAuth('signup')">Sign Up</button>
          </template>
          <template v-else>
            <span class="topbar-user">{{ patientAccount?.fullName }}</span>
            <button type="button" class="topbar-auth-btn" @click="profileDialog = true">My Profile</button>
            <button type="button" class="topbar-auth-btn" @click="handleLogout">Logout</button>
          </template>
        </div>
      </div>
    </div>

    <section class="patient-hero">
      <div class="patient-hero-overlay"></div>
      <div class="patient-hero-content">
        <img :src="bcpClinicLogo" alt="BCP Clinic" class="patient-logo" />

        <nav class="patient-nav">
          <button v-for="link in navLinks" :key="link.id" type="button" class="nav-btn" :class="{ active: activeSection === link.id }" @click="scrollToSection(link.id)">
            {{ link.label }}
          </button>
        </nav>

        <h1>BCP CLINIC SYSTEM</h1>
        <p>Patients can book ahead and monitor appointment assignment in real time.</p>
        <button type="button" class="book-now-btn" @click="openBookingModal">BOOK NOW</button>
      </div>
    </section>

    <section id="about" class="section-card">
      <h2>About the System</h2>
      <p>Digital-first school clinic scheduling with fast booking, assignment tracking, and status monitoring.</p>
      <div class="stats-grid">
        <article><strong>24/7</strong><span>Priority Triage</span></article>
        <article><strong>20+</strong><span>Faculty Advisors</span></article>
        <article><strong>5</strong><span>Connected Care Modules</span></article>
      </div>
    </section>

    <section id="treatment" class="section-card">
      <h2>Treatment Lines</h2>
      <div class="pill-grid">
        <span>General Medicine</span>
        <span>Pediatrics</span>
        <span>Orthopedic</span>
        <span>Dental</span>
        <span>Laboratory</span>
        <span>Mental Health</span>
      </div>
    </section>

    <section id="doctors" class="section-card">
      <h2>Doctors On Duty</h2>
      <div class="doctor-grid">
        <article v-for="name in doctorDirectory" :key="name">
          <v-icon icon="mdi-account-heart-outline" size="22" />
          <div>{{ name }}</div>
        </article>
      </div>
    </section>

    <section id="contact" class="section-card contact-card">
      <h2>Contact</h2>
      <p>Phone: +01 1234567890</p>
      <p>Email: demo@gmail.com</p>
      <button type="button" class="book-now-btn" @click="openBookingModal">Start Booking</button>
    </section>

    <section id="portal" class="section-card portal-card">
      <div class="portal-header">
        <h2>My Clinic Portal</h2>
        <div class="portal-actions">
          <v-btn v-if="isAuthenticated" variant="outlined" size="small" :loading="loadingPortal" @click="loadPatientPortal">Refresh</v-btn>
          <v-btn v-else color="primary" size="small" @click="openAuth('login')">Login to Continue</v-btn>
        </div>
      </div>

      <v-alert v-if="portalError" type="error" variant="tonal" class="mb-4">{{ portalError }}</v-alert>

      <div v-if="loadingSession" class="portal-empty">Checking clinic session...</div>
      <div v-else-if="!isAuthenticated" class="portal-empty">
        <p>Create an optional account to track clinic bookings and status securely.</p>
        <div class="portal-cta">
          <v-btn color="primary" @click="openAuth('signup')">Create Clinic Account</v-btn>
          <v-btn variant="outlined" @click="openAuth('login')">I Already Have an Account</v-btn>
        </div>
      </div>
      <div v-else>
        <div class="portal-profile">
            <article><label>Patient Code</label><strong>{{ patientAccount?.patientCode }}</strong></article>
          <article><label>Name</label><strong>{{ patientAccount?.fullName }}</strong></article>
          <article><label>Email</label><strong>{{ patientAccount?.email }}</strong></article>
          <article><label>Phone</label><strong>{{ patientAccount?.phoneNumber }}</strong></article>
        </div>

        <div class="portal-metrics" v-if="portalData">
          <article><label>Total Bookings</label><strong>{{ portalData.analytics.total }}</strong></article>
          <article><label>Upcoming</label><strong>{{ portalData.analytics.upcoming }}</strong></article>
          <article><label>Pending</label><strong>{{ portalData.analytics.pending }}</strong></article>
          <article><label>Confirmed</label><strong>{{ portalData.analytics.confirmed }}</strong></article>
        </div>

        <div class="portal-table-wrap" v-if="portalData?.appointments?.length">
          <table class="portal-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Date</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in portalData.appointments" :key="item.bookingId">
                <td>
                  <div class="booking-id">{{ item.bookingId }}</div>
                  <small>{{ item.reason }}</small>
                </td>
                <td>{{ item.appointmentDate }} {{ item.preferredTime }}</td>
                <td>{{ item.teacherName || item.doctorName }}</td>
                <td>{{ item.department }}</td>
                <td><span class="status-pill">{{ item.status }}</span></td>
                <td>
                  <div class="booking-id">{{ item.cashierPaymentStatus || 'unpaid' }}</div>
                  <small>{{ item.cashierPaymentMethod || 'Pending cashier update' }}<span v-if="item.officialReceipt"> - OR {{ item.officialReceipt }}</span></small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="portal-empty">No appointment history yet for this clinic account.</div>
      </div>
    </section>

    <PatientBookingModal v-model="bookingDialog" :patient-context="patientAccount" />
    <PatientAuthModal v-model="authDialog" :initial-mode="authMode" @authenticated="handleAuthSuccess" />
    <PatientProfileModal v-model="profileDialog" :account="patientAccount" @updated="handleProfileUpdated" />
  </div>
</template>

<style scoped lang="scss">
.patient-page {
  --clinic-primary-dark: #0f66e8;
  --clinic-primary: #1bbaff;
  --clinic-bg: #eef2f4;
  --clinic-border: #d4dde2;
  min-height: 100vh;
  background: var(--clinic-bg);
  padding-bottom: 56px;
}

.patient-topbar {
  background: linear-gradient(90deg, var(--clinic-primary-dark) 0%, var(--clinic-primary) 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.patient-topbar-inner {
  width: min(1200px, 94vw);
  margin: 0 auto;
  padding: 10px 0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.topbar-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.topbar-auth {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.topbar-auth-btn {
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.topbar-auth-btn-primary {
  background: #0f66e8;
  border-color: #0f66e8;
}

.topbar-user {
  color: #d7f3ff;
  font-size: 12px;
  font-weight: 700;
}

.patient-hero {
  position: relative;
  min-height: 520px;
  background: linear-gradient(130deg, #1b4f7d 0%, #1d5266 62%, #27495a 100%);
  overflow: hidden;
}

.patient-hero-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 20% 10%, rgba(27, 186, 255, 0.16), transparent 48%);
}

.patient-hero-content {
  position: relative;
  z-index: 2;
  width: min(1200px, 94vw);
  margin: 0 auto;
  padding: 34px 0 100px;
  text-align: center;
  color: #fff;
}

.patient-logo {
  width: 210px;
  max-width: 90%;
}

.patient-nav {
  margin: 22px auto 66px;
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.nav-btn,
.nav-link {
  color: #fff;
  text-decoration: none;
  background: transparent;
  border: 0;
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}

.nav-btn:hover,
.nav-link:hover,
.nav-btn.active {
  color: var(--clinic-primary);
}

.patient-hero h1 {
  margin: 0;
  font-size: clamp(30px, 4.4vw, 56px);
  font-weight: 800;
}

.patient-hero p {
  margin: 14px auto 24px;
  font-size: clamp(16px, 2.1vw, 26px);
  max-width: 860px;
}

.book-now-btn {
  border: 0;
  border-radius: 8px;
  padding: 12px 30px;
  background: var(--clinic-primary);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}

.book-now-btn:hover {
  background: #11a3eb;
}

.section-card {
  width: min(1200px, 94vw);
  margin: 16px auto;
  background: #fff;
  border: 1px solid var(--clinic-border);
  border-radius: 14px;
  padding: 24px;
}

.section-card h2 {
  margin: 0 0 8px;
  color: #16395d;
}

.section-card p {
  color: #51677c;
}

.stats-grid,
.pill-grid,
.doctor-grid,
.portal-profile,
.portal-metrics {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}

.stats-grid,
.portal-profile,
.portal-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stats-grid article,
.portal-profile article,
.portal-metrics article {
  border: 1px solid #cae2ef;
  background: #f6fbfe;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stats-grid strong,
.portal-profile strong,
.portal-metrics strong {
  font-size: 22px;
  color: #0f66e8;
}

.stats-grid span,
.portal-profile label,
.portal-metrics label {
  color: #496679;
  font-weight: 600;
}

.pill-grid,
.doctor-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.pill-grid span {
  border-radius: 999px;
  border: 1px solid #c8d9e3;
  padding: 9px 14px;
  color: #294d67;
  font-weight: 600;
  text-align: center;
}

.doctor-grid article {
  border-radius: 12px;
  border: 1px solid #d5e4ec;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  color: #22475f;
}

.contact-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.portal-empty {
  border: 1px dashed #c7d8e2;
  border-radius: 10px;
  padding: 16px;
  color: #547085;
  margin-top: 12px;
}

.portal-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.portal-table-wrap {
  margin-top: 12px;
  overflow-x: auto;
}

.portal-table {
  width: 100%;
  border-collapse: collapse;
}

.portal-table th,
.portal-table td {
  padding: 10px;
  border-bottom: 1px solid #e1edf4;
  text-align: left;
  font-size: 14px;
}

.portal-table th {
  color: #2f536d;
}

.booking-id {
  font-weight: 700;
}

.status-pill {
  border-radius: 999px;
  background: #e7f3ff;
  color: #1f68a2;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 991px) {
  .patient-nav {
    margin-bottom: 40px;
  }

  .nav-btn,
  .nav-link {
    font-size: 14px;
  }

  .stats-grid,
  .pill-grid,
  .doctor-grid,
  .portal-profile,
  .portal-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .stats-grid,
  .pill-grid,
  .doctor-grid,
  .portal-profile,
  .portal-metrics {
    grid-template-columns: 1fr;
  }

  .portal-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .patient-hero-content {
    padding-bottom: 66px;
  }

  .patient-topbar {
    font-size: 12px;
  }

  .patient-topbar-inner {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
