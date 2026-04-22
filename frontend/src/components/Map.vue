<template>
  <div class="map-wrapper">
    <!-- 二维地图 -->
    <Map2D
      ref="map2DRef"
      :basemaps="basemaps"
      :activeBasemapId="activeBasemapId"
      @update:layers="handleLayersUpdate"
      @ready="onMap2DReady"
    />
    
    <!-- 三维地图 -->
    <Map3D
      ref="map3DRef"
      :tiandituApiKey="TIANDITU_API_KEY"
      :buildingColors="buildingColors"
      :defaultBuildingColor="defaultBuildingColor"
      :layers="layers"
      :activeBasemapId="activeBasemapId"
      @ready="onMap3DReady"
    />

    <!-- 底图切换控件 -->
    <div class="basemap-switcher" @mouseenter="basemapPanelVisible = true" @mouseleave="basemapPanelVisible = false">
      <button class="basemap-main-btn">{{ getActiveBasemap.name }}</button>
      
      <transition name="slide-down">
        <div class="basemap-panel" v-if="basemapPanelVisible">
          <div class="basemap-item" v-for="item in basemaps" :key="item.id" 
                :class="{ 'active': item.id === activeBasemapId }" 
                @click="switchBasemap(item.id)">
            <div class="thumbnail" :style="{ backgroundColor: getThumbColor(item.id) }">
              {{ item.name }}
            </div>
            <div class="basemap-info">
              <div class="basemap-name">{{ item.name }}</div>
              <label class="roadnet-toggle" v-if="item.hasRoadNet">
                <input type="checkbox" v-model="item.roadNetVisible" @click.stop @change="toggleRoadNet(item)">
                <span>标注/路网</span>
              </label>
            </div>
          </div>
        </div>
      </transition>
    </div>

    <!-- 功能面板 -->
    <FeaturePanel
      v-if="map2DReady"
      :map="map2DInstance"
      :layers="layers"
      :updateVectorLayer="updateVectorLayer"
      :getPointModify="getPointModify"
      :getLandsModify="getLandsModify"
      :clearHighlight="clearHighlight"
      :analysisButtonText="analysisButtonText"
      @flythrough="onFlythrough"
      @analysis="onAnalysis"
      @toggleLayer="onToggleLayer"
      @typeChange="onTypeChange"
    />
  </div>
</template>

<script setup>
import { ref, computed, markRaw } from 'vue'
import { onMounted, onUnmounted } from 'vue'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import Map2D from './Map2D.vue'
import Map3D from './Map3D.vue'
import FeaturePanel from './FeaturePanel.vue'
import { useVectorStore } from '@/stores/vectorStore'

// ==================== 常量定义 ====================
const TIANDITU_API_KEY = import.meta.env.VITE_TIANDITU_API_KEY

const buildingColors = {
  '商业': 'rgba(255, 0, 0, 0.8)',
  '居住': 'rgba(255, 255, 45, 0.8)',
  '工业': 'rgba(187, 150, 116, 0.8)',
  '配套': 'rgba(254, 24, 201, 0.8)',
}
const defaultBuildingColor = 'rgba(200, 200, 200, 0.7)'

// 底图配置
const basemaps = ref([
  {
    id: 'vector', name: '普通地图',
    layer: markRaw(new TileLayer({
      source: new XYZ({ url: `http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`, wrapX: false, crossOrigin: 'anonymous' }),
      zIndex: 0
    })),
    hasRoadNet: true, roadNetVisible: false,
    roadNetLayer: markRaw(new TileLayer({
      source: new XYZ({ url: `http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`, wrapX: false, crossOrigin: 'anonymous' }),
      visible: false, zIndex: 1
    }))
  },
  {
    id: 'satellite', name: '卫星地图',
    layer: markRaw(new TileLayer({
      source: new XYZ({ url: `http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`, wrapX: false, crossOrigin: 'anonymous' }),
      zIndex: 0
    })),
    hasRoadNet: true, roadNetVisible: false,
    roadNetLayer: markRaw(new TileLayer({
      source: new XYZ({ url: `http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`, wrapX: false, crossOrigin: 'anonymous' }),
      visible: false, zIndex: 1
    }))
  },
  { id: '3d', name: '三维地图', layer: null, hasRoadNet: false, roadNetVisible: false, roadNetLayer: null }
])

// ==================== 响应式状态 ====================
const activeBasemapId = ref('vector')
const basemapPanelVisible = ref(false)

const map2DRef = ref(null)
const map3DRef = ref(null)
const map2DReady = ref(false)
const map2DInstance = ref(null)
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

// 二维地图暴露的方法
let updateVectorLayer = () => {}
let getPointModify = () => null
let getLandsModify = () => null
let clearHighlight = () => {}
let toggleRoadNet = () => {}
let getThumbColor = () => '#ccc'

const vectorStore = useVectorStore()
let escHandler = null

// ==================== 计算属性 ====================
const getActiveBasemap = computed(() => basemaps.value.find(b => b.id === activeBasemapId.value))
const analysisButtonText = computed(() => map3DRef.value?.analysisButtonText || '漫游分析')

// ==================== 事件处理 ====================
function handleLayersUpdate(newLayers) {
  layers.value = newLayers
}

function onMap2DReady({ map, layers: mapLayers }) {
  map2DInstance.value = map
  layers.value = mapLayers.value
  map2DReady.value = true
  
  // 获取暴露的方法
  if (map2DRef.value) {
    updateVectorLayer = map2DRef.value.updateVectorLayer
    getPointModify = map2DRef.value.getPointModify
    getLandsModify = map2DRef.value.getLandsModify
    clearHighlight = map2DRef.value.clearHighlight
    toggleRoadNet = map2DRef.value.toggleRoadNet
    getThumbColor = map2DRef.value.getThumbColor
  }
}

function onMap3DReady() {
  // 三维地图就绪
}

function switchBasemap(id) {
  activeBasemapId.value = id
  
  // 控制容器显示
  const map2DEl = document.querySelector('.map-container')
  const map3DEl = document.querySelector('.cesium-container')
  
  if (id === '3d') {
    if (map2DEl) map2DEl.style.display = 'none'
    if (map3DEl) map3DEl.style.display = 'block'
  } else {
    if (map2DEl) map2DEl.style.display = 'block'
    if (map3DEl) map3DEl.style.display = 'none'
  }
}

function onFlythrough() {
  map3DRef.value?.startFlythrough()
}

function onAnalysis() {
  map3DRef.value?.handleAnalysisClick()
}

function onToggleLayer(key) {
  map2DRef.value?.toggleLayer(key)
}

function onTypeChange(key) {
  map2DRef.value?.onTypeChange(key)
}

// ==================== 生命周期 ====================
onMounted(() => {
  escHandler = (e) => {
    if (e.key !== 'Escape') return
    // 通过 vectorStore 访问状态
    if (vectorStore.showPointForm || vectorStore.showLandsForm) {
      // cancelDraw 在 FeaturePanel 内部，通过事件触发
    }
  }
  document.addEventListener('keydown', escHandler)
})

onUnmounted(() => {
  if (escHandler) document.removeEventListener('keydown', escHandler)
})
</script>

<style scoped>
.map-wrapper {
  position: relative;
  height: 100vh;
}

/* 底图切换样式 */
.basemap-switcher {
  position: absolute;
  top: 60px;
  left: 305px;
  z-index: 3;
}

.basemap-main-btn {
  padding: 3px 5px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  color: #eee;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}

.basemap-main-btn:hover {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
  color: #333;
}

.basemap-panel {
  position: absolute;
  display: flex;
  padding: 5px;
  margin-top: 5px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  min-width: 170px;
  flex-direction: column;
  gap: 5px;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.6s ease;
  opacity: 1;
  transform: translateY(0);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.basemap-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  color: #eee;
  cursor: pointer;
  transition: background 0.2s;
}

.basemap-item:hover {
  background: rgba(255, 255, 255, 0.8);
  color: #333;
}

.basemap-item.active {
  background: rgba(255, 255, 255, 0.8);
  color: #333;
  border: 1px solid #2196F3;
}

.thumbnail {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.basemap-info {
  flex: 1;
}

.basemap-name {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}

.roadnet-toggle {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #999;
  cursor: pointer;
}

.roadnet-toggle input {
  margin-right: 4px;
}
</style>