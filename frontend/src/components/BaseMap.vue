<template>
  <div class="map-wrapper">
    <div class="map-controls">
      <h3>地图控制</h3>

      <!-- 加载数据控制 -->
      <div class="control-item">
        <h4>加载数据：</h4>
        <button @click="loadFacilities">公共设施</button>
        <button @click="loadLandUse">土地利用</button>
      </div>

      <!-- 设施类型显示控制 -->
      <div class="control-type">
        <h4>显示类型：</h4>
        <div>
          <label><input type="checkbox" v-model="facilityChecked">公共设施</label>
          <select v-model="selectedFacilityType" @change="updateFacilityLayer" :disabled="!facilityChecked">
            <option value="all">全部类型</option>
            <option value="school">学校</option>
            <option value="hospital">医院</option>
            <option value="library">图书馆</option>
            <option value="stadium">体育馆</option>
            <option value="park">公园</option>
          </select>
        </div>
        <div>
          <label><input type="checkbox" v-model="landUseChecked">土地利用</label>
          <select v-model="selectedLandUseType" @change="updateLandUseLayer" :disabled="!landUseChecked">
            <option value="all">全部类型</option>
            <option value="commercial">商业用地</option>
            <option value="residential">居住用地</option>
            <option value="industrial">工业用地</option>
            <option value="green_space">公园绿地</option>
          </select>
        </div>
      </div>
    </div>

    <div class="map-content">
      <!-- 地图容器 -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- 地图控件容器 -->
      <div ref="mousePosition" class="mouse-position"></div>
      <div ref="overviewMap" class="overview-map"></div>
      <div ref="scaleLine" class="scale-line"></div>

      <!-- 状态信息显示区域 -->
      <div class="sidebar">
        <div class="status-info">
          <h4>加载状态</h4>
          <div>✅ 公共设施 {{ facilitiesCount }} 个，土地利用 {{ landUseCount }} 个</div>
        </div>
      </div>
      
      <!-- 点击设施要素弹窗 -->
      <div v-if="selectedFeature && popupPosition" :style="{left: popupPosition.x + 'px', top: popupPosition.y + 'px'}" class="feature-popup">
        <div class="popup-content">
          <!-- 关闭按钮 -->
          <button @click="closePopup" class="close-btn">x</button>
          <!-- 要素标题 -->
          <h4>{{ selectedFeature.name || selectedFeature.land_type }}</h4>
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
            <p><strong>面积：</strong>{{ selectedFeature.area }}平方米</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 引入vue组件
import { onMounted, onUnmounted, ref, computed, watch } from 'vue';
// 引入openlayers组件
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature';
import { fromLonLat } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Fill, Stroke, Text } from 'ol/style';
import { Point, Polygon } from 'ol/geom';
import { FullScreen, OverviewMap, ScaleLine, MousePosition,ZoomSlider, ZoomToExtent, defaults } from "ol/control";
import { createStringXY } from "ol/coordinate";

// 引入状态管理和工具模块
import { useMapDataStore } from '../stores/mapData'
import { getMapBbox } from '../utils/mapHelpers';

// 地图容器和地图实例
const mapContainer = ref(null);
let map = null;

// 定义地图控件
const mousePosition = ref(null);
const scaleLine = ref(null);

// 图层定义
const facilitiesLayer = ref(null);
const landUseLayer = ref(null);

// 公共设施和土地利用类型显示定义
const facilityChecked = ref(true);
const landUseChecked = ref(true);
const selectedFacilityType = ref('all');
const selectedLandUseType = ref('all');

// 点击地图要素（用于弹窗显示）
const selectedFeature = ref(null);
// 弹窗位置
const popupPosition = ref(null);

// Pinia存储实例
const mapDataStore = useMapDataStore();

// 公共设施数量与土地利用数量
const facilitiesCount = computed(() => mapDataStore.facilities.length);
const landUseCount = computed(() => mapDataStore.landUse.length);

// 组件挂载_初始化地图
onMounted(() => {
  initializeMap();
})

// 组件卸载_清理地图
onUnmounted(() => {
  if(map) {
    map.setTarget(null);
    map = null;
  }
})

// 创建初始化地图
function initializeMap(){
  // 定义和配置地图控件
  // 1. 鼠标位置显示坐标
  const mousePositionControl = new MousePosition({
    coordinateFormat: createStringXY(4),
    projection: 'EPSG:4326',
    className: 'custom-mouse-position',
    target: mousePosition.value
  });
  // 2. 比例尺
  const scaleLineControl = new ScaleLine({
    target: scaleLine.value
  });

  // 配置地图
  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
          wrapX: false
        })
      }),
      // new TileLayer({
      //   source: new XYZ({
      //     url: 'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
      //     wrapX: false
      //   })
      // }),
    ],

    // 地图视图
    view: new View({
      center: fromLonLat([114.00, 22.55]),
      zoom: 12
    }),

    // 添加地图控件
    controls: defaults().extend([
      // 全屏控件
      new FullScreen(),
      // 鼠标坐标控件
      mousePositionControl,
      // 比例尺控件
      scaleLineControl
    ])
  })

  // 设置地图交互事件（点击设施弹窗）
  setupMapInteractions();
}

// --- 公共设施部分 ---
// 添加filteredFacilities计算属性
const filteredFacilities = computed(() => {
  if(selectedFacilityType.value === 'all'){
    return mapDataStore.facilities;
  } else {
    return mapDataStore.facilities.filter(facility => facility.type === selectedFacilityType.value);
  }
});

// 创建公共设施图层重新渲染函数
function updateFacilityLayer(){
  // 创建矢量源
  const vectorSource = new VectorSource();
  // 遍历过滤后的公共设施数据
  filteredFacilities.value.forEach(facility => {
    const coordinates = facility.geometry.coordinates;
    const point = new Point(fromLonLat(coordinates));
    const feature = new Feature({
      geometry: point,
      name: facility.name,
      type: facility.type,
      address: facility.address,
      capacity: facility.capacity,
      admin_region: facility.admin_region,
      layerType: 'facility'
    });
    // 往矢量源中添加图形数据
    vectorSource.addFeature(feature);
  })

  // 如果已有公共设施图层，先移除旧图层
  if(facilitiesLayer.value){
    map.removeLayer(facilitiesLayer.value);
  }

  // 创建公共设施新图层
  facilitiesLayer.value = new VectorLayer({
    source: vectorSource,
    style: createFacilityStyle,
    visible: facilityChecked.value
  });

  // 添加公共设施图层到地图
  map.addLayer(facilitiesLayer.value);
}

// 监听公共设施和土地利用复选框变化
watch([facilityChecked, landUseChecked], () => {
  // 控制公共设施图层
  if(facilitiesLayer.value){
    facilitiesLayer.value.setVisible(facilityChecked.value);
  }

  // 控制土地利用图层
  if(landUseLayer.value){
    landUseLayer.value.setVisible(landUseChecked.value);
  }
})

// 创建加载公共设施函数
async function loadFacilities(){
  const bbox = getMapBbox(map);
  await mapDataStore.loadFacilities(bbox);
  // 调用重新渲染函数
  updateFacilityLayer();
}

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
    school: '🎓',
    hospital: '🏥',
    library: '📖',
    stadium: '🏀',
    park: '🌳'
  };
  return icons[type] || '📍';
}

// --- 土地利用部分 ---
// 添加filteredLandUse计算属性
const filteredLandUse = computed(() => {
  if(selectedLandUseType.value === 'all'){
    return mapDataStore.landUse;
  } else {
    return mapDataStore.landUse.filter(landUse => landUse.type === selectedLandUseType.value)
  }
})

// 创建土地利用图层重新渲染函数
function updateLandUseLayer() {
  // 创建矢量源
  const vectorSource = new VectorSource();
  // 遍历过滤后的土地利用数据
  filteredLandUse.value.forEach(landUse => {
    const coordinates = landUse.geometry.coordinates;
    const polygon = new Polygon(coordinates).transform('EPSG:4326', 'EPSG:3857');
    const feature = new Feature({
      geometry: polygon,
      name: landUse.name,
      type: landUse.type,
      area: landUse.area,
      layerType: 'landUse'
    });
    // 往矢量源中添加图形数据
    vectorSource.addFeature(feature);
  })

  // 如果已有土地利用图层，先移除旧图层
  if(landUseLayer.value){
    map.removeLayer(landUseLayer.value)
  };

  // 创建土地利用新图层
  landUseLayer.value = new VectorLayer({
    source: vectorSource,
    style: createLandUseStyle,
    visible: landUseChecked.value
  });

  // 添加土地图层到地图
  map.addLayer(landUseLayer.value);
}

// 创建加载土地利用数据函数
async function loadLandUse() {
  const bbox = getMapBbox(map);
  await mapDataStore.loadLandUse(bbox);
  // 调用重新渲染函数
  updateLandUseLayer();
}

// 创建土地利用样式函数
function createLandUseStyle(feature) {
  const type = feature.get('type');
  let color = 'rgba(0, 0, 0, 0.6)';
  // 根据土地利用类型设置不同颜色
  switch(type){
    case 'residential':
      color = 'rgba(255, 255, 45, 0.6)';
      break;
    case 'commercial':
      color = 'rgba(255, 0, 0, 0.6)';
      break;
    case 'industrial':
      color = 'rgba(187, 150, 116, 0.6)';
      break;
    case 'green_space':
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
</script>


<style>
.map-wrapper {
  width: 100vw;
  overflow: hidden;
}

.ol-full-screen {
  position: absolute;
  top: 0;
  right: 3px;
}

.mouse-position {
  position: absolute;
  bottom: 3px;
  right: 285px;
  padding: 0 10px;
  color: #999;
}

.overviewmap {
  position: absolute;
  bottom: 100px;
  width: 150px;
  height: 150px;
  background: skyblue;
}

.scale-line {
  position:absolute;
  left: 3px;
  bottom: 3px;
  color: #666;
  text-align: center;
  padding: 0 10px;
  border-bottom: 1px solid #666;
}

.map-controls {
  position: relative;
  width: 100vw;
  height: 45px;
  background-color: rgba(100, 30, 155, 0.8);
}

.map-controls h3 {
  position: absolute;
  line-height: 45px;
  padding: 0 20px;
  font-size: 20px;
  color: #eee;
  border-right: 1px solid rgba(255, 255, 255, 0.3);
}

.control-item {
  position: absolute;
  left: 140px;
  top: 5px;
  line-height: 35px;
  padding: 0 10px;
  background-color: #ccc;
  border-radius: 6px;
}

.control-item h4 {
  display:inline-block;
  font-size: 16px;
}

.control-item button {
  display: inline-block;
  height: 28px;
  font-size: 16px;
  margin: 0 5px;
  padding: 0 5px;
}

.control-type {
  position: absolute;
  left: 450px;
  top: 5px;
  line-height: 35px;
  padding: 0 10px;
  background-color: #ccc;
  border-radius: 6px;
}

.control-type h4 {
  display:inline-block;
  font-size: 16px;
}

.control-type div {
  display: inline-block;
  font-size: 16px;
  padding: 0 5px;
}

.control-type div select {
  height: 28px;
  font-size: 16px;
  padding: 0 5px;
}

.map-content {
  position:relative;
  width: 100vw;
  height: 88vh;
}

.map-container {
  position: absolute;
  left: 0;
  width: 80vw;
  height: 88vh;
}

.sidebar {
  position: absolute;
  right: 0;
  width: 20vw;
  height: 88vh;
  background-color: #eee;
}

.status-info {
  position: absolute;
  bottom: 0;
  width: 20vw;
  background-color: rgba(0, 0, 0, 0.2);
}

.status-info h4 {
  text-align: center;
  font-size: 18px;
  color: #666;
}

.status-info div {
  color: #52c41a;
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
</style>