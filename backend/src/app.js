// 引入express和cors
const express = require('express');
const cors = require('cors');
require('dotenv').config();  // 加载环境变量

// 引入数据库连接测试和路由模块
const { testConnection } = require('./config/database');
const facilityRoutes = require('./routes/facilityRouter');
const landUseRoutes = require('./routes/landUseRouter');

// 创建express应用实例
const app = express();
const PORT = process.env.SERVER_PORT || 3000;  // 设置服务端口

// 配置中间件
// CORS跨域中间件：允许前端应用访问后端服务
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173'  // 前端开发服务器地址
}));

// JSON解析中间件
app.use(express.json());

// 配置路由
// 公共服务设施路由
app.use('/api/facilities', facilityRoutes);
// 土地利用路由
app.use('/api/landUse', landUseRoutes);

// 创建服务器启动函数
const startServer = async () => {
  // 测试数据库连接
  try {
    await testConnection();
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败', error);
    process.exit(1);
  }

  // 启动HTTP服务
  app.listen(PORT, () => {
    console.log(`✅ 服务启动完成，端口：${PORT}，等待前端请求...`);
  });
};

// 启动服务
startServer();