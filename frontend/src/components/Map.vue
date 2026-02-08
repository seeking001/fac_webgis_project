<template>
  <div class="map-wrapper">
    <div class="map-content">
      <!-- 地图容器 -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- 底图切换控件 -->
      <div class="basemap-switcher" @mouseenter="basemapPanelVisible = true" @mouseleave="basemapPanelVisible = false">
        <button class="basemap-main-btn">
          {{ getActiveBasemap.name }}
        </button>
        
        <transition name="slide-down">
          <div class="basemap-panel" v-if="basemapPanelVisible">
            <div class="basemap-item" v-for="item in basemaps" :key="item.id" :class="{ 'active': item.id === activeBasemapId }" @click="switchBasemap(item.id)">
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
        
        <!-- 图形操作按钮 -->
        <div class="layer-panel" v-for="(config, key) in layers" :key="key">
          <h4>{{ config.name }}</h4>
          
          <!-- 1. 加载与显示控制 -->
          <div class="control-group">
            <input type="checkbox" v-model="config.visible" @change="toggleLayer(key)">
            <span>加载显示</span>
            <select 
              v-model="config.selectedType" 
              @change="onTypeChange(key)"
              :disabled="!config.visible"
            >
              <option v-for="type in config.types" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </div>
          
          <!-- 2. 绘制与编辑图形 -->
          <div class="control-group">
            <button @click="startDrawing(key)" :disabled="!config.visible">
              绘制添加
            </button>
            <button @click="toggleEditMode(key)" 
                    :class="{ 'active': config.editable }"
                    :disabled="!config.visible || !config.loaded">
              {{ config.editable ? '结束编辑' : '编辑图形' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧边栏 -->
      <div class="right_sidebar">
        <h3>信息显示</h3>

        <div class="status-info">
          <h4>加载状态</h4>
          <div v-for="(config, key) in layers">
            <span v-if="config.loaded">
              ✅ {{ config.name }}: {{ key === 'facilities' ? facilitiesCount : landUseCount }} 个
            </span>
            <span v-else>◻️ {{ config.name }}: 未加载</span>
          </div>
        </div>
      </div>
      
      <!-- 点击设施要素弹窗 -->
      <div v-if="selectedFeature && popupPosition" :style="{left: popupPosition.x + 'px', top: popupPosition.y + 'px'}" class="feature-popup">
        <div class="popup-content">
          <button @click="closePopup" class="close-btn">x</button>
          <h4>{{ selectedFeature.name }}</h4>
          <div v-if="selectedFeature.layerType === 'facilities'">
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
          <button v-if="selectedFeature" 
                  @click="deleteFeature(selectedFeature.id)"
                  class="delete-btn">
            删除{{ selectedFeature.layerType === 'facilities' ? '设施' : '用地' }}
          </button>
        </div>
      </div>

      <!-- 添加公共设施属性表单弹窗 -->
      <div v-if="showFacilityForm" class="facility-form">
        <div class="form-overlay" @click="cancelDraw"></div>
        <div class="form-content">
          <h4>添加公共设施</h4>
          <form @submit.prevent="saveFacilityToDatabase">
            <div class="form-group">
              <label>名称：</label>
              <input v-model="facilityForm.name" required placeholder="例如：龙华中学">
            </div>

            <div class="form-group">
              <label>类型：</label>
              <select v-model="facilityForm.type" required>
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
              <input v-model="facilityForm.address" required placeholder="详细地址">
            </div>

            <div class="form-group">
              <label>建筑面积（平方米）：</label>
              <input v-model="facilityForm.capacity" type="number" required placeholder="手动输入">
            </div>

            <div class="form-group">
              <label>行政区：</label>
              <select v-model="facilityForm.admin_region" required>
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

      <!-- 添加土地利用属性表单弹窗 -->
      <div v-if="showLandUseForm" class="landuse-form">
        <div class="form-overlay" @click="cancelDraw"></div>
        <div class="form-content">
          <h4>添加土地利用</h4>
          <form @submit.prevent="saveLandUseToDatabase">
            <div class="form-group">
              <label>名称：</label>
              <input
                v-model="landUseForm.name"
                type="text"
                placeholder="例如：福田居住区"
                required
              >
            </div>

            <div class="form-group">
              <label>用地类型：</label>
              <select v-model="landUseForm.type" required>
                <option value="">请选择类型</option>
                <option value="商业用地">商业用地</option>
                <option value="居住用地">居住用地</option>
                <option value="工业用地">工业用地</option>
                <option value="公园绿地">公园绿地</option>
              </select>
            </div>

            <div class="form-group">
              <label>行政区：</label>
              <select v-model="landUseForm.admin_region" required>
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
              <input
                v-model="landUseForm.area"
                type="number"
                placeholder="手动输入"
                required
              >
            </div>

            <div class="form-buttons">
              <button type="button" @click="cancelDraw" class="btn-cancel">取消</button>
              <button type="submit" class="btn-save">保存</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue'
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

import { useMapDataStore } from '../stores/mapData'
import { getMapBbox } from '../utils/mapHelpers'
import { createFacility, updateFacility, deleteFacility, createLandUse, updateLandUse, deleteLandUse } from '../services/api'

const mapContainer = ref(null)
let map = null

const selectedFeature = ref(null)
const popupPosition = ref(null)
const showFacilityForm = ref(false)
const showLandUseForm = ref(false)
const isDrawing = ref(false)
const facilityForm = ref({
  name: '',
  type: '',
  address: '',
  capacity: null,
  admin_region: ''
})
const landUseForm = ref({
  name: '',
  type: '',
  admin_region: '',
  area: null
});
let drawFeature = null
let drawInteraction = null
let drawLayer = null
let facilityModify = null
let landUseModify = null

const mapDataStore = useMapDataStore()

const basemaps = ref([
  {
    id: 'vector',
    name: '普通地图',
    layer: null,
    url: 'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    hasRoadNet: true,
    roadNetVisible: true,
    roadNetUrl: 'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    roadNetLayer: null
  },
  {
    id: 'satellite',
    name: '卫星地图',
    layer: null,
    url: 'http://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    hasRoadNet: true,
    roadNetVisible: true,
    roadNetUrl: 'http://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    roadNetLayer: null
  },
  {
    id: '3d',
    name: '三维地图',
    layer: null,
    url: null,
    hasRoadNet: false,
    roadNetVisible: false,
    roadNetUrl: null,
    roadNetLayer: null
  }
]);

const activeBasemapId = ref('vector');
const basemapPanelVisible = ref(false);

const layers = ref({
  facilities: {
    name: '公共设施',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: 'all',
    drawType: 'Point',
    editable: false,
    types: [
      { label: '全部类型', value: 'all' },
      { label: '学校', value: '学校' },
      { label: '医院', value: '医院' },
      { label: '图书馆', value: '图书馆' },
      { label: '体育馆', value: '体育馆' },
      { label: '公园', value: '公园' }
    ]
  },
  landUse: {
    name: '土地利用',
    visible: false,
    loaded: false,
    layer: null,
    selectedType: 'all',
    drawType: 'Polygon',
    editable: false,
    types: [
      { label: '全部类型', value: 'all' },
      { label: '商业用地', value: '商业用地' },
      { label: '居住用地', value: '居住用地' },
      { label: '工业用地', value: '工业用地' },
      { label: '公园绿地', value: '公园绿地' }
    ]
  }
});

const facilitiesCount = computed(() => mapDataStore.facilities.length);
const landUseCount = computed(() => mapDataStore.landUse.length);

// 创建初始化地图
const initMap = () => {
  if (!mapContainer.value) return;

  // 初始底图
  const initLayer = new TileLayer({
    source: new XYZ({
      url: basemaps.value[0].url,
      wrapX: false,
      crossOrigin: 'anonymous'
    })
  });

  // 初始路网
  const initRoadLayer = new TileLayer({
    source: new XYZ({
      url: basemaps.value[0].roadNetUrl,
      wrapX: false,
      crossOrigin: 'anonymous'
    })
  });
  
  map = new Map({
    target: mapContainer.value,
    layers: [initLayer, initRoadLayer],
    view: new View({
      center: fromLonLat([114.00, 22.55]),
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
  });
  
  basemaps.value[0].layer = initLayer;
  basemaps.value[0].roadNetLayer = initRoadLayer;
  
  // 设置交互
  setupMapInteractions();
};

// 定义激活地图
const getActiveBasemap = computed(() => {
  return basemaps.value.find(b => b.id === activeBasemapId.value);
});

// 切换地图函数
function switchBasemap(basemapId) {
  if (!map) return;
  if (activeBasemapId.value === basemapId) return;
  
  if (basemapId === '3d') {
    alert('三维地图功能正在开发中…');
    return;
  }
  
  // 1. 移除所有瓦片图层
  const oldLayers = map.getLayers().getArray().filter(layer => layer instanceof TileLayer);
  oldLayers.forEach(layer => {
    map.removeLayer(layer);
  });
  
  // 创建新地图
  const newBasemap = basemaps.value.find(b => b.id === basemapId);
  // 2. 添加地图
  const baseLayer = new TileLayer({
    source: new XYZ({
      url: newBasemap.url,
      wrapX: false,
      crossOrigin: 'anonymous'
    }),
    zIndex: 0
  });
  map.addLayer(baseLayer);
  newBasemap.layer = baseLayer;
  
  // 3. 添加路网
  const roadLayer = new TileLayer({
    source: new XYZ({
      url: newBasemap.roadNetUrl,
      wrapX: false,
      crossOrigin: 'anonymous'
    }),
    visible: newBasemap.roadNetVisible,
    zIndex: 1
  });
  map.addLayer(roadLayer);
  newBasemap.roadNetLayer = roadLayer;
  
  activeBasemapId.value = basemapId;
}

// 切换路网可见性函数
function toggleRoadNet(basemap) {
  basemap.roadNetLayer.setVisible(basemap.roadNetVisible);
}

function getThumbColor(id) {
  const colors = { vector: '#4CAF50', satellite: '#795548', '3d': '#2196F3' };
  return colors[id] || '#ccc';
}

async function toggleLayer(layerKey) {
  const layerObj = layers.value[layerKey];
  if (layerObj.visible && !layerObj.loaded) {
    const bbox = getMapBbox(map);
    if (layerKey === 'facilities') {
      await mapDataStore.loadFacilities(bbox);
    } else {
      await mapDataStore.loadLandUse(bbox);
    }
    layerObj.loaded = true;
    updateVectorLayer(layerKey);
  } else if (layerObj.layer) {
    layerObj.layer.setVisible(layerObj.visible);
  }
}

function updateVectorLayer(layerKey) {
  const layerObj = layers.value[layerKey];
  const storeData = layerKey === 'facilities' ? mapDataStore.facilities : mapDataStore.landUse;
  const styleFunc = layerKey === 'facilities' ? createFacilityStyle : createLandUseStyle;
  const isPoint = layerKey === 'facilities';

  const filteredData = layerObj.selectedType === 'all' 
    ? storeData 
    : storeData.filter(item => item.type === layerObj.selectedType);

  const source = new VectorSource();
  filteredData.forEach(item => {
    const geom = isPoint 
      ? new Point(fromLonLat(item.geometry.coordinates))
      : new Polygon(item.geometry.coordinates).transform('EPSG:4326', 'EPSG:3857');
    
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
    });
    source.addFeature(feature);
  });

  if (layerObj.layer) map.removeLayer(layerObj.layer);
  
  layerObj.layer = new VectorLayer({
    source,
    style: styleFunc,
    visible: layerObj.visible,
    zIndex: 2
  });
  
  map.addLayer(layerObj.layer);

  // 公共设施编辑功能
  if (layerKey === 'facilities') {
    if (facilityModify) {
      map.removeInteraction(facilityModify);
      facilityModify = null;
    }
    
    facilityModify = new Modify({ source: source });
    
    // 编辑完成保存
    facilityModify.on('modifyend', async (event) => {
      const modifiedFeature = event.features.item(0);
      const id = modifiedFeature.get('id');
      
      try {
        const coords = toLonLat(modifiedFeature.getGeometry().getCoordinates());
        const updateData = {
          name: modifiedFeature.get('name') || '未命名设施',
          type: modifiedFeature.get('type') || '学校',
          address: modifiedFeature.get('address') || '',
          capacity: modifiedFeature.get('capacity') || 0,
          admin_region: modifiedFeature.get('admin_region') || '龙华区',
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        };
        
        await updateFacility(id, updateData);
        console.log('✅ 设施位置已保存');
      } catch (error) {
        console.log('保存失败', error);
      }
    });
    
    map.addInteraction(facilityModify);
    facilityModify.setActive(layers.value.facilities.editable || false);
  }
  
  // 土地利用编辑功能
  if (layerKey === 'landUse') {
    if (landUseModify) {
      map.removeInteraction(landUseModify);
      landUseModify = null;
    }
    
    landUseModify = new Modify({ source: source });
    
    landUseModify.on('modifyend', async (event) => {
      const modifiedFeature = event.features.item(0);
      const id = modifiedFeature.get('id');

      try {
        // 获取当前几何（EPSG:3857）
        const geometry = modifiedFeature.getGeometry();
        const coords3857 = geometry.getCoordinates();
        
        // **关键：将坐标转换为 EPSG:4326（经纬度）**
        const coords4326 = coords3857.map(ring => 
          ring.map(coord => toLonLat(coord))
        );

        // 获取要素所有属性
        const updateData = {
          name: modifiedFeature.get('name') || '未命名地块',
          type: modifiedFeature.get('type') || '居住用地',
          admin_region: modifiedFeature.get('admin_region') || '龙华区',
          area: modifiedFeature.get('area') || 0,
          geometry: {
            type: 'Polygon',
            coordinates: coords4326
          }
        };
      
        // 调用API保存
        await updateLandUse(id, updateData);
        console.log('✅ 保存成功');
      } catch (error) {
        console.log('保存失败', error);
      }
    });
    
    map.addInteraction(landUseModify);
    landUseModify.setActive(layerObj.editable);
  }
}

// 删除图形函数
async function deleteFeature(featureId) {
  if (!selectedFeature.value) return;
  
  const layerType = selectedFeature.value.layerType;
  const featureName = layerType === 'facilities' ? '设施' : '图形';
  if (!confirm(`确定要删除这个${featureName}吗？`)) return;
  
  try {
    // 根据类型调用不同的API
    if (layerType === 'landUse') {
      await deleteLandUse(featureId);
    } else if (layerType === 'facilities') {
      await deleteFacility(featureId);
    }
    
    // 从前端移除
    const source = layers.value[layerType]?.layer?.getSource();
    const feature = source?.getFeatures().find(f => f.get('id') === featureId);
    if (feature) source.removeFeature(feature);
    
    // 更新store
    if (layerType === 'facilities') {
      mapDataStore.facilities = mapDataStore.facilities.filter(item => item.id !== featureId);
    } else {
      mapDataStore.landUse = mapDataStore.landUse.filter(item => item.id !== featureId);
    }
    
    closePopup();
    alert('删除成功');
    
  } catch (error) {
    console.error('删除API调用失败:', error);
    
    // 如果API没实现，提示用户
    alert('后端删除API未实现，刷新页面后会恢复');
    
    // 还是在前端删除（演示用）
    const source = layers.value[layerType]?.layer?.getSource();
    const feature = source?.getFeatures().find(f => f.get('id') === featureId);
    if (feature) source.removeFeature(feature);
    closePopup();
  }
}

function onTypeChange(layerKey) {
  if (layers.value[layerKey].loaded) updateVectorLayer(layerKey);
}

function startDrawing(layerKey) {
  if (layerKey === 'landUse') {
    landUseDraw();
  } else if (layerKey === 'facilities'){
    facilityDraw();
  }
}

// 公共设施绘制功能
function facilityDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction);
  
  isDrawing.value = true;
  
  const source = new VectorSource();
  drawLayer = new VectorLayer({
    source,
    style: new Style({
      image: new Circle({
        radius: 4,
        fill: new Fill({ color: 'purple' })
      })
    })
  });
  map.addLayer(drawLayer);
  
  drawInteraction = new Draw({
    source,
    type: 'Point',
    style: new Style({
      image: new Circle({
        radius: 4,
        fill: new Fill({ color: 'purple' })
      })
    })
  });

  drawInteraction.on('drawend', (event) => {
    drawFeature = event.feature;
    showFacilityForm.value = true; // 新增弹窗状态
  });

  map.addInteraction(drawInteraction);
}

// 土地利用绘制功能
function landUseDraw() {
  if (drawInteraction) map.removeInteraction(drawInteraction);
  
  isDrawing.value = true;
  
  const source = new VectorSource();
  drawLayer = new VectorLayer({
    source,
    style: new Style({
      fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
      stroke: new Stroke({ color: 'purple', width: 1.5 })
    })
  });
  map.addLayer(drawLayer);
  
  drawInteraction = new Draw({
    source,
    type: 'Polygon',
    style: new Style({
      fill: new Fill({ color: 'rgba(50, 0, 100, 0.3)' }),
      stroke: new Stroke({ color: 'purple', width: 1.5 })
    })
  });

  drawInteraction.on('drawend', (event) => {
    drawFeature = event.feature;
    showLandUseForm.value = true;
  });

  map.addInteraction(drawInteraction);
}

// 保存公共设施数据
async function saveFacilityToDatabase() {
  try {
    if (!facilityForm.value.name || !drawFeature) return;
    
    const coords = toLonLat(drawFeature.getGeometry().getCoordinates());
    
    const facilityData = {
      name: facilityForm.value.name,
      type: facilityForm.value.type,
      address: facilityForm.value.address,
      capacity: facilityForm.value.capacity || 0,
      admin_region: facilityForm.value.admin_region,
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };
    
    const response = await createFacility(facilityData);
    
    if (response.success) {
      // 添加到图层
      drawFeature.set('id', response.data.id);
      drawFeature.set('name', facilityForm.value.name);
      drawFeature.set('type', facilityForm.value.type);
      drawFeature.set('address', facilityForm.value.address);
      drawFeature.set('capacity', facilityForm.value.capacity || 0);
      drawFeature.set('admin_region', facilityForm.value.admin_region);
      drawFeature.set('layerType', 'facilities');
      
      layers.value.facilities.layer?.getSource()?.addFeature(drawFeature);
      mapDataStore.facilities.push(response.data);  // 更新store
      cancelDraw();
    }
    
  } catch (error) {
    console.error('保存失败:', error);
  }
}

// 保存土地利用数据
async function saveLandUseToDatabase() {
  try {
    if (!landUseForm.value.name || !drawFeature) return;
    
    // 保存到数据库
    const response = await createLandUse({
      name: landUseForm.value.name,
      type: landUseForm.value.type,
      geometry: {
        type: 'Polygon',
        coordinates: drawFeature.getGeometry().getCoordinates().map(ring => 
          ring.map(coord => toLonLat(coord))
        )
      },
      area: landUseForm.value.area || 0,
      admin_region: landUseForm.value.admin_region || '福田区'
    });
    
    if (response.success) {
      // 直接使用已绘制的图形，设置ID和属性
      drawFeature.set('id', response.data.id);
      drawFeature.set('name', landUseForm.value.name);
      drawFeature.set('type', landUseForm.value.type);
      drawFeature.set('admin_region', landUseForm.value.admin_region);
      drawFeature.set('area', landUseForm.value.area || 0);
      drawFeature.set('layerType', 'landUse');
      
      // 添加到土地利用图层
      layers.value.landUse.layer?.getSource()?.addFeature(drawFeature);
      
      alert('保存成功！');
      cancelDraw();
    }
  } catch (error) {
    console.error('保存失败:', error);
  }
}

function cancelDraw() {
  showLandUseForm.value = false;
  showFacilityForm.value = false;
  landUseForm.value = { name: '', type: '', admin_region: '', area: null };
  facilityForm.value = { name: '', type: '', address: '', capacity: null, admin_region: '' };
  drawFeature = null;
  isDrawing.value = false;
  
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
  }
  if (drawLayer) {
    map.removeLayer(drawLayer);
    drawLayer = null;
  }
}

// 编辑图形函数
function toggleEditMode(layerKey) {
  const layerObj = layers.value[layerKey];
  if (layerKey === 'landUse' && layerObj.loaded) {
    layerObj.editable = !layerObj.editable;
    if (landUseModify) landUseModify.setActive(layerObj.editable);
  } else if (layerKey === 'facilities' && layerObj.loaded) {
    layerObj.editable = !layerObj.editable;
    if (facilityModify) facilityModify.setActive(layerObj.editable);
  }
}

function createFacilityStyle(feature) {
  const type = feature.get('type');
  const icons = {
    学校: '🎓',
    医院: '🏥',
    图书馆: '📖',
    体育馆: '🏀',
    公园: '🌳'
  };
  const icon = icons[type] || '📍';
  
  return new Style({
    text: new Text({ text: icon, font: 'bold 18px Arial' })
  });
}

function createLandUseStyle(feature) {
  const type = feature.get('type');
  let color = 'rgba(0, 0, 0, 0.6)';
  
  switch(type) {
    case '居住用地': color = 'rgba(255, 255, 45, 0.6)'; break;
    case '商业用地': color = 'rgba(255, 0, 0, 0.6)'; break;
    case '工业用地': color = 'rgba(187, 150, 116, 0.6)'; break;
    case '公园绿地': color = 'rgba(0, 255, 0, 0.6)'; break;
  }

  return new Style({
    fill: new Fill({ color }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.2)', width: 1.5 })
  });
}

function setupMapInteractions() {
  map.on('click', (event) => {
    if(showLandUseForm.value || isDrawing.value) return;

    const features = map.getFeaturesAtPixel(event.pixel);

    if(features.length > 0) {
      selectedFeature.value = features[0].getProperties();
      popupPosition.value = { x: event.pixel[0] + 20, y: event.pixel[1] };
    } else {
      closePopup();
    }
  });

  map.on('pointermove', (event) => {
    const hit = map.hasFeatureAtPixel(event.pixel);
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });
}

function closePopup() {
  selectedFeature.value = null;
  popupPosition.value = null;
}

onMounted(() => {
  setTimeout(() => {
    if (!mapContainer.value) return;
    initMap();
  }, 300);
});

onUnmounted(() => {
  if(map) {
    map.setTarget(null);
    map = null;
  }
})
</script>

<style>
.map-wrapper {
  width: 100%;
  overflow: hidden;
}

.map-content {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.map-container {
  position: absolute;
  background-color: #e0e0e0;
  width: 100%;
  height: 100%;
}

/* 地图控件样式 */
/* 放大缩小控件 */
.ol-zoom {
  position: absolute;
  left: 305px;
  top: 5px;
}

/* 比例尺控件 */
.ol-scale-line {
  position: absolute;
  left: 305px;
  bottom: 5px;
  height: 20px;
  background: rgba(0,0,0,0.1);
}

/* 地图全屏控件 */
.ol-full-screen {
  position: absolute;
  right: 305px;
  top: 5px;
}

/* 鼠标坐标控件 */
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

/* 地图切换样式 */
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

/* 图形要素弹窗样式 */
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

/* 删除图形按钮 */
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

.facility-form,
.landuse-form {
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