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

/* 地图控件位置 - OpenLayers 默认控件 */
:deep(.ol-zoom) {
  position: absolute;
  left: 305px;
  top: 5px;
}

:deep(.ol-rotate) {
  position: absolute;
  right: 305px;
  top: 5px;
}

:deep(.ol-scale-line) {
  position: absolute;
  left: 305px;
  bottom: 5px;
  height: 20px;
  background: rgba(0,0,0,0.1);
}

:deep(.ol-full-screen) {
  position: absolute;
  right: 305px;
  top: 50px;
}

/* 鼠标位置坐标显示 */
:deep(.custom-mouse-position) {
  position: absolute;
  right: 305px;
  bottom: 5px;
  height: 20px;
  background: rgba(0,0,0,0.1);
  font-size: 12px;
  color: #333;
  padding: 0 10px;
  border-radius: 3px;
}
</style>