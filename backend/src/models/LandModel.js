// 引入数据库连接池模块
const { pool } = require('../config/database');

// 定义数据模型层
class landModel {
  // 获取土地利用数据
  static async getAllLands() {
    let sql = `
      SELECT
        id,
        name,
        type,
        site_area,
        ST_AsGeoJSON(geom) as geometry,
        created_at
      FROM lands
    `;

    const result = await pool.query(sql);  // query查询需提供sql语法

    // 处理查询结果：将GeoJSON字符串解析为JavaScript对象
    return result.rows.map(row => ({  // 这里的小括号相当于调用函数，得到参数
      ...row,  // 展开所有非几何字段
      geometry: JSON.parse(row.geometry)  // 解析GeoJSON几何数据
    }));
  }

  // 添加土地利用数据
  static async createLands(data) {
    const { name, type, site_area, geometry } = data;

    const query = `
      INSERT INTO lands (name, type, site_area, geom)
      VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
      RETURNING id, name, type, site_area, ST_AsGeoJSON(geom) as geometry, created_at
    `;

    const params = [name, type, site_area || 0, JSON.stringify(geometry)];

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
  static async updateLands(id, data) {
    const { name, type, site_area, geometry } = data;

    const query = `
      UPDATE lands
      SET
        name = $1,
        type = $2,
        site_area = $3,
        geom = ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)
      WHERE id = $5
      RETURNING id, name, type, site_area, ST_AsGeoJSON(geom) as geometry, created_at
    `;

    const params = [name, type, site_area || 0, JSON.stringify(geometry), id];

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

  // 删除土地利用数据
  static async deleteLands(id) {
    const query = `
      DELETE FROM lands
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

// 导出landModel类
module.exports = landModel;