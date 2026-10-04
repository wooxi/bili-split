import sqlite3
import json
from typing import List, Dict, Any, Optional
from config import DB_PATH

def init_db():
    """初始化 SQLite 数据库 (歌曲历史表 + 任务队列持久化表)"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # 1. 已归档歌曲表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bvid TEXT NOT NULL,
                artist TEXT NOT NULL,
                title TEXT NOT NULL,
                album TEXT NOT NULL,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                duration_str TEXT DEFAULT '',
                format TEXT DEFAULT 'flac',
                cover_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bvid ON songs(bvid)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_artist ON songs(artist)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_filename ON songs(filename)")

        # 2. 任务持久化表 (刷新页面不丢任务，支持断点重试)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                bvid TEXT NOT NULL,
                title TEXT NOT NULL,
                album TEXT NOT NULL,
                cover_url TEXT DEFAULT '',
                format TEXT DEFAULT 'flac',
                status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'error'
                progress INTEGER DEFAULT 0,
                step TEXT DEFAULT '',
                total_tracks INTEGER DEFAULT 0,
                processed_tracks INTEGER DEFAULT 0,
                tracks_json TEXT DEFAULT '[]',
                files_json TEXT DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status)")
        conn.commit()

# --- 歌曲归档管理 ---

def add_song_record(
    bvid: str,
    artist: str,
    title: str,
    album: str,
    filename: str,
    file_path: str,
    file_size: int,
    duration_str: str = "",
    fmt: str = "flac",
    cover_url: str = ""
) -> int:
    """插入或更新一条歌曲归档记录"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM songs WHERE filename = ?", (filename,))
        cursor.execute("""
            INSERT INTO songs (bvid, artist, title, album, filename, file_path, file_size, duration_str, format, cover_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bvid, artist, title, album, filename, file_path, file_size, duration_str, fmt, cover_url))
        conn.commit()
        return cursor.lastrowid

def get_history_songs(limit: int = 150, keyword: Optional[str] = None) -> List[Dict[str, Any]]:
    """查询历史已归档歌曲列表"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if keyword:
            kw = f"%{keyword}%"
            cursor.execute("""
                SELECT * FROM songs 
                WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR filename LIKE ?
                ORDER BY id DESC LIMIT ?
            """, (kw, kw, kw, kw, limit))
        else:
            cursor.execute("SELECT * FROM songs ORDER BY id DESC LIMIT ?", (limit,))
        
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def delete_song_record(song_id: int) -> Optional[str]:
    """删除指定历史记录，并返回其文件路径供清理磁盘"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT file_path FROM songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        file_path = row[0] if row else None
        
        cursor.execute("DELETE FROM songs WHERE id = ?", (song_id,))
        conn.commit()
        return file_path

# --- 任务持久化与断点管理 ---

def save_or_update_task(
    task_id: str,
    bvid: str,
    title: str,
    album: str,
    cover_url: str,
    fmt: str,
    status: str,
    progress: int,
    step: str,
    total_tracks: int = 0,
    processed_tracks: int = 0,
    tracks_json: str = "[]",
    files_json: str = "[]"
):
    """保存或更新任务状态至 SQLite，确保刷新页面任务不丢失"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (id, bvid, title, album, cover_url, format, status, progress, step, total_tracks, processed_tracks, tracks_json, files_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                progress = excluded.progress,
                step = excluded.step,
                processed_tracks = excluded.processed_tracks,
                files_json = excluded.files_json,
                updated_at = CURRENT_TIMESTAMP
        """, (task_id, bvid, title, album, cover_url, fmt, status, progress, step, total_tracks, processed_tracks, tracks_json, files_json))
        conn.commit()

def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """查询指定任务状态"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        if not row:
            return None
        res = dict(row)
        res["files"] = json.loads(res.get("files_json") or "[]")
        res["tracks"] = json.loads(res.get("tracks_json") or "[]")
        return res

def get_recent_tasks(limit: int = 20) -> List[Dict[str, Any]]:
    """获取所有近期任务历史"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks ORDER BY updated_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["files"] = json.loads(d.get("files_json") or "[]")
            d["tracks"] = json.loads(d.get("tracks_json") or "[]")
            result.append(d)
        return result

init_db()
