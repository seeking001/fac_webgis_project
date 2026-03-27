-- 启用PostGIS扩展
-- PostGIS为PostgreSQL添加了空间数据支持，就像给档案库配备了地图存储能力
CREATE EXTENSION IF NOT EXISTS postgis;

-- 创建公共服务设施表
-- 这个表存储学校、医院、图书馆等公共服务设施的信息
CREATE TABLE IF NOT EXISTS points (
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

-- 插入深圳市部分公共服务设施数据
INSERT INTO points (name, type, address, capacity, admin_region, geom) VALUES
    -- 学校
    ('龙华中学', '学校', '龙华区公园路1号', 2500, '龙华区', 
     ST_GeomFromText('POINT(114.030 22.670)', 4326))
   
-- 如果遇到主键冲突则忽略（避免重复插入）
ON CONFLICT DO NOTHING;

-- 创建公共服务设施视图，便于GeoServer发布
-- GeoServer是开源地图服务器，可以通过这个视图直接发布WFS服务
CREATE OR REPLACE VIEW points_view AS
SELECT
    id,
    name,
    type,
    address,
    capacity,
    admin_region,
    created_at,
    geom
FROM points;


-- 创建土地利用表
CREATE TABLE IF NOT EXISTS lands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    area FLOAT,
    admin_region VARCHAR(100),
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 插入示例土地利用数据
INSERT INTO lands (name, type, area, admin_region, geom) VALUES
    -- 商业用地
    ('龙华商业中心', '商业用地', 120000, '龙华区', 
     ST_GeomFromText('POLYGON((114.020 22.645, 114.030 22.645, 114.030 22.655, 114.020 22.655, 114.020 22.645))', 4326))
ON CONFLICT DO NOTHING;

-- 创建土地利用视图，便于GeoServer发布
CREATE OR REPLACE VIEW lands_view AS
SELECT
    id,
    name,
    type,
    area,
    admin_region,
    created_at,
    geom
FROM lands;