const { pool } = require('../config/database');

class BuildingModel {
  // 获取所有建筑
  static async getAllBuildings() {
    const sql = `
      SELECT
        ogc_fid as id, name, type, address, height, up_floor, down_floor, floor_area,
        ST_AsGeoJSON(geom) AS geometry
      FROM buildings
    `;
    const result = await pool.query(sql);
    return result.rows.map(row => ({
      ...row,
      geometry: JSON.parse(row.geometry)
    }));
  }

  // 可选：根据 id 获取单个建筑
  static async getBuildingById(id) {
    const sql = `
      SELECT
        id, name, type, address, height, up_floor, down_floor, floor_area,
        ST_AsGeoJSON(geom) AS geometry
      FROM buildings
      WHERE id = $1
    `;
    const result = await pool.query(sql, [id]);
    if (result.rows.length === 0) return null;
    return {
      ...result.rows[0],
      geometry: JSON.parse(result.rows[0].geometry)
    };
  }
}

module.exports = BuildingModel;