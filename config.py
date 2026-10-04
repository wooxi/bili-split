import os
import json
from pathlib import Path

# 基础目录
BASE_DIR = Path(__file__).resolve().parent

# 服务监听配置
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# 音乐输出与数据目录
MUSIC_DIR = Path(os.getenv("MUSIC_DIR", "/music" if os.name != "nt" else str(BASE_DIR / "music")))
TEMP_DIR = Path(os.getenv("TEMP_DIR", "/tmp/bili-music" if os.name != "nt" else str(BASE_DIR / "temp")))
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DOWNLOADS_DIR = Path(os.getenv("DOWNLOADS_DIR", str(BASE_DIR / "downloads")))
DB_PATH = DATA_DIR / "history.db"
SETTINGS_PATH = DATA_DIR / "settings.json"

os.makedirs(MUSIC_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

# 默认配置字典
DEFAULT_SETTINGS = {
    "default_format": "flac",
    "enable_loudnorm": True,
    "enable_fade": True,
    "fade_duration": 0.3,
    "ai_api_base": "http://192.168.100.4:8030/v1",
    "ai_api_key": "sk-xxbtN694lmzolOd4gPGLoREzYrwLroLxzhjZ3oD0wJ8D1C75",
    "ai_model": "gemini-3.8-flash",
    "skip_existing": True,
    "tracklist_layout": "double"  # 'double' 双列 或 'single' 单列
}

def load_settings() -> dict:
    """加载持久化用户配置，若无则使用默认值并融合环境变量"""
    cfg = dict(DEFAULT_SETTINGS)
    if os.getenv("AI_API_BASE"): cfg["ai_api_base"] = os.getenv("AI_API_BASE")
    if os.getenv("AI_API_KEY"): cfg["ai_api_key"] = os.getenv("AI_API_KEY")
    if os.getenv("AI_MODEL"): cfg["ai_model"] = os.getenv("AI_MODEL")
    if os.getenv("ENABLE_LOUDNORM"): cfg["enable_loudnorm"] = os.getenv("ENABLE_LOUDNORM").lower() in ("true", "1")
    if os.getenv("ENABLE_FADE"): cfg["enable_fade"] = os.getenv("ENABLE_FADE").lower() in ("true", "1")
    
    if SETTINGS_PATH.exists():
        try:
            with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
                user_cfg = json.load(f)
                cfg.update(user_cfg)
        except Exception as e:
            print(f"读取 settings.json 异常: {e}")
            
    return cfg

def save_settings(new_cfg: dict):
    """保存用户修改后的配置"""
    cfg = load_settings()
    cfg.update(new_cfg)
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    return cfg

# 动态属性访问
current_settings = load_settings()
ENABLE_LOUDNORM = current_settings.get("enable_loudnorm", True)
ENABLE_FADE = current_settings.get("enable_fade", True)
AI_API_BASE = current_settings.get("ai_api_base", "http://192.168.100.4:8030/v1")
AI_API_KEY = current_settings.get("ai_api_key", "sk-xxbtN694lmzolOd4gPGLoREzYrwLroLxzhjZ3oD0wJ8D1C75")
AI_MODEL = current_settings.get("ai_model", "gemini-3.8-flash")
