// 引入模块
import { transformExtent } from 'ol/proj';

export function getMapBbox(map) {
  const mercatorExtent = map.getView().calculateExtent(map.getSize());
  const wgs84Extent = transformExtent(mercatorExtent, 'EPSG:3857', 'EPSG:4326');
  return wgs84Extent;
}