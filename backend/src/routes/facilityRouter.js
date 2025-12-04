// 引入express和FacilityController函数
const express = require('express');
const FacilityController = require('../controllers/facilityController');

// 创建路由实例
const router = express.Router();

// 获取公共服务设施API
router.get('/', FacilityController.getFacilities);

// 导出路由实例,供app.js使用
module.exports = router;