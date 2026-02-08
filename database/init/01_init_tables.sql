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

-- 插入深圳市部分公共服务设施数据
INSERT INTO public_facilities (name, type, address, capacity, admin_region, geom) VALUES
    -- 学校
    ('龙华中学', '学校', '龙华区公园路1号', 2500, '龙华区', 
     ST_GeomFromText('POINT(114.030 22.670)', 4326)),
    ('龙华区实验学校', '学校', '龙华区民治街道民塘路', 1800, '龙华区', 
     ST_GeomFromText('POINT(114.045 22.615)', 4326)),
    ('新华中学', '学校', '龙华区龙华街道人民路', 2200, '龙华区', 
     ST_GeomFromText('POINT(114.020 22.655)', 4326)),
    -- 医院
    ('龙华区人民医院', '医院', '龙华区龙华街道建设东路', 800, '龙华区', 
     ST_GeomFromText('POINT(114.025 22.650)', 4326)),
    ('深圳市人民医院龙华分院', '医院', '龙华区民治街道民康路', 600, '龙华区', 
     ST_GeomFromText('POINT(114.040 22.620)', 4326)),
    -- 图书馆
    ('龙华区图书馆', '图书馆', '龙华区龙华文化广场', 400, '龙华区', 
     ST_GeomFromText('POINT(114.015 22.660)', 4326)),
    ('民治图书馆', '图书馆', '龙华区民治街道民治大道', 300, '龙华区', 
     ST_GeomFromText('POINT(114.038 22.625)', 4326)),
    -- 体育馆
    ('龙华体育中心', '体育馆', '龙华区龙华街道东环一路', 5000, '龙华区', 
     ST_GeomFromText('POINT(114.010 22.665)', 4326)),
    -- 公园
    ('龙华公园', '公园', '龙华区龙华街道人民北路', 200, '龙华区', 
     ST_GeomFromText('POINT(114.018 22.658)', 4326)),
    ('民治公园', '公园', '龙华区民治街道民治大道', 150, '龙华区', 
     ST_GeomFromText('POINT(114.042 22.618)', 4326)),
    ('观澜湖体育公园', '公园', '龙华区观澜街道高尔夫大道', 300, '龙华区', 
     ST_GeomFromText('POINT(114.060 22.710)', 4326)),
    ('大浪商业中心广场', '公园', '龙华区大浪街道华旺路', 100, '龙华区', 
     ST_GeomFromText('POINT(113.990 22.680)', 4326))
    
-- 如果遇到主键冲突则忽略（避免重复插入）
ON CONFLICT DO NOTHING;

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


-- 创建土地利用表
CREATE TABLE IF NOT EXISTS land_use (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    area FLOAT,
    admin_region VARCHAR(100),
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 插入示例土地利用数据
INSERT INTO land_use (name, type, area, admin_region, geom) VALUES
    -- 商业用地
    ('龙华商业中心', '商业用地', 120000, '龙华区', 
     ST_GeomFromText('POLYGON((114.020 22.645, 114.030 22.645, 114.030 22.655, 114.020 22.655, 114.020 22.645))', 4326)),
    ('民治商业区', '商业用地', 80000, '龙华区', 
     ST_GeomFromText('POLYGON((114.035 22.610, 114.045 22.610, 114.045 22.620, 114.035 22.620, 114.035 22.610))', 4326)),
    ('观澜商业区', '商业用地', 95000, '龙华区', 
     ST_GeomFromText('POLYGON((114.055 22.700, 114.065 22.700, 114.065 22.710, 114.055 22.710, 114.055 22.700))', 4326)),
    -- 居住用地
    ('龙华中心居住区', '居住用地', 150000, '龙华区', 
     ST_GeomFromText('POLYGON((114.015 22.650, 114.025 22.650, 114.025 22.660, 114.015 22.660, 114.015 22.650))', 4326)),
    ('民治居住区', '居住用地', 180000, '龙华区', 
     ST_GeomFromText('POLYGON((114.040 22.615, 114.050 22.615, 114.050 22.625, 114.040 22.625, 114.040 22.615))', 4326)),
    ('大浪居住区', '居住用地', 140000, '龙华区', 
     ST_GeomFromText('POLYGON((113.985 22.675, 113.995 22.675, 113.995 22.685, 113.985 22.685, 113.985 22.675))', 4326)),
    ('观澜居住区', '居住用地', 160000, '龙华区', 
     ST_GeomFromText('POLYGON((114.050 22.705, 114.060 22.705, 114.060 22.715, 114.050 22.715, 114.050 22.705))', 4326)),
    -- 工业用地
    ('龙华工业区', '工业用地', 200000, '龙华区', 
     ST_GeomFromText('POLYGON((114.005 22.640, 114.015 22.640, 114.015 22.650, 114.005 22.650, 114.005 22.640))', 4326)),
    ('观澜高新技术园', '工业用地', 250000, '龙华区', 
     ST_GeomFromText('POLYGON((114.065 22.695, 114.075 22.695, 114.075 22.705, 114.065 22.705, 114.065 22.695))', 4326)),
    -- 公园绿地
    ('龙华中心公园', '公园绿地', 50000, '龙华区', 
     ST_GeomFromText('POLYGON((114.018 22.655, 114.023 22.655, 114.023 22.660, 114.018 22.660, 114.018 22.655))', 4326)),
    ('民治生态公园', '公园绿地', 75000, '龙华区', 
     ST_GeomFromText('POLYGON((114.042 22.615, 114.047 22.615, 114.047 22.620, 114.042 22.620, 114.042 22.615))', 4326)),
    ('观澜湖生态区', '公园绿地', 120000, '龙华区', 
     ST_GeomFromText('POLYGON((114.058 22.708, 114.063 22.708, 114.063 22.713, 114.058 22.713, 114.058 22.708))', 4326))
ON CONFLICT DO NOTHING;

-- 创建土地利用视图，便于GeoServer发布
CREATE OR REPLACE VIEW land_use_view AS
SELECT
    id,
    name,
    type,
    area,
    admin_region,
    created_at,
    geom
FROM land_use;