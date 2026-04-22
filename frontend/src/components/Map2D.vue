<template>
  <div ref="mapContainer" class="map-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useMap2D } from '@/logics/useMap2D'

const props = defineProps({
  basemaps: {
    type: Array,
    required: true
  },
  activeBasemapId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:layers', 'ready'])

const mapContainer = ref(null)

// 二维逻辑
const {
  map,
  layers,
  initMap,
  switchBasemap,
  toggleRoadNet,
  getThumbColor,
  toggleLayer,
  onTypeChange,
  updateVectorLayer,
  setupPointModify,
  setupLandsModify,
  getPointModify,
  getLandsModify,
  clearHighlight,
  closePopup
} = useMap2D(mapContainer, props.basemaps)

// 暴露给父组件
defineExpose({
  map,
  layers,
  updateVectorLayer,
  getPointModify,
  getLandsModify,
  clearHighlight,
  closePopup,
  toggleLayer,
  onTypeChange,
  toggleRoadNet,
  getThumbColor
})

// 监听 basemapId 变化
watch(() => props.activeBasemapId, (newId) => {
  if (newId !== '3d' && map.value) {
    switchBasemap(newId)
  }
}, { immediate: true })

// 监听 layers 变化，通知父组件
watch(layers, (newLayers) => {
  emit('update:layers', newLayers)
}, { deep: true })

onMounted(() => {
  initMap()
  emit('ready', { map, layers })
})

onUnmounted(() => {
  if (map.value) {
    map.value.setTarget(null)
    map.value = null
  }
})
</script>

<style scoped>
.map-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>