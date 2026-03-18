<script setup lang="ts">
type AnalyticsCardItem = {
  key?: string;
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  icon?: string;
};

withDefaults(
  defineProps<{
    items: AnalyticsCardItem[];
    cols?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
  }>(),
  {
    cols: '12',
    sm: '6',
    md: '3',
    lg: '3',
    xl: undefined
  }
);
</script>

<template>
  <v-row class="mb-4">
    <v-col
      v-for="(card, index) in items"
      :key="card.key || card.title || index"
      :cols="cols"
      :sm="sm"
      :md="md"
      :lg="lg"
      :xl="xl"
    >
      <v-card :class="['h-100 analytics-card', card.className || 'analytics-card-blue']" elevation="0">
        <v-card-text>
          <div class="d-flex align-start justify-space-between ga-3">
            <div class="analytics-card-title">{{ card.title }}</div>
            <v-btn v-if="card.icon" icon size="small" variant="outlined" class="analytics-card-icon">
              <v-icon :icon="card.icon" size="18" />
            </v-btn>
          </div>
          <div class="analytics-card-value">{{ card.value }}</div>
          <div v-if="card.subtitle" class="analytics-card-subtitle">{{ card.subtitle }}</div>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.analytics-card {
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(12, 31, 60, 0.18);
}

.analytics-card-green {
  background: linear-gradient(135deg, #23ba63 0%, #129a51 100%);
}

.analytics-card-blue {
  background: linear-gradient(135deg, #40a9f2 0%, #357adf 100%);
}

.analytics-card-orange {
  background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
}

.analytics-card-purple {
  background: linear-gradient(135deg, #a82cf0 0%, #7a1fca 100%);
}

.analytics-card-red {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.analytics-card-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #0284c7 100%);
}

.analytics-card-indigo {
  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
}

.analytics-card-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}

.analytics-card-value {
  font-size: 44px;
  font-weight: 800;
  line-height: 1.05;
  margin-top: 8px;
}

.analytics-card-subtitle {
  margin-top: 4px;
  font-size: 14px;
  opacity: 0.95;
}

.analytics-card-icon {
  color: rgba(255, 255, 255, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.45) !important;
  background: rgba(255, 255, 255, 0.05) !important;
}
</style>
