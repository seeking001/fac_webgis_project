// 引入数据模型
const LandUseModel = require('../models/landUseModel');

// 创建土地利用数据控制类
class LandUseController {
  static async getLandUse(req, res) {
    // 从请求查询参数中获取边界框参数
    try {
      const { bbox } = req.query;
      let bboxArray = null;

      // 解析边界框参数
      if (bbox) {
        // 将字符串转换为数组，使用trim()方法去除空格
        bboxArray = bbox.split(',').map(coord => parseFloat(coord.trim()));
      }

      // 调用数据模型层获取设施数据
      const landUse = await LandUseModel.getAllLandUse(bboxArray);

      // 返回标准化的成功响应
      res.json({
        success: true,
        count: landUse.length,
        data: landUse
      });
    } catch (error) {
      // 处理错误并返回标准错误响应
      res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  }

  // 创建土地利用数据
  static async createLandUse(req, res) {
    try {
      const { name, type, area, admin_region, geometry } = req.body;

      // 验证必要字段
      if (!name || !type || !geometry) {
        return res.status(400).json({
          success: false,
          message: '缺少必要字段: name, type, geometry'
        });
      }

      // 调用模型层插入数据
      const newLandUse = await LandUseModel.createLandUse({
        name,
        type,
        area: area || 0,
        admin_region: admin_region || '未知区域',
        geometry
      });

      // 返回成功响应
      res.status(201).json({
        success: true,
        message: '土地利用数据创建成功',
        data: newLandUse
      });
    } catch (error) {
      console.error('创建土地利用数据失败:', error);
      res.status(500).json({
        success: false,
        message: '创建土地利用数据失败'
      });
    }
  }
}

// 导出土地利用数据控制类，供路由模块使用
module.exports = LandUseController;