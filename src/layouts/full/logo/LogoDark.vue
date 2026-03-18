<template>
  <div class="logo">
    <RouterLink to="/dashboard/default" class="logo-link">
      <img :src="bcpClinicLogo" alt="BCP Clinic" class="logo-image" />
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import bcpClinicLogo from '@/assets/images/logos/bcp-olp-logo-mini2.png';
</script>

<style scoped>
.logo-link {
  display: inline-flex;
  max-width: 100%;
}

.logo-image {
  width: 168px;
  max-width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}
</style>
