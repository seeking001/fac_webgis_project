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
  activeBasemapId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['ready'])

const cesiumContainer = ref(null)

// 三维地图内部管理的图层状态
const layers = ref({
  points: {
    name: '设施点',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: '全部类型',
    types: [
      { label: '全部类型', value: '全部类型' },
      { label: '行政办公场所', value: '行政办公场所' },
      { label: '社区管理机构', value: '社区管理机构' },
      { label: '大型文化设施', value: '大型文化设施' },
      { label: '大型体育设施', value: '大型体育设施' },
      { label: '社区文化设施', value: '社区文化设施' },
      { label: '社区体育设施', value: '社区体育设施' },
      { label: '医院', value: '医院' },
      { label: '门诊部', value: '门诊部' },
      { label: '社区健康服务中心', value: '社区健康服务中心' },
      { label: '幼儿园', value: '幼儿园' },
      { label: '小学', value: '小学' },
      { label: '初中', value: '初中' },
      { label: '九年一贯制学校', value: '九年一贯制学校' },
      { label: '高中', value: '高中' },
      { label: '高等教育', value: '高等教育' },
      { label: '职业教育', value: '职业教育' },
      { label: '养老院', value: '养老院' },
      { label: '儿童福利院', value: '儿童福利院' },
      { label: '残疾人服务中心', value: '残疾人服务中心' },
      { label: '社区老年人日间照料中心', value: '社区老年人日间照料中心' },
      { label: '社区托儿机构', value: '社区托儿机构' },
      { label: '社区救助站', value: '社区救助站' },
      { label: '其它设施', value: '其它设施' }
    ]
  },
  lands: {
    name: '设施用地',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: '全部类型',
    types: [
      { label: '全部类型', value: '全部类型' },
      { label: '商业用地', value: '商业用地' },
      { label: '居住用地', value: '居住用地' },
      { label: '工业用地', value: '工业用地' },
      { label: '公园绿地', value: '公园绿地' },
      { label: '行政管理用地', value: '行政管理用地' },
      { label: '文体设施用地', value: '文体设施用地' },
      { label: '医疗卫生用地', value: '医疗卫生用地' },
      { label: '教育设施用地', value: '教育设施用地' },
      { label: '社会福利用地', value: '社会福利用地' }
    ]
  }
})

// 三维逻辑
const {
  viewer,
  cesiumInitialized,
  loadCesium,
  toggleLayer,
  onTypeChange,
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
  layers,
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
  analysisButtonText,
  layers,
  toggleLayer,
  onTypeChange
})

// 当激活底图变为三维时，加载 Cesium
watch(() => props.activeBasemapId, async (newId) => {
  if (newId === '3d') {
    if (!cesiumInitialized.value) {
      await loadCesium()
    }
    
    if (cesiumInitialized.value) {
      loadPointsAndLands(layers.value)  // 传递最新的layers
    }
  }
})

// 新增：监听 layers 变化
watch(
  () => [
    layers.value.points.visible,
    layers.value.points.selectedType,
    layers.value.lands.visible,
    layers.value.lands.selectedType
  ],
  () => {
    if (props.activeBasemapId === '3d' && cesiumInitialized.value) {
      loadPointsAndLands(layers.value);  // 传递最新的layers
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