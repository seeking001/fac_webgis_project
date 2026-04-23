// backend/src/models/AnalysisModel.js

const db = require('../config/database')
const spatialHelper = require('../utils/spatialHelper')

/**
 * 获取教育设施供需分析数据
 * 分析逻辑：
 * 1. 获取所有教育设施（幼儿园、小学、初中、九年一贯制学校）
 * 2. 计算每个设施的学位供给量
 * 3. 通过缓冲区分析，统计服务半径内的居住用地
 * 4. 根据居住用地面积估算人口和学位需求
 * 5. 计算供需比和状态
 */
async function getEducationSupplyDemand() {
  try {
    const query = `
      WITH 
      -- 1. 教育设施基础数据
      education_facilities AS (
        SELECT 
          id,
          name,
          type,
          level,
          scale,
          floor_area,
          ST_AsGeoJSON(geometry)::json AS geometry,
          ST_X(ST_Centroid(geometry)) AS lng,
          ST_Y(ST_Centroid(geometry)) AS lat
        FROM points 
        WHERE type IN ('幼儿园', '小学', '初中', '九年一贯制学校')
          AND geometry IS NOT NULL
      ),
      
      -- 2. 居住用地数据
      residential_lands AS (
        SELECT 
          id,
          name,
          type,
          ${spatialHelper.area('geometry')} AS site_area,
          geometry
        FROM lands 
        WHERE type = '居住用地'
          AND geometry IS NOT NULL
      ),
      
      -- 3. 计算每个设施的服务半径
      facility_with_buffer AS (
        SELECT 
          f.*,
          CASE 
            WHEN f.type = '幼儿园' THEN 300
            WHEN f.type = '小学' THEN 500
            WHEN f.type = '初中' THEN 1000
            WHEN f.type = '九年一贯制学校' THEN 1000
            ELSE 500
          END AS service_radius,
          ${spatialHelper.buffer('f.geometry',
      `CASE 
              WHEN f.type = '幼儿园' THEN 300
              WHEN f.type = '小学' THEN 500
              WHEN f.type = '初中' THEN 1000
              WHEN f.type = '九年一贯制学校' THEN 1000
              ELSE 500
            END`
    )} AS buffer_geom
        FROM education_facilities f
      ),
      
      -- 4. 计算每个设施服务范围内的居住用地
      facility_coverage AS (
        SELECT 
          fb.*,
          COALESCE(SUM(rl.site_area), 0) AS covered_residential_area,
          COUNT(rl.id) AS covered_land_count
        FROM facility_with_buffer fb
        LEFT JOIN residential_lands rl 
          ON ${spatialHelper.intersects('fb.buffer_geom', 'rl.geometry')}
        GROUP BY fb.id, fb.name, fb.type, fb.level, fb.scale, fb.floor_area, 
                 fb.geometry, fb.lng, fb.lat, fb.service_radius, fb.buffer_geom
      )
      
      -- 5. 计算人口和学位需求，以及供需比
      SELECT 
        id,
        name,
        type,
        level,
        scale AS supply_capacity,
        covered_residential_area,
        -- 估算人口：按容积率 2.0，人均居住面积 35 平米计算
        ROUND(covered_residential_area * 2.0 / 35) AS estimated_population,
        -- 估算学位需求
        ROUND(
          CASE 
            WHEN type = '幼儿园' THEN covered_residential_area * 2.0 / 35 * 0.03
            WHEN type = '小学' THEN covered_residential_area * 2.0 / 35 * 0.06
            WHEN type = '初中' THEN covered_residential_area * 2.0 / 35 * 0.03
            WHEN type = '九年一贯制学校' THEN covered_residential_area * 2.0 / 35 * 0.09
            ELSE 0
          END
        ) AS estimated_demand,
        -- 供需比
        CASE 
          WHEN estimated_demand > 0 THEN ROUND(scale::numeric / estimated_demand, 2)
          ELSE NULL
        END AS supply_demand_ratio,
        -- 状态
        CASE 
          WHEN estimated_demand = 0 THEN 'no_data'
          WHEN scale::numeric / estimated_demand >= 1.2 THEN 'sufficient'
          WHEN scale::numeric / estimated_demand >= 0.8 THEN 'balanced'
          ELSE 'insufficient'
        END AS status,
        service_radius,
        lng,
        lat,
        geometry
      FROM facility_coverage
      ORDER BY 
        CASE 
          WHEN status = 'insufficient' THEN 1
          WHEN status = 'balanced' THEN 2
          WHEN status = 'sufficient' THEN 3
          ELSE 4
        END,
        supply_demand_ratio ASC
    `

    const result = await db.query(query)
    return result.rows

  } catch (error) {
    console.error('获取教育设施供需分析失败:', error)
    throw error
  }
}

/**
 * 获取指定设施的服务范围分析
 * @param {number} facilityId - 设施ID
 * @param {string} facilityType - 设施类型（points / lands）
 * @param {number} radius - 服务半径（米）
 */
async function getFacilityServiceArea(facilityId, facilityType, radius = 500) {
  try {
    const tableName = facilityType === 'points' ? 'points' : 'lands'

    const query = `
      WITH facility AS (
        SELECT 
          id,
          name,
          type,
          geometry,
          ${spatialHelper.buffer('geometry', radius)} AS buffer_geom
        FROM ${tableName}
        WHERE id = $1
      ),
      covered_buildings AS (
        SELECT 
          b.id,
          b.name,
          b.type,
          b.up_floor,
          b.height,
          ${spatialHelper.asGeoJSON('b.geometry')} AS geometry,
          ${spatialHelper.geographyDistance('f.geometry', 'b.geometry')} AS distance
        FROM buildings b
        CROSS JOIN facility f
        WHERE ${spatialHelper.intersects('f.buffer_geom', 'b.geometry')}
        ORDER BY distance ASC
      )
      SELECT 
        f.id,
        f.name,
        f.type,
        ${spatialHelper.asGeoJSON('f.geometry')} AS geometry,
        ${spatialHelper.asGeoJSON('f.buffer_geom')} AS buffer_geometry,
        radius AS service_radius,
        COALESCE(
          json_agg(
            json_build_object(
              'id', cb.id,
              'name', cb.name,
              'type', cb.type,
              'up_floor', cb.up_floor,
              'height', cb.height,
              'geometry', cb.geometry,
              'distance', ROUND(cb.distance::numeric, 2)
            )
            ORDER BY cb.distance
          ) FILTER (WHERE cb.id IS NOT NULL),
          '[]'::json
        ) AS covered_buildings
      FROM facility f
      LEFT JOIN covered_buildings cb ON true
      GROUP BY f.id, f.name, f.type, f.geometry, f.buffer_geom
    `

    const result = await db.query(query, [facilityId])
    return result.rows[0] || null

  } catch (error) {
    console.error('获取设施服务范围分析失败:', error)
    throw error
  }
}

/**
 * 获取两个设施之间的最短路径距离（直线距离）
 * @param {number} facilityId1 - 设施1 ID
 * @param {number} facilityId2 - 设施2 ID
 */
async function getDistanceBetweenFacilities(facilityId1, facilityId2) {
  try {
    const query = `
      SELECT 
        p1.name AS facility1,
        p2.name AS facility2,
        ${spatialHelper.geographyDistance('p1.geometry', 'p2.geometry')} AS distance_meters,
        ROUND(${spatialHelper.geographyDistance('p1.geometry', 'p2.geometry')} / 1000::numeric, 2) AS distance_km
      FROM points p1
      CROSS JOIN points p2
      WHERE p1.id = $1 AND p2.id = $2
    `

    const result = await db.query(query, [facilityId1, facilityId2])
    return result.rows[0] || null

  } catch (error) {
    console.error('计算设施间距离失败:', error)
    throw error
  }
}

/**
 * 热力图数据：获取指定区域内的设施密度
 * @param {number} minLng - 最小经度
 * @param {number} minLat - 最小纬度
 * @param {number} maxLng - 最大经度
 * @param {number} maxLat - 最大纬度
 * @param {string} facilityType - 设施类型（可选）
 */
async function getFacilityHeatmap(minLng, minLat, maxLng, maxLat, facilityType = null) {
  try {
    const bbox = `ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)`

    let typeCondition = ''
    const params = []
    if (facilityType) {
      typeCondition = 'AND type = $1'
      params.push(facilityType)
    }

    const query = `
      SELECT 
        id,
        name,
        type,
        ST_X(geometry) AS lng,
        ST_Y(geometry) AS lat
      FROM points
      WHERE ${spatialHelper.intersects(bbox, 'geometry')}
        ${typeCondition}
    `

    const result = await db.query(query, params)
    return result.rows

  } catch (error) {
    console.error('获取热力图数据失败:', error)
    throw error
  }
}

module.exports = {
  getEducationSupplyDemand,
  getFacilityServiceArea,
  getDistanceBetweenFacilities,
  getFacilityHeatmap
}