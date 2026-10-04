import sqlite3
from typing import List, Dict, Any, Optional
from config import DB_PATH

def init_db():
    """初始化 SQLite 数据库"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
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
                format TEXT DEFAULT 'mp3',
                cover_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bvid ON songs(bvid)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_artist ON songs(artist)")
        conn.commit()

def add_song_record(
    bvid: str,
    artist: str,
    title: str,
    album: str,
    filename: str,
    file_path: str,
    file_size: int,
    duration_str: str = "",
    fmt: str = "mp3",
    cover_url: str = ""
) -> int:
    """插入一条歌曲归档记录"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO songs (bvid, artist, title, album, filename, file_path, file_size, duration_str, format, cover_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (bvid, artist, title, album, filename, file_path, file_size, duration_str, fmt, cover_url))
        conn.commit()
        return cursor.lastrowid

def get_history_songs(limit: int = 100, keyword: Optional[str] = None) -> List[Dict[str, Any]]:
    """查询历史已归档歌曲列表"""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if keyword:
            kw = f"%{keyword}%"
            cursor.execute("""
                SELECT * FROM songs 
                WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
                ORDER BY id DESC LIMIT ?
            """, (kw, kw, kw, limit))
        else:
            cursor.execute("SELECT * FROM songs ORDER BY id DESC LIMIT ?", (limit,))
        
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def delete_song_record(song_id: int) -> bool:
    """删除指定历史记录"""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM songs WHERE id = ?", (song_id,))
        conn.commit()
        return cursor.rowcount > 0

# 模块导入时自动确保数据库表创建
init_db()
