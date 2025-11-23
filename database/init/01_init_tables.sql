/**
 * 数据库初始化脚本 - 01_init_tables.sql
 * 
 * 这个脚本负责：
 * 1. 创建PostGIS扩展（启用空间数据库功能）
 * 2. 创建数据表结构
 * 3. 创建空间索引（提高查询性能）
 * 4. 插入示例数据
 * 
 * 类比规划概念：这就像规划局新建一个档案库，建立分类体系并放入示例档案
 */

-- 启用PostGIS扩展
-- PostGIS为PostgreSQL添加了空间数据支持，就像给档案库配备了地图存储能力
CREATE EXTENSION IF NOT EXISTS postgis;

-- 创建公共服务设施表
-- 这个表存储学校、医院、图书馆等公共服务设施的信息
CREATE TABLE IF NOT EXISTS public_facilities (
    -- 自增主键，唯一标识每条记录
    id SERIAL PRIMARY KEY,
    
    -- 设施名称，如"深圳中学"
    name VARCHAR(200) NOT NULL,
    
    -- 设施类型：school, hospital, library, stadium, park, sports
    -- 就像规划档案的分类标签
    type VARCHAR(50) NOT NULL,
    
    -- 详细地址
    address TEXT,
    
    -- 容量（如学校的学生容量、医院的床位数量）
    capacity INTEGER,
    
    -- 所属行政区，如"福田区"
    admin_region VARCHAR(100),
    
    -- 空间几何字段：点类型，使用WGS84坐标系（EPSG:4326）
    -- 这个字段存储设施的地理位置
    geom GEOMETRY(Point, 4326),
    
    -- 创建时间，自动记录数据插入时间
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建土地利用表
-- 这个表存储不同性质的土地使用情况
CREATE TABLE IF NOT EXISTS land_use (
    -- 自增主键
    id SERIAL PRIMARY KEY,
    
    -- 用地类型：教育用地、医疗用地、公共绿地等
    land_type VARCHAR(100) NOT NULL,
    
    -- 面积（平方米），使用数值类型保留2位小数
    area_sqm NUMERIC(12, 2),
    
    -- 空间几何字段：面类型，使用WGS84坐标系
    -- 这个字段存储地块的边界范围
    geom GEOMETRY(Polygon, 4326)
);

-- ===== 创建索引 =====
-- 索引就像档案库的检索目录，可以大幅提高查询速度

-- 为设施表的空间字段创建GIST索引
-- GIST是PostgreSQL的通用索引类型，特别适合空间数据
CREATE INDEX IF NOT EXISTS idx_facilities_geom ON public_facilities USING GIST(geom);

-- 为土地利用表的空间字段创建GIST索引
CREATE INDEX IF NOT EXISTS idx_land_use_geom ON land_use USING GIST(geom);

-- 为设施类型字段创建B-tree索引（适合等值查询）
CREATE INDEX IF NOT EXISTS idx_facilities_type ON public_facilities(type);

-- ===== 插入示例数据 =====
-- 这些数据用于开发和测试，就像在档案库中放入示例档案

-- 插入深圳市部分公共服务设施数据
INSERT INTO public_facilities (name, type, address, capacity, admin_region, geom) VALUES
    -- 深圳中学 - 罗湖区
    ('深圳中学', 'school', '罗湖区深中街18号', 3000, '罗湖区', 
     ST_GeomFromText('POINT(114.109 22.551)', 4326)),
    
    -- 深圳市人民医院 - 福田区
    ('深圳市人民医院', 'hospital', '福田区东门北路1017号', 1500, '福田区', 
     ST_GeomFromText('POINT(114.067 22.553)', 4326)),
    
    -- 深圳图书馆 - 福田区
    ('深圳图书馆', 'library', '福田区福中一路2001号', 800, '福田区', 
     ST_GeomFromText('POINT(114.064 22.542)', 4326)),
    
    -- 深圳湾体育中心 - 南山区
    ('深圳湾体育中心', 'stadium', '南山区滨海大道3001号', 20000, '南山区', 
     ST_GeomFromText('POINT(113.946 22.523)', 4326)),
    
    -- 荔枝公园 - 福田区
    ('荔枝公园', 'park', '福田区红岭中路1001号', 500, '福田区', 
     ST_GeomFromText('POINT(114.097 22.545)', 4326)),
    
    -- 福田区体育中心 - 福田区
    ('福田区体育中心', 'sports', '福田区笋岗西路', 3000, '福田区', 
     ST_GeomFromText('POINT(114.067 22.558)', 4326)),
    
    -- 宝安中心医院 - 宝安区
    ('宝安中心医院', 'hospital', '宝安区龙井二路118号', 1200, '宝安区', 
     ST_GeomFromText('POINT(113.883 22.577)', 4326)),
    
    -- 南山外国语学校 - 南山区
    ('南山外国语学校', 'school', '南山区文华路', 2500, '南山区', 
     ST_GeomFromText('POINT(113.937 22.532)', 4326))
    
-- 如果遇到主键冲突则忽略（避免重复插入）
ON CONFLICT DO NOTHING;

-- 插入示例土地利用数据
-- 这些数据代表不同性质的土地使用区块
INSERT INTO land_use (land_type, area_sqm, geom) VALUES
    -- 教育用地 - 一个矩形区域
    ('教育用地', 50000, 
     ST_GeomFromText('POLYGON((114.100 22.550, 114.110 22.550, 114.110 22.555, 114.100 22.555, 114.100 22.550))', 4326)),
    
    -- 医疗用地 - 另一个矩形区域
    ('医疗用地', 30000, 
     ST_GeomFromText('POLYGON((114.060 22.550, 114.070 22.550, 114.070 22.555, 114.060 22.555, 114.060 22.550))', 4326)),
    
    -- 公共绿地 - 公园绿地
    ('公共绿地', 80000, 
     ST_GeomFromText('POLYGON((114.090 22.540, 114.100 22.540, 114.100 22.545, 114.090 22.545, 114.090 22.540))', 4326))
    
-- 避免重复插入
ON CONFLICT DO NOTHING;

-- ===== 创建视图 =====
-- 视图就像档案库的特定检索视图，可以简化复杂查询

-- 创建公共服务设施视图，便于GeoServer发布
-- GeoServer是开源地图服务器，可以通过这个视图直接发布WFS服务
CREATE OR REPLACE VIEW public_facilities_view AS
SELECT 
    id,
    name,
    type,
    address,
    capacity,
    admin_region,
    created_at,
    geom
FROM public_facilities;

-- 注释：视图不存储数据，只是保存了查询语句
-- 当查询视图时，实际上执行的是视图定义的SELECT语句