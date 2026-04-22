import proj4 from 'proj4'
import { Polygon } from 'ol/geom'

proj4.defs('EPSG:4547', '+proj=tmerc +lat_0=0 +lon_0=114 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

// 导出proj4实例
export { proj4 }

// 坐标转换函数
export function transformCoordinates(coords, fromEPSG, toEPSG, geomType) {
  if (fromEPSG === toEPSG) return coords
  const transform = (coord) => proj4(fromEPSG, toEPSG, coord)
  if (geomType === 'Point') return transform(coords)
  if (geomType === 'Polygon') return coords.map(ring => ring.map(transform))
  return coords
}

// 计算EPSG:4547坐标系下的面积
export function calculateAreaInEPSG4547(coordinates4326) {
  const coordinates4547 = coordinates4326.map(ring =>
    ring.map(coord => proj4('EPSG:4326', 'EPSG:4547', coord))
  )
  return new Polygon(coordinates4547).getArea()
}