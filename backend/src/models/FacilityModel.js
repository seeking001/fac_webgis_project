// 引入数据库连接池模块
const { pool } = require('../config/database');

// 定义数据模型层
class FacilityModel {
  // 获取公共服务设施
  static async getAllFacilities(bbox = null) {
    let query = `
      SELECT
        id,
        name,
        type,
        ST_AsGeoJSON(geom) as geometry,
        address,
        capacity,
        admin_region,
        created_at
      FROM public_facilities
    `;

    const params = [];

    // 如果提供了边界框,添加空间过滤条件
    if (bbox && bbox.length === 4) {
      // 创建矩形边界框
      query += ` WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;
      params.push(...bbox); // 展开bbox数组到参数中
    }

    // 按名称排序
    query += ` ORDER BY name`;

    const result = await pool.query(query, params);

    // 处理查询结果: 将GeoJSON字符串解析为JavaScript对象
    return result.rows.map(row => ({
      ...row,  // 展开所有非几何字段
      geometry: JSON.parse(row.geometry)  // 解析GeoJSON几何数据
    }));
  }
}

// 导出FacilityModel类
module.exports = FacilityModel;