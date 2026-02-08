// 引入express和FacilityController函数
const express = require('express');
const FacilityController = require('../controllers/facilityController');

// 创建路由实例
const router = express.Router();

// 获取公共服务设施API
router.get('/', FacilityController.getFacilities);

// 创建公共服务设施
router.post('/', FacilityController.createFacility);

// 更新公共服务设施
router.put('/:id', FacilityController.updateFacility);

// 删除公共服务设施
router.delete('/:id', FacilityController.deleteFacility);

// 导出路由实例,供app.js使用
module.exports = router;