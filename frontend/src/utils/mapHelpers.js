// 引入模块
import { toLonLat } from 'ol/proj';

export function getMapBbox(map) {
  const view = map.getView();
  // 获取当前地图视图的范围
  const extent = view.calculateExtent(map.getSize());

  // 坐标转换: 将墨卡托转换为WGS84
  const bottomLeft = toLonLat([extent[0], extent[1]]);
  const topRight = toLonLat([extent[2], extent[3]]);

  // 返回标准格式的边界框
  return [
    bottomLeft[0],
    bottomLeft[1],
    topRight[0],
    topRight[1]
  ]
}