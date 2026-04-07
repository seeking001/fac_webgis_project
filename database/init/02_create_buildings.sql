-- 创建建筑表
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200),
    type VARCHAR(50),
    address TEXT,
    height NUMERIC(10,2),
    up_floor SMALLINT,
    down_floor SMALLINT,
    floor_area NUMERIC(12,2),
    geom GEOMETRY(Polygon, 4326)
);

-- 建立空间索引
CREATE INDEX IF NOT EXISTS idx_buildings_geom ON buildings USING GIST (geom);

-- 注释
COMMENT ON TABLE buildings IS '北站南片区建筑（三维展示）';