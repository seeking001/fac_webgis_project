// 引入express和landUseController函数
const express = require('express');
const LandUseController = require('../controllers/landUseController');

// 创建路由实例
const router = express.Router();

// 获取土地利用数据API
router.get('/', LandUseController.getLandUse);

// 添加土地利用数据API
router.post('/', LandUseController.createLandUse);

// 更新土地利用数据API
router.put('/:id', LandUseController.updateLandUse);

// 删除土地利用数据API
router.delete('/:id', LandUseController.deleteLandUse);

// 导出路由实例，供app.js使用
module.exports = router;