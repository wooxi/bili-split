import os
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import requests

from config import (
    BASE_DIR,
    HOST,
    PORT,
    MUSIC_DIR,
    TEMP_DIR,
    DOWNLOADS_DIR,
    ENABLE_LOUDNORM,
    ENABLE_FADE
)
from parser import extract_bvid, fetch_bilibili_video_info, clean_song_info_rule_based
from ai_service import ai_normalize_song
from audio_engine import (
    download_audio_source,
    download_cover,
    cut_and_export_tracks,
    create_zip_archive
)
from db import get_history_songs, delete_song_record

app = FastAPI(
    title="BiliSplit - Linux LXC Edition",
    description="哔哩哔哩音乐合集智能切分与规范归档服务 (Linux/LXC 服务端版)"
)

# 启用 CORS 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 内存任务字典
tasks: Dict[str, Dict[str, Any]] = {}

class ParseRequest(BaseModel):
    url: str

class AiNormalizeRequest(BaseModel):
    title: str
    uploader: Optional[str] = "群星"
    desc: Optional[str] = ""

class TrackItem(BaseModel):
    id: int
    artist: str
    title: str
    start_sec: int
    end_sec: int
    start_str: Optional[str] = ""
    end_str: Optional[str] = ""
    duration_str: Optional[str] = ""
    is_ai: Optional[bool] = False

class ProcessRequest(BaseModel):
    bvid: str
    album: str
    cover_url: str
    format: str = "mp3"
    tracks: List[TrackItem]
    use_loudnorm: Optional[bool] = ENABLE_LOUDNORM
    use_fade: Optional[bool] = ENABLE_FADE

@app.get("/api/config")
async def api_get_config():
    """获取当前 Linux 服务端运行配置"""
    return {
        "music_dir": str(MUSIC_DIR),
        "enable_loudnorm": ENABLE_LOUDNORM,
        "enable_fade": ENABLE_FADE,
        "platform": os.name
    }

@app.get("/api/cover-proxy")
async def cover_proxy(url: str):
    """代理获取 B站封面图片，彻底解决外部访问与跨域 Referer 403 问题"""
    if not url:
        raise HTTPException(status_code=400, detail="缺少 url 参数")
    if url.startswith("//"):
        url = "https:" + url
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        content_type = resp.headers.get("content-type", "image/jpeg")
        return Response(content=resp.content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片代理异常: {str(e)}")

@app.post("/api/ai-normalize")
async def api_ai_normalize(req: AiNormalizeRequest):
    """针对格式不明确的歌曲名称，调用 AI 大模型进行精准规范"""
    res = ai_normalize_song(req.title, uploader=req.uploader, context_desc=req.desc)
    if res:
        return {"artist": res["artist"], "title": res["title"], "is_ai": True}
    
    a, t = clean_song_info_rule_based(req.title, default_artist=req.uploader)
    return {"artist": a, "title": t, "is_ai": False}

@app.post("/api/parse")
async def api_parse(req: ParseRequest):
    bvid = extract_bvid(req.url)
    if not bvid:
        raise HTTPException(status_code=400, detail="未能识别有效的 B站 视频链接或 BV号")
    
    try:
        data = fetch_bilibili_video_info(bvid)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")

def background_split_task(task_id: str, req_data: ProcessRequest):
    task = tasks[task_id]
    try:
        bvid = req_data.bvid
        album = req_data.album.strip() or f"Bilibili_{bvid}"
        fmt = req_data.format.lower()
        if fmt not in ["mp3", "flac", "m4a"]:
            fmt = "mp3"
            
        task["status"] = "downloading"
        task["step"] = "正在直连 B站官方高带宽 CDN 提取原声..."
        task["progress"] = 10

        # 1. 下载封面
        cover_path = os.path.join(TEMP_DIR, f"{task_id}_cover.jpg")
        has_cover = download_cover(req_data.cover_url, cover_path)
        if not has_cover:
            cover_path = None

        # 2. 下载音频源流
        def dl_progress(d):
            if d.get('status') == 'downloading':
                p = d.get('_percent_str', '0%').replace('%', '').strip()
                try:
                    p_val = float(p)
                    task["progress"] = 10 + int(p_val * 0.4)
                except Exception:
                    pass

        source_audio = download_audio_source(bvid, f"{task_id}_source", progress_hook=dl_progress)
        task["step"] = "原音频就绪，开始执行智能切分与音频优化..."
        task["progress"] = 50

        # 3. 切分、音频过滤与标签注入
        task_out_dir = os.path.join(DOWNLOADS_DIR, task_id)
        os.makedirs(task_out_dir, exist_ok=True)

        tracks_dict = [t.model_dump() for t in req_data.tracks]

        def on_track_status(current, total, track_name, progress):
            task["status"] = "processing"
            task["step"] = f"正在优化处理 [{current}/{total}]: {track_name}"
            task["progress"] = 50 + int((current / total) * 45)

        files = cut_and_export_tracks(
            source_audio=source_audio,
            tracks=tracks_dict,
            album_name=album,
            cover_path=cover_path,
            output_dir=task_out_dir,
            export_format=fmt,
            status_callback=on_track_status,
            bvid=bvid,
            cover_url=req_data.cover_url,
            use_loudnorm=req_data.use_loudnorm,
            use_fade=req_data.use_fade
        )

        # 4. 打包为 ZIP 归档
        safe_album = "".join(c for c in album if c not in r'\/:*?"<>|').strip() or "Bilibili_Album"
        zip_filename = f"{safe_album}.zip"
        zip_path = os.path.join(task_out_dir, zip_filename)
        create_zip_archive(files, zip_path)

        task["status"] = "completed"
        task["step"] = f"切分完成！歌曲已归档至服务器专属目录 ({MUSIC_DIR})"
        task["progress"] = 100
        task["files"] = [
            {
                "filename": f["filename"],
                "artist": f["artist"],
                "title": f["title"],
                "size_mb": round(f["size"] / (1024 * 1024), 2)
            }
            for f in files
        ]
        task["zip_filename"] = zip_filename

    except Exception as e:
        task["status"] = "error"
        task["step"] = f"处理失败: {str(e)}"
        print(f"任务异常 [{task_id}]: {e}")

@app.post("/api/process")
async def api_process(req: ProcessRequest, background_tasks: BackgroundTasks):
    if not req.tracks:
        raise HTTPException(status_code=400, detail="曲目列表不能为空")
    
    task_id = str(uuid.uuid4())[:8]
    tasks[task_id] = {
        "status": "pending",
        "step": "准备启动处理管线...",
        "progress": 0,
        "files": [],
        "zip_filename": None
    }
    
    background_tasks.add_task(background_split_task, task_id, req)
    return {"task_id": task_id}

@app.get("/api/task/{task_id}")
async def api_task_status(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="未找到该任务")
    return tasks[task_id]

@app.get("/api/download/{task_id}/zip")
async def api_download_zip(task_id: str):
    if task_id not in tasks or tasks[task_id]["status"] != "completed":
        raise HTTPException(status_code=400, detail="任务尚未完成或不存在")
    
    zip_filename = tasks[task_id]["zip_filename"]
    zip_path = os.path.join(DOWNLOADS_DIR, task_id, zip_filename)
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="压缩包文件未找到")
        
    return FileResponse(zip_path, filename=zip_filename, media_type="application/zip")

@app.get("/api/download/{task_id}/track/{filename}")
async def api_download_track(task_id: str, filename: str):
    track_path = os.path.join(DOWNLOADS_DIR, task_id, filename)
    if not os.path.exists(track_path):
        raise HTTPException(status_code=404, detail="歌曲文件未找到")
        
    return FileResponse(track_path, filename=filename)

# 历史曲库持久化管理 API
@app.get("/api/history")
async def api_get_history(keyword: Optional[str] = Query(None), limit: int = 100):
    """获取服务器上持久化归档的历史歌曲"""
    songs = get_history_songs(limit=limit, keyword=keyword)
    return {"songs": songs}

@app.delete("/api/history/{song_id}")
async def api_delete_history(song_id: int):
    """从数据库中删除某条历史记录"""
    success = delete_song_record(song_id)
    if not success:
        raise HTTPException(status_code=404, detail="未找到该记录")
    return {"status": "ok"}

@app.get("/api/stream-song/{filename}")
async def api_stream_song(filename: str):
    """直接流式播放/下载服务器 MUSIC_DIR 中的歌曲"""
    file_path = MUSIC_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="歌曲文件在服务器曲库中不存在")
    return FileResponse(str(file_path), filename=filename)

# 静态资源挂载
STATIC_DIR = os.path.join(BASE_DIR, "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=HOST, port=PORT, reload=True)
