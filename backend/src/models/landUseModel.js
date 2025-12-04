// 引入数据库连接池模块
const { pool } = require('../config/database');

// 定义数据模型层
class LandUseModel {
  // 获取土地利用数据
  static async getAllLandUse(bbox = null) {
    let query = `
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
      query += ` WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4490)`;
      params.push(...bbox);  // 展开bbox数组到参数中
    }

    const result = await pool.query(query, params);

    // 处理查询结果：将GeoJSON字符串解析为JavaScript对象
    return result.rows.map(row => ({
      ...row,  // 展开所有非几何字段
      geometry: JSON.parse(row.geometry)  // 解析GeoJSON几何数据
    }));
  }
}

// 导出LandUseModel类
module.exports = LandUseModel;