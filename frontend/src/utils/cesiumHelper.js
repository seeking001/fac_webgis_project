// 图标缓存，避免重复创建样式
const iconCache = {}

// 设施类型对应的图标
const ICON_MAP = {
  '行政办公场所': '🏛️',
  '社区管理机构': '🏢',
  '大型文化设施': '🏫',
  '大型体育设施': '🏟️',
  '社区文化设施': '🎨',
  '社区体育设施': '🏀',
  '医院': '🏥',
  '门诊部': '💊',
  '社区健康服务中心': '❤️',
  '幼儿园': '🌈',
  '小学': '✏️',
  '初中': '📙',
  '九年一贯制学校': '📘',
  '高中': '📚',
  '高等教育': '🎓',
  '职业教育': '💻',
  '养老院': '🏠',
  '儿童福利院': '🛝',
  '残疾人服务中心': '♿',
  '社区老年人日间照料中心': '🍵',
  '社区托儿机构': '🍼',
  '社区救助站': '🤝'
};

// 获取设施点图标（根据类型返回图标 URL，可使用 emoji 转 canvas 或图片）
export function getPointIcon(type) {
  // 如果缓存中已存在，直接返回（解决canvas报错问题）
  if (iconCache[type]) {
    return iconCache[type]
  }

  // 创建 Canvas 绘制图标
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d')

  // 绘制图标符号
  ctx.fillStyle = 'white'
  ctx.font = 'bold 18px "Segoe UI Emoji", "Apple Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const icon = ICON_MAP[type] || '📍'
  ctx.fillText(icon, 16, 16)

  // 存入缓存
  iconCache[type] = canvas

  return canvas
}

// 漫游分析函数6 -- 教育设施供需分析 -- 绘制半圆柱体
export function drawHalfCylinder(Cesium, viewer, lng, lat, height, color, startAngle, endAngle) {
  const radius = 30;  // 半径（米）
  const segments = 20; // 分段数
  const positions = [];

  // 生成指定角度范围内的圆弧点
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (endAngle - startAngle) * i / segments;
    const dx = radius * Math.cos(angle);
    const dy = radius * Math.sin(angle);
    const offsetLng = dx / 111000;
    const offsetLat = dy / 111000;
    positions.push([lng + offsetLng, lat + offsetLat]);
  }

  // 添加圆心点（使形状为扇形）
  positions.unshift([lng, lat]);

  const polygon = viewer.entities.add({
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray(
        positions.flatMap(p => [p[0], p[1]])
      ),
      extrudedHeight: height,
      material: Cesium.Color.fromCssColorString(color).withAlpha(0.6),
      // outline: true,
      // outlineColor: Cesium.Color.WHITE,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
    }
  });
  return polygon;
}

// 漫游分析函数7 -- 教育设施供需分析 -- 绘制服务半径圆盘（动态波纹效果）
export function drawServiceRadius(Cesium, viewer, lng, lat, maxRadius, color, analysisEntities) {
  if (!maxRadius || isNaN(maxRadius) || maxRadius <= 0) {
    console.warn('drawServiceRadius: 无效的半径', maxRadius);
    return;
  }

  const MIN_RADIUS = 1;

  // 静态底圆（淡色背景）
  const baseEllipse = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
    ellipse: {
      semiMajorAxis: Math.max(MIN_RADIUS, maxRadius),
      semiMinorAxis: Math.max(MIN_RADIUS, maxRadius),
      material: Cesium.Color.fromCssColorString(color).withAlpha(0.2),
      outline: false,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });
  analysisEntities.push(baseEllipse);

  // 存储波纹对象
  const waves = [];
  let waveId = 0;

  // 创建单个波纹
  function createWave() {
    const id = waveId++;
    const wave = {
      id: id,
      radius: 0,
      alpha: 0.6,
      active: true,
      entity: null
    };

    // 创建椭圆实体
    wave.entity = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 0.1),
      ellipse: {
        semiMajorAxis: 0,
        semiMinorAxis: 0,
        material: Cesium.Color.fromCssColorString(color).withAlpha(0.6),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(color),
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    });
    analysisEntities.push(wave.entity);
    waves.push(wave);
    return wave;
  }

  // 移除波纹
  function removeWave(wave) {
    if (wave.entity && viewer.entities.contains(wave.entity)) {
      viewer.entities.remove(wave.entity);
    }
    wave.active = false;
  }

  let lastCreateTime = 0;

  const interval = setInterval(() => {
    const now = Date.now();

    // 每隔 500ms 创建一个新波纹（控制频率）
    if (now - lastCreateTime > 500) {
      createWave();
      lastCreateTime = now;
    }

    // 更新所有波纹
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i];
      if (!wave.active) {
        waves.splice(i, 1);
        continue;
      }

      // 半径扩大（速度 30 米/帧）
      wave.radius += 30;

      // 透明度衰减
      wave.alpha = 0.5 * (1 - wave.radius / maxRadius);

      // 边框宽度随半径增加而变细
      const width = Math.max(1, 3 - (wave.radius / maxRadius) * 30);

      // 超出最大半径则移除
      if (wave.radius >= maxRadius) {
        removeWave(wave);
        continue;
      }

      // 确保半径有效
      const currentRadius = Math.max(MIN_RADIUS, wave.radius);

      try {
        wave.entity.ellipse.semiMajorAxis = currentRadius;
        wave.entity.ellipse.semiMinorAxis = currentRadius;
        wave.entity.ellipse.material = Cesium.Color.fromCssColorString(color).withAlpha(wave.alpha);
        wave.entity.ellipse.outlineWidth = width;
        wave.entity.ellipse.outlineColor = Cesium.Color.fromCssColorString(color).withAlpha(wave.alpha);
      } catch (e) {
        removeWave(wave);
      }
    }
  }, 80);

  if (!window.rippleIntervals) window.rippleIntervals = [];
  window.rippleIntervals.push(interval);
}