import os
from pathlib import Path

# 基础目录（Linux 容器内通常位于 /app 或 /opt/bili-music-splitter）
BASE_DIR = Path(__file__).resolve().parent

# 服务监听配置（0.0.0.0 允许 LXC 容器外部局域网访问）
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# 音乐输出专属目录 (在 LXC 中建议挂载外部 NAS 或 Host 目录，如 /music)
MUSIC_DIR = Path(os.getenv("MUSIC_DIR", "/music" if os.name != "nt" else str(BASE_DIR / "music")))

# 临时缓存目录与数据目录
TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/bili-music" if os.name != "nt" else str(BASE_DIR / "temp")))
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DOWNLOADS_DIR = Path(os.getenv("DOWNLOADS_DIR", str(BASE_DIR / "downloads")))

# 数据库文件路径
DB_PATH = DATA_DIR / "history.db"

# 音频增强配置
ENABLE_LOUDNORM = os.getenv("ENABLE_LOUDNORM", "true").lower() in ("true", "1", "yes")
ENABLE_FADE = os.getenv("ENABLE_FADE", "true").lower() in ("true", "1", "yes")

# AI 大模型网关配置（支持环境变量注入）
AI_API_BASE = os.getenv("AI_API_BASE", "http://192.168.100.4:8030/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "sk-xxbtN694lmzolOd4gPGLoREzYrwLroLxzhjZ3oD0wJ8D1C75")
AI_MODEL = os.getenv("AI_MODEL", "gemini-3.8-flash")

# 确保目录初始化
os.makedirs(MUSIC_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
