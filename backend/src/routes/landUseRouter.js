// 引入express和landUseController函数
const express = require('express');
const LandUseController = require('../controllers/landUseController');

// 创建路由实例
const router = express.Router();

// 获取公共服务设施API
router.get('/', LandUseController.getLandUse);

// 导出路由实例，供app.js使用
module.exports = router;