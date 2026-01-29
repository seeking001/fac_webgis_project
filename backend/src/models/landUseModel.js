// 引入数据库连接池模块
const { pool } = require('../config/database');

// 定义数据模型层
class LandUseModel {
  // 获取土地利用数据
  static async getAllLandUse(bbox = null) {
    let sql = `
      SELECT
        id,
        name,
        type,
        ST_AsGeoJSON(geom) as geometry,
        area,
        admin_region,
        created_at
      FROM land_use
    `;

    const params = [];

    // 根据视图框添加空间过滤条件
    if (bbox && bbox.length === 4) {
      // 创建视图框
      sql += ` WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params.push(...bbox);  // 展开bbox数组到参数中
    }

    const result = await pool.query(sql, params);  // query查询需提供sql语法和params参数

    // 处理查询结果：将GeoJSON字符串解析为JavaScript对象
    return result.rows.map(row => ({  // 这里的小括号相当于调用函数，得到参数
      ...row,  // 展开所有非几何字段
      geometry: JSON.parse(row.geometry)  // 解析GeoJSON几何数据
    }));
  }

  // 添加土地利用数据
  static async createLandUse(data) {
    const { name, type, area, admin_region, geometry } = data;

    const query = `
      INSERT INTO land_use (name, type, area, admin_region, geom)
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326))
      RETURNING id, name, type, area, admin_region, ST_AsGeoJSON(geom) as geometry, created_at
    `;

    const params = [name, type, area || 0, admin_region || '未知区域', JSON.stringify(geometry)];

    try {
      const result = await pool.query(query, params);
      const row = result.rows[0];

      return {
        ...row,
        geometry: JSON.parse(row.geometry)
      };
    } catch (error) {
      console.error('插入土地利用数据失败:', error);
      throw error;
    }
  }

  // 更新土地利用数据
  static async updateLandUse(id, data) {
    const { name, type, area, admin_region, geometry } = data;

    const query = `
      UPDATE land_use
      SET
        name = $1,
        type = $2,
        area = $3,
        admin_region = $4,
        geom = ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)
      WHERE id = $6
      RETURNING id, name, type, area, admin_region, ST_AsGeoJSON(geom) as geometry, created_at
    `;

    const params = [name, type, area || 0, admin_region || '未知区域', JSON.stringify(geometry), id];

    try {
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        throw new Error('土地利用数据未找到');
      }
      const row = result.rows[0];

      return {
        ...row,
        geometry: JSON.parse(row.geometry)
      };
    } catch (error) {
      console.error('更新土地利用数据失败:', error);
      throw error;
    }
  }
}

// 导出LandUseModel类
module.exports = LandUseModel;