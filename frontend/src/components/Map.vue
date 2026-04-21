<template>
  <div class="map-wrapper">
    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>
    <div ref="cesiumContainer" class="cesium-container" v-show="activeBasemapId === '3d'"></div>

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

    <!-- 左侧边栏 -->
    <div class="left_sidebar">
      <h3>图形操作</h3>
      <div class="layer-panel" v-for="(config, key) in layers" :key="key">
        <h4>{{ config.name }}</h4>
        <div class="control-group">
          <input type="checkbox" v-model="config.visible" @change="toggleLayer(key)">
          <span>加载显示</span>
          <select v-model="config.selectedType" @change="onTypeChange(key)" :disabled="!config.visible">
            <option v-for="type in config.types" :value="type.value">{{ type.label }}</option>
          </select>
        </div>
        <div class="control-group">
          <button @click="startDrawing(key)" :disabled="!config.visible">绘制</button>
          <button @click="handleImport(key)" :disabled="!config.visible">导入</button>
          <button @click="handleExport(key)" :disabled="!config.visible">导出</button>
        </div>
      </div>

      <!-- 三维展示操作框 -->
      <div class="layer-panel">
        <h4>三维展示</h4>
        <div class="control-group">
          <button @click="startFlythrough" class="fly-btn">漫游飞行</button>
          <button @click="handleAnalysisClick" class="fly-btn">{{ analysisButtonText }}</button>
        </div>
      </div>
    </div>

    <!-- 右侧边栏 -->
    <div class="right_sidebar">
      <h3>信息显示</h3>
      <!-- 供需分析面板 -->
      <div class="analysis-panel" style="display: none;">
        <h4>供需分析</h4>
        <div class="analysis-content">
          <p style="color: #aaa; text-align: center;">分析中...</p>
        </div>
      </div>

      <div class="status-info">
        <h4>加载状态</h4>
        <div v-for="(config, key) in layers">
          <span v-if="config.loaded">✅ {{ config.name }}: {{ key === 'points' ? pointsCount : landsCount }} 个</span>
          <span v-else>◻️ {{ config.name }}: 未加载</span>
        </div>
      </div>
      
      <div class="operation-hint" v-if="vectorStore.isDrawing || vectorStore.showPointForm || vectorStore.showLandsForm || vectorStore.selectedFeature">
        <h4>操作提示</h4>
        <div class="hint-content">
          <p v-if="vectorStore.isDrawing">
            🔹 按 <kbd>Backspace</kbd> 撤销上一个顶点<br>
            🔹 按 <kbd>Esc</kbd> 退出绘制
          </p>
          <p v-else>
            🔹 点击要素查看详情<br>
            🔹 点击"编辑图形"可拖动顶点修改<br>
            🔹 点击"删除设施/用地"可删除要素
          </p>
        </div>
      </div>
    </div>
    
    <!-- 要素弹窗 -->
    <div v-if="vectorStore.selectedFeature && vectorStore.popupPosition" 
          :style="{left: vectorStore.popupPosition.x + 'px', top: vectorStore.popupPosition.y + 'px'}" 
          class="feature-popup">
      <div class="popup-content">
        <button @click="vectorStore.closePopup" class="close-btn">x</button>
        <h4>{{ vectorStore.selectedFeature.name }}</h4>
        <div v-if="vectorStore.selectedFeature.layerType === 'points'">
          <p><strong>设施级别：</strong>{{ vectorStore.selectedFeature.level }}</p>
          <p><strong>设施类型：</strong>{{ vectorStore.selectedFeature.type }}</p>
          <p><strong>建筑面积：</strong>{{ vectorStore.selectedFeature.floor_area }}平方米</p>
          <p><strong>服务规模：</strong>{{ vectorStore.selectedFeature.scale }}人</p>
        </div>
        <div v-else>
          <p><strong>用地类型：</strong>{{ vectorStore.selectedFeature.type }}</p>
          <p><strong>用地面积：</strong>{{ vectorStore.selectedFeature.site_area }}平方米</p>
        </div>
        <div class="popup-buttons">
          <button @click="toggleEditMode(vectorStore.selectedFeature)" class="edit-btn" :class="{ 'active': vectorStore.isEditing }">
            {{ vectorStore.isEditing ? '编辑属性' : '编辑图形' }}
          </button>
          <button @click="exportSingleFeature(vectorStore.selectedFeature)" class="export-btn">导出数据</button>
          <button v-if="vectorStore.selectedFeature" @click="deleteFeature(vectorStore.selectedFeature.id)" class="delete-btn">
            删除{{ vectorStore.selectedFeature.layerType === 'points' ? '设施' : '用地' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 设施点表单 -->
    <div v-if="vectorStore.showPointForm" class="point-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ vectorStore.isEditing ? '编辑公共设施' : '添加公共设施' }}</h4>
        <form @submit.prevent="savePointToDatabase">
          <div class="form-group">
            <label>设施名称：</label>
            <input v-model="vectorStore.pointsForm.name" required placeholder="例如：玉龙学校">
          </div>
          <div class="form-group">
            <label>设施级别：</label>
            <select v-model="vectorStore.pointsForm.level" required>
              <option value="">请选择级别</option>
              <option value="区域级">区域级</option>
              <option value="社区级">社区级</option>
            </select>
          </div>
          <div class="form-group">
            <label>设施类型：</label>
            <select v-model="vectorStore.pointsForm.type" required>
              <option value="">请选择类型</option>
              <option value="行政办公场所">行政办公场所</option>
              <option value="社区管理机构">社区管理机构</option>
              <option value="大型文化设施">大型文化设施</option>
              <option value="大型体育设施">大型体育设施</option>
              <option value="社区文化设施">社区文化设施</option>
              <option value="社区体育设施">社区体育设施</option>
              <option value="医院">医院</option>
              <option value="门诊部">门诊部</option>
              <option value="社区健康服务中心">社区健康服务中心</option>
              <option value="幼儿园">幼儿园</option>
              <option value="小学">小学</option>
              <option value="初中">初中</option>
              <option value="九年一贯制学校">九年一贯制学校</option>
              <option value="高中">高中</option>
              <option value="高等教育">高等教育</option>
              <option value="职业教育">职业教育</option>
              <option value="养老院">养老院</option>
              <option value="儿童福利院">儿童福利院</option>
              <option value="残疾人服务中心">残疾人服务中心</option>
              <option value="社区老年人日间照料中心">社区老年人日间照料中心</option>
              <option value="社区托儿机构">社区托儿机构</option>
              <option value="社区救助站">社区救助站</option>
              <option value="其它设施">其它设施</option>
            </select>
          </div>
          <div class="form-group">
            <label>建筑面积（平方米）：</label>
            <input v-model="vectorStore.pointsForm.floor_area" type="number" required placeholder="手动输入">
          </div>
          <div class="form-group">
            <label>服务规模（人）：</label>
            <input v-model="vectorStore.pointsForm.scale" type="number" placeholder="手动输入">
          </div>
          <div class="form-buttons">
            <button type="button" @click="cancelDraw" class="btn-cancel">取消</button>
            <button type="submit" class="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 设施用地表单 -->
    <div v-if="vectorStore.showLandsForm" class="lands-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ vectorStore.isEditing ? '编辑土地利用' : '添加土地利用' }}</h4>
        <form @submit.prevent="saveLandsToDatabase">
          <div class="form-group">
            <label>设施名称：</label>
            <input v-model="vectorStore.landsForm.name" type="text" placeholder="例如：玉龙学校" required>
          </div>
          <div class="form-group">
            <label>用地类型：</label>
            <select v-model="vectorStore.landsForm.type" required>
              <option value="">请选择类型</option>
              <option value="商业用地">商业用地</option>
              <option value="居住用地">居住用地</option>
              <option value="工业用地">工业用地</option>
              <option value="公园绿地">公园绿地</option>
              <option value="行政管理用地">行政管理用地 (GIC1)</option>
              <option value="文体设施用地">文体设施用地 (GIC2)</option>
              <option value="医疗卫生用地">医疗卫生用地 (GIC4)</option>
              <option value="教育设施用地">教育设施用地 (GIC5)</option>
              <option value="社会福利用地">社会福利用地 (GIC7)</option>
            </select>
          </div>
          <div class="form-group">
            <label>用地面积（平方米）：</label>
            <div style="display: flex; gap: 8px;">
              <input v-model="vectorStore.landsForm.site_area" type="number" placeholder="手动输入" style="flex: 1;">
              <button type="button" @click="calcArea" class="calc-btn">自动计算</button>
            </div>
          </div>
          <div class="form-buttons">
            <button type="button" @click="cancelDraw" class="btn-cancel">取消</button>
            <button type="submit" class="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
// Vue 核心
import { onMounted, onUnmounted, ref, computed, markRaw } from 'vue'

// OpenLayers 核心
import 'ol/ol.css'

// OpenLayers 图层与数据源
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ'

// 内部模块
import { useMap2D } from '@/logics/useMap2D'
import { useMap3D } from '@/logics/useMap3D'
import { useFeature } from '@/logics/useFeature'
import { useVectorStore } from '@/stores/vectorStore'

// ==================== 常量定义 ====================
const TIANDITU_API_KEY = import.meta.env.VITE_TIANDITU_API_KEY

// 建筑类型颜色样式
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
const mapContainer = ref(null)
const cesiumContainer = ref(null)
const activeBasemapId = ref('vector')
const basemapPanelVisible = ref(false)

const vectorStore = useVectorStore()
let escHandler = null

// ==================== 计算属性 ====================
const pointsCount = computed(() => vectorStore.points.length)
const landsCount = computed(() => vectorStore.lands.length)
const getActiveBasemap = computed(() => basemaps.value.find(b => b.id === activeBasemapId.value))

// 1、二维逻辑
const {
  map,
  layers,
  initMap: initMap2D,
  updateVectorLayer,
  getPointModify,
  getLandsModify,
  clearHighlight,
  switchBasemap: switchBasemap2D,
  toggleRoadNet,
  getThumbColor,
  toggleLayer,
  onTypeChange,
} = useMap2D(mapContainer, basemaps)

// 2、调用useFeature逻辑
const {
  startDrawing,
  cancelDraw,
  toggleEditMode,
  exitEditMode,
  savePointToDatabase,
  saveLandsToDatabase,
  deleteFeature,
  handleImport,
  handleExport,
  exportSingleFeature,
  calcArea,
} = useFeature(map, layers, updateVectorLayer, getPointModify, getLandsModify, clearHighlight)

// 3、三维逻辑
const {
  viewer,
  cesiumInitialized,
  loadCesium,
  startFlythrough,
  handleAnalysisClick,
  loadPointsAndLands,
  analysisButtonText,
} = useMap3D(cesiumContainer, TIANDITU_API_KEY, buildingColors, defaultBuildingColor, layers, activeBasemapId)

// 初始化地图
function initMap() {
  initMap2D()
}

// 底图切换
const switchBasemap = async (id) => {
  if (id === '3d') {
    if (map.value) {
      map.value.getTargetElement().style.display = 'none'
    }
    if (cesiumContainer.value) {
      cesiumContainer.value.style.display = 'block'
    }
    if (!cesiumInitialized.value) {
      await loadCesium()
    } else {
      setTimeout(() => {
        if (viewer.value) viewer.value.resize()
        loadPointsAndLands()
      }, 50)
    }
  } else {
    switchBasemap2D(id)
    if (map.value?.getTargetElement()) {
      map.value.getTargetElement().style.display = 'block'
    }
    if (cesiumContainer.value) {
      cesiumContainer.value.style.display = 'none'
    }
  }
  activeBasemapId.value = id
}

// ==================== 生命周期 ====================
onMounted(() => {
  if (!mapContainer.value) return
  initMap()
  if (cesiumContainer.value) cesiumContainer.value.style.display = 'none'
  
  escHandler = (e) => {
    if (e.key !== 'Escape') return
    if (vectorStore.showPointForm || vectorStore.showLandsForm) {
      cancelDraw()
    } else if (vectorStore.isEditing) {
      exitEditMode()
      vectorStore.closePopup()
    }
  }
  document.addEventListener('keydown', escHandler)
})

onUnmounted(() => {
  if (escHandler) document.removeEventListener('keydown', escHandler)
  if (map.value) {
    map.value.setTarget(null)
    map.value = null
  }
  if (viewer.value) {
    viewer.value.destroy()
    viewer.value = null
  }
})
</script>

<style>
.map-wrapper {
  position: relative;
  height: 100vh;
}

.map-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

.cesium-container {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
}

/* 地图控件样式 */
.ol-zoom {
  position: absolute;
  left: 305px;
  top: 5px;
}

.ol-scale-line {
  position: absolute;
  left: 305px;
  bottom: 5px;
  height: 20px;
  background: rgba(0,0,0,0.1);
}

.ol-full-screen {
  position: absolute;
  right: 305px;
  top: 5px;
}

.custom-mouse-position {
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

/* 三维弹窗样式 */
.cesium-popup {
  position: absolute;
  background: rgba(30, 0, 60, 0.5);
  padding: 10px 30px 10px 15px;
  border-radius: 8px;
  color: #eee;
  z-index: 1000;
  font-size: 14px;
  min-width: 200px;
  max-width: 300px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  pointer-events: auto;
}

.cesium-popup h4 {
  margin: 0 0 8px 0;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  color: #ffd700;
  font-size: 16px;
}

.cesium-popup p {
  margin: 5px 0;
  font-size: 13px;
  line-height: 1.4;
}

.cesium-popup strong {
  color: #ffd700;
}

.cesium-popup-close {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 22px;
  height: 22px;
  background: rgba(50, 0, 100, 0.8);
  border-radius: 50%;
  border: none;
  color: #eee;
  font-size: 18px;
  line-height: 1;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.cesium-popup-close:hover {
  background: rgb(50, 0, 100);
  color: #ffd700;
}

/* 左侧栏样式 */
.left_sidebar {
  position: absolute;
  left: 0;
  width: 300px;
  height: 100%;
  background-color: rgba(30, 0, 100, 0.5);
}

.left_sidebar h3 {
  line-height: 45px;
  text-align: center;
  padding: 0 20px;
  font-size: 20px;
  color: #eee;
}

.layer-panel {
  margin: 5px 10px;
  padding: 5px;
  background: rgba(0, 0, 30, 0.4);
  border-radius: 8px;
}
.layer-panel h4 {
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: #b3c6ff;
  font-size: 16px;
  text-align: center;
}
.control-group {
  display: flex;
  margin: 10px 0;
  gap: 5px;
  align-items: center;
  font-size: 14px;
  color: #eee;
}
.control-group select {
  padding: 3px 5px;
  width: 190px;
  font-size: 14px;
  border-radius: 5px;
  border: none;
}
.control-group button {
  padding: 3px 5px;
  font-size: 14px;
  border-radius: 5px;
  background: #309eff;
  color: #eee;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.control-group button:hover:not(:disabled) {
  background: #66ccff;
}
.control-group button:disabled,
.control-group select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 右侧边栏样式 */
.right_sidebar {
  position: absolute;
  right: 0;
  width: 300px;
  height: 100%;
  background-color: rgba(30, 0, 100, 0.5);
}

.right_sidebar h3 {
  line-height: 45px;
  text-align: center;
  padding: 0 20px;
  font-size: 20px;
  color: #eee;
}

.status-info {
  position: absolute;
  bottom: 0;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.4);
}

.status-info h4 {
  padding: 3px 5px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 16px;
  color: #ccc;
}

.status-info div {
  padding: 3px;
  font-size: 14px;
  color: #52c41a;
}

/* 操作提示样式 */
.operation-hint {
  position: absolute;
  bottom: 88px;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.4);
}

.operation-hint h4 {
  padding: 3px 5px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 16px;
  color: #ccc;
  margin: 0;
}

.hint-content {
  padding: 3px;
  font-size: 14px;
  line-height: 1.8;
  color: #52c41a;
}

.hint-content kbd {
  padding: 3px;
  font-size: 14px;
  color: #e8ff66;
}

/* 供需分析样式 */
.analysis-panel {
  margin: 10px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px;
  margin-bottom: 10px;
}

.analysis-panel h4 {
  padding-bottom: 5px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-size: 16px;
  color: #b3c6ff;
}

.analysis-content {
  font-size: 14px;
  color: #eee;
  line-height: 1.5;
  padding: 5px;
}

.analysis-content .school-name {
  font-size: 16px;
  font-weight: 600;
  color: #390;
  text-align: center;
  margin-bottom: 10px;
}

.analysis-content p {
  margin: 5px 0;
}

/* 要素弹窗样式 */
.feature-popup {
  position: absolute;
  background: rgba(30, 0, 60, 0.5);
  padding: 5px 30px 5px 5px;
  border-radius: 5px;
}

.popup-content{
  position: relative;
  padding: 0 5px;
}

.close-btn {
  position: absolute;
  top: 3px;
  right: -23px;
  width: 18px;
  height: 18px;
  background-color: rgba(50, 0, 100, 0.5);
  border-radius: 50%;
  border: none;
  line-height: 1;
  text-align: center;
  font-size: 14px;
  color: #eee;
}

.close-btn:hover {
  background: rgb(50, 0, 100);
}

.popup-content h4 {
  margin-bottom: 5px;
  padding-bottom: 2px;
  border-bottom: 1px solid #aaa;
  font-size: 16px;
  color: #eee;
}

.popup-content p {
  font-size: 14px;
  color: #eee;
}

.popup-buttons {
  display: flex;
  gap: 5px;
  margin-bottom: 10px;
}

.edit-btn {
  margin-top: 5px;
  padding: 2px 6px;
  background: rgba(50, 0, 100, 0.5);
  font-size: 12px;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.edit-btn:hover {
  background: rgba(50, 0, 100, 1);
}

.edit-btn.active {
  background: rgba(150, 0, 100, 0.8);
}

.export-btn {
  margin-top: 5px;
  padding: 2px 6px;
  background: rgba(50, 0, 100, 0.5);
  font-size: 12px;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
.export-btn:hover {
  background: rgb(50, 0, 100);
}

.delete-btn {
  margin-top: 5px;
  padding: 2px 6px;
  background: rgba(50, 0, 100, 0.5);
  font-size: 12px;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.delete-btn:hover {
  background: rgb(50, 0, 100);
}

/* 表单弹窗样式 */
.point-form,
.lands-form {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.form-overlay {
  position: absolute;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
}

.form-content {
  position: relative;
  background: white;
  padding: 20px;
  border-radius: 5px;
  width: 300px;
  z-index: 1001;
}

.form-content h4 {
  margin: 0 0 15px 0;
  text-align: center;
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #666;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
}

/* 自动计算样式 */
.calc-btn {
  padding: 8px 12px;
  background: #67c23a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.calc-btn:hover {
  background: #5daf34;
}

.area-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #67c23a;
}

.form-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.btn-cancel,
.btn-save {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.btn-cancel {
  background: #f0f0f0;
  color: #666;
}

.btn-save {
  background: #409eff;
  color: white;
}
</style>