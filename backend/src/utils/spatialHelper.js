// backend/src/utils/spatialHelper.js

/**
 * PostGIS 空间函数工具封装
 * 所有函数均返回 SQL 片段字符串，供 Model 拼接使用
 */

/**
 * 将点坐标转换为 PostGIS POINT (WKT 格式)
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @returns {string} WKT 格式的 POINT 字符串
 */
function pointToWKT(lng, lat) {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
}

/**
 * 将多边形坐标数组转换为 PostGIS POLYGON
 * @param {Array} coordinates - GeoJSON 坐标数组
 * @returns {string} WKT 格式的 POLYGON 字符串
 */
function polygonToWKT(coordinates) {
  const rings = coordinates.map(ring => {
    const points = ring.map(coord => `${coord[0]} ${coord[1]}`).join(',')
    return `(${points})`
  }).join(',')
  return `ST_SetSRID(ST_GeomFromText('POLYGON(${rings})'), 4326)`
}

/**
 * 计算两点之间的距离（单位：米）
 * @param {number} lng1 - 点1经度
 * @param {number} lat1 - 点1纬度
 * @param {number} lng2 - 点2经度
 * @param {number} lat2 - 点2纬度
 * @param {boolean} useSpheroid - 是否使用椭球体计算（默认 true，更精确）
 * @returns {string} SQL 表达式
 */
function distance(lng1, lat1, lng2, lat2, useSpheroid = true) {
  const point1 = pointToWKT(lng1, lat1)
  const point2 = pointToWKT(lng2, lat2)
  return `ST_Distance(${point1}::geography, ${point2}::geography, ${useSpheroid})`
}

/**
 * 计算两点之间的球面距离（简化版，使用 geography 类型）
 * @param {string} geomColumn1 - 几何字段1
 * @param {string} geomColumn2 - 几何字段2
 * @returns {string} SQL 表达式
 */
function geographyDistance(geomColumn1, geomColumn2) {
  return `ST_Distance(${geomColumn1}::geography, ${geomColumn2}::geography)`
}

/**
 * 生成缓冲区（单位：米）
 * @param {string} geomColumn - 几何字段
 * @param {number} radius - 半径（米）
 * @returns {string} SQL 表达式
 */
function buffer(geomColumn, radius) {
  return `ST_Buffer(${geomColumn}::geography, ${radius})::geometry`
}

/**
 * 判断两个几何是否相交
 * @param {string} geomA - 几何A
 * @param {string} geomB - 几何B
 * @returns {string} SQL 表达式
 */
function intersects(geomA, geomB) {
  return `ST_Intersects(${geomA}, ${geomB})`
}

/**
 * 判断点是否在面内
 * @param {number} lng - 经度
 * @param {number} lat - 纬度
 * @param {string} polygonColumn - 面几何字段
 * @returns {string} SQL 条件
 */
function pointInPolygon(lng, lat, polygonColumn) {
  const point = pointToWKT(lng, lat)
  return `ST_Within(${point}, ${polygonColumn})`
}

/**
 * 计算面积（单位：平方米）
 * @param {string} geomColumn - 几何字段
 * @returns {string} SQL 表达式
 */
function area(geomColumn) {
  return `ST_Area(${geomColumn}::geography)`
}

/**
 * 计算几何的质心
 * @param {string} geomColumn - 几何字段
 * @returns {string} SQL 表达式
 */
function centroid(geomColumn) {
  return `ST_Centroid(${geomColumn})`
}

/**
 * 将几何转换为 GeoJSON
 * @param {string} geomColumn - 几何字段
 * @returns {string} SQL 表达式
 */
function asGeoJSON(geomColumn) {
  return `ST_AsGeoJSON(${geomColumn})::json`
}

/**
 * 转换坐标系
 * @param {string} geomColumn - 几何字段
 * @param {number} targetSRID - 目标坐标系 SRID
 * @returns {string} SQL 表达式
 */
function transform(geomColumn, targetSRID) {
  return `ST_Transform(${geomColumn}, ${targetSRID})`
}

/**
 * 生成空间索引查询提示（PostgreSQL）
 * @param {string} indexName - 索引名称
 * @returns {string} 索引提示（空字符串，PostgreSQL 自动使用索引）
 */
function useIndex() {
  return ''
}

module.exports = {
  pointToWKT,
  polygonToWKT,
  distance,
  geographyDistance,
  buffer,
  intersects,
  pointInPolygon,
  area,
  centroid,
  asGeoJSON,
  transform,
  useIndex
}