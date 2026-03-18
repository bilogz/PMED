<template>
  <div class="logo-main">
    <RouterLink to="/dashboard/default" class="logo-main-link">
      <img :src="bcpShield" alt="BCP Clinic" class="logo-main-icon" />
      <div v-if="!customizer.mini_sidebar" class="logo-main-text">
        <div class="logo-main-title">Bestlink College</div>
        <div class="logo-main-subtitle">of the Philippines</div>
      </div>
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { useCustomizerStore } from '@/stores/customizer';
import bcpShield from '@/assets/images/logos/bcp-olp-logo-mini2.png';

const customizer = useCustomizerStore();
</script>

<style scoped>
.logo-main {
  display: flex;
  align-items: center;
}

.logo-main-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
}

.logo-main-icon {
  width: 52px;
  height: 52px;
  display: block;
  object-fit: contain;
}

.logo-main-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: #ffffff;
  line-height: 1.1;
}

.logo-main-title {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.logo-main-subtitle {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.86);
}
</style>
