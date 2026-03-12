// 引入express和landController函数
const express = require('express');
const landController = require('../controllers/landController');

// 创建路由实例
const router = express.Router();

// 获取土地利用数据API
router.get('/', landController.getLands);

// 添加土地利用数据API
router.post('/', landController.createLands);

// 更新土地利用数据API
router.put('/:id', landController.updateLands);

// 删除土地利用数据API
router.delete('/:id', landController.deleteLands);

// 导出路由实例，供app.js使用
module.exports = router;