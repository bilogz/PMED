<script setup>
import { mdiCircleOutline } from '@mdi/js';
import NavItem from '../NavItem/NavItem.vue';

const props = defineProps({ item: Object, level: Number });

function resolveIcon(item) {
  if (typeof item?.icon === 'string' && item.icon.length > 0) return item.icon;
  return mdiCircleOutline;
}
</script>

<template>
  <!-- ---------------------------------------------- -->
  <!---Item Childern -->
  <!-- ---------------------------------------------- -->
  <v-list-group no-action>
    <!-- ---------------------------------------------- -->
    <!---Dropdown  -->
    <!-- ---------------------------------------------- -->
    <template v-slot:activator="{ props }">
      <v-list-item v-bind="props" :value="item.title" rounded class="mb-1" color="secondary">
        <!---Title  -->
        <v-list-item-title class="mr-auto">
          <div class="sidebar-item-label">
            <v-icon :icon="resolveIcon(item)" size="18" class="sidebar-item-icon" />
            <span>{{ item.title }}</span>
          </div>
        </v-list-item-title>
        <!---If Caption-->
        <v-list-item-subtitle v-if="item.subCaption" class="text-caption mt-n1 hide-menu">
          {{ item.subCaption }}
        </v-list-item-subtitle>
      </v-list-item>
    </template>
    <!-- ---------------------------------------------- -->
    <!---Sub Item-->
    <!-- ---------------------------------------------- -->
    <template v-for="(subitem, i) in item.children" :key="i">
      <NavCollapse :item="subitem" v-if="subitem.children" :level="props.level + 1" />
      <NavItem :item="subitem" :level="props.level + 1" v-else></NavItem>
    </template>
  </v-list-group>

  <!-- ---------------------------------------------- -->
  <!---End Item Sub Header -->
  <!-- ---------------------------------------------- -->
</template>

<style scoped>
.sidebar-item-label {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-item-icon {
  flex: 0 0 auto;
}
</style>
