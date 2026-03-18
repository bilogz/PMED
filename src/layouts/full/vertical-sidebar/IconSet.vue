<script setup lang="ts">
import { computed } from 'vue';

type SidebarItemLike = {
  icon?: unknown;
  title?: string;
};

const props = defineProps<{
  item?: SidebarItemLike | string | object;
  level?: number;
}>();

const iconByTitle: Record<string, string> = {
  dashboard: 'mdi-view-dashboard-outline',
  appointments: 'mdi-calendar-clock-outline',
  'patients database': 'mdi-account-group-outline',
  'registration (patient management)': 'mdi-clipboard-text-outline',
  'walk-in': 'mdi-walk',
  'check-up': 'mdi-stethoscope',
  laboratory: 'mdi-flask-outline',
  'pharmacy & inventory': 'mdi-pill',
  'mental health & addiction': 'mdi-account-heart-outline',
  reports: 'mdi-chart-line'
};

const resolved = computed(() => {
  const raw = props.item;
  if (typeof raw === 'string') return { type: 'mdi' as const, value: raw };

  if (raw && typeof raw === 'object') {
    const candidate = raw as SidebarItemLike;
    if (typeof candidate.icon === 'string') return { type: 'mdi' as const, value: candidate.icon };
    if (candidate.icon) return { type: 'component' as const, value: candidate.icon };

    const mapped = iconByTitle[String(candidate.title || '').trim().toLowerCase()];
    if (mapped) return { type: 'mdi' as const, value: mapped };
  }

  return { type: 'mdi' as const, value: 'mdi-circle-outline' };
});
</script>

<template>
  <template v-if="resolved.type === 'mdi'">
    <v-icon :icon="resolved.value as string" :size="(props.level || 0) > 0 ? 14 : 20" class="iconClass" />
  </template>
  <template v-else-if="(props.level || 0) > 0">
    <component :is="resolved.value" size="5" fill="currentColor" stroke-width="1.5" class="iconClass"></component>
  </template>
  <template v-else>
    <component :is="resolved.value" size="20" stroke-width="1.5" class="iconClass"></component>
  </template>
</template>
