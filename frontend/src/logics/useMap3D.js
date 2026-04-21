import { ref, computed, watch } from 'vue';
import { getPointIcon, drawHalfCylinder, drawServiceRadius } from '@/utils/cesiumHelper';
import { getEducationSupply } from '@/services/api';
import { useVectorStore } from '@/stores/vectorStore';

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

export function useMap3D(cesiumContainer, TIANDITU_API_KEY, buildingColors, defaultBuildingColor, layers, activeBasemapId) {
  const vectorStore = useVectorStore();
  const viewer = ref(null);
  const cesiumInitialized = ref(false);
  const buildingDataSource = ref(null);
  let pointEntities = [];
  let landEntities = [];
  let cesiumPopupDiv = null;
  let cesiumWatcher = null;
  let lastHighlighted = null;

  let Cesium = null;
  let cesiumPopupCloseBtn = null;

  let isFlying = false;
  const isAnalyzing = ref(false);
  const currentAnalysisIndex = ref(0);
  const analysisFacilities = ref([]);

  let educationSupplyData = [];
  let analysisEntities = [];

  const analysisButtonText = computed(() => {
    if (isAnalyzing.value) {
      return `下一个 (${currentAnalysisIndex.value + 1}/${analysisFacilities.value.length})`;
    }
    return '漫游分析';
  });

  async function loadCesium() {
    if (cesiumInitialized.value) return;

    window.CESIUM_BASE_URL = '/cesium';

    Cesium = await import('cesium');
    await import('cesium/Build/Cesium/Widgets/widgets.css');

    const terrainProvider = await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true,
    });

    viewer.value = new Cesium.Viewer(cesiumContainer.value, {
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      baseLayerPicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      animation: false,
      timeline: false,
      infoBox: false,
      imageryProvider: false,
      selectionIndicator: false,
      terrainProvider: terrainProvider,
    });

    viewer.value.cesiumWidget.creditContainer.style.display = 'none';
    viewer.value.imageryLayers.removeAll();

    if (TIANDITU_API_KEY) {
      viewer.value.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
      }));
    }

    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(114.03, 22.58, 1800),
      orientation: {
        heading: Cesium.Math.toRadians(-10),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0
      }
    });

    await loadBuildings();
    await loadPointsAndLands();
    await loadEducationSupplyData();
    setupCesiumClickHandler();

    cesiumWatcher = watch(
      () => [
        layers.value.points.visible,
        layers.value.points.selectedType,
        layers.value.lands.visible,
        layers.value.lands.selectedType
      ],
      () => {
        if (activeBasemapId.value === '3d') {
          loadPointsAndLands();
        }
      }
    );

    cesiumInitialized.value = true;
  }

  function setupCesiumClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas);
    handler.setInputAction((click) => {
      const pick = viewer.value.scene.pick(click.position);

      if (lastHighlighted) {
        if (lastHighlighted.polygon) {
          if (lastHighlighted._originalOutlineColor !== undefined) {
            lastHighlighted.polygon.outlineColor = lastHighlighted._originalOutlineColor;
          }
          if (lastHighlighted._originalOutlineWidth !== undefined) {
            lastHighlighted.polygon.outlineWidth = lastHighlighted._originalOutlineWidth;
          }
          if (lastHighlighted._originalMaterial) {
            lastHighlighted.polygon.material = lastHighlighted._originalMaterial;
          }
        }
        if (lastHighlighted.billboard) {
          lastHighlighted.billboard.scale = lastHighlighted._originalScale || 0.8;
        }
        if (lastHighlighted.label) {
          lastHighlighted.label.font = lastHighlighted._originalFont || '14px "Microsoft YaHei", Arial, sans-serif';
        }
        lastHighlighted = null;
      }

      if (Cesium.defined(pick) && pick.id) {
        const entity = pick.id;
        lastHighlighted = entity;

        if (entity.polygon) {
          const currentOutlineColor = entity.polygon.outlineColor?.getValue();
          entity._originalOutlineColor = currentOutlineColor
            ? currentOutlineColor.clone()
            : Cesium.Color.TRANSPARENT.clone();
          entity._originalOutlineWidth = entity.polygon.outlineWidth?.getValue() || 1.0;
          if (!entity._originalMaterial) {
            entity._originalMaterial = entity.polygon.material;
          }
          entity.polygon.material = Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.3)');
          entity.polygon.outlineColor = Cesium.Color.WHITE;
          entity.polygon.outlineWidth = 1;
        }

        if (entity.billboard) {
          entity._originalScale = entity.billboard.scale?.getValue() || 0.8;
          entity.billboard.scale = entity._originalScale * 1.5;
        }

        if (entity.label) {
          entity._originalFont = entity.label.font?.getValue() || '14px "Microsoft YaHei", Arial, sans-serif';
          entity.label.font = '16px "Microsoft YaHei", Arial, sans-serif';
        }

        setTimeout(() => {
          const properties = entity.properties?.getValue() || entity._properties;
          if (properties) showCesiumPopup(properties, click.position);
        }, 100);
      } else {
        closeCesiumPopup();
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  async function loadBuildings() {
    try {
      const response = await fetch('http://localhost:3000/api/buildings');
      const result = await response.json();

      buildingDataSource.value = await Cesium.GeoJsonDataSource.load(result.data, {
        stroke: Cesium.Color.TRANSPARENT,
        fill: Cesium.Color.fromCssColorString('rgba(200,200,200,0.6)')
      });

      const entities = buildingDataSource.value.entities.values;
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        const properties = entity.properties;

        let height = properties?.height?.getValue();
        if (!height || height === 0) {
          const upFloor = properties?.up_floor?.getValue();
          height = upFloor ? upFloor * 3 : 10;
        }

        const type = entity.properties?.type?.getValue();
        const color = buildingColors[type] || defaultBuildingColor;

        if (entity.polygon) {
          entity.polygon.material = Cesium.Color.fromCssColorString(color);
          entity.polygon.extrudedHeight = height;
          entity.polygon.height = 0;
          entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
          entity.polygon.extrudedHeightReference = Cesium.HeightReference.RELATIVE_TO_GROUND;
        }
      }

      viewer.value.dataSources.add(buildingDataSource.value);
    } catch (error) {
      console.error('加载建筑失败', error);
    }
  }

  async function loadPointsAndLands() {
    pointEntities.forEach(e => viewer.value.entities.remove(e));
    landEntities.forEach(e => viewer.value.entities.remove(e));
    pointEntities = [];
    landEntities = [];

    if (vectorStore.points.length === 0) {
      await vectorStore.loadPoints();
    }
    if (vectorStore.lands.length === 0) {
      await vectorStore.loadLands();
    }

    const pointsConfig = layers.value.points;
    const landsConfig = layers.value.lands;

    if (pointsConfig.visible) {
      let filteredPoints = vectorStore.points;
      if (pointsConfig.selectedType !== '全部类型') {
        filteredPoints = filteredPoints.filter(p => p.type === pointsConfig.selectedType);
      }

      filteredPoints.forEach(point => {
        const [lng, lat] = point.geometry.coordinates;
        const entity = viewer.value.entities.add({
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
          billboard: {
            image: getPointIcon(point.type),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            scale: 0.8,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          label: {
            text: point.name,
            font: '14px "Microsoft YaHei", Arial, sans-serif',
            pixelOffset: new Cesium.Cartesian2(15, -2),
            fillColor: Cesium.Color.BLACK,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          },
          properties: point
        });
        pointEntities.push(entity);
      });
    }

    if (landsConfig.visible) {
      let filteredLands = vectorStore.lands;
      if (landsConfig.selectedType !== '全部类型') {
        filteredLands = filteredLands.filter(l => l.type === landsConfig.selectedType);
      }

      filteredLands.forEach(land => {
        const hierarchy = new Cesium.PolygonHierarchy(
          land.geometry.coordinates[0].map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1])),
          land.geometry.coordinates.slice(1).map(ring =>
            ring.map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1]))
          )
        );
        const entity = viewer.value.entities.add({
          polygon: {
            hierarchy: hierarchy,
            material: Cesium.Color.fromCssColorString(LAND_STYLES[land.type] || 'rgba(0,0,0,0.5)'),
            outline: true,
            outlineColor: Cesium.Color.WHITE
          },
          properties: land
        });
        landEntities.push(entity);
      });
    }
  }

  async function loadEducationSupplyData() {
    try {
      const res = await getEducationSupply();
      if (res.success) educationSupplyData = res.data;
      else console.error('加载供需数据失败', res.message);
    } catch (err) {
      console.error('加载供需数据异常', err);
    }
  }

  async function startFlythrough() {
    if (!viewer.value || isFlying) return;
    isFlying = true;

    try {
      viewer.value.scene.screenSpaceCameraController.enableInputs = false;

      const flightPath = [
        { lng: 114.0310, lat: 22.5900, height: 1200, heading: -21, pitch: -40, duration: 2 },
        { lng: 114.0305, lat: 22.5940, height: 800, heading: -26, pitch: -30, duration: 2 },
        { lng: 114.0288, lat: 22.5980, height: 550, heading: -30, pitch: -23, duration: 2 },
        { lng: 114.0268, lat: 22.6020, height: 400, heading: -33, pitch: -18, duration: 2 },
        { lng: 114.0240, lat: 22.6060, height: 350, heading: -35, pitch: -15, duration: 2 },
      ];

      for (let i = 0; i < flightPath.length; i++) {
        const point = flightPath[i];
        await new Promise((resolve) => {
          viewer.value.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height),
            orientation: {
              heading: Cesium.Math.toRadians(point.heading),
              pitch: Cesium.Math.toRadians(point.pitch),
              roll: 0
            },
            duration: point.duration,
            easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
            complete: () => resolve(),
            cancel: () => resolve()
          });
        });
      }

      await new Promise((resolve) => {
        viewer.value.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(114.03, 22.58, 1800),
          orientation: {
            heading: Cesium.Math.toRadians(-10),
            pitch: Cesium.Math.toRadians(-30),
            roll: 0
          },
          duration: 3,
          easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
          complete: resolve
        });
      });
    } catch (error) {
      console.error('飞行漫游出错', error);
    } finally {
      viewer.value.scene.screenSpaceCameraController.enableInputs = true;
      isFlying = false;
    }
  }

  async function handleAnalysisClick() {
    if (!viewer.value) return;

    if (!isAnalyzing.value) {
      await startAnalysisSession();
    } else {
      await analyzeNextFacility();
    }
  }

  async function startAnalysisSession() {
    clearAnalysisGraphics();

    const facilities = educationSupplyData.filter(f =>
      ['幼儿园', '小学', '初中', '九年一贯制学校'].includes(f.type)
    );

    if (facilities.length === 0) {
      alert('没有可分析的教育设施');
      return;
    }

    analysisFacilities.value = facilities.slice(0, 10);
    currentAnalysisIndex.value = 0;
    isAnalyzing.value = true;
    isFlying = true;

    showAnalysisPanel();
    viewer.value.scene.screenSpaceCameraController.enableInputs = false;

    try {
      await analyzeCurrentFacility();
    } catch (error) {
      console.error('分析出错', error);
      resetAnalysisState();
    }
  }

  async function analyzeCurrentFacility() {
    const fac = analysisFacilities.value[currentAnalysisIndex.value];
    await flyToFacility(fac);
    await showAnalysisForFacility(fac);
  }

  async function showAnalysisForFacility(fac) {
    clearAnalysisGraphics();

    let radius = 0;
    if (fac.type === '幼儿园') radius = 300;
    else if (fac.type === '小学') radius = 500;
    else if (fac.type === '初中') radius = 1000;
    else if (fac.type === '九年一贯制学校') radius = 1000;

    const minHeight = 0;
    const maxHeight = 600;
    const minScale = 0;
    const maxScale = 6000;

    let actualHeight = minHeight + (fac.scale - minScale) / (maxScale - minScale) * (maxHeight - minHeight);
    actualHeight = Math.min(maxHeight, Math.max(minHeight, actualHeight));

    let demandHeight = minHeight + (fac.demand - minScale) / (maxScale - minScale) * (maxHeight - minHeight);
    demandHeight = Math.min(maxHeight, Math.max(minHeight, demandHeight));

    let color = '#808080';
    if (fac.status === 'sufficient') color = '#4caf50';
    else if (fac.status === 'balanced') color = '#ffc107';
    else if (fac.status === 'insufficient') color = '#f44336';

    drawDualColorColumn(fac.lng, fac.lat, actualHeight, demandHeight, fac.scale, fac.demand, fac.name, analysisEntities);
    drawServiceRadius(Cesium, viewer.value, fac.lng, fac.lat, radius, color, analysisEntities);

    showSupplyDemandPanel(fac);
  }

  function drawDualColorColumn(lng, lat, actualHeight, demandHeight, actualScale, demandScale, name, analysisEntities) {
    const splitAngle = -35 * Math.PI / 180;
    const gap = 5;
    const gapOffset = gap / 2 / 111000;

    const greenLng = lng - gapOffset;
    const greenLat = lat - gapOffset;
    const redLng = lng + gapOffset;
    const redLat = lat + gapOffset;

    const supplyColumn = drawHalfCylinder(Cesium, viewer.value, greenLng, greenLat, actualHeight, '#4caf50', splitAngle - Math.PI, splitAngle);
    const demandColumn = drawHalfCylinder(Cesium, viewer.value, redLng, redLat, demandHeight, '#f44336', splitAngle, splitAngle + Math.PI);

    const horizontalOffset = 5;
    const lngOffset = horizontalOffset / 111000;

    const supplyLabel = viewer.value.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng - lngOffset, lat, actualHeight + 30),
      label: {
        text: `${actualScale}`,
        font: 'bold 16px "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#4caf50'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
        pixelOffset: new Cesium.Cartesian2(-5, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    const demandLabel = viewer.value.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng + lngOffset, lat, demandHeight + 30),
      label: {
        text: `${demandScale}`,
        font: 'bold 16px "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#f44336'),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(5, 0),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    analysisEntities.push(supplyColumn, demandColumn, supplyLabel, demandLabel);
  }

  function showSupplyDemandPanel(fac) {
    const container = document.querySelector('.analysis-content');
    if (!container) return;

    let html = '';
    if (!fac || fac.status === 'no_data') {
      html = '<p style="color: #aaa; text-align: center;">暂无数据</p>';
    } else {
      html = `<p class="school-name">${fac.name}</p>`;
      html += `<p><strong>学校类型：</strong> ${fac.type}</p>`;
      html += `<p><strong>实际学位：</strong> ${fac.scale} 个</p>`;
      html += `<p><strong>覆盖人口：</strong> ${fac.population.toLocaleString()} 人</p>`;

      if (fac.type === '九年一贯制学校') {
        html += `<p><strong>小学需求：</strong> ${fac.demandPrimary || 0} 学位</p>`;
        html += `<p><strong>初中需求：</strong> ${fac.demandJunior || 0} 学位</p>`;
        html += `<p><strong>总需求：</strong> ${fac.demand} 学位</p>`;
      } else {
        html += `<p><strong>需求学位：</strong> ${fac.demand} 个</p>`;
      }

      const ratioColor = fac.supplyRatio >= 1.1 ? '#4caf50' : (fac.supplyRatio >= 0.9 ? '#ffc107' : '#f44336');
      html += `<p><strong>供需比：</strong> <span style="color: ${ratioColor}; font-weight: bold;">${fac.supplyRatio || '-'}</span></p>`;

      let statusText = '';
      if (fac.status === 'sufficient') statusText = '充足 ✅';
      else if (fac.status === 'balanced') statusText = '平衡 ⚠️';
      else if (fac.status === 'insufficient') statusText = '不足 ❌';
      html += `<p><strong>供需评价：</strong> ${statusText}</p>`;
    }
    container.innerHTML = html;
  }

  function flyToFacility(fac) {
    return new Promise((resolve) => {
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(fac.lng + 0.013, fac.lat - 0.013, 1500),
        orientation: {
          heading: Cesium.Math.toRadians(-45),
          pitch: Cesium.Math.toRadians(-35),
          roll: 0
        },
        duration: 1.5,
        complete: resolve,
        cancel: resolve
      });
    });
  }

  async function analyzeNextFacility() {
    const nextIndex = currentAnalysisIndex.value + 1;
    if (nextIndex < analysisFacilities.value.length) {
      currentAnalysisIndex.value = nextIndex;
      await analyzeCurrentFacility();
    } else {
      await finishAnalysis();
    }
  }

  async function finishAnalysis() {
    await new Promise((resolve) => {
      viewer.value.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(114.03, 22.58, 1800),
        orientation: {
          heading: Cesium.Math.toRadians(-10),
          pitch: Cesium.Math.toRadians(-30),
          roll: 0
        },
        duration: 2,
        complete: resolve
      });
    });

    clearAnalysisGraphics();
    hideAnalysisPanel();
    document.querySelector('.analysis-content').innerHTML = '<p style="color: #aaa; text-align: center;">分析中...</p>';
    resetAnalysisState();
  }

  function resetAnalysisState() {
    isAnalyzing.value = false;
    currentAnalysisIndex.value = 0;
    analysisFacilities.value = [];
    isFlying = false;
    viewer.value.scene.screenSpaceCameraController.enableInputs = true;
  }

  function clearAnalysisGraphics() {
    if (window.rippleIntervals) {
      window.rippleIntervals.forEach(interval => clearInterval(interval));
      window.rippleIntervals = [];
    }

    // 移除所有分析图形（柱体、波纹、标注）
    const entities = viewer.value?.entities;
    if (entities) {
      const toRemove = [];
      entities.values.forEach(entity => {
        // 柱体：有 polygon 且 extrudedHeight 存在
        // 波纹：有 ellipse
        // 标注：有 label 且文本是纯数字
        if ((entity.polygon && entity.polygon.extrudedHeight !== undefined) ||
          entity.ellipse ||
          (entity.label && /^\d+$/.test(entity.label.text))) {
          toRemove.push(entity);
        }
      });
      toRemove.forEach(entity => entities.remove(entity));
    }

    analysisEntities = [];
  }

  function showAnalysisPanel() {
    const panel = document.querySelector('.analysis-panel');
    if (panel) panel.style.display = 'block';
  }

  function hideAnalysisPanel() {
    const panel = document.querySelector('.analysis-panel');
    if (panel) panel.style.display = 'none';
  }

  function showCesiumPopup(properties, screenPosition) {
    if (!cesiumPopupDiv) {
      cesiumPopupDiv = document.createElement('div');
      cesiumPopupDiv.className = 'cesium-popup';
      document.body.appendChild(cesiumPopupDiv);

      cesiumPopupCloseBtn = document.createElement('button');
      cesiumPopupCloseBtn.className = 'cesium-popup-close';
      cesiumPopupCloseBtn.innerHTML = '×';
      cesiumPopupCloseBtn.onclick = closeCesiumPopup;
      cesiumPopupDiv.appendChild(cesiumPopupCloseBtn);
    }

    let html = `<h4>${properties.name || '未命名'}</h4>`;
    if (properties.level !== undefined) {
      html += `<p><strong>设施级别：</strong>${properties.level || '-'}</p>`;
      html += `<p><strong>设施类型：</strong>${properties.type || '-'}</p>`;
      html += `<p><strong>建筑面积：</strong>${properties.floor_area || 0}平方米</p>`;
      html += `<p><strong>服务规模：</strong>${properties.scale || 0}人</p>`;
    } else if (properties.site_area !== undefined) {
      html += `<p><strong>用地类型：</strong>${properties.type || '-'}</p>`;
      html += `<p><strong>用地面积：</strong>${properties.site_area || 0}平方米</p>`;
    } else {
      if (properties.type) html += `<p><strong>建筑类型：</strong>${properties.type}</p>`;
      if (properties.height) html += `<p><strong>建筑高度：</strong>${properties.height}米</p>`;
      if (properties.up_floor) html += `<p><strong>地上层数：</strong>${properties.up_floor}层</p>`;
      if (properties.down_floor) html += `<p><strong>地下层数：</strong>${properties.down_floor}层</p>`;
      if (properties.floor_area) html += `<p><strong>建筑面积：</strong>${properties.floor_area}平方米</p>`;
    }

    cesiumPopupDiv.innerHTML = html;
    cesiumPopupDiv.appendChild(cesiumPopupCloseBtn);
    cesiumPopupDiv.style.display = 'block';
    cesiumPopupDiv.style.left = `${screenPosition.x + 15}px`;
    cesiumPopupDiv.style.top = `${screenPosition.y}px`;
  }

  function closeCesiumPopup() {
    if (cesiumPopupDiv) {
      cesiumPopupDiv.style.display = 'none';
    }
  }

  return {
    viewer,
    cesiumInitialized,
    loadCesium,
    startFlythrough,
    handleAnalysisClick,
    loadPointsAndLands,
    closeCesiumPopup,
    analysisButtonText,
  };
}