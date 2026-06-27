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

const expandedKeys = ref<Set<string>>(new Set())
const activeKeySignature = computed(() => Array.from(props.activeKeys).sort().join('|'))

watch(activeKeySignature, () => {
  // 当前页面所在路径保持展开，其他目录默认收起，支持任意层级菜单。
  expandedKeys.value = new Set(props.activeKeys)
}, { immediate: true })

function hasChildren(item: PortalMenuItem) {
  return item.children.length > 0
}

function isExpanded(item: PortalMenuItem) {
  return expandedKeys.value.has(item.key)
}

function toggleDirectory(item: PortalMenuItem) {
  const nextKeys = new Set(expandedKeys.value)
  if (nextKeys.has(item.key)) {
    nextKeys.delete(item.key)
  } else {
    nextKeys.add(item.key)
  }
  expandedKeys.value = nextKeys
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
