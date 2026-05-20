-- 创建建筑表
DROP TABLE IF EXISTS buildings CASCADE;
 CREATE TABLE buildings (
     ogc_fid SERIAL PRIMARY KEY,
     name VARCHAR(200),
     type VARCHAR(50),
     address TEXT,
     height NUMERIC(10,2),
     up_floor SMALLINT,
     down_floor SMALLINT,
     floor_area NUMERIC(12,2),
     geom GEOMETRY(MultiPolygon, 4326)
 );

-- 建立空间索引
CREATE INDEX idx_buildings_geom ON buildings USING GIST (geom);