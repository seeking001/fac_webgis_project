<template>
  <div class="map-wrapper">
    <!-- 二维地图 -->
    <Map2D
      v-show="activeBasemapId !== '3d'"
      ref="map2DRef"
      :basemaps="basemaps"
      :activeBasemapId="activeBasemapId"
      @ready="onMap2DReady"
    />
    
    <!-- 三维地图 -->
    <Map3D
      v-show="activeBasemapId === '3d'"
      ref="map3DRef"
      :tiandituApiKey="TIANDITU_API_KEY"
      :buildingColors="buildingColors"
      :defaultBuildingColor="defaultBuildingColor"
      :activeBasemapId="activeBasemapId"
      @ready="onMap3DReady"
    />

    <!-- 底图切换控件 -->
    <div class="basemap-switcher" @mouseenter="basemapPanelVisible = true" @mouseleave="basemapPanelVisible = false">
      <button class="basemap-main-btn">{{ getActiveBasemap.name }}</button>
      
      <transition name="slide-down">
        <div class="basemap-panel" v-if="basemapPanelVisible">
          <div
            class="basemap-item"
            v-for="item in basemaps"
            :key="item.id"
            :class="{ active: item.id === activeBasemapId }"
            @click="switchBasemap(item.id)"
          >
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
      v-if="map2DReady || cesiumReady"
      :map2DRef="map2DRef"
      :map3DRef="map3DRef"
      :activeBasemapId="activeBasemapId"
      :analysisButtonText="analysisButtonText"
      @flythrough="onFlythrough"
      @analysis="onAnalysis"
    />
  </div>
</template>

<script setup>
import { ref, computed, markRaw } from 'vue'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'
import Map2D from './Map2D.vue'
import Map3D from './Map3D.vue'
import FeaturePanel from './FeaturePanel.vue'

// 常量
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

// 响应式状态
const activeBasemapId = ref('vector')
const basemapPanelVisible = ref(false)

const map2DRef = ref(null)
const map3DRef = ref(null)
const map2DReady = ref(false)
const cesiumReady = ref(false)
const map2DInstance = ref(null)

// 计算属性
const getActiveBasemap = computed(() => basemaps.value.find(b => b.id === activeBasemapId.value))
const analysisButtonText = computed(() => map3DRef.value?.analysisButtonText || '漫游分析')

// 底图切换方法
function switchBasemap(id) {
  activeBasemapId.value = id
}

function toggleRoadNet(item) {
  item.roadNetLayer?.setVisible(item.roadNetVisible)
}

function getThumbColor(id) {
  return { vector: '#1CAF50', satellite: '#795548', '3d': '#2196F3' }[id] || '#ccc'
}

// 事件处理
function onMap2DReady({ map }) {
  map2DInstance.value = map
  map2DReady.value = true
}

function onMap3DReady() {
  cesiumReady.value = true
}

function onFlythrough() {
  map3DRef.value?.startFlythrough()
}

function onAnalysis() {
  map3DRef.value?.handleAnalysisClick()
}
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