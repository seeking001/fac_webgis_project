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
          <button @click="startDrawing(key)" :disabled="!config.visible">绘制添加</button>
        </div>
      </div>
    </div>

    <!-- 右侧边栏：信息显示 -->
    <div class="right_sidebar">
      <h3>信息显示</h3>
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
          <p><strong>类型：</strong>{{ selectedFeature.type }}</p>
          <p><strong>地址：</strong>{{ selectedFeature.address }}</p>
          <p><strong>建筑面积：</strong>{{ selectedFeature.capacity }}平方米</p>
          <p><strong>行政区：</strong>{{ selectedFeature.admin_region }}</p>
        </div>
        <div v-else>
          <p><strong>用地类型：</strong>{{ selectedFeature.type }}</p>
          <p><strong>用地面积：</strong>{{ selectedFeature.area }}平方米</p>
          <p><strong>行政区：</strong>{{ selectedFeature.admin_region }}</p>
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

    <!-- 公共设施表单弹窗 -->
    <div v-if="showPointForm" class="point-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ isEditing ? '编辑公共设施' : '添加公共设施' }}</h4>
        <form @submit.prevent="savePointToDatabase">
          <div class="form-group">
            <label>名称：</label>
            <input v-model="pointsForm.name" required placeholder="例如：龙华中学">
          </div>
          <div class="form-group">
            <label>类型：</label>
            <select v-model="pointsForm.type" required>
              <option value="">请选择类型</option>
              <option value="学校">学校</option>
              <option value="医院">医院</option>
              <option value="图书馆">图书馆</option>
              <option value="体育馆">体育馆</option>
              <option value="公园">公园</option>
            </select>
          </div>
          <div class="form-group">
            <label>地址：</label>
            <input v-model="pointsForm.address" required placeholder="详细地址">
          </div>
          <div class="form-group">
            <label>建筑面积（平方米）：</label>
            <input v-model="pointsForm.capacity" type="number" required placeholder="手动输入">
          </div>
          <div class="form-group">
            <label>行政区：</label>
            <select v-model="pointsForm.admin_region" required>
              <option value="">请选择区域</option>
              <option value="福田区">福田区</option>
              <option value="南山区">南山区</option>
              <option value="罗湖区">罗湖区</option>
              <option value="宝安区">宝安区</option>
              <option value="龙华区">龙华区</option>
              <option value="光明区">光明区</option>
            </select>
          </div>
          <div class="form-buttons">
            <button type="button" @click="cancelDraw" class="btn-cancel">取消</button>
            <button type="submit" class="btn-save">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 土地利用表单弹窗 -->
    <div v-if="showLandsForm" class="lands-form">
      <div class="form-overlay" @click="cancelDraw"></div>
      <div class="form-content">
        <h4>{{ isEditing ? '编辑土地利用' : '添加土地利用' }}</h4>
        <form @submit.prevent="saveLandsToDatabase">
          <div class="form-group">
            <label>名称：</label>
            <input v-model="landsForm.name" type="text" placeholder="例如：福田居住区" required>
          </div>
          <div class="form-group">
            <label>用地类型：</label>
            <select v-model="landsForm.type" required>
              <option value="">请选择类型</option>
              <option value="商业用地">商业用地</option>
              <option value="居住用地">居住用地</option>
              <option value="工业用地">工业用地</option>
              <option value="公园绿地">公园绿地</option>
            </select>
          </div>
          <div class="form-group">
            <label>行政区：</label>
            <select v-model="landsForm.admin_region" required>
              <option value="">请选择区域</option>
              <option value="福田区">福田区</option>
              <option value="南山区">南山区</option>
              <option value="罗湖区">罗湖区</option>
              <option value="宝安区">宝安区</option>
              <option value="龙华区">龙华区</option>
              <option value="光明区">光明区</option>
            </select>
          </div>
          <div class="form-group">
            <label>用地面积（平方米）：</label>
            <input v-model="landsForm.area" type="number" placeholder="手动输入" required>
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
import { fromLonLat, toLonLat } from 'ol/proj'
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

// 表单数据
const pointsForm = ref({
  name: '',
  type: '',
  address: '',
  capacity: null,
  admin_region: ''
})
const landsForm = ref({
  name: '',
  type: '',
  admin_region: '',
  area: null
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
      { label: '学校', value: '学校' },
      { label: '医院', value: '医院' },
      { label: '图书馆', value: '图书馆' },
      { label: '体育馆', value: '体育馆' },
      { label: '公园', value: '公园' }
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
      { label: '公园绿地', value: '公园绿地' }
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
    
    const feature = new Feature({
      geometry: geom,
      id: item.id,
      name: item.name,
      type: item.type,
      layerType: layerKey,
      address: item.address,
      capacity: item.capacity,
      admin_region: item.admin_region,
      area: item.area
    })
    source.addFeature(feature)
  })

  // 移除旧图层
  if (layerObj.layer) map.removeLayer(layerObj.layer)
  
  // 添加新图层
  layerObj.layer = new VectorLayer({
    source,
    style: styleFunc,
    visible: layerObj.visible,
    zIndex: 2
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
    学校: '🎓',
    医院: '🏥',
    图书馆: '📖',
    体育馆: '🏀',
    公园: '🌳',
    警察局: '👮',
    消防站: '🚒',
    停车场: '🅿️'
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
}

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
  
  // pointModify.on('modifyend', async (event) => {
  //   const modifiedFeature = event.features.item(0)
  //   const id = modifiedFeature.get('id')
    
  //   try {
  //     const coords = toLonLat(modifiedFeature.getGeometry().getCoordinates())
  //     const updateData = {
  //       name: modifiedFeature.get('name') || '未命名设施',
  //       type: modifiedFeature.get('type') || '学校',
  //       address: modifiedFeature.get('address') || '',
  //       capacity: modifiedFeature.get('capacity') || 0,
  //       admin_region: modifiedFeature.get('admin_region') || '龙华区',
  //       geometry: {
  //         type: 'Point',
  //         coordinates: coords
  //       }
  //     }
      
  //     await updatePoints(id, updateData)
  //     console.log('✅ 设施位置已保存')

  //     // 更新store后，更新保存的原始几何
  //     if (isEditing.value && originalGeometry.value) {
  //       originalGeometry.value = modifiedFeature.getGeometry().clone()
  //     }
  //   } catch (error) {
  //     console.log('保存失败', error)
  //   }
  // })
  
  map.addInteraction(pointModify)
  pointModify.setActive(layers.value.points.editable || false)
}

// 编辑设施用地
function setupLandsModify(source) {
  if (landsModify) {
    map.removeInteraction(landsModify)
    landsModify = null
  }
  
  landsModify = new Modify({ source })
  
  // landsModify.on('modifyend', async (event) => {
  //   const modifiedFeature = event.features.item(0)
  //   const id = modifiedFeature.get('id')

  //   try {
  //     const geometry = modifiedFeature.getGeometry()
  //     const coords3857 = geometry.getCoordinates()
  //     const coords4326 = coords3857.map(ring => 
  //       ring.map(coord => toLonLat(coord))
  //     )

  //     const updateData = {
  //       name: modifiedFeature.get('name') || '未命名地块',
  //       type: modifiedFeature.get('type') || '居住用地',
  //       admin_region: modifiedFeature.get('admin_region') || '龙华区',
  //       area: modifiedFeature.get('area') || 0,
  //       geometry: {
  //         type: 'Polygon',
  //         coordinates: coords4326
  //       }
  //     }
    
  //     await updateLands(id, updateData)
  //     console.log('✅ 保存成功')

  //     // 更新store后，更新保存的原始几何
  //     if (isEditing.value && originalGeometry.value) {
  //       originalGeometry.value = modifiedFeature.getGeometry().clone()
  //     }
  //   } catch (error) {
  //     console.log('保存失败', error)
  //   }
  // })
  
  map.addInteraction(landsModify)
  landsModify.setActive(layers.value.lands.editable)
}

// 退出编辑模式函数
function exitEditMode(){
  // 退出编辑时，如何几何被修改了，就恢复到编辑前状态
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
      type: feature.type || '',
      address: feature.address || '',
      capacity: feature.capacity || null,
      admin_region: feature.admin_region || ''
    }
    showPointForm.value = true
  } else {
    landsForm.value = {
      name: feature.name || '',
      type: feature.type || '',
      admin_region: feature.admin_region || '',
      area: feature.area || null
    }
    showLandsForm.value = true
  }
}


// ========== 数据表单与属性保存 ==========
// 公共设施数据保存函数
async function savePointToDatabase() {
  try {
    if (!pointsForm.value.name) return

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
        type: pointsForm.value.type,
        address: pointsForm.value.address,
        capacity: pointsForm.value.capacity || 0,
        admin_region: pointsForm.value.admin_region,
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
          feature.set('type', pointsForm.value.type)
          feature.set('address', pointsForm.value.address)
          feature.set('capacity', pointsForm.value.capacity)
          feature.set('admin_region', pointsForm.value.admin_region)
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
        type: pointsForm.value.type,
        address: pointsForm.value.address,
        capacity: pointsForm.value.capacity || 0,
        admin_region: pointsForm.value.admin_region,
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
        newFeature.set('type', pointsForm.value.type)
        newFeature.set('address', pointsForm.value.address)
        newFeature.set('capacity', pointsForm.value.capacity)
        newFeature.set('admin_region', pointsForm.value.admin_region)
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
        admin_region: landsForm.value.admin_region,
        area: landsForm.value.area || 0,
        geometry: geometry
      }

      const response = await updateLands(id, updateData)

      if (response.success) {
        // 更新地图要素的属性
        if (feature) {
          feature.set('name', landsForm.value.name)
          feature.set('type', landsForm.value.type)
          feature.set('admin_region', landsForm.value.admin_region)
          feature.set('area', landsForm.value.area)
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
        geometry: {
          type: 'Polygon',
          coordinates: drawFeature.getGeometry().getCoordinates().map(ring =>
            ring.map(coord => toLonLat(coord))
          )
        },
        area: landsForm.value.area || 0,
        admin_region: landsForm.value.admin_region || '龙华区'
      })

      if (response.success) {
        // 将新要素添加到地图
        const newFeature = drawFeature.clone()
        newFeature.set('id', response.data.id)
        newFeature.set('name', landsForm.value.name)
        newFeature.set('type', landsForm.value.type)
        newFeature.set('admin_region', landsForm.value.admin_region)
        newFeature.set('area', landsForm.value.area)
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
    if(showLandsForm.value || isDrawing.value || showPointForm.value) return

    const features = map.getFeaturesAtPixel(event.pixel)

    if(features.length > 0) {
      // 如果之前处于编辑模式，退出编辑
      if(isEditing.value){
        exitEditMode()
      }
      selectedFeature.value = features[0].getProperties()
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
  }
  selectedFeature.value = null
  popupPosition.value = null
}

function cancelDraw() {
  showLandsForm.value = false
  showPointForm.value = false
  landsForm.value = { name: '', type: '', admin_region: '', area: null }
  pointsForm.value = { name: '', type: '', address: '', capacity: null, admin_region: '' }
  drawFeature = null
  isDrawing.value = false
  
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
      exitEditMode()
      closePopup()
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
  flex: 1;
  padding: 3px 6px;
  background: rgba(50, 0, 100, 0.5);
  font-size: 12px;
  color: white;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}

.edit-btn:hover {
  background: rgb(50, 0, 100);
}

.edit-btn.active {
  background: rgb(100, 50, 200);
}

.delete-btn {
  margin-top: 5px;
  padding: 1px 6px;
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