const BuildingModel = require('../models/BuildingModel');

class BuildingController {
  static async getBuildings(req, res) {
    try {
      const buildings = await BuildingModel.getAllBuildings();
      // 转换为 GeoJSON FeatureCollection
      const features = buildings.map(b => ({
        type: 'Feature',
        geometry: b.geometry,
        properties: {
          id: b.id,
          name: b.name,
          type: b.type,
          address: b.address,
          height: b.height,
          up_floor: b.up_floor,
          down_floor: b.down_floor,
          floor_area: b.floor_area
        }
      }));
      res.json({
        success: true,
        count: buildings.length,
        data: {
          type: 'FeatureCollection',
          features: features
        }
      });
    } catch (error) {
      console.error('获取建筑数据失败:', error);
      res.status(500).json({ success: false, message: '服务器错误' });
    }
  }
}

module.exports = BuildingController;