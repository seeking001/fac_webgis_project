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
    -- 深圳中学 - 罗湖区
    ('深圳中学', '学校', '罗湖区深中街18号', 3000, '罗湖区', 
     ST_GeomFromText('POINT(114.109 22.551)', 4326)),
    
    -- 深圳市人民医院 - 福田区
    ('深圳市人民医院', '医院', '福田区东门北路1017号', 1500, '福田区', 
     ST_GeomFromText('POINT(114.067 22.553)', 4326)),
    
    -- 深圳图书馆 - 福田区
    ('深圳图书馆', '图书馆', '福田区福中一路2001号', 800, '福田区', 
     ST_GeomFromText('POINT(114.064 22.542)', 4326)),
    
    -- 深圳湾体育中心 - 南山区
    ('深圳湾体育中心', '体育馆', '南山区滨海大道3001号', 20000, '南山区', 
     ST_GeomFromText('POINT(113.946 22.523)', 4326)),
    
    -- 荔枝公园 - 福田区
    ('荔枝公园', '公园', '福田区红岭中路1001号', 500, '福田区', 
     ST_GeomFromText('POINT(114.097 22.545)', 4326))
    
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
    ('福田商业区', '商业用地', 50000, '福田区', ST_GeomFromText('POLYGON((114.055 22.540, 114.060 22.540, 114.060 22.545, 114.055 22.545, 114.055 22.540))', 4326)),
    ('罗湖居住区', '居住用地', 80000, '罗湖区', ST_GeomFromText('POLYGON((114.100 22.550, 114.110 22.550, 114.110 22.560, 114.100 22.560, 114.100 22.550))', 4326)),
    ('南山工业区', '工业用地', 120000, '南山区', ST_GeomFromText('POLYGON((113.920 22.500, 113.940 22.500, 113.940 22.520, 113.920 22.520, 113.920 22.500))', 4326)),
    ('宝安公园绿地', '公园绿地', 30000, '宝安区', ST_GeomFromText('POLYGON((113.880 22.570, 113.900 22.570, 113.900 22.590, 113.880 22.590, 113.880 22.570))', 4326))
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