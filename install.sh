#!/usr/bin/env bash
# ==============================================================================
# BiliSplit - Linux / LXC 容器一键部署脚本 (支持 Debian / Ubuntu)
# ==============================================================================

set -e

# 确保以 root 权限运行
if [ "$EUID" -ne 0 ]; then
  echo "[-] 请使用 root 权限运行此脚本 (例如: sudo bash install.sh)"
  exit 1
fi

INSTALL_DIR="/opt/bili-music-splitter"
MUSIC_DIR="/music"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=================================================="
echo "    BiliSplit - Linux LXC 服务端一键部署程序"
echo "=================================================="

# 1. 安装系统依赖 (FFmpeg, Python3, venv)
echo "[1/5] 安装系统基础依赖与音视频工具 (FFmpeg)..."
apt-get update -qq
apt-get install -y -qq ffmpeg python3 python3-pip python3-venv curl

# 2. 准备部署目录与专属音乐存储目录
echo "[2/5] 准备服务运行目录与 /music 存储目录..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$MUSIC_DIR"

# 复制项目代码
cp -r "$CURRENT_DIR"/* "$INSTALL_DIR/"

# 3. 创建 Python 虚拟运行环境
echo "[3/5] 构建 Python 独立虚拟环境并安装依赖..."
cd "$INSTALL_DIR"
python3 -m venv venv
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q

# 4. 配置 Systemd 系统守护进程服务
echo "[4/5] 注册并配置 Systemd 系统服务 (开机自启)..."
cat << 'EOF' > /etc/systemd/system/bili-split.service
[Unit]
Description=BiliSplit - Bilibili Music Splitter Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/bili-music-splitter
ExecStart=/opt/bili-music-splitter/venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
Environment=HOST=0.0.0.0
Environment=PORT=8000
Environment=MUSIC_DIR=/music
Environment=ENABLE_LOUDNORM=true
Environment=ENABLE_FADE=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable bili-split
systemctl restart bili-split

# 5. 完成提示
echo "[5/5] 服务启动完毕！"
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo "=================================================="
echo " BiliSplit 服务已成功部署并在后台运行！"
echo ""
echo " 访问 Web 界面: http://${LOCAL_IP:-127.0.0.1}:8000"
echo " 音乐输出目录: ${MUSIC_DIR} (建议挂载宿主盘或 NAS)"
echo ""
echo " 常用运维命令:"
echo " - 查看状态: systemctl status bili-split"
echo " - 查看日志: journalctl -u bili-split -f"
echo " - 重启服务: systemctl restart bili-split"
echo " - 停止服务: systemctl stop bili-split"
echo "=================================================="
