// 引入数据模型
const FacilityModel = require('../models/FacilityModel');

class FacilityController {
  static async getFacilities(req, res) {
    // 从请求查询参数中获取边界框参数
    const { bbox } = req.query;
    let bboxArray = null;

    // 解析边界框参数
    if (bbox) {
      // 将字符串转换为数组
      bboxArray = bbox.split(',').map(coord => parseFloat(coord));
    }

    // 调用数据模型层获取设施数据
    const facilities = await FacilityModel.getAllFacilities(bboxArray);

    // 返回标准化的成功响应
    res.json({
      success: true,
      count: facilities.length,
      data: facilities
    });
  }
}

// 导出FacilityController类,供路由模块使用
module.exports = FacilityController;