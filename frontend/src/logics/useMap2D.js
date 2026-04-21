// 引入相关模块
import { ref } from 'vue';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Point, Polygon } from 'ol/geom';
import { Style, Fill, Stroke, Text } from 'ol/style';
import { FullScreen, ScaleLine, MousePosition, defaults } from 'ol/control';
import { createStringXY } from 'ol/coordinate';
import { Modify } from 'ol/interaction';
import { fromLonLat, toLonLat } from 'ol/proj';
import { useVectorStore } from '@/stores/vectorStore';

// 常量定义--设施点图标样式
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

// 常量定义--设施用地颜色样式
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

// 导出二维地图
export function useMap2D(mapContainer, basemaps) {
  // 地图实例
  const map = ref(null)
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

  let currentHighlightFeature = null;
  let pointModify = null;
  let landsModify = null;

  // 地图初始化
  function initMap() {
    if (!mapContainer.value) return
    map.value = new Map({
      target: mapContainer.value,
      layers: [basemaps.value[0].layer, basemaps.value[0].roadNetLayer],
      view: new View({ center: fromLonLat([114.0245, 22.6115]), zoom: 15, projection: 'EPSG:3857' }),
      controls: defaults().extend([
        new FullScreen(),
        new ScaleLine(),
        new MousePosition({ coordinateFormat: createStringXY(4), projection: 'EPSG:4326', className: 'custom-mouse-position' })
      ])
    })
    setupMapInteractions()
  }

  // 二维地图切换
  function switchBasemap(basemapId) {
    if (!map.value) return;

    // 移除当前所有 TileLayer
    const oldLayers = map.value.getLayers().getArray().filter(layer => layer instanceof TileLayer);
    oldLayers.forEach(layer => map.value.removeLayer(layer));

    const newBasemap = basemaps.value.find(e => e.id === basemapId);
    if (newBasemap && newBasemap.layer) {
      map.value.addLayer(newBasemap.layer);
      if (newBasemap.roadNetLayer) map.value.addLayer(newBasemap.roadNetLayer);
    }
  }

  // 切换路网显示
  function toggleRoadNet(basemap) { basemap.roadNetLayer?.setVisible(basemap.roadNetVisible) }
  // 获取地图缩略图颜色
  function getThumbColor(id) { return { vector: '#1CAF50', satellite: '#795548', '3d': '#2196F3' }[id] || '#ccc' }

  // ==================== openlayers图层操作 ====================
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
    map.value.addLayer(layerObj.layer)

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
        zIndex: 4
      })
    }
  }

  // ==================== 交互与工具 ====================
  function setupMapInteractions() {
    map.value.on('click', (event) => {
      // 通过 featureState 访问
      if (vectorStore.mapInteraction.showLandsForm ||
        vectorStore.mapInteraction.isDrawing ||
        vectorStore.mapInteraction.showPointForm ||
        vectorStore.mapInteraction.isEditing) {
        return;
      }

      const features = map.value.getFeaturesAtPixel(event.pixel)
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

        if (featureState.isEditing.value && featureState.selectedFeature.value?.id === properties.id) return
        if (featureState.isEditing.value) exitEditMode()
        featureState.selectedFeature.value = properties
        popupPosition.value = { x: event.pixel[0] + 20, y: event.pixel[1] }
      } else {
        // 点击空白区域，清除高亮
        if (currentHighlightFeature) {
          currentHighlightFeature.setStyle(null)
          currentHighlightFeature = null
        }
        featureState.closePopup()
      }
    })

    map.value.on('pointermove', (event) => {
      map.value.getTargetElement().style.cursor = map.value.hasFeatureAtPixel(event.pixel) ? 'pointer' : ''
    })
  }

  // 修改设施点交互
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
    map.value.addInteraction(pointModify)
    pointModify.setActive(false)
  }

  // 修改设施用地交互
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
    map.value.addInteraction(landsModify)
    landsModify.setActive(false)
  }

  // 关闭信息弹窗
  function closePopup() {
    // 清除高亮
    if (currentHighlightFeature) {
      currentHighlightFeature.setStyle(null)
      currentHighlightFeature = null
    }

    if (featureState.isEditing.value) { featureState.exitEditMode(); return }
    featureState.selectedFeature.value = null
    featureState.popupPosition.value = null
  }

  return { map, layers, pointModify, landsModify, currentHighlightFeature, initMap, switchBasemap, toggleRoadNet, getThumbColor, toggleLayer, updateVectorLayer, setupMapInteractions, onTypeChange, closePopup }
}




