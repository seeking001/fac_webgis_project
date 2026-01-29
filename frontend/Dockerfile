# frontend/Dockerfile
FROM node:22-alpine

WORKDIR /app

# 复制文件
COPY package*.json ./

# 复制源代码
COPY . .

# 安装依赖
RUN npm install

# 暴露端口
EXPOSE 5173

# 开发模式启动
CMD ["npm", "run", "dev"]