<template>
  <div ref="cesiumContainer" class="cesium-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useMap3D } from '@/logics/useMap3D'

const props = defineProps({
  tiandituApiKey: {
    type: String,
    required: true
  },
  buildingColors: {
    type: Object,
    required: true
  },
  defaultBuildingColor: {
    type: String,
    required: true
  },
  layers: {
    type: Object,
    required: true
  },
  activeBasemapId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['ready'])

const cesiumContainer = ref(null)

// 三维逻辑
const {
  viewer,
  cesiumInitialized,
  loadCesium,
  startFlythrough,
  handleAnalysisClick,
  loadPointsAndLands,
  closeCesiumPopup,
  analysisButtonText
} = useMap3D(
  cesiumContainer,
  props.tiandituApiKey,
  props.buildingColors,
  props.defaultBuildingColor,
  props.layers,
  props.activeBasemapId
)

// 暴露给父组件
defineExpose({
  viewer,
  cesiumInitialized,
  loadCesium,
  startFlythrough,
  handleAnalysisClick,
  loadPointsAndLands,
  closeCesiumPopup,
  analysisButtonText
})

// 当激活底图变为三维时，加载 Cesium
watch(() => props.activeBasemapId, async (newId) => {
  if (newId === '3d') {
    if (!cesiumInitialized.value) {
      await loadCesium()
    }
    
    // 重新加载图层
    if (cesiumInitialized.value) {
      loadPointsAndLands()
    }
  }
})

onMounted(() => {
  emit('ready', { viewer, cesiumInitialized })
})

onUnmounted(() => {
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style scoped>
.cesium-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}
</style>