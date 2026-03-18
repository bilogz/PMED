<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
import { useAuthStore } from '@/stores/auth';
// Icon Imports
import { BellIcon, SettingsIcon, SearchIcon, Menu2Icon, ClockIcon, TemperatureIcon } from 'vue-tabler-icons';

// dropdown imports
import NotificationDD from './NotificationDD.vue';
import ProfileDD from './ProfileDD.vue';
import Searchbar from './SearchBarPanel.vue';

const customizer = useCustomizerStore();
const authStore = useAuthStore();
const showSearch = ref(false);
const clockText = ref('');
const temperatureText = ref('Temp --');
let clockTimer: ReturnType<typeof setInterval> | null = null;
let weatherTimer: ReturnType<typeof setInterval> | null = null;

function searchbox() {
  showSearch.value = !showSearch.value;
}

const displayName = computed(() => authStore.user?.fullName || authStore.user?.username || 'Admin');
const userInitials = computed(() => {
  const raw = displayName.value.trim();
  if (!raw) return 'AD';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
});

function updateClock(): void {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(now);
  clockText.value = formatted;
}

async function fetchTemperature(lat: number, lon: number): Promise<void> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`,
      { method: 'GET' }
    );
    if (!response.ok) {
      temperatureText.value = 'Temp --';
      return;
    }

    const payload = (await response.json()) as { current?: { temperature_2m?: number } };
    const value = payload.current?.temperature_2m;
    temperatureText.value = Number.isFinite(value) ? `${Math.round(value as number)}°C` : 'Temp --';
  } catch {
    temperatureText.value = 'Temp --';
  }
}

function refreshTemperature(): void {
  if (!navigator.geolocation) {
    temperatureText.value = 'Temp --';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      fetchTemperature(coords.latitude, coords.longitude);
    },
    () => {
      temperatureText.value = 'Temp --';
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
  );
}

onMounted(() => {
  updateClock();
  refreshTemperature();
  clockTimer = setInterval(updateClock, 1000);
  weatherTimer = setInterval(refreshTemperature, 10 * 60 * 1000);
});

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer);
  if (weatherTimer) clearInterval(weatherTimer);
});
</script>

<template>
  <v-app-bar elevation="0" height="80">
    <v-btn
      class="hidden-md-and-down text-secondary"
      color="lightsecondary"
      icon
      rounded="sm"
      variant="flat"
      @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)"
      size="small"
    >
      <Menu2Icon size="20" stroke-width="1.5" />
    </v-btn>
    <v-btn
      class="hidden-lg-and-up text-secondary ms-3"
      color="lightsecondary"
      icon
      rounded="sm"
      variant="flat"
      @click.stop="customizer.SET_SIDEBAR_DRAWER"
      size="small"
    >
      <Menu2Icon size="20" stroke-width="1.5" />
    </v-btn>

    <!-- search mobile -->
    <v-btn
      class="hidden-lg-and-up text-secondary ml-3"
      color="lightsecondary"
      icon
      rounded="sm"
      variant="flat"
      size="small"
      @click="searchbox"
    >
      <SearchIcon size="17" stroke-width="1.5" />
    </v-btn>

    <v-sheet v-if="showSearch" class="search-sheet v-col-12">
      <Searchbar :closesearch="searchbox" />
    </v-sheet>

    <!-- ---------------------------------------------- -->
    <!-- Search part -->
    <!-- ---------------------------------------------- -->
    <v-sheet class="mx-3 v-col-3 v-col-xl-2 v-col-lg-4 d-none d-lg-block">
      <Searchbar />
    </v-sheet>

    <div class="d-none d-lg-flex align-center ga-2">
      <v-chip color="lightsecondary" variant="flat" size="small" class="text-secondary">
        <ClockIcon size="14" stroke-width="1.8" class="mr-1" />
        {{ clockText }}
      </v-chip>
      <v-chip color="lightsecondary" variant="flat" size="small" class="text-secondary">
        <TemperatureIcon size="14" stroke-width="1.8" class="mr-1" />
        {{ temperatureText }}
      </v-chip>
    </div>

    <!---/Search part -->

    <v-spacer />
    <!-- ---------------------------------------------- -->
    <!---right part -->
    <!-- ---------------------------------------------- -->

    <!-- ---------------------------------------------- -->
    <!-- Notification -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn icon class="text-secondary mx-3" color="lightsecondary" rounded="sm" size="small" variant="flat" v-bind="props">
          <BellIcon stroke-width="1.5" size="22" />
        </v-btn>
      </template>
      <v-sheet rounded="md" width="330" elevation="12">
        <NotificationDD />
      </v-sheet>
    </v-menu>

    <!-- ---------------------------------------------- -->
    <!-- User Profile -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="false">
      <template v-slot:activator="{ props }">
        <v-btn class="profileBtn text-primary" color="lightprimary" variant="flat" rounded="pill" v-bind="props">
          <v-avatar size="30" class="mr-2 profile-avatar">
            <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" alt="Profile" />
            <span v-else class="profile-initials">{{ userInitials }}</span>
            <span class="online-dot" />
          </v-avatar>
          <SettingsIcon stroke-width="1.5" />
        </v-btn>
      </template>
      <v-sheet rounded="md" width="330" elevation="12">
        <ProfileDD />
      </v-sheet>
    </v-menu>
  </v-app-bar>
</template>

<style scoped>
.profile-avatar {
  position: relative;
  background: linear-gradient(135deg, #2f80ed 0%, #225ac8 100%);
}

.profile-initials {
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #16a34a;
  border: 2px solid #ffffff;
}

</style>
