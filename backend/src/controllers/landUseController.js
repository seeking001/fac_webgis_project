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
}

// 导出土地利用数据控制类，供路由模块使用
module.exports = LandUseController;