-- 启用PostGIS扩展
-- PostGIS为PostgreSQL添加了空间数据支持，就像给档案库配备了地图存储能力
CREATE EXTENSION IF NOT EXISTS postgis;

-- 创建公共设施点位表
CREATE TABLE IF NOT EXISTS points (
    -- 自增主键，唯一标识每条记录
    id SERIAL PRIMARY KEY,
    
    -- 设施名称
    name VARCHAR(255) NOT NULL,

    -- 设施等级
    level VARCHAR(20),
    
    -- 设施类型
    type VARCHAR(50) NOT NULL,
    
    -- 建筑面积
    floor_area INTEGER,
    
    -- 服务规模
    scale INTEGER,
    
    -- 空间几何字段：点类型，使用WGS84坐标系（EPSG:4326）
    geom GEOMETRY(Point, 4326),
    
    -- 创建时间，自动记录数据插入时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建公共设施用地表
CREATE TABLE IF NOT EXISTS lands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    site_area INTEGER,
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建空间索引
CREATE INDEX IF NOT EXISTS idx_points_geom ON points USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_lands_geom ON lands USING GIST(geom);