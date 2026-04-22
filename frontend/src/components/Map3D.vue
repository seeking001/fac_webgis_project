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
    
    if (cesiumInitialized.value) {
      loadPointsAndLands(props.layers)  // 传递最新的layers
    }
  }
})

// 新增：监听 layers 变化
watch(
  () => [
    props.layers.points.visible,
    props.layers.points.selectedType,
    props.layers.lands.visible,
    props.layers.lands.selectedType
  ],
  () => {
    if (props.activeBasemapId === '3d' && cesiumInitialized.value) {
      loadPointsAndLands(props.layers);  // 传递最新的layers
    }
  }
)

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

<style>
.cesium-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.cesium-popup-3d {
  position: absolute;
  background: rgba(30, 0, 60, 0.8);
  color: #eee;
  padding: 8px 32px 8px 12px;
  border-radius: 6px;
  z-index: 1000;
  pointer-events: auto;
  max-width: 300px;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(2px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.cesium-popup-3d h4 {
  margin: 0 0 6px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 16px;
  color: #fff;
}

.cesium-popup-3d p {
  margin: 4px 0;
  line-height: 1.4;
}

.cesium-popup-close-3d {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  background: rgba(80, 0, 120, 0.8);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.cesium-popup-close-3d:hover {
  background: rgba(120, 0, 180, 1);
}

.popup-content-wrapper-3d {
  /* 可留空，或添加内边距等 */
}
</style>