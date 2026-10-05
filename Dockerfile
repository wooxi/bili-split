FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 安装 Linux 基础依赖与 FFmpeg、Node.js 与 npm
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# 复制依赖清单并安装
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 安装 netease_engine 依赖
RUN if [ -d "/app/netease_engine" ]; then cd /app/netease_engine && npm install --production; fi

# 创建专属数据与音乐输出目录
RUN mkdir -p /music /app/data /tmp/bili-music

# 环境变量配置
ENV HOST=0.0.0.0 \
    PORT=8000 \
    MUSIC_DIR=/music \
    DATA_DIR=/app/data \
    TEMP_DIR=/tmp/bili-music \
    ENABLE_LOUDNORM=true \
    ENABLE_FADE=true

# 暴露端口与数据卷
EXPOSE 8000
VOLUME ["/music", "/app/data"]

# 启动服务
CMD ["python", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
