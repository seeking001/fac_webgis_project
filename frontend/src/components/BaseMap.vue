<template>
  <div class="map-wrapper">
    <div class="map-controls">
      <h3>地图控制</h3>
      <div class="control-item">
        <h4>加载数据：</h4>
        <button @click="loadFacilities">公共设施</button>
      </div>
    </div>
    <div ref="mapContainer" class="map-container"></div>
  </div>
</template>

<script setup>
// 引入vue组件
import { onMounted, onUnmounted, ref } from 'vue';
// 引入openlayers组件
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import Feature from 'ol/Feature.js';
import { fromLonLat } from 'ol/proj';
import XYZ from 'ol/source/XYZ';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import { Style, Circle, Fill, Stroke } from 'ol/style';
import { Point } from 'ol/geom';

// 引入状态管理和工具模块
import { useMapDataStore } from '../stores/mapData'
import { getMapBbox } from '../utils/mapHelpers';

// 地图容器和地图实例
const mapContainer = ref(null);
let map = null;

// Pinia存储实例
const mapDataStore = useMapDataStore();

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
      })
    ],
    view: new View({
      center: fromLonLat([114.00, 22.55]),
      zoom: 12
    })
  })
}

// 创建获取设施函数
let facilitiesLayer = null;
async function loadFacilities(){
  const bbox = getMapBbox(map);
  await mapDataStore.loadFacilities(bbox);

  // 获取设施数据
  const facilities = mapDataStore.facilities;

  // 创建矢量源
  const vectorSource = new VectorSource();

  // 遍历设施数据，将每个设施点添加到矢量源
  facilities.forEach(facility => {
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
  if(facilitiesLayer) {
    map.removeLayer(facilitiesLayer);
  }

  // 创建新的矢量图层
  facilitiesLayer = new VectorLayer({
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
  map.addLayer(facilitiesLayer);
}
</script>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100vw;
  height: 94vh;
  overflow: hidden;
}

.map-controls {
  display: inline-block;
  width: 100vw;
  height: 45px;
  line-height: 45px;
  background-color: rgba(100, 30, 155, 0.8);
}

.map-controls h3 {
  display: inline;
  padding: 0 20px;
  font-size: 20px;
  color: #fff;
  border-right: 1px solid rgba(255, 255, 255, 0.5);
}

.control-item {
  display: inline-block;
  line-height: 40px;
  margin-left: 15px;
  padding: 0 10px;
  background-color: #ccc;
  border-radius: 6px 6px 0 0;
}

.control-item h4 {
  display:inline-block;
  font-size: 16px;
}

.control-item button {
  display: inline-block;
  font-size: 16px;
}

.map-container {
  width: 100vw;
  height: 88vh;
}
</style>