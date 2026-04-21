import { ref, computed, watch } from 'vue';
import { getPointIcon, drawHalfCylinder, drawServiceRadius } from '@/utils/cesiumHelper';
import { getEducationSupply } from '@/services/api';

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

export function useMap3D(cesiumContainer, TIANDITU_API_KEY, buildingColors, defaultBuildingColor, vectorStore, layers, activeBasemapId) {
  const viewer = ref(null);          // Cesium Viewer 实例
  const cesiumInitialized = ref(false);   // Cesium 是否已初始化的标志
  const buildingDataSource = ref(null);
  let pointEntities = [];
  let landEntities = [];
  let cesiumPopupDiv = null  // Cesium 弹窗元素
  let cesiumWatcher = null  // 保存Cesium的 watch 返回值
  let lastHighlighted = null

  let Cesium = null    // 保存 Cesium 模块引用
  let cesiumPopupCloseBtn = null  // Cesium 弹窗关闭按钮

  // 漫游状态
  let isFlying = false   // 漫游飞行状态
  const isAnalyzing = ref(false)           // 是否处于分析模式
  const currentAnalysisIndex = ref(0)      // 当前分析到的设施索引
  const analysisFacilities = ref([])       // 待分析的设施列表

  // 教育设施供需分析相关变量
  let educationSupplyData = []          // 存储供需数据
  let analysisEntities = [];  // 存储所有分析图形

  // 计算属性
  const analysisButtonText = computed(() => {
    if (isAnalyzing.value) {
      return `下一个 (${currentAnalysisIndex.value + 1}/${analysisFacilities.value.length})`
    }
    return '漫游分析'
  })


  // 动态加载 Cesium 的函数
  async function loadCesium() {
    if (cesiumInitialized) return

    // 设置 Cesium 基础路径
    window.CESIUM_BASE_URL = '/cesium'

    // 动态导入 Cesium 核心库和样式
    Cesium = await import('cesium')
    await import('cesium/Build/Cesium/Widgets/widgets.css')

    // 创建地形
    const terrainProvider = await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true,
      // requestWaterMask: true
    })

    // 初始化 Viewer
    viewer.value = new Cesium.Viewer(cesiumContainer.value, {
      geocoder: false,              // 查找位置工具
      homeButton: false,            // 返回初始位置
      sceneModePicker: false,       // 选择视角模式
      baseLayerPicker: false,       // 图层选择器
      navigationHelpButton: false,  // 导航帮助按钮
      fullscreenButton: false,      // 全屏按钮
      animation: false,             // 动画器件
      timeline: false,              // 时间线
      infoBox: false,               // 实体信息
      imageryProvider: false,       // 禁用默认影像提供器
      selectionIndicator: false,    // 选择指示器
      terrainProvider: terrainProvider,  // 使用地形数据
    })

    // 移除 Cesium 默认的logo
    viewer.value.cesiumWidget.creditContainer.style.display = 'none'

    // 移除原生默认地图
    viewer.value.imageryLayers.removeAll()

    if (TIANDITU_API_KEY) {
      // 天地图卫星地图
      viewer.value.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
        url: `https://t0.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
      }))

      // 天地图卫星地图注记
      // viewer.value.imageryLayers.addImageryProvider(new Cesium.UrlTemplateImageryProvider({
      //   url: `https://t0.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${TIANDITU_API_KEY}`,
      //   subdomains: ['0', '1', '2', '3', '4', '5', '6', '7']
      // }))
    }

    // 设置初始相机位置
    viewer.value.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(114.03, 22.58, 1800),
      orientation: {
        heading: Cesium.Math.toRadians(-10),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0
      }
    })

    // 加载建筑数据
    await loadBuildings()
    // 加载设施点和用地
    await loadPointsAndLands()
    // 预加载教育设施供需分析数据
    await loadEducationSupplyData()
    // 设置点击事件
    setupCesiumClickHandler()

    // 监听
    cesiumWatcher = watch(
      () => [
        layers.value.points.visible,
        layers.value.points.selectedType,
        layers.value.lands.visible,
        layers.value.lands.selectedType
      ],  // 监听图层显示和类型筛选的变化
      () => {
        if (activeBasemapId.value === '3d') {
          loadPointsAndLands()  // 重新加载点和面
        }
      }
    )

    cesiumInitialized.value = true
  }

  // 点击事件：显示建筑/设施信息
  function setupCesiumClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.value.scene.canvas)
    handler.setInputAction((click) => {
      const pick = viewer.value.scene.pick(click.position)

      // 清除之前的高亮
      if (lastHighlighted) {
        if (lastHighlighted.polygon) {
          // 恢复原始样式（使用保存的值）
          if (lastHighlighted._originalOutlineColor !== undefined) {
            lastHighlighted.polygon.outlineColor = lastHighlighted._originalOutlineColor
          }
          if (lastHighlighted._originalOutlineWidth !== undefined) {
            lastHighlighted.polygon.outlineWidth = lastHighlighted._originalOutlineWidth
          }
          if (lastHighlighted._originalMaterial) {
            lastHighlighted.polygon.material = lastHighlighted._originalMaterial
          }
        }
        if (lastHighlighted.billboard) {
          lastHighlighted.billboard.scale = lastHighlighted._originalScale || 0.8
        }
        if (lastHighlighted.label) {
          lastHighlighted.label.font = lastHighlighted._originalFont || '14px "Microsoft YaHei", Arial, sans-serif'
        }
        lastHighlighted = null
      }

      // 设置新的高亮
      if (Cesium.defined(pick) && pick.id) {
        const entity = pick.id
        lastHighlighted = entity

        // 保存原始样式
        if (entity.polygon) {
          // 关键修正：使用 getValue() 获取实际值
          const currentOutlineColor = entity.polygon.outlineColor?.getValue()
          // 如果当前有颜色值，克隆它；否则使用透明色
          entity._originalOutlineColor = currentOutlineColor
            ? currentOutlineColor.clone()
            : Cesium.Color.TRANSPARENT.clone()

          entity._originalOutlineWidth = entity.polygon.outlineWidth?.getValue() || 1.0

          if (!entity._originalMaterial) {
            entity._originalMaterial = entity.polygon.material
          }

          // 设置高亮样式
          entity.polygon.material = Cesium.Color.fromCssColorString('rgba(255, 255, 255, 0.3)')
          entity.polygon.outlineColor = Cesium.Color.WHITE
          entity.polygon.outlineWidth = 1
        }

        if (entity.billboard) {
          entity._originalScale = entity.billboard.scale?.getValue() || 0.8
          entity.billboard.scale = entity._originalScale * 1.5
        }

        if (entity.label) {
          entity._originalFont = entity.label.font?.getValue() || '14px "Microsoft YaHei", Arial, sans-serif'
          entity.label.font = '16px "Microsoft YaHei", Arial, sans-serif'
        }

        // 显示弹窗
        setTimeout(() => {
          const properties = entity.properties?.getValue() || entity._properties
          if (properties) showCesiumPopup(properties, click.position)
        }, 100)
      } else {
        closeCesiumPopup()
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  // 加载建筑数据的函数
  async function loadBuildings() {
    try {
      const response = await fetch('http://localhost:3000/api/buildings')
      const result = await response.json()

      buildingDataSource = await Cesium.GeoJsonDataSource.load(result.data, {
        stroke: Cesium.Color.TRANSPARENT,
        fill: Cesium.Color.fromCssColorString('rgba(200,200,200,0.6)')
      })

      // 自定义建筑样式和高度
      const entities = buildingDataSource.entities.values
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        const properties = entity.properties

        let height = properties?.height?.getValue()
        if (!height || height === 0) {
          const upFloor = properties?.up_floor?.getValue()
          height = upFloor ? upFloor * 3 : 10
        }

        const type = entity.properties?.type?.getValue()
        const color = buildingColors[type] || defaultBuildingColor

        if (entity.polygon) {
          entity.polygon.material = Cesium.Color.fromCssColorString(color)
          entity.polygon.extrudedHeight = height
          entity.polygon.height = 0
          // 解决地形偏移问题
          entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
          entity.polygon.extrudedHeightReference = Cesium.HeightReference.RELATIVE_TO_GROUND
        }
      }

      viewer.value.dataSources.add(buildingDataSource)
    } catch (error) {
      console.error('加载建筑失败', error)
    }
  }

  // 加载设施点和用地
  async function loadPointsAndLands() {
    // 清除旧数据
    pointEntities.forEach(e => viewer.value.entities.remove(e))
    landEntities.forEach(e => viewer.value.entities.remove(e))
    pointEntities = []
    landEntities = []

    // 确保数据已加载
    if (vectorStore.points.length === 0) {
      await vectorStore.loadPoints()
    }
    if (vectorStore.lands.length === 0) {
      await vectorStore.loadLands()
    }

    // 获取图层配置
    const pointsConfig = layers.value.points
    const landsConfig = layers.value.lands

    // 按配置过滤设施点
    if (pointsConfig.visible) {
      let filteredPoints = vectorStore.points
      if (pointsConfig.selectedType !== '全部类型') {
        filteredPoints = filteredPoints.filter(p => p.type === pointsConfig.selectedType)
      }

      filteredPoints.forEach(point => {
        const [lng, lat] = point.geometry.coordinates
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
        })
        pointEntities.push(entity)
      })
    }

    // 按配置过滤设施用地
    if (landsConfig.visible) {
      let filteredLands = vectorStore.lands
      if (landsConfig.selectedType !== '全部类型') {
        filteredLands = filteredLands.filter(l => l.type === landsConfig.selectedType)
      }

      filteredLands.forEach(land => {
        const hierarchy = new Cesium.PolygonHierarchy(
          land.geometry.coordinates[0].map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1])),
          land.geometry.coordinates.slice(1).map(ring =>
            ring.map(coord => Cesium.Cartesian3.fromDegrees(coord[0], coord[1]))
          )
        )
        const entity = viewer.value.entities.add({
          polygon: {
            hierarchy: hierarchy,
            material: Cesium.Color.fromCssColorString(LAND_STYLES[land.type] || 'rgba(0,0,0,0.5)'),
            outline: true,
            outlineColor: Cesium.Color.WHITE
          },
          properties: land
        })
        landEntities.push(entity)
      })
    }
  }

  // 预加载教育设施供需分析数据
  async function loadEducationSupplyData() {
    try {
      const res = await getEducationSupply();
      if (res.success) educationSupplyData = res.data;
      else console.error('加载供需数据失败', res.message);
    } catch (err) {
      console.error('加载供需数据异常', err);
    }
  }

  // 漫游飞行函数
  async function startFlythrough() {
    if (!viewer || isFlying) return
    isFlying = true

    try {
      // 禁用用户交互
      viewer.value.scene.screenSpaceCameraController.enableInputs = false

      // 定义飞行路径
      const flightPath = [
        { lng: 114.0310, lat: 22.5900, height: 1200, heading: -21, pitch: -40, duration: 2 },
        { lng: 114.0305, lat: 22.5940, height: 800, heading: -26, pitch: -30, duration: 2 },
        { lng: 114.0288, lat: 22.5980, height: 550, heading: -30, pitch: -23, duration: 2 },
        { lng: 114.0268, lat: 22.6020, height: 400, heading: -33, pitch: -18, duration: 2 },
        { lng: 114.0240, lat: 22.6060, height: 350, heading: -35, pitch: -15, duration: 2 },
      ]

      // 逐个航点飞行
      for (let i = 0; i < flightPath.length; i++) {
        const point = flightPath[i]
        // 使用 Promise 包装 flyTo，确保等待完成
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
            complete: () => {
              resolve()  // 飞行完成后继续下一个
            },
            cancel: () => {
              resolve()  // 如果被取消，也继续
            }
          })
        })
      }

      // 最后飞回整体视图
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
        })
      })
    } catch (error) {
      console.error('飞行漫游出错', error)
    } finally {
      viewer.value.scene.screenSpaceCameraController.enableInputs = true
      isFlying = false
    }
  }

  // 漫游分析函数1 -- 教育设施供需分析 -- 按钮点击逐个分析
  async function handleAnalysisClick() {
    if (!viewer) return

    if (!isAnalyzing.value) {
      // 首次点击：开始分析
      await startAnalysisSession()
    } else {
      // 分析中：下一个
      await analyzeNextFacility()
    }
  }

  // 漫游分析函数2 -- 教育设施供需分析 -- 开始分析会话
  async function startAnalysisSession() {
    // 清理旧状态
    clearAnalysisGraphics()

    // 筛选教育设施
    const facilities = educationSupplyData.filter(f =>
      ['幼儿园', '小学', '初中', '九年一贯制学校'].includes(f.type)
    )

    if (facilities.length === 0) {
      alert('没有可分析的教育设施')
      return
    }

    // 初始化状态
    analysisFacilities.value = facilities.slice(0, 10)
    currentAnalysisIndex.value = 0
    isAnalyzing.value = true
    isFlying = true

    // 显示分析面板
    showAnalysisPanel()

    // 禁用用户交互
    viewer.value.scene.screenSpaceCameraController.enableInputs = false

    try {
      // 分析第一个设施
      await analyzeCurrentFacility()
    } catch (error) {
      console.error('分析出错', error)
      resetAnalysisState()
    }
  }

  // 漫游分析函数3 -- 教育设施供需分析 -- 分析当前索引的设施
  async function analyzeCurrentFacility() {
    const fac = analysisFacilities.value[currentAnalysisIndex.value]

    // 飞行到设施
    await flyToFacility(fac)

    // 清除上一个设施的图形，绘制当前设施的图形
    clearAnalysisGraphics()
    await showAnalysisForFacility(fac)
  }

  // 漫游分析函数4 -- 教育设施供需分析 -- 显示设施的分析效果
  async function showAnalysisForFacility(fac) {
    clearAnalysisGraphics();

    // 根据设施类型设置服务半径
    let radius = 0;
    if (fac.type === '幼儿园') radius = 300;
    else if (fac.type === '小学') radius = 500;
    else if (fac.type === '初中') radius = 1000;
    else if (fac.type === '九年一贯制学校') radius = 1000;

    // 计算柱体高度
    const minHeight = 0;
    const maxHeight = 600;
    const minScale = 0;
    const maxScale = 6000;

    let actualHeight = minHeight + (fac.scale - minScale) / (maxScale - minScale) * (maxHeight - minHeight);
    actualHeight = Math.min(maxHeight, Math.max(minHeight, actualHeight));

    let demandHeight = minHeight + (fac.demand - minScale) / (maxScale - minScale) * (maxHeight - minHeight);
    demandHeight = Math.min(maxHeight, Math.max(minHeight, demandHeight));

    // 根据供需状态设置颜色
    let color = '#808080';
    let status = fac.status;
    if (status === 'sufficient') color = '#4caf50';
    else if (status === 'balanced') color = '#ffc107';
    else if (status === 'insufficient') color = '#f44336';

    // 获取需求学位数
    let demandScale = fac.demand;

    // 绘制双色柱
    drawDualColorColumn(
      fac.lng, fac.lat,
      actualHeight, demandHeight,
      fac.scale, fac.demand,
      fac.name
    );

    // 绘制服务半径圆盘
    drawServiceRadius(Cesium, viewer, fac.lng, fac.lat, radius, color, analysisEntities);

    // 显示仪表盘
    showSupplyDemandPanel(fac);
  }

  // 漫游分析函数5 -- 教育设施供需分析 -- 绘制双色柱
  function drawDualColorColumn(lng, lat, actualHeight, demandHeight, actualScale, demandScale, name) {
    const splitAngle = -35 * Math.PI / 180;  // 分割角度（-35度，向右倾斜）
    const gap = 5;  // 间距（米）
    const gapOffset = gap / 2 / 111000;  // 转换为经纬度偏移（约 0.0000135）

    // 绿色半圆柱向左偏移
    const greenLng = lng - gapOffset;
    const greenLat = lat - gapOffset;

    // 红色半圆柱向右偏移
    const redLng = lng + gapOffset;
    const redLat = lat + gapOffset;

    // 绿色半圆柱（供给）
    const supplyColumn = drawHalfCylinder(Cesium, viewer, greenLng, greenLat, actualHeight, '#4caf50', splitAngle - Math.PI, splitAngle);

    // 红色半圆柱（需求）
    const demandColumn = drawHalfCylinder(Cesium, viewer, redLng, redLat, demandHeight, '#f44336', splitAngle, splitAngle + Math.PI);

    const horizontalOffset = 5;  // 左右偏移 5 米
    const lngOffset = horizontalOffset / 111000;
    // 供给标签（绿色，位于绿色柱一侧，偏左）
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

    // 需求标签（红色，位于红色柱一侧，偏右）
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

  // 漫游分析函数8 -- 教育设施供需分析 -- 供需分析面板
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

  // 漫游分析函数9 -- 教育设施供需分析 -- 飞行到指定设施
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

  // 漫游分析函数10 -- 教育设施供需分析 -- 分析下一个设施
  async function analyzeNextFacility() {
    const nextIndex = currentAnalysisIndex.value + 1

    if (nextIndex < analysisFacilities.value.length) {
      // 下一个
      currentAnalysisIndex.value = nextIndex
      await analyzeCurrentFacility()
    } else {
      // 最后一个结束分析
      await finishAnalysis()
    }
  }

  // 漫游分析函数11 -- 教育设施供需分析 -- 结束分析
  async function finishAnalysis() {
    // 飞回初始视图
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
      })
    })

    // 清理
    clearAnalysisGraphics()
    hideAnalysisPanel()
    document.querySelector('.analysis-content').innerHTML =
      '<p style="color: #aaa; text-align: center;">分析中...</p>'

    resetAnalysisState()
  }

  // 漫游分析函数12 -- 教育设施供需分析 -- 重置分析状态
  function resetAnalysisState() {
    isAnalyzing.value = false
    currentAnalysisIndex.value = 0
    analysisFacilities.value = []
    isFlying = false
    viewer.value.scene.screenSpaceCameraController.enableInputs = true  // 恢复用户交互
  }

  // 漫游分析函数13 -- 教育设施供需分析 -- 清除分析图形和停止动画
  function clearAnalysisGraphics() {
    // 清理所有波纹动画
    if (window.rippleIntervals) {
      window.rippleIntervals.forEach(interval => clearInterval(interval));
      window.rippleIntervals = [];
    }

    for (const entity of analysisEntities) {
      if (entity && viewer.value.entities.contains(entity)) {
        viewer.value.entities.remove(entity);
      }
    }
    analysisEntities = [];
  }

  // 显示供需分析面板
  function showAnalysisPanel() {
    const panel = document.querySelector('.analysis-panel');
    if (panel) panel.style.display = 'block';
  }

  // 隐藏供需分析面板
  function hideAnalysisPanel() {
    const panel = document.querySelector('.analysis-panel');
    if (panel) panel.style.display = 'none';
  }

  // 显示三维地图弹窗
  function showCesiumPopup(properties, screenPosition) {
    if (!cesiumPopupDiv) {
      cesiumPopupDiv = document.createElement('div');
      cesiumPopupDiv.className = 'cesium-popup';
      document.body.appendChild(cesiumPopupDiv);

      // 添加关闭按钮
      cesiumPopupCloseBtn = document.createElement('button')
      cesiumPopupCloseBtn.className = 'cesium-popup-close'
      cesiumPopupCloseBtn.innerHTML = '×'
      cesiumPopupCloseBtn.onclick = closeCesiumPopup
      cesiumPopupDiv.appendChild(cesiumPopupCloseBtn)
    }

    // 构建弹窗内容
    let html = `<h4>${properties.name || '未命名'}</h4>`;
    // 通过字段自动判断类型
    if (properties.level !== undefined) {
      // 设施点
      html += `<p><strong>设施级别：</strong>${properties.level || '-'}</p>`
      html += `<p><strong>设施类型：</strong>${properties.type || '-'}</p>`
      html += `<p><strong>建筑面积：</strong>${properties.floor_area || 0}平方米</p>`
      html += `<p><strong>服务规模：</strong>${properties.scale || 0}人</p>`
    } else if (properties.site_area !== undefined) {
      // 设施用地
      html += `<p><strong>用地类型：</strong>${properties.type || '-'}</p>`
      html += `<p><strong>用地面积：</strong>${properties.site_area || 0}平方米</p>`
    } else {
      // 建筑
      if (properties.type) html += `<p><strong>建筑类型：</strong>${properties.type}</p>`
      if (properties.height) html += `<p><strong>建筑高度：</strong>${properties.height}米</p>`
      if (properties.up_floor) html += `<p><strong>地上层数：</strong>${properties.up_floor}层</p>`
      if (properties.down_floor) html += `<p><strong>地下层数：</strong>${properties.down_floor}层</p>`
      if (properties.floor_area) html += `<p><strong>建筑面积：</strong>${properties.floor_area}平方米</p>`
    }

    cesiumPopupDiv.innerHTML = html
    cesiumPopupDiv.appendChild(cesiumPopupCloseBtn)
    cesiumPopupDiv.style.display = 'block'

    // 设置弹窗位置（使用 screenPosition）
    cesiumPopupDiv.style.left = `${screenPosition.x + 15}px`
    cesiumPopupDiv.style.top = `${screenPosition.y}px`
  }

  // 关闭三维地图弹窗
  function closeCesiumPopup() {
    if (cesiumPopupDiv) {
      cesiumPopupDiv.style.display = 'none'
    }
  }

  return { viewer, cesiumInitialized, loadCesium, startFlythrough, handleAnalysisClick, loadPointsAndLands, closeCesiumPopup }
}