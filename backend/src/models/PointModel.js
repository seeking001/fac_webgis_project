// 引入数据库连接池模块
const { pool } = require('../config/database');

// 定义数据模型层
class PointModel {
  // 获取公共服务设施
  static async getAllPoints(bbox = null) {
    let query = `
      SELECT
        id,
        name,
        level,
        type,
        floor_area,
        scale,
        ST_AsGeoJSON(geom) as geometry,
        created_at
      FROM points
    `;

    const params = [];

    // 如果提供了边界框,添加空间过滤条件
    if (bbox && bbox.length === 4) {
      // 创建矩形边界框
      query += ` WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params.push(...bbox); // 展开bbox数组到参数中
    }

    const result = await pool.query(query, params);

    // 处理查询结果: 将GeoJSON字符串解析为JavaScript对象
    return result.rows.map(row => ({
      ...row,  // 展开所有非几何字段
      geometry: JSON.parse(row.geometry)  // 解析GeoJSON几何数据
    }));
  }

  // 创建公共服务设施
  static async createPoints(data) {
    const { name, level, type, floor_area, scale, geometry } = data;

    const query = `
      INSERT INTO points 
        (name, level, type, floor_area, scale, geom)
      VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))
      RETURNING 
        id, name, level, type, floor_area, scale, ST_AsGeoJSON(geom) as geometry, created_at
    `;

    const params = [
      name || '设施名称',
      level || '设施级别',
      type || '设施类型',
      floor_area || 0,
      scale || 0,
      JSON.stringify(geometry)
    ];

    try {
      const result = await pool.query(query, params);
      const row = result.rows[0];

      return {
        ...row,
        geometry: JSON.parse(row.geometry)
      };
    } catch (error) {
      console.error('创建设施失败:', error);
      throw error;
    }
  }

  // 更新公共服务设施
  static async updatePoints(id, data) {
    const { name, level, type, floor_area, scale, geometry } = data;

    const query = `
    UPDATE points
    SET
      name = COALESCE($1, name),
      level = COALESCE($2, level),
      type = COALESCE($3, type),
      floor_area = COALESCE($4, floor_area),
      scale = COALESCE($5, scale),
      geom = COALESCE(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326), geom)
    WHERE id = $7
    RETURNING
      id, name, level, type, floor_area, scale,
      ST_AsGeoJSON(geom) as geometry, created_at
  `;

    const params = [
      name || null,
      level || null,
      type || null,
      floor_area || null,
      scale || null,
      geometry ? JSON.stringify(geometry) : null,
      id
    ];

    try {
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        throw new Error('设施未找到');
      }
      const row = result.rows[0];

      return {
        ...row,
        geometry: JSON.parse(row.geometry)
      };
    } catch (error) {
      console.error('更新设施失败:', error);
      throw error;
    }
  }

  // 删除公共服务设施
  static async deletePoints(id) {
    const query = `
    DELETE FROM points
    WHERE id = $1
    RETURNING id
  `;

    const params = [id];

    try {
      const result = await pool.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('删除失败:', error);
      throw error;
    }
  }
}

// 导出PointModel类
module.exports = PointModel;