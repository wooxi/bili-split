<div align="center">

# BiliSplit

### 哔哩哔哩音乐提取与自动化归档工作站 (Linux / Docker)

专为 Linux 系统设计的开箱即用音频提取与媒体归档系统。

[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Docker-blue?style=flat-square&logo=linux)](https://github.com/wooxi/bili-split)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://github.com/wooxi/bili-split)
[![Audio](https://img.shields.io/badge/Audio-EBU%20R128%20%7C%20320K-10b981?style=flat-square)](https://github.com/wooxi/bili-split)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/wooxi/bili-split)
[![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

<br/>

<img src="docs/images/ui-preview.svg" alt="BiliSplit UI 预览" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />

</div>

---

## 🌟 核心特性与功能

### 🎛️ 工业级双视图工作区 (Dual-Engine Workspace)
* **提取工作台 (Workstation)**：输入视频链接即可秒级解析，呈现原画封面、分段曲目与元数据编辑表；支持行内即时校对、一键互换歌手与歌名。
* **持久化媒体库 (Library)**：内置 SQLite 数据库，全量记录归档历史；支持按曲名、歌手、专辑实时模糊检索，随时流式调阅或单曲复下。

### 🔊 广播级音频均衡与平滑过渡
* **EBU R128 工业级响度标准化 (Loudness Normalization)**：自动均衡不同创作者、不同合集音源的播放响度，杜绝切歌时忽大忽小的听觉落差。
* **智能平滑淡入淡出 (Smart Micro-Fade)**：切分音轨首尾自动置入 0.3 秒平滑微淡出，消除视频切片边缘的突兀咔哒爆音。

### ✨ 智能元数据规范与曲风过滤 (AI Curation)
* **智能噪词过滤**：深度剥离“摇滚现场”、“伤感慢摇”、“纯音乐”等曲风/场景干扰词，保留纯净曲目核心。
* **AI 决策引擎接入**：分层策略结合规则引擎与大模型网关，针对复杂翻唱、Live 现场、AI 改编等非标标题，一键自动校对为标准规范：`歌手 - 歌名 (版本/Cover).mp3`。
* **原生 ID3 封装**：写入歌曲名、歌手、专辑及原画级高清封面（无任何多余歌词），车机与专业播放器即插即用。

### ⚡ 官方高速直连流提取
* **官方高带宽 CDN 直通**：自动探测并锁定官方主力 CDN 节点，彻底杜绝 PCDN / MCDN 解析超时与连接中断。
* **多格式高品质输出**：提供 MP3 (320Kbps 高保真)、FLAC (无损级)、M4A (原音轨流提取) 自由切换。

### 🎶 全局常驻音频播放器
* 界面底部常驻沉浸式流式音频控制台，支持时间轴毫秒拖拽微调、前退 5 秒快速定位、无级音量调节与实时封面渲染。

### ☁️ 网易云音乐云盘全自动安全增量同步 (全新)
* **扫码授权登录**：内置手机网易云音乐 App 扫码登录，自动轮询授权状态并持久化凭证，支持多端查看云盘容量与曲目统计。
* **单实例防重排他锁**：底层引入系统级进程排他锁（In-process asyncio.Lock + 跨进程 PID 锁），彻底杜绝并发上传导致双份曲目的问题。
* **全量云端查重与秒级跳过**：上传前全量比对个人云盘资产索引，已存在曲目毫秒级跳过，零重复网络消耗。
* **实时进度监视看板**：前端可视化呈现大进度条、百分比、当前正在上传的文件名与体积、4项关键指标统计及实时日志流终端。
* **刷新/断网状态不丢**：任务在 Linux 底层异步守护运行，页面刷新自动恢复监视，支持随时主动中止。
* **曲库与工作台深度集成**：媒体库支持单曲/多选批量推送；音频工作台归档完成后支持一键无缝推送到云盘。

### 🐧 Linux / Docker 原生就绪
* 采用 Linux 标准目录规范，歌曲自动持久化归档至挂载目录 `/music`（无缝共享给 Navidrome、Jellyfin 等媒体库）。
* 支持 Docker Compose 极简一键拉起，容器无缝重启与持久化。

---

## 🚀 部署指南 (Linux / Docker)

### 选项 A：Docker Compose 部署 (推荐)

在 Linux 服务器中创建部署目录，编写 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  bili-split:
    image: bili-split:latest
    build: .
    container_name: bili-split
    restart: unless-stopped
    ports:
      - "8000:8000"
    volumes:
      # 持久化音乐输出目录（可共享给 Navidrome / Jellyfin）
      - /ssd/music:/music
      # 持久化数据库与配置
      - ./data:/app/data
    environment:
      - HOST=0.0.0.0
      - PORT=8000
      - MUSIC_DIR=/music
      - ENABLE_LOUDNORM=true
      - ENABLE_FADE=true
      - AI_API_BASE=http://192.168.100.4:8030/v1
      - AI_API_KEY=sk-xxxxxx
      - AI_MODEL=gemini-3.8-flash
```

启动服务：
```bash
docker compose up -d --build
```

访问地址：  
👉 **`http://<Linux服务器IP>:8000`**

---

### 选项 B：Linux 宿主机原生部署

```bash
# 1. 克隆代码
git clone https://github.com/wooxi/bili-split.git /opt/bili-music-splitter
cd /opt/bili-music-splitter

# 2. 执行安装脚本 (配置 Python 虚拟环境并注册 Systemd 开机自启)
sudo bash install.sh
```

---

## 🛠️ 服务端运维命令 (Docker)

```bash
# 查看运行日志
docker compose logs -f

# 重启服务
docker compose restart

# 更新并重新构建容器
docker compose up -d --build
```

---

## ⚙️ 环境变量说明 (.env)

| 变量名 | 默认值 | 作用说明 |
| :--- | :--- | :--- |
| `HOST` | `0.0.0.0` | 监听地址（`0.0.0.0` 允许局域网外部设备访问） |
| `PORT` | `8000` | 服务 Web 与 API 端口 |
| `MUSIC_DIR` | `/music` | 歌曲持久化保存的专属目录（挂载外部存储） |
| `ENABLE_LOUDNORM` | `true` | 是否启用 EBU R128 工业级响度标准化 |
| `ENABLE_FADE` | `true` | 是否启用切片首尾 0.3 秒平滑淡入淡出 |
| `AI_API_BASE` | `http://.../v1` | OpenAI 兼容接口地址 |
| `AI_API_KEY` | `sk-...` | AI 模型网关密钥 |
| `AI_MODEL` | `gemini-3.8-flash` | 模型标识 |

---

## 📄 开源许可证

本项目基于 [MIT License](LICENSE) 开源发布。
