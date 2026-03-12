// 引入express和PointController函数
const express = require('express');
const PointController = require('../controllers/pointController');

// 创建路由实例
const router = express.Router();

// 获取公共服务设施API
router.get('/', PointController.getPoints);

// 创建公共服务设施
router.post('/', PointController.createPoints);

// 更新公共服务设施
router.put('/:id', PointController.updatePoints);

// 删除公共服务设施
router.delete('/:id', PointController.deletePoints);

// 导出路由实例,供app.js使用
module.exports = router;