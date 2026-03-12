// 引入数据模型
const PointModel = require('../models/PointModel');

class PointController {
  static async getPoints(req, res) {
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
      const points = await PointModel.getAllPoints(bboxArray);

      // 返回标准化的成功响应
      res.json({
        success: true,
        count: points.length,
        data: points
      });
    } catch (error) {
      // 处理错误并返回标准错误响应
      res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  }

  // 创建公共服务设施
  static async createPoints(req, res) {
    try {
      const { name, type, address, capacity, admin_region, geometry } = req.body;

      if (!name || !type || !geometry) {
        return res.status(400).json({
          success: false,
          message: '缺少必要字段: name, type, geometry'
        });
      }

      const newPoint = await PointModel.createPoints({
        name,
        type,
        address: address || '',
        capacity: capacity || 0,
        admin_region: admin_region || '未知区域',
        geometry
      });

      res.status(201).json({
        success: true,
        message: '设施创建成功',
        data: newPoint
      });

    } catch (error) {
      console.error('创建失败:', error);
      res.status(500).json({
        success: false,
        message: '创建失败'
      });
    }
  }

  // 更新公共服务设施
  static async updatePoints(req, res) {
    try {
      const { id } = req.params;
      const { name, type, address, capacity, admin_region, geometry } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: '缺少设施ID'
        });
      }

      const updatedPoints = await PointModel.updatePoints(id, {
        name,
        type,
        address,
        capacity: capacity || 0,
        admin_region: admin_region || '未知区域',
        geometry
      });

      res.json({
        success: true,
        message: '设施更新成功',
        data: updatedPoints
      });

    } catch (error) {
      console.error('更新失败:', error);
      res.status(500).json({
        success: false,
        message: '更新失败'
      });
    }
  }

  // 删除公共服务设施
  static async deletePoints(req, res) {
    try {
      const { id } = req.params;

      // TODO: 调用模型层删除设施
      const result = await PointModel.deletePoints(id);

      res.json({
        success: true,
        message: '删除成功',
        data: result
      });
    } catch (error) {
      console.error('删除失败:', error);
      res.status(500).json({
        success: false,
        message: '删除失败'
      });
    }
  }
}

// 导出PointController类,供路由模块使用
module.exports = PointController;