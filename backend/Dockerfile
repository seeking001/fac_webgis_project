# backend/Dockerfile
FROM node:20-alpine3.18

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 暴露端口
EXPOSE 3000

# 开发环境使用 nodemon
CMD ["npm", "run", "dev"]