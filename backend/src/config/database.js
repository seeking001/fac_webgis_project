// 引入PostgreSQL数据库
const { Pool } = require('pg');
require('dotenv').config();

// 创建数据库连接池
const pool = new Pool({
  host: process.env.DB_HOST,  // 数据库服务器地址
  port: process.env.DB_PORT, //数据库端口
  database: process.env.DB_NAME, //数据库名称
  user: process.env.DB_USER, //用户名
  password: process.env.DB_PASSWORD, //密码
  ssl: process.env.DB_SSL === 'true'  // 是否使用SSL加密连接
});

// 创建测试数据库连接函数
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ 数据库连接测试成功');
    client.release();
  } catch (error) {
    console.error('❌ 数据库连接测试失败', error);
    throw error;
  }
};

// 导出模块
module.exports = {
  pool,  // 数据库连接池实例
  testConnection  // 连接测试函数
};