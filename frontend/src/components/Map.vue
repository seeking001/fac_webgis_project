<template>
  <div class="map-wrapper">
    <!-- 地图容器 -->
    <div ref="mapContainer" class="map-container"></div>

    <!-- 底图切换控件 -->
    <div class="basemap-switcher" @mouseenter="basemapPanelVisible = true" @mouseleave="basemapPanelVisible = false">
      <button class="basemap-main-btn">
        {{ getActiveBasemap.name }}
      </button>
      
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

    <!-- 左侧边栏：图形操作 -->
    <div class="left_sidebar">
      <h3>图形操作</h3>
      
      <div class="layer-panel" v-for="(config, key) in layers" :key="key">
        <h4>{{ config.name }}</h4>
        
        <!-- 1. 加载与显示控制 -->
        <div class="control-group">
          <input type="checkbox" v-model="config.visible" @change="toggleLayer(key)">
          <span>加载显示</span>
          <select v-model="config.selectedType" @change="onTypeChange(key)" :disabled="!config.visible">
            <option v-for="type in config.types" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>
        
        <!-- 2. 绘制与编辑 -->
        <div class="control-group">
          <button @click="startDrawing(key)" :disabled="!config.visible">绘制</button>
          <button @click="handleImport(key)" :disabled="!config.visible">导入</button>
          <button @click="handleExport(key)" :disabled="!config.visible">导出</button>
        </div>
      </div>
    </div>

    <!-- 右侧边栏：信息显示 -->
    <div class="right_sidebar">
      <h3>信息显示</h3>
      <!-- 显示绘制提示 -->
      <div v-if="isDrawing" class="draw-hint">
        <p>正在绘制... 按 <kbd>ESC</kbd> 退出 | 按 <kbd>Ctrl+Z</kbd> 撤销上一点</p>
      </div>
      <div class="status-info">
        <h4>加载状态</h4>
        <div v-for="(config, key) in layers">
          <span v-if="config.loaded">
            ✅ {{ config.name }}: {{ key === 'points' ? pointsCount : landsCount }} 个
          </span>
          <span v-else>◻️ {{ config.name }}: 未加载</span>
        </div>
      </div>
    </div>
    
    <!-- 点击要素弹窗 -->
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
          <button v-if="selectedFeature" @click="deleteFeature(selectedFeature.id)" class="delete-btn">
            删除{{ selectedFeature.layerType === 'points' ? '设施' : '用地' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 设施点表单弹窗 -->
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
              <!-- 新增类型 - 行政管理类 -->
              <option value="行政办公场所">行政办公场所</option>
              <option value="社区管理机构">社区管理机构</option>
              <!-- 新增类型 - 文化体育类 -->
              <option value="大型文化设施">大型文化设施</option>
              <option value="大型体育设施">大型体育设施</option>
              <option value="社区文化设施">社区文化设施</option>
              <option value="社区体育设施">社区体育设施</option>
              <!-- 新增类型 - 医疗卫生类 -->
              <option value="医院">医院</option>
              <option value="门诊部">门诊部</option>
              <option value="社区健康服务中心">社区健康服务中心</option>
              <!-- 新增类型 - 教育类 -->
              <option value="幼儿园">幼儿园</option>
              <option value="小学">小学</option>
              <option value="初中">初中</option>
              <option value="九年一贯制学校">九年一贯制学校</option>
              <option value="高中">高中</option>
              <option value="高等教育">高等教育</option>
              <option value="职业教育">职业教育</option>
              <!-- 新增类型 - 社会福利类 -->
              <option value="养老院">养老院</option>
              <option value="儿童福利院">儿童福利院</option>
              <option value="残疾人服务中心">残疾人服务中心</option>
              <option value="社区老年人日间照料中心">社区老年人日间照料中心</option>
              <option value="社区托儿机构">社区托儿机构</option>
              <option value="社区救助站">社区救助站</option>
              <!-- 新增类型 - 其它类 -->
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

    <!-- 设施用地表单弹窗 -->
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
            <input v-model="landsForm.site_area" type="number" placeholder="手动输入" required>
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
import { onMounted, onUnmounted, ref, computed, markRaw } from 'vue'
import { Map, View } from 'ol'
import 'ol/ol.css'
import TileLayer from 'ol/layer/Tile'
import Feature from 'ol/Feature'
import { fromLonLat, toLonLat, transform } from 'ol/proj'
import proj4 from 'proj4'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import { Style, Fill, Stroke, Text, Circle } from 'ol/style'
import { Point, Polygon } from 'ol/geom'
import { FullScreen, ScaleLine, MousePosition, defaults } from "ol/control"
import { createStringXY } from "ol/coordinate"
import { Draw, Modify } from 'ol/interaction'
import { useVectorStore } from '../stores/vectorStore'
import { getMapBbox } from '../utils/mapUtil'
import { createPoints, updatePoints, deletePoints, createLands, updateLands, deleteLands } from '../services/api'

// DOM 引用
const mapContainer = ref(null)
let map = null

// 定义 EPSG:4547（确保全局可用）
proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

// 天地图密钥配置
const TIANDITU_API_KEY = import.meta.env.VITE_TIANDITU_API_KEY

// 地图底图预定义
const basemaps = ref([
  {
    id: 'vector',
    name: '普通地图',
    layer: markRaw(new TileLayer({
      source: new XYZ({
        url: `http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      zIndex: 0
    })),
    hasRoadNet: true,
    roadNetVisible: false,
    roadNetLayer: markRaw(new TileLayer({
      source: new XYZ({
        url: `http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      visible: false,
      zIndex: 1
    }))
  },
  {
    id: 'satellite',
    name: '卫星地图',
    layer: markRaw(new TileLayer({
      source: new XYZ({
        url: `http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      zIndex: 0
    })),
    hasRoadNet: true,
    roadNetVisible: false,
    roadNetLayer: markRaw(new TileLayer({
      source: new XYZ({
        url: `http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      visible: false,
      zIndex: 1
    }))
  },
  {
    id: '3d',
    name: '三维地图',
    layer: null,
    hasRoadNet: false,
    roadNetVisible: false,
    roadNetLayer: null
  }
])

// 默认底图及显示状态
const activeBasemapId = ref('vector')
const basemapPanelVisible = ref(false)

// 状态管理
const selectedFeature = ref(null)
const popupPosition = ref(null)
const showPointForm = ref(false)
const showLandsForm = ref(false)
const isDrawing = ref(false)
const isEditing = ref(false)  // 是否处于编辑模式
const originalGeometry = ref(null)  // 保存原始几何，用于取消编辑
let escHandler = null  // 键盘状态

// 导入导出相关
const importFile = ref(null)               // 暂存待导入的文件
const importLayerType = ref(null)          // 当前导入的目标图层 'points' 或 'lands'
const importFeatures = ref([])             // 解析后的要素列表
const importCurrentIndex = ref(0)          // 当前处理的要素索引（用于多要素逐个提示）
const showImportConfirm = ref(false)       // 是否显示导入确认对话框

// 表单数据
const pointsForm = ref({
  name: '',
  level: '',
  type: '',
  floor_area: null,
  scale: null
})
const landsForm = ref({
  name: '',
  type: '',
  site_area: null
})

// 绘制相关
let drawFeature = null
let drawInteraction = null
let drawLayer = null
let pointModify = null
let landsModify = null

// Store
const vectorStore = useVectorStore()

// 矢量图层配置
const layers = ref({
  points: {
    name: '设施点',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: 'all',
    drawType: 'Point',
    // editable: false,
    types: [
      { label: '全部类型', value: 'all' },
      // 【新增类型 - 行政管理类】
      { label: '行政办公场所', value: '行政办公场所' },
      { label: '社区管理机构', value: '社区管理机构' },
      // 【新增类型 - 文化体育类】
      { label: '大型文化设施', value: '大型文化设施' },
      { label: '大型体育设施', value: '大型体育设施' },
      { label: '社区文化设施', value: '社区文化设施' },
      { label: '社区体育设施', value: '社区体育设施' },
      // 【新增类型 - 医疗卫生类】
      { label: '医院', value: '医院' },
      { label: '门诊部', value: '门诊部' },
      { label: '社区健康服务中心', value: '社区健康服务中心' },
      // 【新增类型 - 教育类】
      { label: '幼儿园', value: '幼儿园' },
      { label: '小学', value: '小学' },
      { label: '初中', value: '初中' },
      { label: '九年一贯制学校', value: '九年一贯制学校' },
      { label: '高中', value: '高中' },
      { label: '高等教育', value: '高等教育' },
      { label: '职业教育', value: '职业教育' },
      // 【新增类型 - 社会福利类】
      { label: '养老院', value: '养老院' },
      { label: '儿童福利院', value: '儿童福利院' },
      { label: '残疾人服务中心', value: '残疾人服务中心' },
      { label: '社区老年人日间照料中心', value: '社区老年人日间照料中心' },
      { label: '社区托儿机构', value: '社区托儿机构' },
      { label: '社区救助站', value: '社区救助站' },
      // 【新增类型 - 其它类】
      { label: '其它设施', value: '其它设施' }
    ]
  },
  lands: {
    name: '设施用地',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: 'all',
    drawType: 'Polygon',
    // editable: false,
    types: [
      { label: '全部类型', value: 'all' },
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

// 计算属性
const pointsCount = computed(() => vectorStore.points.length)
const landsCount = computed(() => vectorStore.lands.length)
const getActiveBasemap = computed(() => basemaps.value.find(b => b.id === activeBasemapId.value))

// ========== 地图初始化 ==========
const initMap = () => {
  if (!mapContainer.value) return

  map = new Map({
    target: mapContainer.value,
    layers: [basemaps.value[0].layer, basemaps.value[0].roadNetLayer],
    view: new View({
      center: fromLonLat([114.04, 22.69]),
      zoom: 12,
      projection: 'EPSG:3857'
    }),
    controls: defaults().extend([
      new FullScreen(),
      new ScaleLine(),
      new MousePosition({
        coordinateFormat: createStringXY(4),
        projection: 'EPSG:4326',
        className: 'custom-mouse-position'
      })
    ])
  })
  
  // 添加要素交互
  setupMapInteractions()
}

// ========== 底图操作 ==========
function switchBasemap(basemapId) {
  // 基础检查
  if (!map) return
  if (activeBasemapId.value === basemapId) return
  
  // 特殊处理：三维地图
  if (basemapId === '3d') {
    alert('三维地图功能正在开发中…')
    return
  }
  
  // 移除旧底图
  const oldLayers = map.getLayers().getArray().filter(layer => layer instanceof TileLayer)
  oldLayers.forEach(layer => map.removeLayer(layer))

  // 配置新底图
  const newBasemap = basemaps.value.find(b => b.id === basemapId)
  
  // 添加新底图
  map.addLayer(newBasemap.layer)
  map.addLayer(newBasemap.roadNetLayer)
  
  // 更新当前选中的底图ID
  activeBasemapId.value = basemapId
}

function toggleRoadNet(basemap) {
  if (basemap.roadNetLayer) {
    basemap.roadNetLayer.setVisible(basemap.roadNetVisible)
  }
}

function getThumbColor(id) {
  const colors = { vector: '#4CAF50', satellite: '#795548', '3d': '#2196F3' }
  return colors[id] || '#ccc'
}

// ========== 图层操作 ==========
async function toggleLayer(layerKey) {
  const layerObj = layers.value[layerKey]
  if (layerObj.visible && !layerObj.loaded) {
    const bbox = getMapBbox(map)
    if (layerKey === 'points') {
      await vectorStore.loadPoints(bbox)
    } else {
      await vectorStore.loadLands(bbox)
    }
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
  const styleFunc = layerKey === 'points' ? createPointsStyle : createLandsStyle
  const isPoint = layerKey === 'points'

  const filteredData = layerObj.selectedType === 'all' 
    ? storeData 
    : storeData.filter(item => item.type === layerObj.selectedType)

  const source = new VectorSource()
  filteredData.forEach(item => {
    const geom = isPoint 
      ? new Point(fromLonLat(item.geometry.coordinates))
      : new Polygon(item.geometry.coordinates).transform('EPSG:4326', 'EPSG:3857')
    
    if (isPoint) {
      // 点要素
      const feature = new Feature({
        geometry: geom,
        id: item.id,
        name: item.name,
        level: item.level,
        type: item.type,
        layerType: layerKey,
        floor_area: item.floor_area,
        scale: item.scale
      });
      source.addFeature(feature)
    } else {
      // 面要素
      const feature = new Feature({
        geometry: geom,
        id: item.id,
        name: item.name,
        type: item.type,
        layerType: layerKey,
        site_area: item.site_area
      });
      source.addFeature(feature)
    }
  })

  // 移除旧图层
  if (layerObj.layer) map.removeLayer(layerObj.layer)
  
  // 添加新图层
  layerObj.layer = new VectorLayer({
    source,
    style: styleFunc,
    visible: layerObj.visible,
    zIndex: layerKey === 'points' ? 3 : 2
  })
  map.addLayer(layerObj.layer)

  // 设置编辑交互
  if (layerKey === 'points') {
    setupPointModify(source)
  } else if (layerKey === 'lands') {
    setupLandsModify(source)
  }
}


// ========== 样式函数 ==========
function createPointsStyle(feature) {
  const type = feature.get('type')
  const icons = {
    // 【新增图标 - 行政管理类】
    行政办公场所: '🏛️',
    社区管理机构: '🏢',
    // 【新增图标 - 文化体育类】
    大型文化设施: '🏫',
    大型体育设施: '🏟️',
    社区文化设施: '🎨',
    社区体育设施: '🏀',
    // 【新增图标 - 医疗卫生类】
    医院: '🏥',
    门诊部: '💊',
    社区健康服务中心: '❤️',
    // 【新增图标 - 教育类】
    幼儿园: '🌈',
    小学: '✏️',
    初中: '📙',
    九年一贯制学校: '📘',
    高中: '📚',
    高等教育: '🎓',
    职业教育: '💻',
    // 【新增图标 - 社会福利类】
    养老院: '🏠',
    儿童福利院: '🛝',
    残疾人服务中心: '♿',
    社区老年人日间照料中心: '🍵',
    社区托儿机构: '🍼',
    社区救助站: '🤝',
    // 【新增图标 - 其它类】
    其它设施: '📍'
  }
  const icon = icons[type] || '📍'
  const name = feature.get('name') || ''
  
  return [
    new Style({
      text: new Text({
         text: icon,
         font: 'bold 16px Arial'
      })
    }),
    new Style({
      text: new Text({
        text: name,
        font: '14px Arial',
        textAlign: 'left',  // 左对齐
        offsetX: 12,  // 向右偏移12px
        textBaseline: 'middle',  // 垂直居中
        stroke: new Stroke({ color: '#fff', width: 1 })  // 白色描边
      })
    })
  ]
}

function createLandsStyle(feature) {
  const type = feature.get('type')
  let color = 'rgba(0, 0, 0, 0.6)'
  
  switch(type) {
    case '居住用地': color = 'rgba(255, 255, 45, 0.6)'; break
    case '商业用地': color = 'rgba(255, 0, 0, 0.6)'; break
    case '工业用地': color = 'rgba(187, 150, 116, 0.6)'; break
    case '公园绿地': color = 'rgba(0, 255, 0, 0.6)'; break
    case '行政管理用地': color = 'rgba(254, 24, 201, 0.6)'; break
    case '文体设施用地': color = 'rgba(254, 24, 201, 0.6)'; break
    case '医疗卫生用地': color = 'rgba(254, 24, 201, 0.6)'; break
    case '教育设施用地': color = 'rgba(254, 24, 201, 0.6)'; break
    case '社会福利用地': color = 'rgba(254, 24, 201, 0.6)'; break
  }

  return new Style({
    fill: new Fill({ color }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.2)', width: 1.5 })
  })
}


// ========== 绘制功能 ==========
function startDrawing(layerKey) {
  if (layerKey === 'points') pointDraw()
  else if (layerKey === 'lands') landsDraw()
}

// 点绘制功能
function pointDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction)
  
  isDrawing.value = true
  
  const source = new VectorSource()
  drawLayer = new VectorLayer({
    source,
    style: new Style({
      image: new Circle({
        radius: 4,
        fill: new Fill({ color: 'purple' })
      })
    })
  })
  map.addLayer(drawLayer)
  
  drawInteraction = new Draw({
    source,
    type: 'Point',
    style: new Style({
      image: new Circle({
        radius: 4,
        fill: new Fill({ color: 'purple' })
      })
    })
  })

  drawInteraction.on('drawend', (event) => {
    drawFeature = event.feature
    showPointForm.value = true
  })

  map.addInteraction(drawInteraction)

  // ESC键退出绘制
  const escHandler = (e) => {
    if (e.key === 'Escape' && isDrawing.value) {
      cancelDraw()
      document.removeEventListener('keydown', escHandler)
    }
  }
  document.addEventListener('keydown', escHandler)
}

// 用地绘制功能
function landsDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction)
  
  isDrawing.value = true
  
  const source = new VectorSource()
  drawLayer = new VectorLayer({
    source,
    style: new Style({
      fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
      stroke: new Stroke({ color: 'purple', width: 1.5 })
    })
  })
  map.addLayer(drawLayer)
  
  drawInteraction = new Draw({
    source,
    type: 'Polygon',
    style: new Style({
      fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
      stroke: new Stroke({ color: 'purple', width: 1.5 })
    })
  })

  drawInteraction.on('drawend', (event) => {
    drawFeature = event.feature
    showLandsForm.value = true
  })

  map.addInteraction(drawInteraction)
  
  const escHandler = (e) => {
    if (e.key === 'Escape' && isDrawing.value) {
      cancelDraw()
    }
  }
  
  // 【推荐】利用 OpenLayers 原生 Backspace 删除顶点
  const undoHandler = (e) => {
    if (e.ctrlKey && e.key === 'z' && isDrawing.value) {
      e.preventDefault()
      e.stopPropagation()
      // 模拟 Backspace 键，触发 OpenLayers 的删除顶点功能
      const backspaceEvent = new KeyboardEvent('keydown', { key: 'Backspace' })
      document.dispatchEvent(backspaceEvent)
    }
  }
  
  document.addEventListener('keydown', escHandler)
  document.addEventListener('keydown', undoHandler)
  
  window._drawEscHandler = escHandler
  window._drawUndoHandler = undoHandler
}

// ========== 导入导出功能 ==========
// 统一的坐标转换函数
function convertCoordinate(coord, fromEPSG, toEPSG) {
  if (fromEPSG === toEPSG) return coord
  // 使用 proj4 转换
  return proj4(fromEPSG, toEPSG, coord)
}

// 导入文件（触发文件选择）
function handleImport(layerType) {
  importLayerType.value = layerType
  // 创建隐藏的文件输入
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.geojson'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    readGeoJSONFile(file)
  }
  input.click()
}

// 读取并解析 GeoJSON 文件
function readGeoJSONFile(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const geojson = JSON.parse(e.target.result)
      // 校验几何类型
      const layerType = importLayerType.value
      const expectedType = layerType === 'points' ? 'Point' : 'Polygon'
      const features = geojson.features || [geojson]
      
      // 过滤出符合几何类型的要素
      const validFeatures = features.filter(f => {
        const geomType = f.geometry?.type
        if (layerType === 'lands') {
          // 面图层：支持 Polygon 和 MultiPolygon
          return geomType === 'Polygon' || geomType === 'MultiPolygon'
        } else {
          // 点图层：支持 Point 和 MultiPoint
          return geomType === 'Point' || geomType === 'MultiPoint'
        }
      })
      
      if (validFeatures.length === 0) {
        alert(`文件中没有有效的${expectedType}数据`)
        return
      }
      
      importFeatures.value = validFeatures
      // 弹出坐标系选择对话框
      showCoordinateDialogForImport()
    } catch (err) {
      alert('文件解析失败，请确保是有效的 GeoJSON 文件')
      console.error(err)
    }
  }
  reader.readAsText(file, 'UTF-8')
}

// 显示坐标系选择对话框
function showCoordinateDialogForImport() {
  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;font-size:14px;width:300px;'
  select.innerHTML = `
    <option value="">请选择源文件坐标系</option>
    <option value="EPSG:4326">WGS84 经纬度</option>
    <option value="EPSG:4547">CGCS2000 / 3度带 114E</option>
  `
  
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
  
  const mask = document.createElement('div')
  mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'
  
  document.body.appendChild(mask)
  document.body.appendChild(select)
  document.body.appendChild(btnGroup)
  
  const closeDialog = () => {
    document.body.removeChild(mask)
    document.body.removeChild(select)
    document.body.removeChild(btnGroup)
  }
  
  confirmBtn.onclick = () => {
    const sourceEPSG = select.value
    if (!sourceEPSG) {
      alert('请选择坐标系')
      return
    }
    closeDialog()
    
    if (sourceEPSG === 'EPSG:4547' && !proj4.defs('EPSG:4547')) {
      proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
    }
    
    importWithTransform(sourceEPSG)
  }
  
  cancelBtn.onclick = () => {
    closeDialog()
    importFeatures.value = []
    importLayerType.value = null
  }
}

// 执行坐标转换并逐个导入
async function importWithTransform(sourceEPSG) {
  if (sourceEPSG === 'EPSG:4547' && !proj4.defs('EPSG:4547')) {
    proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
  }
  
  const targetEPSG = 'EPSG:4326'
  let successCount = 0
  
  for (let i = 0; i < importFeatures.value.length; i++) {
    const feature = importFeatures.value[i]
    let geom = feature.geometry
    let geomType = geom.type
    let coordinates = geom.coordinates
    
    // 处理 MultiPolygon/MultiPoint
    if (geomType === 'MultiPolygon') {
      geomType = 'Polygon'
      coordinates = coordinates[0]
    }
    if (geomType === 'MultiPoint') {
      geomType = 'Point'
      coordinates = coordinates[0]
    }
    
    // 坐标转换
    if (sourceEPSG !== targetEPSG) {
      try {
        if (geomType === 'Point') {
          coordinates = proj4(sourceEPSG, targetEPSG, coordinates)
        } else if (geomType === 'Polygon') {
          coordinates = coordinates.map(ring =>
            ring.map(coord => {
              const result = proj4(sourceEPSG, targetEPSG, coord)
              // 确保返回的是数组 [lng, lat]
              return [result[0], result[1]]
            })
          )
        }
      } catch (err) {
        console.error('坐标转换失败:', err)
        alert('坐标转换失败，请检查源坐标系选择是否正确')
        return
      }
    }
    
    // 提取属性
    const props = feature.properties || {}
    const layerType = importLayerType.value
    
    // 准备表单数据
    if (layerType === 'points') {
      pointsForm.value = {
        name: props.name || '',
        type: props.type || '',
        address: props.address || '',
        capacity: props.capacity || 0,
        admin_region: props.admin_region || ''
      }
    } else {
      landsForm.value = {
        name: props.name || '',
        type: props.type || '',
        admin_region: props.admin_region || '',
        area: props.area || 0
      }
    }
    
    // 存储临时几何信息
    window._tempImportGeometry = { type: geomType, coordinates: coordinates, layerType: layerType }
    
    // 弹出表单
    if (layerType === 'points') {
      showPointForm.value = true
    } else {
      showLandsForm.value = true
    }
    
    // 等待用户保存（通过修改保存函数处理导入）
    await new Promise((resolve) => {
      window._resolveImport = resolve
    })
    
    successCount++
  }
  
  alert(`成功导入 ${successCount} 个要素`)
  importFeatures.value = []
  importLayerType.value = null
  delete window._tempImportGeometry
  delete window._resolveImport
}

// 导出图层数据函数
async function handleExport(layerType) {
  const layerObj = layers.value[layerType]
  if (!layerObj || !layerObj.layer) {
    alert('请先加载图层数据')
    return
  }
  
  const source = layerObj.layer.getSource()
  const features = source.getFeatures()
  if (features.length === 0) {
    alert('没有可导出的要素')
    return
  }
  
  // 创建选择框
  const select = document.createElement('select')
  select.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;padding:10px;background:white;border:2px solid #409eff;border-radius:5px;font-size:14px;width:300px;'
  select.innerHTML = `
    <option value="">请选择导出坐标系</option>
    <option value="EPSG:4326">WGS84 经纬度</option>
    <option value="EPSG:4547">CGCS2000 / 3度带 114E</option>
  `
  
  // 创建按钮容器
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
  
  // 创建遮罩层
  const mask = document.createElement('div')
  mask.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9998;'
  
  document.body.appendChild(mask)
  document.body.appendChild(select)
  document.body.appendChild(btnGroup)
  
  // 关闭弹窗的函数
  const closeDialog = () => {
    document.body.removeChild(mask)
    document.body.removeChild(select)
    document.body.removeChild(btnGroup)
  }
  
  // 确定按钮事件
  confirmBtn.onclick = () => {
    const targetEPSG = select.value
    if (!targetEPSG) {
      alert('请选择坐标系')
      return
    }
    closeDialog()
    
    // 定义 EPSG:4547（如果尚未定义）
    try {
      if (!proj4.defs('EPSG:4547')) {
        proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')
      }
    } catch (e) {
      console.log('EPSG:4547 已存在或定义失败')
    }
    
    // 构建 GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      crs: {
        type: 'name',
        properties: {
          name: targetEPSG
        }
      },
      features: []
    }
    
    for (const feature of features) {
      const props = feature.getProperties()
      const properties = {
        name: props.name,
        type: props.type,
        admin_region: props.admin_region
      }
      if (layerType === 'points') {
        properties.address = props.address
        properties.capacity = props.capacity
      } else {
        properties.area = props.area
      }
      
      let geom = feature.getGeometry()
      let coordinates = geom.getCoordinates()
      
      // 坐标转换
      if (targetEPSG === 'EPSG:4326') {
        if (geom.getType() === 'Point') {
          coordinates = toLonLat(coordinates)
        } else if (geom.getType() === 'Polygon') {
          coordinates = coordinates.map(ring =>
            ring.map(coord => toLonLat(coord))
          )
        }
      } else if (targetEPSG === 'EPSG:4547') {
        if (geom.getType() === 'Point') {
          const lonlat = toLonLat(coordinates)
          console.log('原始经纬度:', lonlat)
          const result = proj4('EPSG:4326', 'EPSG:4547', [lonlat[0], lonlat[1]])
          console.log('转换后4547坐标:', result)
          coordinates = result
        } else if (geom.getType() === 'Polygon') {
          coordinates = coordinates.map(ring =>
            ring.map(coord => {
              const lonlat = toLonLat(coord)
              const result = proj4('EPSG:4326', 'EPSG:4547', [lonlat[0], lonlat[1]])
              console.log('转换后4547坐标:', result)
              return result
            })
          )
        }
      }
      
      const featureGeom = {
        type: geom.getType(),
        coordinates: coordinates
      }
      
      geojson.features.push({
        type: 'Feature',
        geometry: featureGeom,
        properties: properties
      })
    }
    
    // 下载文件
    const dataStr = JSON.stringify(geojson, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-')
    a.download = `${layerType === 'points' ? '设施点' : '设施用地'}_导出_${timestamp}.geojson`
    a.href = url
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // 取消按钮事件
  cancelBtn.onclick = closeDialog
}


// ========== 编辑功能 ==========

// 操作编辑状态函数
function toggleEditMode(feature) {
  if (!feature) return
  
  const layerType = feature.layerType
  const layerObj = layers.value[layerType]
  
  if (!layerObj.loaded) return
  
  if (!isEditing.value) {
    // 进入编辑图形模式
    isEditing.value = true

    // 获取要编辑的地图要素
    const source = layerObj.layer.getSource()
    const mapFeature = source.getFeatures().find(f => f.get('id') === feature.id)

    if(mapFeature){
      // 保存原始几何
      originalGeometry.value = mapFeature.getGeometry().clone()
      // 激活对应图层的编辑
      if (layerType === 'points') {
        pointModify.setActive(true)
      } else {
        landsModify.setActive(true)
      }
    }
  } else {
    // 退出编辑图形模式，进入编辑属性模式
    openEditForm(feature)
  }
}

// 编辑设施点
function setupPointModify(source) {
  if (pointModify) {
    map.removeInteraction(pointModify)
    pointModify = null
  }
  
  pointModify = new Modify({ source })
  
  pointModify.on('modifyend', (event) => {
    const modifiedFeature = event.features.item(0)
    const id = modifiedFeature.get('id')
    
    if (selectedFeature.value && selectedFeature.value.id === id) {
      const coords = toLonLat(modifiedFeature.getGeometry().getCoordinates())
      
      // 直接修改现有对象的 geometry 属性
      selectedFeature.value.geometry = {
        type: 'Point',
        coordinates: coords
      }
    }
  })
  
  map.addInteraction(pointModify)
  pointModify.setActive(false)
}

// 编辑设施用地
function setupLandsModify(source) {
  if (landsModify) {
    map.removeInteraction(landsModify)
    landsModify = null
  }
  
  landsModify = new Modify({ source })
  
  landsModify.on('modifyend', async (event) => {
    const modifiedFeature = event.features.item(0)
    const id = modifiedFeature.get('id')

    // 更新selectedFeature的数据，保持弹窗显示正常
    if (selectedFeature.value && selectedFeature.value.id === id) {
      const geometry = modifiedFeature.getGeometry()
      const coords4326 = geometry.getCoordinates().map(ring =>
        ring.map(coord => toLonLat(coord))
      )

      selectedFeature.value.geometry = {
        type: 'Polygon',
        coordinates: coords4326
      }
    }
  })
  
  map.addInteraction(landsModify)
  landsModify.setActive(false)
}

// 退出编辑模式函数
function exitEditMode(){
  // 退出编辑时，如果几何被修改了，就恢复到编辑前状态
  if(originalGeometry.value && selectedFeature.value){
    // 获取当前正在编辑的要素
    const layerType = selectedFeature.value.layerType
    if (layerType) {
      const layerObj = layers.value[layerType]
      const source = layerObj.layer.getSource()
      const mapFeature = source.getFeatures().find(f => f.get('id') === selectedFeature.value.id)
      if (mapFeature) {
        mapFeature.setGeometry(originalGeometry.value.clone())
      }
    }
    originalGeometry.value = null
  }

  // 关闭编辑交互
  if (pointModify) pointModify.setActive(false)
  if (landsModify) landsModify.setActive(false)
  isEditing.value = false
}

// 打开属性表单函数
function openEditForm(feature) {
  if (feature.layerType === 'points') {
    pointsForm.value = {
      name: feature.name || '',
      level: feature.level || '',
      type: feature.type || '',
      floor_area: feature.floor_area || null,
      scale: feature.scale || null
    }
    showPointForm.value = true
  } else {
    landsForm.value = {
      name: feature.name || '',
      type: feature.type || '',
      site_area: feature.site_area || null
    }
    showLandsForm.value = true
  }
}


// ========== 数据表单与属性保存 ==========
// 公共设施数据保存函数
async function savePointToDatabase() {
  try {
    if (!pointsForm.value.name) return

    // 判断是否为导入模式
    if (window._tempImportGeometry) {
      const { type, coordinates, layerType } = window._tempImportGeometry
      
      if (!pointsForm.value.name) {
        alert('请输入名称')
        return
      }
      
      let finalCoordinates = type === 'Point' 
        ? [Number(coordinates[0]), Number(coordinates[1])]
        : coordinates
      
      const response = await createPoints({
        name: pointsForm.value.name,
        level: pointsForm.value.level,
        type: pointsForm.value.type,
        floor_area: pointsForm.value.floor_area || 0,
        scale: pointsForm.value.scale || 0,
        geometry: { type, coordinates: finalCoordinates }
      })
      
      if (response.success) {
        // 刷新图层
        const layerObj = layers.value[layerType]
        if (layerObj.loaded) {
          const bbox = getMapBbox(map)
          await vectorStore.loadPoints(bbox)
          updateVectorLayer(layerType)
        }
        alert('导入成功！')
        showPointForm.value = false
        pointsForm.value = { name: '', type: '', address: '', capacity: null, admin_region: '' }
        
        // 触发下一个要素
        if (window._resolveImport) window._resolveImport()
      }
      return
    }

    // 判断是编辑还是新增
    if (selectedFeature.value && selectedFeature.value.id) {
      // ========== 编辑现有设施 ==========
      const id = selectedFeature.value.id

      // 获取当前几何（可能已被拖动修改）
      const source = layers.value.points.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === id)

      // 获取最新几何坐标
      let geometry = selectedFeature.value.geometry
      if (feature) {
        const coords = toLonLat(feature.getGeometry().getCoordinates())
        geometry = {
          type: 'Point',
          coordinates: coords
        }
      }

      const updateData = {
        name: pointsForm.value.name,
        level: pointsForm.value.level,
        type: pointsForm.value.type,
        floor_area: pointsForm.value.floor_area || 0,
        scale: pointsForm.value.scale || 0,
        geometry: geometry
      }

      const response = await updatePoints(id, updateData)

      if (response.success) {
        // 更新地图要素的属性
        if (feature) {
          // 更新几何（保持修改后的状态）
          const currentGeom = feature.getGeometry()
          feature.setGeometry(currentGeom.clone())

          // 更新属性
          feature.set('name', pointsForm.value.name)
          feature.set('level', pointsForm.value.level)
          feature.set('type', pointsForm.value.type)
          feature.set('floor_area', pointsForm.value.floor_area)
          feature.set('scale', pointsForm.value.scale)
        }

        // 更新 store
        const index = vectorStore.points.findIndex(p => p.id === id)
        if (index !== -1) {
          vectorStore.points[index] = {
            ...vectorStore.points[index],
            ...updateData,
            id: id
          }
        }

        // 更新弹窗显示
        selectedFeature.value = {
          ...selectedFeature.value,
          ...updateData,
          id: id
        }

        alert('更新成功！')

        // 关闭编辑交互
        if (pointModify) pointModify.setActive(false)

        // 关闭要素弹窗（但不触发 exitEditMode）
        selectedFeature.value = null
        popupPosition.value = null

        // 清理编辑状态（几何已正确保存，不再需要原始几何）
        isEditing.value = false
        originalGeometry.value = null

        // 关闭属性表单
        showPointForm.value = false
      }
    } else {
      // ========== 创建新设施 ==========
      if (!drawFeature) return

      const response = await createPoints({
        name: pointsForm.value.name,
        level: pointsForm.value.level,
        type: pointsForm.value.type,
        floor_area: pointsForm.value.floor_area || 0,
        scale: pointsForm.value.scale || 0,
        geometry: {
          type: 'Point',
          coordinates: toLonLat(drawFeature.getGeometry().getCoordinates())
        }
      })

      if (response.success) {
        // 将新要素添加到地图
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

        alert('添加成功！')
        cancelDraw() // 关闭表单并清理绘制状态
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败：' + error.message)
  }
}

// 土地利用数据保存函数
async function saveLandsToDatabase() {
  try {
    if (!landsForm.value.name) return

    // 判断是否为导入模式
    if (window._tempImportGeometry) {
      const { type, coordinates, layerType } = window._tempImportGeometry
      
      if (!landsForm.value.name) {
        alert('请输入名称')
        return
      }
      
      // 【关键】确保坐标是数字类型，去除可能的多余维度
      let finalCoordinates = coordinates
      if (type === 'Polygon') {
        finalCoordinates = coordinates.map(ring =>
          ring.map(point => [Number(point[0]), Number(point[1])])
        )
      } else if (type === 'Point') {
        finalCoordinates = [Number(coordinates[0]), Number(coordinates[1])]
      }
      
      // 打印最终要发送的数据
      const postData = {
        name: landsForm.value.name,
        type: landsForm.value.type,
        site_area: landsForm.value.site_area || 0,
        geometry: { 
          type: type, 
          coordinates: finalCoordinates 
        }
      }
      console.log('发送数据:', JSON.stringify(postData, null, 2))
      
      try {
        const response = await createLands(postData)
        
        if (response && response.success) {
          // 刷新图层
          const layerObj = layers.value[layerType]
          if (layerObj && layerObj.loaded) {
            const bbox = getMapBbox(map)
            await vectorStore.loadLands(bbox)
            updateVectorLayer(layerType)
          }
          alert('导入成功！')
          showLandsForm.value = false
          landsForm.value = { name: '', type: '', site_area: null }
          
          delete window._tempImportGeometry
          if (window._resolveImport) window._resolveImport()
        } else {
          console.error('导入失败:', response)
          alert(`导入失败: ${response?.message || '未知错误'}`)
        }
      } catch (error) {
        console.error('导入异常:', error)
        alert(`导入异常: ${error.message}`)
      }
      return
    }

    // 判断是编辑还是新增
    if (selectedFeature.value && selectedFeature.value.id) {
      // ========== 编辑现有用地 ==========
      const id = selectedFeature.value.id

      // 获取当前几何（可能已被拖动修改）
      const source = layers.value.lands.layer?.getSource()
      const feature = source?.getFeatures().find(f => f.get('id') === id)

      // 获取最新几何坐标
      let geometry = selectedFeature.value.geometry
      if (feature) {
        const geometry3857 = feature.getGeometry()
        const coords4326 = geometry3857.getCoordinates().map(ring =>
          ring.map(coord => toLonLat(coord))
        )
        geometry = {
          type: 'Polygon',
          coordinates: coords4326
        }
      }

      const updateData = {
        name: landsForm.value.name,
        type: landsForm.value.type,
        site_area: landsForm.value.area || 0,
        geometry: geometry
      }

      const response = await updateLands(id, updateData)

      if (response.success) {
        // 更新地图要素的属性
        if (feature) {
          feature.set('name', landsForm.value.name)
          feature.set('type', landsForm.value.type)
          feature.set('site_area', landsForm.value.site_area)
        }

        // 更新 store
        const index = vectorStore.lands.findIndex(l => l.id === id)
        if (index !== -1) {
          vectorStore.lands[index] = {
            ...vectorStore.lands[index],
            ...updateData,
            id: id
          }
        }

        // 更新弹窗显示
        selectedFeature.value = {
          ...selectedFeature.value,
          ...updateData,
          id: id
        }

        alert('更新成功！')

        // 关闭编辑交互
        if (landsModify) landsModify.setActive(false)

        // 关闭要素弹窗（但不触发 exitEditMode）
        selectedFeature.value = null
        popupPosition.value = null

        // 清理编辑状态（几何已正确保存，不再需要原始几何）
        isEditing.value = false
        originalGeometry.value = null

        // 关闭属性表单
        showLandsForm.value = false
      }
    } else {
      // ========== 创建新用地 ==========
      if (!drawFeature) return

      const response = await createLands({
        name: landsForm.value.name,
        type: landsForm.value.type,
        site_area: landsForm.value.site_area || 0,
        geometry: {
          type: 'Polygon',
          coordinates: drawFeature.getGeometry().getCoordinates().map(ring =>
            ring.map(coord => toLonLat(coord))
          )
        }
      })

      if (response.success) {
        // 将新要素添加到地图
        const newFeature = drawFeature.clone()
        newFeature.set('id', response.data.id)
        newFeature.set('name', landsForm.value.name)
        newFeature.set('type', landsForm.value.type)
        newFeature.set('site_area', landsForm.value.site_area)
        newFeature.set('layerType', 'lands')

        layers.value.lands.layer?.getSource()?.addFeature(newFeature)
        vectorStore.lands.push(response.data)

        alert('添加成功！')
        cancelDraw()
      }
    }
  } catch (error) {
    console.error('保存失败:', error)
    alert('保存失败：' + error.message)
  }
}

// ========== 删除功能 ==========
async function deleteFeature(featureId) {
  if (!selectedFeature.value) return
  
  const layerType = selectedFeature.value.layerType
  const featureName = layerType === 'points' ? '设施' : '图形'
  if (!confirm(`确定要删除这个${featureName}吗？`)) return
  
  try {
    if (layerType === 'points') {
      await deletePoints(featureId)
    } else if (layerType === 'lands') {
      await deleteLands(featureId)
    }
    
    const source = layers.value[layerType]?.layer?.getSource()
    const feature = source?.getFeatures().find(f => f.get('id') === featureId)
    if (feature) source.removeFeature(feature)
    
    if (layerType === 'points') {
      vectorStore.points = vectorStore.points.filter(item => item.id !== featureId)
    } else {
      vectorStore.lands = vectorStore.lands.filter(item => item.id !== featureId)
    }
    
    closePopup()
    alert('删除成功')
    
  } catch (error) {
    console.error('删除API调用失败:', error)
    alert('后端删除API未实现，刷新页面后会恢复')
    
    const source = layers.value[layerType]?.layer?.getSource()
    const feature = source?.getFeatures().find(f => f.get('id') === featureId)
    if (feature) source.removeFeature(feature)
    closePopup()
  }
}

// ========== 交互设置 ==========
function setupMapInteractions() {
  map.on('click', (event) => {
    if(showLandsForm.value || isDrawing.value || showPointForm.value || isEditing.value) return

    const features = map.getFeaturesAtPixel(event.pixel)

    if(features.length > 0) {
      // 每次点击都重新获取要素属性
      const feature = features[0]
      const properties = feature.getProperties()
      // 如果处于编辑模式且点击的要素是当前正在编辑的要素，则不做任何操作，保持编辑状态
      if (isEditing.value && selectedFeature.value && selectedFeature.value.id === properties.id) {
        return
      }
      // 如果之前处于编辑模式，且点击了其他要素，退出编辑
      if(isEditing.value){
        exitEditMode()
      }
      selectedFeature.value = properties
      popupPosition.value = { x: event.pixel[0] + 20, y: event.pixel[1] }
    } else {
      closePopup()
    }
  })

  map.on('pointermove', (event) => {
    const hit = map.hasFeatureAtPixel(event.pixel)
    map.getTargetElement().style.cursor = hit ? 'pointer' : ''
  })
}

// ========== 工具函数 ==========
function closePopup() {
  // 如何正在编辑模式，放弃编辑并恢复到编辑前状态
  if (isEditing.value) {
    exitEditMode()
    return  // 编辑模式下不清空selectedFeature，确保弹窗数据正常
  }
  selectedFeature.value = null
  popupPosition.value = null
}

// 取消绘制函数
function cancelDraw() {
  // 如果正在导入模式，跳过当前要素
  if (window._tempImportGeometry && window._resolveImport) {
    showLandsForm.value = false
    showPointForm.value = false
    const resolve = window._resolveImport
    delete window._tempImportGeometry
    delete window._resolveImport
    if (resolve) resolve()
    return
  }
  
  showLandsForm.value = false
  showPointForm.value = false
  landsForm.value = { name: '', type: '', site_area: null }
  pointsForm.value = { name: '', level: '', type: '', floor_area: null, scale: null }
  drawFeature = null
  isDrawing.value = false
  
  // 【新增】清理绘制时的键盘监听
  if (window._drawEscHandler) {
    document.removeEventListener('keydown', window._drawEscHandler)
    delete window._drawEscHandler
  }
  if (window._drawUndoHandler) {
    document.removeEventListener('keydown', window._drawUndoHandler)
    delete window._drawUndoHandler
  }
  
  if (drawInteraction) {
    map.removeInteraction(drawInteraction)
    drawInteraction = null
  }
  if (drawLayer) {
    map.removeLayer(drawLayer)
    drawLayer = null
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  if (!mapContainer.value) return
  initMap()

  // 添加ECS键盘监听
  escHandler = (e) => {
    if (e.key === 'Escape' && isEditing.value) {
      // 只在图形编辑模式且没有打开表单时处理
      if(isEditing.value && !showPointForm.value && !showLandsForm.value) {
        exitEditMode()
        closePopup()
      }
    }
  }
  document.addEventListener('keydown', escHandler)
})

onUnmounted(() => {
  // 移除ECS键盘监听
  if (escHandler) {
    document.removeEventListener('keydown', escHandler)
  }

  if(map) {
    map.setTarget(null)
    map = null
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

.draw-hint {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 1000;
  pointer-events: none;
}
.draw-hint kbd {
  background: #333;
  padding: 2px 6px;
  border-radius: 4px;
  margin: 0 2px;
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
  margin: 1px 0;
  color: #52c41a;
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