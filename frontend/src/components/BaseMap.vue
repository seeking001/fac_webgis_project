<template>
  <div class="map-wrapper">
    <div class="map-controls">
      <h3>地图控制</h3>
      <div class="control-item">
        <h4>加载数据：</h4>
        <button @click="loadFacilities">公共设施</button>
        <button @click="loadLandUse">土地利用</button>
      </div>
    </div>

    <div class="map-content">
      <!-- 地图容器 -->
      <div ref="mapContainer" class="map-container"></div>

      <!-- 状态信息显示区域 -->
      <div class="sidebar">
        <div class="status-info">
          <h4>加载状态</h4>
          <div>✅ 公共设施 {{ facilitiesCount }} 个，土地利用 {{ landUseCount }} 个</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 引入vue组件
import { onMounted, onUnmounted, ref, computed } from 'vue';
// 引入openlayers组件
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature.js';
import { fromLonLat } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { Point, Polygon } from 'ol/geom';

// 引入状态管理和工具模块
import { useMapDataStore } from '../stores/mapData'
import { getMapBbox } from '../utils/mapHelpers';
import { storeToRefs } from 'pinia';

// 地图容器和地图实例
const mapContainer = ref(null);
let map = null;

// 图层定义
const facilitiesLayer = ref(null);
const landUseLayer = ref(null);

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
  map = new Map({
    target: mapContainer.value,
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'http://t0.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
          warpX: false
        })
      }),
      new TileLayer({
        source: new XYZ({
          url: 'http://t0.tianditu.gov.cn/cva_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=5911fa4ad51d6af49b0b3be1eba86a2f',
          warpX: false
        })
      }),
    ],
    view: new View({
      center: fromLonLat([114.00, 22.55]),
      zoom: 12
    })
  })
}

// 创建获取设施函数
async function loadFacilities(){
  const bbox = getMapBbox(map);
  await mapDataStore.loadFacilities(bbox);

  // 获取设施数据
  // const facilities = mapDataStore.facilities;
  // 换一种写法，能够保持facilities数据响应式
  const { facilities } = storeToRefs(mapDataStore); 

  // 创建矢量源
  const vectorSource = new VectorSource();

  // 遍历设施数据，将每个设施点添加到矢量源
  facilities.value.forEach(facility => {
    const coordinates = facility.geometry.coordinates;
    const point = new Point(fromLonLat(coordinates));

    const feature = new Feature({
      geometry: point,
      name: facility.name,
      type: facility.type
    });

    vectorSource.addFeature(feature);
  });

  // 如果已经存在设施图层，则先移除
  if(facilitiesLayer.value) {
    map.removeLayer(facilitiesLayer.value);
  }

  // 创建新的矢量图层
  facilitiesLayer.value = new VectorLayer({
    source: vectorSource,
    style: new Style({
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: 'red' }),
        stroke: new Stroke({
          color: 'white',
          width: 1.5
        })
      })
    })
  });

  // 将矢量图层添加到地图
  map.addLayer(facilitiesLayer.value);
}

// 创建获取土地利用数据函数
async function loadLandUse() {
  const bbox = getMapBbox(map);
  await mapDataStore.loadLandUse(bbox);

  // 获取土地利用数据
  const { landUse } = storeToRefs(mapDataStore);
  const vectorSource = new VectorSource()
  landUse.value.forEach(landUse => {
    const coordinates = landUse.geometry.coordinates;
    const polygon = new Polygon(coordinates).transform('EPSG:4326', 'EPSG:3857');

    const feature = new Feature({
      geometry: polygon,
      name: landUse.name,
      type: landUse.type,
      area: landUse.area
    });

    vectorSource.addFeature(feature);
  });

  // 如果存在土地利用图层，先移除
  if (landUseLayer.value) {
    map.removeLayer(landUseLayer.value)
  };

  // 创建土地利用图层
  landUseLayer.value = new VectorLayer({
    source: vectorSource,
    style: createLandUseStyle
  });

  // 将矢量图层添加到地图
  map.addLayer(landUseLayer.value);
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
</script>

<style scoped>
.map-wrapper {
  width: 100vw;
  overflow: hidden;
}

.map-controls {
  position: relative;
  width: 100vw;
  height: 45px;
  /* line-height: 45px; */
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
  /* display: inline-block; */
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
  font-size: 16px;
  margin: 0 5px;
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
</style>