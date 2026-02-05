<template>
  <div class="map-wrapper">
    <div class="map-content">
      <!-- 地图容器 -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- 左侧边栏 -->
      <div class="left_sidebar">
        <h3>图形操作</h3>
        
        <div class="layer-panel" v-for="(config, key) in layers" :key="key">
          <!-- 版块标题 -->
          <h4>{{ config.name }}</h4>
          
          <!-- 1. 加载与显示控制 -->
          <div class="control-group">
            <input 
              type="checkbox" 
              v-model="config.visible"
              @change="toggleLayer(key)"
            >
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

      <!-- 底图切换控件 -->
      <div class="basemap-switcher"
          @mouseenter="basemapPanelVisible = true"
          @mouseleave="basemapPanelVisible = false">
        <!-- 主按钮 -->
        <button class="basemap-main-btn">
          {{ getActiveBasemap.name }} ▾
        </button>
        
        <!-- 滑出面板 -->
        <transition name="slide-down">
          <div class="basemap-panel" v-if="basemapPanelVisible">
            <div class="basemap-item" 
                v-for="item in basemaps" 
                :key="item.id"
                :class="{ 'active': item.id === activeBasemapId }"
                @click="switchBasemap(item.id)">
              <!-- 缩略图 (暂时用色块代替，后期替换为图片) -->
              <div class="thumbnail" :style="{ backgroundColor: getThumbColor(item.id) }">
                {{ item.name }}
              </div>
              <!-- 底图名称与路网控制 -->
              <div class="basemap-info">
                <div class="basemap-name">{{ item.name }}</div>
                <!-- 路网复选框（仅普通和卫星地图显示） -->
                <label class="roadnet-toggle" v-if="item.hasRoadNet">
                  <input type="checkbox" 
                        v-model="item.roadNetVisible"
                        @click.stop
                        @change="toggleRoadNet(item)">
                  <span>路网</span>
                </label>
              </div>
            </div>
          </div>
        </transition>
      </div>
      
      <!-- 点击设施要素弹窗 -->
      <div v-if="selectedFeature && popupPosition" :style="{left: popupPosition.x + 'px', top: popupPosition.y + 'px'}" class="feature-popup">
        <div class="popup-content">
          <!-- 关闭按钮 -->
          <button @click="closePopup" class="close-btn">x</button>
          <!-- 要素标题 -->
          <h4>{{ selectedFeature.name }}</h4>
          <!-- 设施信息 -->
          <div v-if="selectedFeature.layerType === 'facility'">
            <p><strong>类型：</strong>{{ selectedFeature.type }}</p>
            <p><strong>地址：</strong>{{ selectedFeature.address }}</p>
            <p><strong>规模：</strong>{{ selectedFeature.capacity }}</p>
            <p><strong>行政区：</strong>{{ selectedFeature.admin_region }}</p>
          </div>
          <!-- 土地利用信息 -->
          <div v-else>
            <p><strong>用地类型：</strong>{{ selectedFeature.type }}</p>
            <p><strong>用地面积：</strong>{{ selectedFeature.area }}平方米</p>
            <p><strong>行政区：</strong>{{ selectedFeature.admin_region }}</p>
          </div>
        </div>
      </div>

      <!-- 添加数据属性表单弹窗 -->
      <div v-if="showLandUseForm" class="landuse-form">
        <div class="form-overlay" @click="cancelDraw"></div>
        <div class="form-content">
          <h4>添加土地利用</h4>
          <form @submit.prevent="saveToDatabase">
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
                <option value="">请选择类型</option>
                <option value="福田区">福田区</option>
                <option value="南山区">南山区</option>
                <option value="罗湖区">罗湖区</option>
                <option value="宝安区">宝安区</option>
              </select>
            </div>

            <div class="form-group">
              <label>面积（平方米）：</label>
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
// 引入vue组件
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
// 引入openlayers组件
import { Map, View } from 'ol'
import 'ol/ol.css'
import TileLayer from 'ol/layer/Tile'
import Feature from 'ol/Feature'
import { fromLonLat, toLonLat } from 'ol/proj'
import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import { Style, Fill, Stroke, Text } from 'ol/style'
import { Point, Polygon } from 'ol/geom'
import { FullScreen, ScaleLine, MousePosition, defaults } from "ol/control"
import { createStringXY } from "ol/coordinate"
import { Draw, Modify } from 'ol/interaction'
// 引入proj4
// import proj4 from 'proj4'
// import { register } from 'ol/proj/proj4'

// 引入状态管理和工具模块
import { useMapDataStore } from '../stores/mapData'
import { getMapBbox } from '../utils/mapHelpers'

// 引入api组件
import { createLandUse, updateLandUse } from '../services/api'

// 初始化proj4，定义坐标系
// proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')
// proj4.defs('EPSG:4490', '+proj=longlat +ellps=GRS80 +datum=CGCS2000 +no_defs +type=crs')
// register(proj4)

// 地图容器和地图实例
const mapContainer = ref(null)
let map = null

// 点击地图要素（用于弹窗显示）
const selectedFeature = ref(null)
// 弹窗位置
const popupPosition = ref(null)

// 输入矢量要素（用于弹窗显示）
const showLandUseForm = ref(false)
const isDrawing = ref(false)
const landUseForm = ref({
  name: '',
  type: '',
  admin_region: '',
  area: null
});
let drawFeature = null
let drawInteraction = null
let drawLayer = null
// 土地利用图层的修改交互
let landUseModify = null

// Pinia存储实例
const mapDataStore = useMapDataStore()

const layers = ref({
  facilities: {
    name: '公共设施',
    visible: false,         // 对应复选框
    loaded: false,          // 数据是否已加载
    layer: null,            // 对应的VectorLayer实例
    selectedType: 'all',    // 当前选中的分类
    drawType: 'Point',      // 绘制类型（若未来需要绘制设施点）
    types: [                // 可选的分类
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
    drawType: 'Polygon',    // 绘制类型为面
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

// 底图管理
const basemaps = ref([
  {
    id: 'vector',
    name: '普通地图',
    layer: null,
    thumbnail: 'path/to/vector-thumb.jpg', // 缩略图路径（可后补）
    url: 'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    hasRoadNet: true, // 是否有路网图层
    roadNetVisible: true, // 路网是否显示
    roadNetUrl: 'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
    roadNetLayer: null
  },
  {
    id: 'satellite',
    name: '卫星地图',
    layer: null,
    thumbnail: 'path/to/satellite-thumb.jpg',
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
    thumbnail: 'path/to/3d-thumb.jpg',
    url: '', // 预留，后续对接Cesium
    hasRoadNet: false,
    roadNetVisible: false
  }
]);

// 当前激活的底图ID
const activeBasemapId = ref('vector');
// 控制底图切换面板的显示
const basemapPanelVisible = ref(false);

// 公共设施数量与土地利用数量
const facilitiesCount = computed(() => mapDataStore.facilities.length);
const landUseCount = computed(() => mapDataStore.landUse.length);

// 创建初始化地图
const initMap = () =>{
  map = new Map({
    target: mapContainer.value,
    layers: [],
    view: new View({
      center: fromLonLat([114.00, 22.55]),
      zoom: 12
    }),
    controls: defaults().extend([
      new FullScreen(),    // 全屏控件
      new ScaleLine(),     // 比例尺
      new MousePosition({  // 鼠标位置
        coordinateFormat: createStringXY(4),
        projection: 'EPSG:4326'
      })
    ])
  })

  // 初始化默认底图
  switchBasemap('vector')

  // 地图交互事件（点击设施弹窗）
  setupMapInteractions()
}

// 3. 通用方法
// A. 切换图层显示/加载
async function toggleLayer(layerKey) {
  const layerObj = layers.value[layerKey];
  if (layerObj.visible && !layerObj.loaded) {
    // 首次勾选：加载数据
    const bbox = getMapBbox(map);
    if (layerKey === 'facilities') {
      await mapDataStore.loadFacilities(bbox);
    } else {
      await mapDataStore.loadLandUse(bbox);
    }
    layerObj.loaded = true;
    updateVectorLayer(layerKey); // 创建并显示图层
  } else if (layerObj.layer) {
    // 非首次：直接切换可见性
    layerObj.layer.setVisible(layerObj.visible);
  }
}

// B. 更新矢量图层 (替代原来的 updateFacilityLayer 和 updateLandUseLayer)
function updateVectorLayer(layerKey) {
  const layerObj = layers.value[layerKey];
  const storeData = layerKey === 'facilities' ? mapDataStore.facilities : mapDataStore.landUse;
  const styleFunc = layerKey === 'facilities' ? createFacilityStyle : createLandUseStyle;
  const isPoint = layerKey === 'facilities';

  // 过滤数据
  const filteredData = layerObj.selectedType === 'all' 
    ? storeData 
    : storeData.filter(item => item.type === layerObj.selectedType);

  // 创建矢量源
  const source = new VectorSource();
  filteredData.forEach(item => {
    const geom = isPoint 
      ? new Point(fromLonLat(item.geometry.coordinates))
      : new Polygon(item.geometry.coordinates).transform('EPSG:4326', 'EPSG:3857');
    
    const featureProps = {
      id: item.id,
      name: item.name,
      type: item.type,
      layerType: layerKey
    };

    const feature = new Feature({
      geometry: geom,
      ...featureProps
    });
    source.addFeature(feature);
  });

  // 移除旧图层，创建新图层
  if (layerObj.layer) map.removeLayer(layerObj.layer);
  layerObj.layer = new VectorLayer({
    source,
    style: styleFunc,
    visible: layerObj.visible // 关键：同步可见性状态
  });
  map.addLayer(layerObj.layer);

  // ---------- 新增的修复代码块（只在土地利用版块生效） ----------
  if (layerKey === 'landUse') {
    // 1. 移除旧的修改交互（如果存在）
    if (landUseModify) {
      map.removeInteraction(landUseModify);
      landUseModify = null; // 可选，清理引用
    }
    
    // 2. 创建新的修改交互，绑定到当前新的矢量源
    landUseModify = new Modify({
      source: source // 关键：绑定到刚创建的新 source
    });
    
    // 3. 重新绑定要素修改完成的监听事件
    landUseModify.on('modifyend', async (event) => {
      const features = event.features.getArray();
      const feature = features[0];
      const id = feature.get('id');
      
      // 获取更新后的属性
      const name = feature.get('name');
      const type = feature.get('type');
      const area = feature.get('area');
      const admin_region = feature.get('admin_region');
      
      // 获取几何数据并转换为GeoJSON (WGS84)
      const geometry = feature.getGeometry();
      const coordinates = geometry.getCoordinates();
      const wgs84Coordinates = coordinates.map(ring =>
        ring.map(coord => toLonLat(coord)) // 确保 toLonLat 已导入
      );
      
      const geoJsonGeometry = {
        type: 'Polygon',
        coordinates: wgs84Coordinates
      };
      
      const landUseData = {
        name,
        type,
        area,
        admin_region,
        geometry: geoJsonGeometry
      };
      
      try {
        const response = await updateLandUse(id, landUseData);
        if (response.success) {
          console.log('土地利用更新成功');
        } else {
          console.error('更新失败:', response.message);
        }
      } catch (error) {
        console.error('更新请求失败:', error);
      }
    });
    
    // 4. 将新的交互添加到地图
    map.addInteraction(landUseModify);
    // 根据当前的编辑状态设置交互是否激活
    landUseModify.setActive(layerObj.editable);
  }
}

// C. 分类切换处理
function onTypeChange(layerKey) {
  if (layers.value[layerKey].loaded) {
    updateVectorLayer(layerKey);
  }
}

// D. 启动绘图 (统一入口)
function startDrawing(layerKey) {
  const layerObj = layers.value[layerKey];
  // 这里可以扩展，例如设施绘制点，土地利用绘制面
  if (layerKey === 'landUse') {
    vectorDraw(); // 调用你原有的土地利用绘图函数
  } else {
    alert(`启动${layerObj.name}绘制功能`);
    // 未来可在此处初始化设施点绘制
  }
}

function toggleEditMode(layerKey) {
  const layerObj = layers.value[layerKey];
  if (layerKey === 'landUse' && layerObj.loaded) {
    layerObj.editable = !layerObj.editable;
    // 控制 Modify 交互的激活状态
    if (landUseModify) {
      landUseModify.setActive(layerObj.editable);
    }
    // 可以在这里改变按钮样式或给出提示
    console.log(`${layerObj.name} 编辑模式: ${layerObj.editable ? '开启' : '关闭'}`);
  }
}

// -- 地图切换处理 --
// 获取当前激活的底图对象（计算属性）
const getActiveBasemap = computed(() => {
  return basemaps.value.find(b => b.id === activeBasemapId.value) || basemaps.value[0];
});

// 切换底图
function switchBasemap(basemapId) {
  if (activeBasemapId.value === basemapId) return;
  
  const oldBasemap = basemaps.value.find(b => b.id === activeBasemapId.value);
  const newBasemap = basemaps.value.find(b => b.id === basemapId);
  
  if (!newBasemap) return;

  if (!newBasemap.url) {
    alert('三维地图功能正在开发中，敬请期待！');
    return;
  }
  
  // 1. 移除所有现有的底图和路网图层
  const currentLayers = map.getLayers().getArray();
  
  basemaps.value.forEach(b => {
    if (b.layer && currentLayers.includes(b.layer)) {
      map.removeLayer(b.layer);
    }
    if (b.roadNetLayer && currentLayers.includes(b.roadNetLayer)) {
      map.removeLayer(b.roadNetLayer);
    }
  });
  
  // 2. 创建或获取新底图图层
  if (!newBasemap.layer) {
    newBasemap.layer = new TileLayer({
      source: new XYZ({
        url: newBasemap.url,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      zIndex: 0 // 确保底图在最底层
    });
  }
  
  // 3. 添加底图到地图（添加到最底层）
  map.addLayer(newBasemap.layer);
  
  // 4. 处理路网（如果有且需要显示）
  if (newBasemap.hasRoadNet && newBasemap.roadNetVisible) {
    if (!newBasemap.roadNetLayer) {
      newBasemap.roadNetLayer = new TileLayer({
        source: new XYZ({
          url: newBasemap.roadNetUrl,
          wrapX: false,
          crossOrigin: 'anonymous'
        }),
        zIndex: 1 // 路网在底图之上
      });
    }
    map.addLayer(newBasemap.roadNetLayer);
  }
  
  // 5. 更新状态
  activeBasemapId.value = basemapId;
}

// 切换路网显示
function toggleRoadNet(basemap) {
  // 确保只对当前激活的底图操作
  if (basemap.id !== activeBasemapId.value) return;
  
  if (basemap.roadNetVisible && !basemap.roadNetLayer) {
    // 创建并显示路网
    basemap.roadNetLayer = new TileLayer({
      source: new XYZ({
        url: basemap.roadNetUrl,
        wrapX: false,
        crossOrigin: 'anonymous'
      }),
      zIndex: 1
    });
    map.addLayer(basemap.roadNetLayer);
  } else if (!basemap.roadNetVisible && basemap.roadNetLayer) {
    // 移除路网
    map.removeLayer(basemap.roadNetLayer);
  }
}

// 辅助函数：为缩略图生成临时颜色
function getThumbColor(id) {
  const colors = { vector: '#4CAF50', satellite: '#795548', '3d': '#2196F3' };
  return colors[id] || '#ccc';
}


// --- 公共设施部分 ---
// 创建公共设施样式函数
function createFacilityStyle(feature){
  const type = feature.get('type');  // 此处的feature在其它函数调用时生效
  // 输出样式
  return new Style({
    text: new Text({
      text: getFacilityIcon(type),  // 调用公共设施emoji图标样式函数
      font: 'bold 18px Arial'
    })
  });
}

// 创建公共设施emoji图标样式函数
function getFacilityIcon(type){
  const icons = {
    学校: '🎓',
    医院: '🏥',
    图书馆: '📖',
    体育馆: '🏀',
    公园: '🌳'
  };
  return icons[type] || '📍';
}

// --- 土地利用部分 ---
// 创建土地利用样式函数
function createLandUseStyle(feature) {
  const type = feature.get('type');
  let color = 'rgba(0, 0, 0, 0.6)';
  // 根据土地利用类型设置不同颜色
  switch(type){
    case '居住用地':
      color = 'rgba(255, 255, 45, 0.6)';
      break;
    case '商业用地':
      color = 'rgba(255, 0, 0, 0.6)';
      break;
    case '工业用地':
      color = 'rgba(187, 150, 116, 0.6)';
      break;
    case '公园绿地':
      color = 'rgba(0, 255, 0, 0.6)';
      break;
  }

  return new Style({
    fill: new Fill({
      color: color
    }),
    stroke: new Stroke({
      color: 'rgba(0, 0, 0, 0.2)',
      width: 1.5
    })
  });
}


// 创建地图交互处理函数(要素弹窗)
function setupMapInteractions() {
  map.on('click', (event) => {
    // 如果正在绘图模式，不触发弹窗
    if(showLandUseForm.value || isDrawing.value) {
      return;
    }

    // 定义要素为空
    const features = map.getFeaturesAtPixel(event.pixel);

    if(features.length > 0) {
      selectedFeature.value = features[0].getProperties();
      // 设置弹窗位置为点击位置
      popupPosition.value = {
        x: event.pixel[0] + 20,
        y: event.pixel[1]
      };
    } else {
      closePopup();
    }
  });

  // 指针接近设施要素时改变鼠标样式
  map.on('pointermove', (event) => {
    // 定义鼠标位置是否有要素
    const hit = map.hasFeatureAtPixel(event.pixel);

    // 如果有要素，显示手型光标，否则显示默认指针
    map.getTargetElement().style.cursor = hit ? 'pointer' : '';
  });
}

// 关闭要素弹窗
function closePopup() {
  selectedFeature.value = null;
  popupPosition.value = null;
}


// 创建绘图功能
function vectorDraw(){
  // 先清除之前的绘图交互
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
  }

  // 临时禁用点击弹窗事件
  isDrawing.value = true;

  // 创建临时图层
  const source = new VectorSource();
  drawLayer = new VectorLayer({
    source,
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 0, 0, 0.5)'
      }),
      stroke: new Stroke({
        color: 'red',
        width: 1.5
      })
    })
  });
  map.addLayer(drawLayer);
  // 创建绘图交互
  drawInteraction = new Draw({
    source,
    type: 'Polygon',
    style: new Style({
      fill: new Fill({
        color: 'rgba(255, 0, 0, 0.5)'
      }),
      stroke: new Stroke({
        color: 'red',
        width: 1.5
      })
    })
  });

  // 监听绘图完成事件
  drawInteraction.on('drawend', (event) => {
    drawFeature = event.feature;
    // 显示表单
    showLandUseForm.value = true;
  });

  // 添加绘图交互
  map.addInteraction(drawInteraction);
}

// 提交保存到数据库的函数
async function saveToDatabase() {
  try {
    // 1. 检查必要数据
    if (!landUseForm.value.name || !drawFeature) {
      alert('请填写地块名称');
      return;
    }
    
    // 2. 准备几何数据
    const geometry = drawFeature.getGeometry();
    const coordinates = geometry.getCoordinates();
    
    const wgs84Coordinates = coordinates.map(ring =>
      ring.map(coord => toLonLat(coord))
    );

    // 3. 创建GeoJSON格式
    const geoJsonGeometry = {
      type: 'Polygon',
      coordinates: coordinates.map(ring =>
        ring.map(coord => toLonLat(coord))
      )
    };
    
    // 4. 准备发送的数据
    const landUseData = {
      name: landUseForm.value.name,
      type: landUseForm.value.type,
      geometry: geoJsonGeometry,
      area: landUseForm.value.area || 0,  // 使用表单中的面积，如果没有则设为0
      admin_region: landUseForm.value.admin_region || '福田区'  // 先写固定值
    };
    
    console.log('准备保存的数据:', landUseData);
    
    // 5. 调用API保存到数据库
    const response = await createLandUse(landUseData);
    
    if (response.success) {
      alert('保存成功！');
      // 重新加载土地利用数据
      await loadLandUse();
      // 重置状态
      cancelDraw();
    } else {
      alert('保存失败: ' + response.message);
    }
    
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败，请检查控制台');
  }
}

// 取消绘制函数
function cancelDraw() {
  // 重置状态
  showLandUseForm.value = false;
  landUseForm.value = { 
    name: '', 
    type: '', 
    admin_region: '', 
    area: null 
  };
  drawFeature = null;
  isDrawing.value = false;
  
  // 移除绘图交互
  if (drawInteraction) {
    map.removeInteraction(drawInteraction);
    drawInteraction = null;
  }
  if (drawLayer) {
    map.removeLayer(drawLayer);
    drawLayer = null;
  }
}

// 组件挂载_初始化地图
onMounted(() => {
  initMap();
})

// 组件卸载_清理地图
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
  position:relative;
  width: 100vw;
  height: 100vh;
}

.map-container {
  position: absolute;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 左侧边栏 - 地图控制样式 */
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


/* 右侧边栏 - 信息显示样式 */
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

/* 底图切换器样式 */
.basemap-switcher {
  position: absolute;
  top: 60px; /* 位于你的主标题下方 */
  left: 50%;
  transform: translateX(-50%);
  z-index: 99;
}

.basemap-main-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #dcdcdc;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
}
.basemap-main-btn:hover {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

/* 滑出面板 */
.basemap-panel {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 滑出动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  opacity: 1;
  transform: translateY(0);
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 底图项 */
.basemap-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.basemap-item:hover {
  background: #f5f5f5;
}
.basemap-item.active {
  background: #e8f4fd;
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
  font-weight: bold;
  margin-bottom: 4px;
}

.roadnet-toggle {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #666;
  cursor: pointer;
}
.roadnet-toggle input {
  margin-right: 4px;
}

/* 要素信息弹窗样式 */
.feature-popup {
  position: absolute;
  background: rgba(0, 0, 0, 0.5);
  padding: 5px 30px 5px 5px;
  border-radius: 5px;
}

.popup-content{
  position: relative;
  padding: 0 5px;
}

.close-btn {
  position: absolute;
  right: -25px;
  border-radius: 50%;
  border: none;
  width: 20px;
  height: 20px;
  line-height: 1;
  text-align: center;
  font-size: 14px;
  color: #000;
}

.close-btn:hover {
  background: #ccc;
}

/* 弹窗标题 */
.popup-content h4 {
  margin-bottom: 5px;
  padding-bottom: 2px;
  border-bottom: 1px solid #aaa;
  font-size: 16px;
  color: #eee;
}

/* 弹窗内容 */
.popup-content p {
  font-size: 14px;
  color: #eee;
}

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