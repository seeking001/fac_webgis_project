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
    </div>

    <!-- 右侧边栏 -->
    <div class="right_sidebar">
      <h3>信息显示</h3>
      <div class="status-info">
        <h4>加载状态</h4>
        <div v-for="(config, key) in layers">
          <span v-if="config.loaded">✅ {{ config.name }}: {{ key === 'points' ? pointsCount : landsCount }} 个</span>
          <span v-else>◻️ {{ config.name }}: 未加载</span>
        </div>
      </div>
      
      <div class="operation-hint" v-if="isDrawing || showPointForm || showLandsForm || selectedFeature">
        <h4>操作提示</h4>
        <div class="hint-content">
          <p v-if="isDrawing">
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
    <div v-if="selectedFeature && popupPosition" 
          :style="{left: popupPosition.x + 'px', top: popupPosition.y + 'px'}" 
          class="feature-popup">
      <div class="popup-content">
        <button @click="closePopup" class="close-btn">x</button>
        <h4>{{ selectedFeature.name }}</h4>
        <div v-if="selectedFeature.layerType === 'points'">
          <p><strong>设施级别：</strong>{{ selectedFeature.level }}</p>
          <p><strong>设施类型：</strong>{{ selectedFeature.type }}</p>
          <p><strong>建筑面积：</strong>{{ selectedFeature.floor_area }}平方米</p>
          <p><strong>服务规模：</strong>{{ selectedFeature.scale }}座/床</p>
        </div>
        <div v-else>
          <p><strong>用地类型：</strong>{{ selectedFeature.type }}</p>
          <p><strong>用地面积：</strong>{{ selectedFeature.site_area }}平方米</p>
        </div>
        <div class="popup-buttons">
          <button @click="toggleEditMode(selectedFeature)" class="edit-btn" :class="{ 'active': isEditing }">
            {{ isEditing ? '编辑属性' : '编辑图形' }}
          </button>
          <button @click="exportSingleFeature(selectedFeature)" class="export-btn">导出数据</button>
          <button v-if="selectedFeature" @click="deleteFeature(selectedFeature.id)" class="delete-btn">
            删除{{ selectedFeature.layerType === 'points' ? '设施' : '用地' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 设施点表单 -->
    <div v-if="showPointForm" class="point-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ isEditing ? '编辑公共设施' : '添加公共设施' }}</h4>
        <form @submit.prevent="savePointToDatabase">
          <div class="form-group">
            <label>设施名称：</label>
            <input v-model="pointsForm.name" required placeholder="例如：玉龙学校">
          </div>
          <div class="form-group">
            <label>设施级别：</label>
            <select v-model="pointsForm.level" required>
              <option value="">请选择级别</option>
              <option value="区域级">区域级</option>
              <option value="社区级">社区级</option>
            </select>
          </div>
          <div class="form-group">
            <label>设施类型：</label>
            <select v-model="pointsForm.type" required>
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
            <input v-model="pointsForm.floor_area" type="number" required placeholder="手动输入">
          </div>
          <div class="form-group">
            <label>服务规模（座/床）：</label>
            <input v-model="pointsForm.scale" type="number" placeholder="手动输入">
          </div>
          <div class="form-buttons">
            <button type="button" @click="cancelDraw" class="btn-cancel">取消</button>
            <button type="submit" class="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 设施用地表单 -->
    <div v-if="showLandsForm" class="lands-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ isEditing ? '编辑土地利用' : '添加土地利用' }}</h4>
        <form @submit.prevent="saveLandsToDatabase">
          <div class="form-group">
            <label>设施名称：</label>
            <input v-model="landsForm.name" type="text" placeholder="例如：玉龙学校" required>
          </div>
          <div class="form-group">
            <label>用地类型：</label>
            <select v-model="landsForm.type" required>
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
              <input v-model="landsForm.site_area" type="number" placeholder="手动输入" style="flex: 1;">
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
import { onMounted, onUnmounted, ref, computed, markRaw, watch } from 'vue'

// OpenLayers 核心
import { Map, View } from 'ol'
import 'ol/ol.css'

// OpenLayers 图层与数据源
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'

// OpenLayers 要素与几何
import Feature from 'ol/Feature'
import { Point, Polygon } from 'ol/geom'

// OpenLayers 样式
import { Style, Fill, Stroke, Text, Circle } from 'ol/style'

// OpenLayers 交互与控件
import { FullScreen, ScaleLine, MousePosition, defaults } from "ol/control"
import { createStringXY } from "ol/coordinate"
import { Draw, Modify } from 'ol/interaction'

// 工具库
import { fromLonLat, toLonLat } from 'ol/proj'
import proj4 from 'proj4'

// 内部模块
import { useVectorStore } from '../stores/vectorStore'
import { createPoints, updatePoints, deletePoints, createLands, updateLands, deleteLands } from '../services/api'

// ==================== 常量定义 ====================
proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

const TIANDITU_API_KEY = import.meta.env.VITE_TIANDITU_API_KEY

// 设施点图标样式
const POINT_STYLES = {
  行政办公场所: '🏛️',
  社区管理机构: '🏢',
  大型文化设施: '🏫',
  大型体育设施: '🏟️',
  社区文化设施: '🎨',
  社区体育设施: '🏀',
  医院: '🏥',
  门诊部: '💊',
  社区健康服务中心: '❤️',
  幼儿园: '🌈',
  小学: '✏️',
  初中: '📙',
  九年一贯制学校: '📘',
  高中: '📚',
  高等教育: '🎓',
  职业教育: '💻',
  养老院: '🏠',
  儿童福利院: '🛝',
  残疾人服务中心: '♿',
  社区老年人日间照料中心: '🍵',
  社区托儿机构: '🍼',
  社区救助站: '🤝',
  其它设施: '📍'
}

// 设施用地颜色样式
const LAND_STYLES = {
  '居住用地': 'rgba(255, 255, 45, 0.6)',
  '商业用地': 'rgba(255, 0, 0, 0.6)',
  '工业用地': 'rgba(187, 150, 116, 0.6)',
  '公园绿地': 'rgba(0, 255, 0, 0.6)',
  '行政管理用地': 'rgba(254, 24, 201, 0.6)',
  '文体设施用地': 'rgba(254, 24, 201, 0.6)',
  '医疗卫生用地': 'rgba(254, 24, 201, 0.6)',
  '教育设施用地': 'rgba(254, 24, 201, 0.6)',
  '社会福利用地': 'rgba(254, 24, 201, 0.6)'
}

// 建筑类型颜色样式
const buildingColors = {
  '配套': 'rgba(254, 24, 201, 0.6)',     // GIC用地色
  '商业': 'rgba(255, 0, 0, 0.6)',        // 商业用地色
  '住宅': 'rgba(255, 255, 45, 0.6)',     // 居住用地色
  '工业': 'rgba(187, 150, 116, 0.6)',    // 工业用地色
};
const defaultBuildingColor = 'rgba(200, 200, 200, 0.7)';

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

// 矢量图层配置
const layers = ref({
  points: {
    name: '设施点', visible: false, loaded: false, layer: null, selectedType: '全部类型',
    types: [
      { label: '全部类型', value: '全部类型' },
      { label: '行政办公场所', value: '行政办公场所' }, { label: '社区管理机构', value: '社区管理机构' },
      { label: '大型文化设施', value: '大型文化设施' }, { label: '大型体育设施', value: '大型体育设施' },
      { label: '社区文化设施', value: '社区文化设施' }, { label: '社区体育设施', value: '社区体育设施' },
      { label: '医院', value: '医院' }, { label: '门诊部', value: '门诊部' }, { label: '社区健康服务中心', value: '社区健康服务中心' },
      { label: '幼儿园', value: '幼儿园' }, { label: '小学', value: '小学' }, { label: '初中', value: '初中' },
      { label: '九年一贯制学校', value: '九年一贯制学校' }, { label: '高中', value: '高中' }, { label: '高等教育', value: '高等教育' },
      { label: '职业教育', value: '职业教育' }, { label: '养老院', value: '养老院' }, { label: '儿童福利院', value: '儿童福利院' },
      { label: '残疾人服务中心', value: '残疾人服务中心' }, { label: '社区老年人日间照料中心', value: '社区老年人日间照料中心' },
      { label: '社区托儿机构', value: '社区托儿机构' }, { label: '社区救助站', value: '社区救助站' }, { label: '其它设施', value: '其它设施' }
    ]
  },
  lands: {
    name: '设施用地', visible: false, loaded: false, layer: null, selectedType: '全部类型',
    types: [
      { label: '全部类型', value: '全部类型' },
      { label: '商业用地', value: '商业用地' }, { label: '居住用地', value: '居住用地' }, { label: '工业用地', value: '工业用地' },
      { label: '公园绿地', value: '公园绿地' }, { label: '行政管理用地', value: '行政管理用地' }, { label: '文体设施用地', value: '文体设施用地' },
      { label: '医疗卫生用地', value: '医疗卫生用地' }, { label: '教育设施用地', value: '教育设施用地' }, { label: '社会福利用地', value: '社会福利用地' }
    ]
  }
})

// ==================== 响应式状态 ====================
const mapContainer = ref(null)
const cesiumContainer = ref(null)  // Cesium 地图容器
let map = null
let viewer = null;          // Cesium Viewer 实例
let cesiumInitialized = false;
let buildingDataSource = null;
let pointEntities = [];
let landEntities = [];

const activeBasemapId = ref('vector')
const basemapPanelVisible = ref(false)

const selectedFeature = ref(null)
const popupPosition = ref(null)
const showPointForm = ref(false)
const showLandsForm = ref(false)
const isDrawing = ref(false)
const isEditing = ref(false)
const originalGeometry = ref(null)

const drawHandlers = { backspace: null, esc: null }
let escHandler = null

const importLayerType = ref(null)
const importFeatures = ref([])

const pointsForm = ref({ name: '', level: '', type: '', floor_area: null, scale: null })
const landsForm = ref({ name: '', type: '', site_area: null })

let drawFeature = null
let drawInteraction = null
let drawLayer = null
let pointModify = null
let landsModify = null
let currentHighlightFeature = null  // 记录当前高亮的要素
let Cesium = null    // 保存 Cesium 模块引用

const vectorStore = useVectorStore()

// ==================== 计算属性 ====================
const pointsCount = computed(() => vectorStore.points.length)
const landsCount = computed(() => vectorStore.lands.length)
const getActiveBasemap = computed(() => basemaps.value.find(b => b.id === activeBasemapId.value))

// ==================== 工具函数 ====================
function transformCoordinates(coords, fromEPSG, toEPSG, geomType) {
  if (fromEPSG === toEPSG) return coords
  const transform = (coord) => proj4(fromEPSG, toEPSG, coord)
  if (geomType === 'Point') return transform(coords)
  if (geomType === 'Polygon') return coords.map(ring => ring.map(transform))
  return coords
}

function resetForms() {
  pointsForm.value = { name: '', level: '', type: '', floor_area: null, scale: null }
  landsForm.value = { name: '', type: '', site_area: null }
}

function calculateAreaInEPSG4547(coordinates4326) {
  const coordinates4547 = coordinates4326.map(ring =>
    ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', coord))
  )
  return new Polygon(coordinates4547).getArea()
}

function calcArea() {
  let coordinates4326 = null
  
  if (window._tempImportGeometry?.layerType === 'lands') {
    const { coordinates, type } = window._tempImportGeometry
    if (type === 'Polygon') coordinates4326 = coordinates
  }
  
  if (!coordinates4326 && selectedFeature.value?.layerType === 'lands') {
    const source = layers.value.lands.layer?.getSource()
    const mapFeature = source?.getFeatures().find(f => f.get('id') === selectedFeature.value.id)
    if (mapFeature?.getGeometry()) {
      coordinates4326 = mapFeature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
    }
  }
  
  if (!coordinates4326 && drawFeature) {
    const geom = drawFeature.getGeometry()
    if (geom?.getType() === 'Polygon') {
      coordinates4326 = geom.getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
    }
  }
  
  if (!coordinates4326) {
    alert('请先绘制或选择用地')
    return
  }
  
  landsForm.value.site_area = Math.round(calculateAreaInEPSG4547(coordinates4326))
}

// ==================== 地图初始化 ====================
function initMap() {
  if (!mapContainer.value) return
  map = new Map({
    target: mapContainer.value,
    layers: [basemaps.value[0].layer, basemaps.value[0].roadNetLayer],
    view: new View({ center: fromLonLat([114.04, 22.69]), zoom: 12, projection: 'EPSG:3857' }),
    controls: defaults().extend([
      new FullScreen(),
      new ScaleLine(),
      new MousePosition({ coordinateFormat: createStringXY(4), projection: 'EPSG:4326', className: 'custom-mouse-position' })
    ])
  })
  setupMapInteractions()
}

// ==================== 底图操作 ====================
async function switchBasemap(basemapId) {
  if (!map || activeBasemapId.value === basemapId) return
  
  // 三维地图特殊处理
  if (basemapId === '3d') {
    // 隐藏 2D 地图容器
    map.getTargetElement().style.display = 'none'
    // 显示 3D 容器
    if (cesiumContainer.value) cesiumContainer.value.style.display = 'block'
    
    // 加载 Cesium
    if (!cesiumInitialized) await loadCesium()
    activeBasemapId.value = basemapId
    return
  }
  
  const oldLayers = map.getLayers().getArray().filter(layer => layer instanceof TileLayer)
  oldLayers.forEach(layer => map.removeLayer(layer))
  
  const newBasemap = basemaps.value.find(b => b.id === basemapId)
  if (newBasemap && newBasemap.layer) {
    map.addLayer(newBasemap.layer)
    if (newBasemap.roadNetLayer) map.addLayer(newBasemap.roadNetLayer)
  }
  
  // 如果从 3D 切换回 2D，恢复地图容器显示
  if (map.getTargetElement()) {
    map.getTargetElement().style.display = 'block'
  }
  if (cesiumContainer.value) {
    cesiumContainer.value.style.display = 'none'
  }

  activeBasemapId.value = basemapId
}

function toggleRoadNet(basemap) { basemap.roadNetLayer?.setVisible(basemap.roadNetVisible) }
function getThumbColor(id) { return { vector: '#4CAF50', satellite: '#795548', '3d': '#2196F3' }[id] || '#ccc' }

// 动态加载 Cesium 的函数
async function loadCesium() {
  if (cesiumInitialized) return

  // 设置 Cesium 基础路径
  window.CESIUM_BASE_URL = '/cesium'
  
  // 动态导入 Cesium 核心库和样式
  Cesium = await import('cesium')
  await import('cesium/Build/Cesium/Widgets/widgets.css')
  
  // 初始化 Viewer
  viewer = new Cesium.Viewer(cesiumContainer.value, {
    geocoder: false,              // 查找位置工具
    homeButton: false,            // 返回初始位置
    sceneModePicker: false,       // 选择视角模式
    baseLayerPicker: false,       // 图层选择器
    navigationHelpButton: false,  // 导航帮助按钮
    fullscreenButton: false,      // 全屏按钮
    animation: false,             // 动画器件
    timeline: false,              // 时间线
    infoBox: false,               // 实体信息
  })
  
  // 移除 Cesium 默认的logo
  viewer.cesiumWidget.creditContainer.style.display = 'none'

  // 移除原生默认地图
  viewer.imageryLayers.removeAll()

  if (TIANDITU_API_KEY) {
    // 天地图卫星地图
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
    }))

    // 天地图卫星地图注记
    viewer.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      url: `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
    }))
  }
  
  // 设置初始相机位置
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(114.0265, 22.6042, 5000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0
    }
  })
  
  // 加载建筑数据
  await loadBuildings()
  // 加载设施点和用地
  loadPointsAndLands()
  // 设置点击事件
  setupCesiumClickHandler()
  
  cesiumInitialized = true
}

// 加载建筑数据的函数
async function loadBuildings() {
  try {
    const response = await fetch('http://localhost:3000/api/buildings')
    const result = await response.json()
    if (!result.success) throw new Error('加载建筑失败')
    
    const geojson = result.data
    
    buildingDataSource = await Cesium.GeoJsonDataSource.load(geojson, {
      stroke: Cesium.Color.WHITE,
      fill: Cesium.Color.fromCssColorString('rgba(200,200,200,0.6)'),
      extrudedHeight: (properties) => {
        let height = properties.height
        if (!height && properties.up_floor) height = properties.up_floor * 3.5
        return height || 10
      },
      closeTop: true,
      closeBottom: false
    })
    
    // 自定义建筑颜色
    const entities = buildingDataSource.entities.values
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      const type = entity.properties?.type?.getValue()
      const color = buildingColors[type] || defaultBuildingColor
      entity.polygon.material = Cesium.Color.fromCssColorString(color)
    }
    
    viewer.dataSources.add(buildingDataSource)
  } catch (error) {
    console.error('建筑加载失败', error)
  }
}

// 加载设施点和用地
function loadPointsAndLands() {
  // 清除旧数据
  pointEntities.forEach(e => viewer.entities.remove(e))
  landEntities.forEach(e => viewer.entities.remove(e))
  pointEntities = []
  landEntities = []
  
  // 从 store 获取点数据
  const points = vectorStore.points
  points.forEach(point => {
    const [lng, lat] = point.geometry.coordinates
    const entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat),
      billboard: {
        image: getPointIcon(point.type),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        scale: 0.8
      },
      label: {
        text: point.name,
        font: '14px sans-serif',
        pixelOffset: new Cesium.Cartesian2(0, -30),
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE
      },
      properties: point
    })
    pointEntities.push(entity)
  })
  
  // 加载用地数据
  const lands = vectorStore.lands
  lands.forEach(land => {
    const coordinates = land.geometry.coordinates[0]
    const positions = coordinates.map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1]))
    const entity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: Cesium.Color.fromCssColorString(LAND_STYLES[land.type] || 'rgba(0,0,0,0.5)'),
        outline: true,
        outlineColor: Cesium.Color.BLACK
      },
      properties: land
    })
    landEntities.push(entity)
  })
}

// 获取设施点图标（根据类型返回图标 URL，可使用 emoji 转 canvas 或图片）
function getPointIcon(type) {
  // 简单实现：使用 Canvas 生成带文字图标的图片，或使用固定图片
  // 此处返回一个 emoji 的 Canvas 纹理（演示用）
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff6600';
  ctx.arc(16, 16, 12, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = '20px sans-serif';
  ctx.fillText('📍', 8, 24);
  return canvas;
}

// 点击事件：显示建筑/设施信息
function setupCesiumClickHandler() {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((click) => {
    const pick = viewer.scene.pick(click.position)
    if (Cesium.defined(pick) && pick.id) {
      const entity = pick.id
      const properties = entity.properties?.getValue() || entity._properties
      if (properties) {
        showCesiumPopup(properties, click.position)
      }
    } else {
      closeCesiumPopup()
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

// 显示三维弹窗（简单 div）
let cesiumPopupDiv = null;
function showCesiumPopup(properties, screenPosition) {
  if (!cesiumPopupDiv) {
    cesiumPopupDiv = document.createElement('div');
    cesiumPopupDiv.className = 'cesium-popup';
    document.body.appendChild(cesiumPopupDiv);
  }
  // 填充内容（类似二维弹窗）
  let html = `<h4>${properties.name || '建筑'}</h4>`;
  if (properties.height) html += `<p>高度: ${properties.height}米</p>`;
  if (properties.type) html += `<p>类型: ${properties.type}</p>`;
  if (properties.floor_area) html += `<p>建筑面积: ${properties.floor_area}㎡</p>`;
  // 设置位置
  cesiumPopupDiv.style.left = `${screenPosition.x + 20}px`;
  cesiumPopupDiv.style.top = `${screenPosition.y}px`;
  cesiumPopupDiv.style.display = 'block';
}
function closeCesiumPopup() {
  if (cesiumPopupDiv) cesiumPopupDiv.style.display = 'none';
}

// ==================== 图层操作 ====================
async function toggleLayer(layerKey) {
  const layerObj = layers.value[layerKey]
  if (layerObj.visible && !layerObj.loaded) {
    if (layerKey === 'points') await vectorStore.loadPoints()
    else await vectorStore.loadLands()
    layerObj.loaded = true
    updateVectorLayer(layerKey)
  } else if (layerObj.layer) {
    layerObj.layer.setVisible(layerObj.visible)
  }
}

function onTypeChange(layerKey) {
  if (layers.value[layerKey].loaded) updateVectorLayer(layerKey)
}

function updateVectorLayer(layerKey) {
  const layerObj = layers.value[layerKey]
  const storeData = layerKey === 'points' ? vectorStore.points : vectorStore.lands
  const isPoint = layerKey === 'points'
  
  const filteredData = layerObj.selectedType === '全部类型' ? storeData : storeData.filter(item => item.type === layerObj.selectedType)
  const source = new VectorSource()
  
  filteredData.forEach(item => {
    const geom = isPoint ? new Point(fromLonLat(item.geometry.coordinates)) : new Polygon(item.geometry.coordinates).transform('EPSG:4326', 'EPSG:3857')
    const props = { id: item.id, name: item.name, layerType: layerKey }
    if (isPoint) Object.assign(props, { level: item.level, type: item.type, floor_area: item.floor_area, scale: item.scale })
    else Object.assign(props, { type: item.type, site_area: item.site_area })
    source.addFeature(new Feature({ geometry: geom, ...props }))
  })
  
  if (layerObj.layer) map.removeLayer(layerObj.layer)
  layerObj.layer = new VectorLayer({ source, style: isPoint ? createPointsStyle : createLandsStyle, visible: layerObj.visible, zIndex: isPoint ? 3 : 2 })
  map.addLayer(layerObj.layer)
  
  const setupModify = isPoint ? setupPointModify : setupLandsModify
  setupModify(source)
}

// ==================== 样式函数 ====================
function createPointsStyle(feature) {
  const icon = POINT_STYLES[feature.get('type')] || '📍'
  const name = feature.get('name') || ''
  return [
    new Style({ text: new Text({ text: icon, font: 'bold 16px Arial' }) }),
    new Style({ text: new Text({ text: name, font: '14px Arial', textAlign: 'left', offsetX: 12, textBaseline: 'middle', stroke: new Stroke({ color: '#fff', width: 1 }) }) })
  ]
}

function createLandsStyle(feature) {
  const color = LAND_STYLES[feature.get('type')] || 'rgba(0, 0, 0, 0.6)'
  return new Style({ fill: new Fill({ color }), stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.2)', width: 1.5 }) })
}

// 高亮样式函数
function createHighlightStyle(feature) {
  const layerType = feature.get('layerType')
  
  if (layerType === 'points') {
    // 点要素高亮：放大图标并添加光晕效果
    const icon = POINT_STYLES[feature.get('type')] || '📍'
    const name = feature.get('name') || ''
    return [
      new Style({
        text: new Text({
          text: icon,
          font: 'bold 24px Arial',  // 放大图标
          stroke: new Stroke({ color: 'white', width: 2 })
        })
      }),
      new Style({
        text: new Text({
          text: name,
          font: '16px Arial',
          textAlign: 'left',
          offsetX: 14,
          textBaseline: 'middle',
          stroke: new Stroke({ color: '#fff', width: 2 })
        })
      })
    ]
  } else {
    // 面要素高亮：添加黄色边框和半透明填充
    const type = feature.get('type')
    const color = LAND_STYLES[type] || 'rgba(0, 0, 0, 0.6)'
    return new Style({
      fill: new Fill({ color }),
      stroke: new Stroke({ color: 'yellow', width: 2 }),
      zIndex:4
    })
  }
}

// ==================== 绘制功能 ====================
function startDrawing(layerKey) { resetForms(); layerKey === 'points' ? pointDraw() : landsDraw() }

function pointDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction)
  isDrawing.value = true
  
  const source = new VectorSource()
  drawLayer = new VectorLayer({ source, style: new Style({ image: new Circle({ radius: 4, fill: new Fill({ color: 'purple' }) }) }) })
  map.addLayer(drawLayer)
  
  drawInteraction = new Draw({ source, type: 'Point', style: new Style({ image: new Circle({ radius: 4, fill: new Fill({ color: 'purple' }) }) }) })
  drawInteraction.on('drawend', (event) => { drawFeature = event.feature; showPointForm.value = true })
  map.addInteraction(drawInteraction)
  
  const escHandler = (e) => { if (e.key === 'Escape' && isDrawing.value) { cancelDraw(); document.removeEventListener('keydown', escHandler) } }
  document.addEventListener('keydown', escHandler)
}

function landsDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction)
  isDrawing.value = true
  
  const source = new VectorSource()
  drawLayer = new VectorLayer({ source, style: new Style({ fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }), stroke: new Stroke({ color: 'purple', width: 1.5 }) }) })
  map.addLayer(drawLayer)
  
  drawInteraction = new Draw({ source, type: 'Polygon', style: new Style({ fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }), stroke: new Stroke({ color: 'purple', width: 1.5 }) }) })
  drawInteraction.on('drawend', (event) => { drawFeature = event.feature; showLandsForm.value = true; removeBackspaceListener() })
  map.addInteraction(drawInteraction)
  
  const backspaceHandler = (e) => { if (e.key === 'Backspace' && isDrawing.value) { e.preventDefault(); drawInteraction?.removeLastPoint?.() } }
  const escHandler = (e) => { if (e.key === 'Escape' && isDrawing.value) cancelDraw() }
  document.addEventListener('keydown', backspaceHandler)
  document.addEventListener('keydown', escHandler)
  drawHandlers.backspace = backspaceHandler
  drawHandlers.esc = escHandler
}

function removeBackspaceListener() {
  if (drawHandlers.backspace) {
    document.removeEventListener('keydown', drawHandlers.backspace)
    drawHandlers.backspace = null
  }
}

// ==================== 导入导出功能 ====================
function handleImport(layerType) {
  importLayerType.value = layerType
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.geojson'
  input.onchange = (e) => { const file = e.target.files[0]; if (file) readGeoJSONFile(file) }
  input.click()
}

function readGeoJSONFile(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const geojson = JSON.parse(e.target.result)
      const layerType = importLayerType.value
      const features = geojson.features || [geojson]
      const validFeatures = features.filter(f => {
        const type = f.geometry?.type
        return layerType === 'lands' ? (type === 'Polygon' || type === 'MultiPolygon') : (type === 'Point' || type === 'MultiPoint')
      })
      if (validFeatures.length === 0) { alert(`文件中没有有效的${layerType === 'points' ? 'Point' : 'Polygon'}数据`); return }
      importFeatures.value = validFeatures
      showCoordinateDialogForImport()
    } catch (err) { alert('文件解析失败，请确保是有效的 GeoJSON 文件') }
  }
  reader.readAsText(file, 'UTF-8')
}

function showCoordinateDialogForImport() {
  const mask = document.createElement('div')
  mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'
  
  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
  select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'
  
  const btnGroup = document.createElement('div')
  btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
  const confirmBtn = document.createElement('button')
  confirmBtn.textContent = '确定'
  confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '取消'
  cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
  btnGroup.append(confirmBtn, cancelBtn)
  document.body.append(mask, select, btnGroup)
  
  const close = () => [mask, select, btnGroup].forEach(el => el.remove())
  confirmBtn.onclick = () => {
    const epsg = select.value
    if (!epsg) {
      alert('请选择坐标系')
      return
    }
    close()
    if (epsg === 'EPSG:4547' && !proj4.defs('EPSG:4547')) proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
    importWithTransform(epsg)
  }
  cancelBtn.onclick = () => { close(); importFeatures.value = []; importLayerType.value = null }
}

async function importWithTransform(sourceEPSG) {
  const targetEPSG = 'EPSG:4326'
  let successCount = 0
  
  for (const feature of importFeatures.value) {
    let geom = feature.geometry
    let geomType = geom.type
    let coordinates = geom.coordinates
    
    if (geomType === 'MultiPolygon') { geomType = 'Polygon'; coordinates = coordinates[0] }
    if (geomType === 'MultiPoint') { geomType = 'Point'; coordinates = coordinates[0] }
    
    if (sourceEPSG !== targetEPSG) {
      try { coordinates = transformCoordinates(coordinates, sourceEPSG, targetEPSG, geomType) }
      catch (err) { alert('坐标转换失败'); return }
    }
    
    const props = feature.properties || {}
    const layerType = importLayerType.value
    
    if (layerType === 'points') {
      pointsForm.value = { name: props.name || '', level: props.level || '', type: props.type || '', floor_area: props.floor_area || null, scale: props.scale || null }
    } else {
      landsForm.value = { name: props.name || '', type: props.type || '', site_area: props.site_area || null }
      if (!landsForm.value.site_area && geomType === 'Polygon') {
        const tempCoords = coordinates.map(ring => ring.map(coord => fromLonLat(coord)))
        landsForm.value.site_area = Math.round(new Polygon(tempCoords).getArea())
      }
    }
    
    window._tempImportGeometry = { type: geomType, coordinates, layerType }
    layerType === 'points' ? (showPointForm.value = true) : (showLandsForm.value = true)
    await new Promise(resolve => window._resolveImport = resolve)
    successCount++
  }
  
  alert(`成功导入 ${successCount} 个要素`)
  importFeatures.value = []
  importLayerType.value = null
  delete window._tempImportGeometry
  delete window._resolveImport
}

async function handleExport(layerType) {
  const layerObj = layers.value[layerType]
  if (!layerObj?.layer) { alert('请先加载图层数据'); return }
  const features = layerObj.layer.getSource().getFeatures()
  if (features.length === 0) { alert('没有可导出的要素'); return }
  
  const mask = document.createElement('div')
  mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'

  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
  select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'
  
  const btnGroup = document.createElement('div')
  btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
  const confirmBtn = document.createElement('button')
  confirmBtn.textContent = '确定'
  confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '取消'
  cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
  btnGroup.append(confirmBtn, cancelBtn)
  document.body.append(mask, select, btnGroup)
  const close = () => [mask, select, btnGroup].forEach(el => el.remove())
  
  confirmBtn.onclick = () => {
    const targetEPSG = select.value
    if (!targetEPSG) {
      alert('请选择坐标系')
      return
    }
    close()
    
    const geojson = { type: 'FeatureCollection', crs: { type: 'name', properties: { name: targetEPSG } }, features: [] }
    for (const feature of features) {
      const props = feature.getProperties()
      const properties = { name: props.name, type: props.type }
      if (layerType === 'points') Object.assign(properties, { level: props.level, floor_area: props.floor_area, scale: props.scale })
      else properties.site_area = props.site_area
      
      let geom = feature.getGeometry()
      let coordinates = geom.getCoordinates()
      
      if (targetEPSG === 'EPSG:4326') {
        if (geom.getType() === 'Point') coordinates = toLonLat(coordinates)
        else if (geom.getType() === 'Polygon') coordinates = coordinates.map(ring => ring.map(coord => toLonLat(coord)))
      } else if (targetEPSG === 'EPSG:4547') {
        if (geom.getType() === 'Point') coordinates = proj4('EPSG:4326', 'EPSG:4547', toLonLat(coordinates))
        else if (geom.getType() === 'Polygon') coordinates = coordinates.map(ring => ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', toLonLat(coord))))
      }
      
      geojson.features.push({ type: 'Feature', geometry: { type: geom.getType(), coordinates }, properties })
    }
    
    const dataStr = JSON.stringify(geojson, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.download = `${layerType === 'points' ? '设施点' : '设施用地'}_导出_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.geojson`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }
  cancelBtn.onclick = close
}

// 单个要素导出函数
async function exportSingleFeature(feature) {
  // 创建坐标系选择对话框
  const mask = document.createElement('div')
  mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'
  
  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;width:300px;'
  select.innerHTML = '<option value="" disabled selected hidden>请选择坐标系</option><option value="EPSG:4547">CGCS2000_3度带_114E</option><option value="EPSG:4326">WGS84_经纬度</option>'
  
  const btnGroup = document.createElement('div')
  btnGroup.style.cssText = 'position:fixed;top:calc(50% + 50px);left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:10px;'
  const confirmBtn = document.createElement('button')
  confirmBtn.textContent = '确定'
  confirmBtn.style.cssText = 'padding:5px 15px;background:#409eff;color:white;border:none;border-radius:3px;cursor:pointer;'
  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = '取消'
  cancelBtn.style.cssText = 'padding:5px 15px;background:#ccc;color:#333;border:none;border-radius:3px;cursor:pointer;'
  btnGroup.appendChild(confirmBtn)
  btnGroup.appendChild(cancelBtn)
  
  document.body.appendChild(mask)
  document.body.appendChild(select)
  document.body.appendChild(btnGroup)
  
  const close = () => {
    document.body.removeChild(mask)
    document.body.removeChild(select)
    document.body.removeChild(btnGroup)
  }
  
  confirmBtn.onclick = () => {
    const targetEPSG = select.value
    if (!targetEPSG) {
      alert('请选择坐标系')
      return
    }
    close()
    
    const layerType = feature.layerType
    const geomType = layerType === 'points' ? 'Point' : 'Polygon'
    
    // 获取几何坐标（从地图要素中获取，确保坐标正确）
    const source = layers.value[layerType]?.layer?.getSource()
    const mapFeature = source?.getFeatures().find(f => f.get('id') === feature.id)
    
    if (!mapFeature) {
      alert('未找到要素数据')
      return
    }
    
    const geometry = mapFeature.getGeometry()
    let coordinates
    
    // 获取原始坐标（3857），然后转换为4326
    if (geomType === 'Point') {
      const coords3857 = geometry.getCoordinates()
      coordinates = toLonLat(coords3857)
    } else {
      const coords3857 = geometry.getCoordinates()
      coordinates = coords3857.map(ring =>
        ring.map(coord => toLonLat(coord))
      )
    }
    
    // 如果需要转换到4547
    if (targetEPSG === 'EPSG:4547') {
      if (geomType === 'Point') {
        coordinates = proj4('EPSG:4326', 'EPSG:4547', coordinates)
      } else {
        coordinates = coordinates.map(ring =>
          ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', coord))
        )
      }
    }
    
    // 构建属性
    const properties = {
      name: feature.name,
      type: feature.type
    }
    if (layerType === 'points') {
      properties.level = feature.level
      properties.floor_area = feature.floor_area
      properties.scale = feature.scale
    } else {
      properties.site_area = feature.site_area
    }
    
    // 构建 GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      crs: { type: 'name', properties: { name: targetEPSG } },
      features: [{
        type: 'Feature',
        geometry: { type: geomType, coordinates },
        properties: properties
      }]
    }
    
    // 下载文件
    const dataStr = JSON.stringify(geojson, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-')
    a.download = `${layerType === 'points' ? '设施点' : '设施用地'}_${feature.name || '要素'}_${timestamp}.geojson`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }
  
  cancelBtn.onclick = close
}

// ==================== 编辑功能 ====================
function toggleEditMode(feature) {
  if (!feature) return
  const layerObj = layers.value[feature.layerType]
  if (!layerObj?.loaded) return
  
  if (!isEditing.value) {
    isEditing.value = true
    const source = layerObj.layer.getSource()
    const mapFeature = source?.getFeatures().find(f => f.get('id') === feature.id)
    if (mapFeature) {
      originalGeometry.value = mapFeature.getGeometry().clone()
      const modify = feature.layerType === 'points' ? pointModify : landsModify
      modify.setActive(true)
    }
  } else {
    openEditForm(feature)
  }
}

function setupPointModify(source) {
  if (pointModify) map.removeInteraction(pointModify)
  pointModify = new Modify({ source })
  pointModify.on('modifyend', (event) => {
    const modifiedFeature = event.features.item(0)
    const id = modifiedFeature.get('id')
    if (selectedFeature.value?.id === id) {
      selectedFeature.value.geometry = { type: 'Point', coordinates: toLonLat(modifiedFeature.getGeometry().getCoordinates()) }
    }
  })
  map.addInteraction(pointModify)
  pointModify.setActive(false)
}

function setupLandsModify(source) {
  if (landsModify) map.removeInteraction(landsModify)
  landsModify = new Modify({ source })
  landsModify.on('modifyend', (event) => {
    const modifiedFeature = event.features.item(0)
    const id = modifiedFeature.get('id')
    if (selectedFeature.value?.id === id) {
      const geometry = modifiedFeature.getGeometry()
      selectedFeature.value.geometry = {
        type: 'Polygon',
        coordinates: geometry.getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
      }
    }
  })
  map.addInteraction(landsModify)
  landsModify.setActive(false)
}

function exitEditMode() {
  // 清除高亮
  if (currentHighlightFeature) {
    currentHighlightFeature.setStyle(null)
    currentHighlightFeature = null
  }

  if (originalGeometry.value && selectedFeature.value) {
    const layerObj = layers.value[selectedFeature.value.layerType]
    const source = layerObj.layer.getSource()
    const mapFeature = source.getFeatures().find(f => f.get('id') === selectedFeature.value.id)
    if (mapFeature) mapFeature.setGeometry(originalGeometry.value.clone())
    originalGeometry.value = null
  }
  if (pointModify) pointModify.setActive(false)
  if (landsModify) landsModify.setActive(false)
  isEditing.value = false
}

function openEditForm(feature) {
  if (feature.layerType === 'points') {
    pointsForm.value = { name: feature.name || '', level: feature.level || '', type: feature.type || '', floor_area: feature.floor_area || null, scale: feature.scale || null }
    showPointForm.value = true
  } else {
    landsForm.value = { name: feature.name || '', type: feature.type || '', site_area: feature.site_area || null }
    showLandsForm.value = true
  }
}

// ==================== 数据保存 ====================
async function savePointToDatabase() {
  try {
    if (!pointsForm.value.name) return
    
    if (window._tempImportGeometry) {
      const { type, coordinates, layerType } = window._tempImportGeometry
      const response = await createPoints({
        name: pointsForm.value.name, level: pointsForm.value.level, type: pointsForm.value.type,
        floor_area: pointsForm.value.floor_area || 0, scale: pointsForm.value.scale || 0,
        geometry: { type, coordinates: type === 'Point' ? [Number(coordinates[0]), Number(coordinates[1])] : coordinates }
      })
      if (response.success) {
        const layerObj = layers.value[layerType]
        if (layerObj.loaded) {
          await vectorStore.loadPoints()
          updateVectorLayer(layerType)
        }
        showPointForm.value = false
        if (window._resolveImport) window._resolveImport()
      }
      return
    }
    
    if (selectedFeature.value?.id) {
      const id = selectedFeature.value.id
      const source = layers.value.points.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === id)
      let geometry = selectedFeature.value.geometry
      if (feature) geometry = { type: 'Point', coordinates: toLonLat(feature.getGeometry().getCoordinates()) }
      
      const updateData = { name: pointsForm.value.name, level: pointsForm.value.level, type: pointsForm.value.type, floor_area: pointsForm.value.floor_area || 0, scale: pointsForm.value.scale || 0, geometry }
      const response = await updatePoints(id, updateData)
      if (response.success) {
        if (feature) {
          feature.setGeometry(feature.getGeometry().clone())
          feature.set('name', pointsForm.value.name)
          feature.set('level', pointsForm.value.level)
          feature.set('type', pointsForm.value.type)
          feature.set('floor_area', pointsForm.value.floor_area)
          feature.set('scale', pointsForm.value.scale)
        }
        const index = vectorStore.points.findIndex(p => p.id === id)
        if (index !== -1) vectorStore.points[index] = { ...vectorStore.points[index], ...updateData, id }
        selectedFeature.value = { ...selectedFeature.value, ...updateData, id }

        alert('更新成功！')

        pointModify.setActive(false)
        selectedFeature.value = null
        popupPosition.value = null
        isEditing.value = false
        originalGeometry.value = null
        showPointForm.value = false
      }
    } else {
      if (!drawFeature) return
      const response = await createPoints({
        name: pointsForm.value.name, level: pointsForm.value.level, type: pointsForm.value.type,
        floor_area: pointsForm.value.floor_area || 0, scale: pointsForm.value.scale || 0,
        geometry: { type: 'Point', coordinates: toLonLat(drawFeature.getGeometry().getCoordinates()) }
      })
      if (response.success) {
        const newFeature = drawFeature.clone()
        newFeature.set('id', response.data.id)
        newFeature.set('name', pointsForm.value.name)
        newFeature.set('level', pointsForm.value.level)
        newFeature.set('type', pointsForm.value.type)
        newFeature.set('floor_area', pointsForm.value.floor_area)
        newFeature.set('scale', pointsForm.value.scale)
        newFeature.set('layerType', 'points')
        layers.value.points.layer?.getSource()?.addFeature(newFeature)
        vectorStore.points.push(response.data)

        alert('绘制成功！')

        cancelDraw()
      }
    }
  } catch (error) {
    alert('保存失败：' + error.message)
  }
}

async function saveLandsToDatabase() {
  try {
    if (!landsForm.value.name) return
    
    if (window._tempImportGeometry) {
      const { type, coordinates, layerType } = window._tempImportGeometry
      let finalCoordinates = coordinates
      if (type === 'Polygon') finalCoordinates = coordinates.map(ring => ring.map(point => [Number(point[0]), Number(point[1])]))
      else if (type === 'Point') finalCoordinates = [Number(coordinates[0]), Number(coordinates[1])]
      
      const response = await createLands({
        name: landsForm.value.name, type: landsForm.value.type, site_area: landsForm.value.site_area || 0,
        geometry: { type, coordinates: finalCoordinates }
      })
      if (response?.success) {
        const layerObj = layers.value[layerType]
        if (layerObj?.loaded) {
          await vectorStore.loadLands()
          updateVectorLayer(layerType)
        }
        showLandsForm.value = false
        delete window._tempImportGeometry
        if (window._resolveImport) window._resolveImport()
      }
      return
    }
    
    if (selectedFeature.value?.id) {
      const id = selectedFeature.value.id
      const source = layers.value.lands.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === id)
      let geometry = selectedFeature.value.geometry
      if (feature) {
        geometry = {
          type: 'Polygon',
          coordinates: feature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
        }
      }
      
      const updateData = { name: landsForm.value.name, type: landsForm.value.type, site_area: landsForm.value.site_area || 0, geometry }
      const response = await updateLands(id, updateData)
      if (response.success) {
        if (feature) {
          feature.set('name', landsForm.value.name)
          feature.set('type', landsForm.value.type)
          feature.set('site_area', landsForm.value.site_area)
        }
        const index = vectorStore.lands.findIndex(l => l.id === id)
        if (index !== -1) vectorStore.lands[index] = { ...vectorStore.lands[index], ...updateData, id }
        selectedFeature.value = { ...selectedFeature.value, ...updateData, id }

        alert('更新成功！')

        landsModify.setActive(false)
        selectedFeature.value = null
        popupPosition.value = null
        isEditing.value = false
        originalGeometry.value = null
        showLandsForm.value = false
      }
    } else {
      if (!drawFeature) return
      const response = await createLands({
        name: landsForm.value.name, type: landsForm.value.type, site_area: landsForm.value.site_area || 0,
        geometry: {
          type: 'Polygon',
          coordinates: drawFeature.getGeometry().getCoordinates().map(ring => ring.map(coord => toLonLat(coord)))
        }
      })
      if (response.success) {
        const newFeature = drawFeature.clone()
        newFeature.set('id', response.data.id)
        newFeature.set('name', landsForm.value.name)
        newFeature.set('type', landsForm.value.type)
        newFeature.set('site_area', landsForm.value.site_area)
        newFeature.set('layerType', 'lands')
        layers.value.lands.layer?.getSource()?.addFeature(newFeature)
        vectorStore.lands.push(response.data)

        alert('绘制成功！')

        cancelDraw()
      }
    }
  } catch (error) {
    alert('保存失败：' + error.message)
  }
}

// ==================== 删除功能 ====================
async function deleteFeature(featureId) {
  if (!selectedFeature.value) return
  const layerType = selectedFeature.value.layerType
  if (!confirm(`确定要删除这个${layerType === 'points' ? '设施' : '图形'}吗？`)) return
  
  try {
    if (layerType === 'points') await deletePoints(featureId)
    else await deleteLands(featureId)
    
    const source = layers.value[layerType]?.layer?.getSource()
    const feature = source?.getFeatures().find(f => f.get('id') === featureId)
    if (feature) source.removeFeature(feature)
    
    if (layerType === 'points') vectorStore.points = vectorStore.points.filter(item => item.id !== featureId)
    else vectorStore.lands = vectorStore.lands.filter(item => item.id !== featureId)
    
    closePopup()

    alert('删除成功')
  } catch (error) {
    const source = layers.value[layerType]?.layer?.getSource()
    const feature = source?.getFeatures().find(f => f.get('id') === featureId)
    if (feature) source.removeFeature(feature)
    closePopup()
  }
}

// ==================== 交互与工具 ====================
function setupMapInteractions() {
  map.on('click', (event) => {
    if (showLandsForm.value || isDrawing.value || showPointForm.value || isEditing.value) return
    const features = map.getFeaturesAtPixel(event.pixel)
    if (features.length > 0) {
      const feature = features[0]
      const properties = feature.getProperties()

      // 高亮处理：移除之前的高亮
      if (currentHighlightFeature) {
        currentHighlightFeature.setStyle(null)  // 恢复默认样式
      }

      // 设置当前要素的高亮样式
      feature.setStyle(createHighlightStyle(feature))
      currentHighlightFeature = feature

      if (isEditing.value && selectedFeature.value?.id === properties.id) return
      if (isEditing.value) exitEditMode()
      selectedFeature.value = properties
      popupPosition.value = { x: event.pixel[0] + 20, y: event.pixel[1] }
    } else {
      // 点击空白区域，清除高亮
      if (currentHighlightFeature) {
        currentHighlightFeature.setStyle(null)
        currentHighlightFeature = null
      }
      closePopup()
    }
  })
  
  map.on('pointermove', (event) => {
    map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel) ? 'pointer' : ''
  })
}

function closePopup() {
  // 清除高亮
  if (currentHighlightFeature) {
    currentHighlightFeature.setStyle(null)
    currentHighlightFeature = null
  }

  if (isEditing.value) { exitEditMode(); return }
  selectedFeature.value = null
  popupPosition.value = null
}

function cancelDraw() {
  if (window._tempImportGeometry && window._resolveImport) {
    showLandsForm.value = false
    showPointForm.value = false
    const resolve = window._resolveImport
    delete window._tempImportGeometry
    delete window._resolveImport
    resolve?.()
    return
  }
  
  showLandsForm.value = false
  showPointForm.value = false
  resetForms()
  drawFeature = null
  isDrawing.value = false
  
  Object.entries(drawHandlers).forEach(([key, handler]) => {
    if (handler) { document.removeEventListener('keydown', handler); drawHandlers[key] = null }
  })
  
  if (drawInteraction) { map.removeInteraction(drawInteraction); drawInteraction = null }
  if (drawLayer) { map.removeLayer(drawLayer); drawLayer = null }
}

// ==================== 生命周期 ====================
onMounted(() => {
  if (!mapContainer.value) return
  initMap()
  // 初始隐藏三维容器
  if (cesiumContainer.value) cesiumContainer.value.style.display = 'none'
  
  escHandler = (e) => {
    if (e.key !== 'Escape') return
    if (showPointForm.value || showLandsForm.value) cancelDraw()
    else if (isEditing.value) { exitEditMode(); closePopup() }
  }
  document.addEventListener('keydown', escHandler)
})

onUnmounted(() => {
  if (escHandler) document.removeEventListener('keydown', escHandler)
  if (map) { map.setTarget(null); map = null }
  if (viewer) {
    viewer.destroy()
    viewer = null
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
  background: rgba(30, 0, 60, 0.9);
  padding: 8px 15px;
  border-radius: 5px;
  color: white;
  z-index: 1000;
  pointer-events: none;
  font-size: 14px;
  max-width: 250px;
  backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cesium-popup h4 {
  margin: 0 0 5px;
  border-bottom: 1px solid #aaa;
  color: #ffd700;
}

.cesium-popup p {
  margin: 3px 0;
  font-size: 12px;
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