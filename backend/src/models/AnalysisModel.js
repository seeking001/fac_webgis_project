const { pool } = require('../config/database');

class AnalysisModel {
  static async getEducationSupply() {
    // 1. 查询所有教育设施
    const facilitiesQuery = `
      SELECT id, name, type, scale, 
             ST_X(geom) as lng, 
             ST_Y(geom) as lat
      FROM points
      WHERE type IN ('幼儿园', '小学', '初中', '九年一贯制学校')
        AND geom IS NOT NULL
    `;
    const facilitiesRes = await pool.query(facilitiesQuery);
    const facilities = facilitiesRes.rows;

    if (!facilities || facilities.length === 0) {
      console.warn('没有找到教育设施数据');
      return [];
    }

    // 2. 查询所有居住建筑的中心点坐标
    const buildingsQuery = `
      SELECT ogc_fid as id, floor_area, 
             ST_X(ST_Centroid(geom)) as center_lng,
             ST_Y(ST_Centroid(geom)) as center_lat
      FROM buildings
      WHERE type = '居住' 
        AND floor_area IS NOT NULL 
        AND floor_area > 0
        AND geom IS NOT NULL
        AND ST_IsValid(geom) = true
    `;
    const buildingsRes = await pool.query(buildingsQuery);

    // 过滤掉中心点为 NULL 的建筑
    const buildings = buildingsRes.rows.filter(b =>
      b.center_lng !== null && b.center_lat !== null &&
      !isNaN(b.center_lng) && !isNaN(b.center_lat)
    );

    console.log(`找到 ${facilities.length} 个教育设施，${buildings.length} 个居住建筑`);

    if (buildings.length === 0) {
      console.warn('没有找到有效的居住建筑数据');
      return facilities.map(fac => ({
        id: fac.id,
        name: fac.name,
        type: fac.type,
        lng: parseFloat(fac.lng),
        lat: parseFloat(fac.lat),
        scale: fac.scale,
        population: 0,
        demand: 0,
        supplyRatio: null,
        status: 'no_data',
        totalFloorArea: 0
      }));
    }

    // 3. 为每个设施计算供需
    const results = [];
    for (const fac of facilities) {
      // 跳过坐标无效的设施
      if (fac.lng === null || fac.lat === null || isNaN(fac.lng) || isNaN(fac.lat)) {
        continue;
      }

      // 确定服务半径（米）
      let radius = 0;
      if (fac.type === '幼儿园') radius = 300;
      else if (fac.type === '小学') radius = 500;
      else if (fac.type === '初中') radius = 1000;
      else if (fac.type === '九年一贯制学校') radius = 1000;
      else continue;

      // 计算半径内的居住建筑总面积
      let totalFloorArea = 0;
      const facLatRad = fac.lat * Math.PI / 180;

      for (const b of buildings) {
        // 使用 center_lng 和 center_lat，不是 geom.coordinates
        const dx = (fac.lng - b.center_lng) * 111320 * Math.cos(facLatRad);
        const dy = (fac.lat - b.center_lat) * 110574;
        const dist = Math.hypot(dx, dy);
        if (dist <= radius) {
          totalFloorArea += (b.floor_area || 0);
        }
      }

      // 计算人口（3.2人/100平方米）
      const population = totalFloorArea / 100 * 3.2;

      // 计算需求学位数和供需比
      let demand = 0;
      let demandPrimary = 0;
      let demandJunior = 0;
      let supplyRatio = null;
      let status = 'no_data';

      if (fac.type === '幼儿园') {
        demand = population * 40 / 1000;
        supplyRatio = fac.scale / (demand || 1);
        status = supplyRatio >= 1.1 ? 'sufficient' : (supplyRatio >= 0.9 ? 'balanced' : 'insufficient');
      }
      else if (fac.type === '小学') {
        demand = population * 80 / 1000;
        supplyRatio = fac.scale / (demand || 1);
        status = supplyRatio >= 1.1 ? 'sufficient' : (supplyRatio >= 0.9 ? 'balanced' : 'insufficient');
      }
      else if (fac.type === '初中') {
        demand = population * 40 / 1000;
        supplyRatio = fac.scale / (demand || 1);
        status = supplyRatio >= 1.1 ? 'sufficient' : (supplyRatio >= 0.9 ? 'balanced' : 'insufficient');
      }
      else if (fac.type === '九年一贯制学校') {
        const primaryScale = fac.scale * 2 / 3;
        const juniorScale = fac.scale * 1 / 3;
        demandPrimary = population * 80 / 1000;
        demandJunior = population * 40 / 1000;

        // 供需比 = 总供给 / 总需求
        const totalSupply = primaryScale + juniorScale;
        const totalDemand = demandPrimary + demandJunior;
        demand = totalDemand;  // 赋值给 demand 变量
        supplyRatio = totalSupply / (totalDemand || 1);
        status = supplyRatio >= 1.1 ? 'sufficient' : (supplyRatio >= 0.9 ? 'balanced' : 'insufficient');
      }

      // 基础返回对象
      const resultItem = {
        id: fac.id,
        name: fac.name,
        type: fac.type,
        lng: parseFloat(fac.lng),
        lat: parseFloat(fac.lat),
        scale: fac.scale,
        population: Math.round(population),
        demand: Math.round(demand),
        supplyRatio: supplyRatio ? parseFloat(supplyRatio.toFixed(2)) : null,
        status: status,
        totalFloorArea: Math.round(totalFloorArea)
      };

      // 九年一贯制学校额外添加字段
      if (fac.type === '九年一贯制学校') {
        resultItem.demandPrimary = Math.round(demandPrimary);
        resultItem.demandJunior = Math.round(demandJunior);
      }

      results.push(resultItem);
    }

    console.log(`成功计算 ${results.length} 个教育设施的供需数据`);
    return results;
  }
}

module.exports = AnalysisModel;