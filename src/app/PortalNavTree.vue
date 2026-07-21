<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { MainPage, PortalMenuItem } from './navigation'

const props = defineProps<{
  items: PortalMenuItem[]
  activePage: MainPage
  activeKeys: Set<string>
}>()

const emit = defineEmits<{
  open: [item: PortalMenuItem]
}>()

const expandedKeys = ref<string[]>([])
const activeKeySignature = computed(() => Array.from(props.activeKeys).sort().join('|'))

watch(activeKeySignature, () => {
  // 当前页面所在路径自动展开，同时保留用户手动展开的其他目录。
  expandedKeys.value = Array.from(new Set([...expandedKeys.value, ...props.activeKeys]))
}, { immediate: true })

function hasChildren(item: PortalMenuItem) {
  return item.children.length > 0
}

function isExpanded(item: PortalMenuItem) {
  return expandedKeys.value.includes(item.key)
}

function toggleDirectory(item: PortalMenuItem) {
  expandedKeys.value = isExpanded(item)
    ? expandedKeys.value.filter((key) => key !== item.key)
    : [...expandedKeys.value, item.key]
}

function handleItemClick(item: PortalMenuItem) {
  if (hasChildren(item)) {
    toggleDirectory(item)
    return
  }
  if (item.pageKey) emit('open', item)
}
</script>

<template>
  <div class="portal-nav-tree">
    <template v-for="item in items" :key="item.key">
      <button
        class="portal-nav-item"
        :class="{
          active: activeKeys.has(item.key),
          directory: hasChildren(item),
          expanded: isExpanded(item),
        }"
        type="button"
        :disabled="!item.pageKey && !hasChildren(item)"
        @click="handleItemClick(item)"
      >
        <span><component :is="item.icon" :size="16" /></span>
        <strong>{{ item.label }}</strong>
        <em>{{ item.subLabel }}</em>
        <ChevronRight v-if="hasChildren(item)" class="portal-nav-chevron" :size="15" />
      </button>

      <div v-if="hasChildren(item) && isExpanded(item)" class="portal-subnav">
        <PortalNavTree
          :items="item.children"
          :active-page="activePage"
          :active-keys="activeKeys"
          @open="emit('open', $event)"
        />
      </div>
    </template>
  </div>
</template>
