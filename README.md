# 龙华区公共服务设施规划管理系统

## 项目概述
基于Vue3 + OpenLayers + GeoServer + PostgreSQL的WebGIS项目，用于龙华区公共服务设施规划选址和土地管理。

## 技术栈
- 前端: Vue3 + OpenLayers + Pinia
- 地图服务: GeoServer
- 数据库: PostgreSQL + PostGIS
- 部署: Docker Compose

## 开发环境设置

### 前置要求
- Docker & Docker Compose
- Node.js 18+
- Git

### 快速开始
1. 克隆项目: `git clone <repository-url>`
2. 启动GeoServer: `cd docker && docker-compose up -d`
3. 启动前端: `cd frontend && npm run dev`
4. 访问: http://localhost:5173

## Git工作流
- `main`分支: 稳定版本
- `develop`分支: 开发集成
- `feature/*`分支: 功能开发
- `hotfix/*`分支: 紧急修复