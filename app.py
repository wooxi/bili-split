import os
import uuid
import json
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
    ENABLE_FADE,
    load_settings,
    save_settings
)
from parser import extract_bvid, fetch_bilibili_video_info, clean_song_info_rule_based
from ai_service import ai_normalize_song, test_ai_connection
from audio_engine import (
    download_audio_source,
    download_cover,
    cut_and_export_tracks,
    create_zip_archive
)
from db import (
    get_history_songs,
    delete_song_record,
    batch_delete_song_records,
    save_or_update_task,
    get_task_by_id,
    get_recent_tasks,
    delete_task_record
)
from netease_service import (
    get_netease_status,
    create_qr_code,
    check_qr_code,
    logout as netease_logout,
    start_upload_task as netease_start_upload,
    get_upload_status as netease_get_upload_status,
    cancel_upload_task as netease_cancel_upload
)

app = FastAPI(
    title="BiliSplit - Workstation Edition",
    description="哔哩哔哩音乐提取与自动化归档工作站"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    bvid: Optional[str] = ""
    cid: Optional[int] = None
    page: Optional[int] = 1
    cover_url: Optional[str] = ""
    is_ai: Optional[bool] = False

class ProcessRequest(BaseModel):
    bvid: str
    album: str
    cover_url: str
    uploader: Optional[str] = ""
    video_title: Optional[str] = ""
    format: str = "flac"  # 默认最高音质 FLAC
    tracks: List[TrackItem]
    use_loudnorm: Optional[bool] = ENABLE_LOUDNORM
    use_fade: Optional[bool] = ENABLE_FADE

class SettingsUpdateRequest(BaseModel):
    default_format: Optional[str] = None
    enable_loudnorm: Optional[bool] = None
    enable_fade: Optional[bool] = None
    fade_duration: Optional[float] = None
    ai_api_base: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None
    skip_existing: Optional[bool] = None
    tracklist_layout: Optional[str] = None

class TestAiRequest(BaseModel):
    ai_api_base: str
    ai_api_key: str
    ai_model: str

class NeteaseUploadRequest(BaseModel):
    file_names: Optional[List[str]] = None
    song_ids: Optional[List[int]] = None

@app.on_event("startup")
async def on_server_startup():
    """服务启动时自动纠偏：将上次因容器重启意外中断的幽灵任务重置为 interrupted，允许断点续提"""
    try:
        import sqlite3
        from config import DB_PATH
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("""
                UPDATE tasks 
                SET status = 'interrupted', 
                    step = '任务中断，已保留已提取曲目，可点击继续断点续提' 
                WHERE status IN ('processing', 'pending')
            """)
            conn.commit()
    except Exception as e:
        print(f"初始化任务状态纠偏异常: {e}")

@app.get("/api/config")
async def api_get_config():
    """获取当前服务配置与可编辑参数"""
    cfg = load_settings()
    # 遮罩敏感 key 供展示，若为空则显示空
    key = cfg.get("ai_api_key", "")
    masked_key = (key[:6] + "..." + key[-4:]) if len(key) > 12 else key
    return {
        "music_dir": str(MUSIC_DIR),
        "data_dir": str(BASE_DIR / "data"),
        "platform": os.name,
        "default_format": cfg.get("default_format", "flac"),
        "enable_loudnorm": cfg.get("enable_loudnorm", True),
        "enable_fade": cfg.get("enable_fade", True),
        "fade_duration": cfg.get("fade_duration", 0.3),
        "ai_api_base": cfg.get("ai_api_base", "http://192.168.100.4:8030/v1"),
        "ai_api_key": key,  # 原样返回以便前端表单直接修改
        "ai_model": cfg.get("ai_model", "gemini-3.8-flash"),
        "skip_existing": cfg.get("skip_existing", True),
        "tracklist_layout": cfg.get("tracklist_layout", "double")
    }

@app.post("/api/config")
async def api_save_config(req: SettingsUpdateRequest):
    """保存用户在设置页面修改的配置参数"""
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    saved = save_settings(update_data)
    return {"status": "ok", "config": saved}

@app.post("/api/config/test-ai")
async def api_test_ai(req: TestAiRequest):
    """测试指定 AI 网关与模型的连通性"""
    res = test_ai_connection(req.ai_api_base, req.ai_api_key, req.ai_model)
    return res

@app.get("/api/cover-proxy")
async def cover_proxy(url: str):
    """代理获取 B站封面图片，彻底解决防盗链 403 问题"""
    if not url:
        raise HTTPException(status_code=400, detail="缺少 url 参数")
    if url.startswith("//"):
        url = "https:" + url
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        content_type = resp.headers.get("content-type", "image/jpeg")
        return Response(content=resp.content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"图片代理异常: {str(e)}")

@app.post("/api/ai-normalize")
async def api_ai_normalize(req: AiNormalizeRequest):
    """按需调用 AI 大模型精修歌名"""
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
        if fmt not in ["flac", "mp3", "m4a"]:
            fmt = "flac"
            
        total_tracks = len(req_data.tracks)
        tracks_dump = [t.model_dump() for t in req_data.tracks]

        task["status"] = "processing"
        task["step"] = "正在准备音频流与封面..."
        task["progress"] = 1

        # 持久化至数据库 (刷新不丢)
        save_or_update_task(
            task_id=task_id, bvid=bvid, title=req_data.album, album=album,
            cover_url=req_data.cover_url, fmt=fmt, status="processing",
            progress=1, step=task["step"], total_tracks=total_tracks,
            processed_tracks=0, tracks_json=json.dumps(tracks_dump),
            uploader=req_data.uploader, video_title=req_data.video_title or req_data.album,
            url=f"https://www.bilibili.com/video/{bvid}"
        )

        cover_path = os.path.join(TEMP_DIR, f"{task_id}_cover.jpg")
        has_cover = download_cover(req_data.cover_url, cover_path)
        if not has_cover:
            cover_path = None

        # 检查是否为单视频长音频串烧（需要先下载整段音频流）
        is_single_stream = not any(t.get("cid") and (t.get("page", 0) > 1 or t.get("bvid")) for t in tracks_dump)
        source_audio = ""
        if is_single_stream:
            task["step"] = "正在下载原声长音频流..."
            source_audio = download_audio_source(bvid, f"{task_id}_source")

        task_out_dir = os.path.join(DOWNLOADS_DIR, task_id)
        os.makedirs(task_out_dir, exist_ok=True)

        def on_track_status(current, total, track_name, progress):
            task["status"] = "processing"
            task["step"] = f"正在处理 [{current}/{total}]: {track_name}"
            task["progress"] = progress
            save_or_update_task(
                task_id=task_id, bvid=bvid, title=req_data.album, album=album,
                cover_url=req_data.cover_url, fmt=fmt, status="processing",
                progress=progress, step=task["step"], total_tracks=total,
                processed_tracks=current, uploader=req_data.uploader,
                video_title=req_data.video_title or req_data.album,
                url=f"https://www.bilibili.com/video/{bvid}"
            )

        # 执行切分与智能断点去重
        files = cut_and_export_tracks(
            source_audio=source_audio,
            tracks=tracks_dump,
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

        # 压缩包打包
        safe_album = "".join(c for c in album if c not in r'\/:*?"<>|').strip() or "Bilibili_Album"
        zip_filename = f"{safe_album}.zip"
        zip_path = os.path.join(task_out_dir, zip_filename)
        create_zip_archive(files, zip_path)

        task["status"] = "completed"
        task["step"] = f"归档完成，全部歌曲已写入 {MUSIC_DIR}"
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

        save_or_update_task(
            task_id=task_id, bvid=bvid, title=req_data.album, album=album,
            cover_url=req_data.cover_url, fmt=fmt, status="completed",
            progress=100, step=task["step"], total_tracks=total_tracks,
            processed_tracks=total_tracks, files_json=json.dumps(task["files"]),
            uploader=req_data.uploader, video_title=req_data.video_title or req_data.album,
            url=f"https://www.bilibili.com/video/{bvid}"
        )

    except Exception as e:
        task["status"] = "error"
        task["step"] = f"处理失败: {str(e)}"
        save_or_update_task(
            task_id=task_id, bvid=req_data.bvid, title=req_data.album, album=req_data.album,
            cover_url=req_data.cover_url, fmt=req_data.format, status="error",
            progress=task.get("progress", 0), step=task["step"],
            uploader=req_data.uploader, video_title=req_data.video_title or req_data.album,
            url=f"https://www.bilibili.com/video/{req_data.bvid}"
        )
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
    
    save_or_update_task(
        task_id=task_id, bvid=req.bvid, title=req.album, album=req.album,
        cover_url=req.cover_url, fmt=req.format, status="pending",
        progress=0, step="已加入处理队列...", total_tracks=len(req.tracks),
        processed_tracks=0, tracks_json=json.dumps([t.model_dump() for t in req.tracks]),
        uploader=req.uploader, video_title=req.video_title or req.album,
        url=f"https://www.bilibili.com/video/{req.bvid}"
    )
    
    background_tasks.add_task(background_split_task, task_id, req)
    return {"task_id": task_id}

@app.get("/api/task/{task_id}")
async def api_task_status(task_id: str):
    # 优先查内存
    if task_id in tasks:
        return tasks[task_id]
    # 查 SQLite 数据库以支持刷新后恢复
    db_task = get_task_by_id(task_id)
    if db_task:
        return {
            "status": db_task["status"],
            "step": db_task["step"],
            "progress": db_task["progress"],
            "files": db_task.get("files", []),
            "zip_filename": f"{db_task['album']}.zip"
        }
    raise HTTPException(status_code=404, detail="未找到该任务")

# 任务队列历史与断点续提 API
@app.get("/api/tasks/recent")
async def api_get_recent_tasks():
    """获取所有历史与活动任务列表"""
    recent = get_recent_tasks(limit=30)
    return {"tasks": recent}

@app.post("/api/tasks/retry/{task_id}")
async def api_retry_task(task_id: str, background_tasks: BackgroundTasks):
    """智能重试/继续执行中断的任务 (利用完整性校验自动跳过已提取曲目)"""
    # 仅当任务在当前内存活跃运行时，才拦截并提示已有线程运行
    if task_id in tasks and tasks[task_id].get("status") in ("processing", "pending"):
        return {"task_id": task_id, "status": "already_running", "message": "任务已经在后台运行中"}

    db_task = get_task_by_id(task_id)
    if not db_task:
        raise HTTPException(status_code=404, detail="任务不存在")

    tracks = [TrackItem(**t) for t in db_task.get("tracks", [])]
    if not tracks:
        raise HTTPException(status_code=400, detail="该任务无有效曲目数据")
        
    req = ProcessRequest(
        bvid=db_task["bvid"],
        album=db_task["album"],
        cover_url=db_task.get("cover_url", ""),
        uploader=db_task.get("uploader", ""),
        video_title=db_task.get("video_title", db_task["album"]),
        format=db_task.get("format", "flac"),
        tracks=tracks
    )
    
    tasks[task_id] = {
        "status": "pending",
        "step": "准备断点续提...",
        "progress": db_task.get("progress", 0),
        "files": [],
        "zip_filename": None
    }
    background_tasks.add_task(background_split_task, task_id, req)
    return {"task_id": task_id, "status": "requeued"}

@app.delete("/api/tasks/{task_id}")
async def api_delete_task(task_id: str):
    """删除某条任务记录"""
    success = delete_task_record(task_id)
    if task_id in tasks:
        del tasks[task_id]
    return {"status": "ok", "deleted": success}

@app.get("/api/download/{task_id}/zip")
async def api_download_zip(task_id: str):
    zip_path = None
    if task_id in tasks and tasks[task_id].get("zip_filename"):
        zip_path = os.path.join(DOWNLOADS_DIR, task_id, tasks[task_id]["zip_filename"])
    else:
        db_task = get_task_by_id(task_id)
        if db_task:
            zip_path = os.path.join(DOWNLOADS_DIR, task_id, f"{db_task['album']}.zip")
            
    if not zip_path or not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="压缩包未生成或已被清理")
        
    return FileResponse(zip_path, filename=os.path.basename(zip_path), media_type="application/zip")

@app.get("/api/download/{task_id}/track/{filename}")
async def api_download_track(task_id: str, filename: str):
    track_path = os.path.join(DOWNLOADS_DIR, task_id, filename)
    if not os.path.exists(track_path):
        # 回退至 MUSIC_DIR
        track_path = MUSIC_DIR / filename
    if not os.path.exists(str(track_path)):
        raise HTTPException(status_code=404, detail="歌曲文件未找到")
        
    return FileResponse(str(track_path), filename=filename)

class BatchDeleteRequest(BaseModel):
    ids: List[int]

# 历史曲库持久化管理 API
@app.get("/api/history")
async def api_get_history(keyword: Optional[str] = Query(None), limit: int = 150):
    songs = get_history_songs(limit=limit, keyword=keyword)
    return {"songs": songs}

@app.delete("/api/history/{song_id}")
async def api_delete_history(song_id: int):
    file_path = delete_song_record(song_id)
    # 彻底从磁盘删除文件，避免孤立残留
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
    return {"status": "ok"}

@app.post("/api/history/batch-delete")
async def api_batch_delete_history(req: BatchDeleteRequest):
    """批量从数据库与磁盘物理删除选中的歌曲文件"""
    if not req.ids:
        return {"deleted_count": 0}
    
    file_paths = batch_delete_song_records(req.ids)
    for p in file_paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except Exception as e:
                print(f"删除物理文件异常: {p}, {e}")
                
    return {"deleted_count": len(req.ids)}

@app.get("/api/stream-song/{filename}")
async def api_stream_song(filename: str):
    """直接流式播放/下载服务器 MUSIC_DIR 中的歌曲 (带安全路径处理)"""
    # 彻底规范解码
    safe_filename = "".join(c for c in filename if c not in r'\/:*?"<>|').strip()
    file_path = MUSIC_DIR / safe_filename
    if not file_path.exists():
        # 尝试遍历查找匹配名称
        found = None
        for p in MUSIC_DIR.iterdir():
            if p.name == filename or p.name == safe_filename:
                found = p
                break
        if found:
            file_path = found
        else:
            raise HTTPException(status_code=404, detail=f"曲目文件未找到: {filename}")
            
    return FileResponse(str(file_path), filename=file_path.name)

# ==============================================================
# 网易云音乐云盘与扫码登录 API
# ==============================================================

@app.get("/api/netease/status")
async def api_netease_status():
    """获取网易云登录用户信息及云盘容量配额"""
    return await get_netease_status()

@app.post("/api/netease/qr/create")
async def api_netease_qr_create():
    """生成网易云登录二维码与 Key"""
    return await create_qr_code()

@app.get("/api/netease/qr/check")
async def api_netease_qr_check(key: str = Query(...)):
    """轮询网易云二维码扫码授权状态"""
    return await check_qr_code(key)

@app.post("/api/netease/logout")
async def api_netease_logout():
    """退出网易云账号"""
    return await netease_logout()

@app.post("/api/netease/upload")
async def api_netease_upload(req: Optional[NeteaseUploadRequest] = None):
    """发起推送到网易云云盘任务 (支持全量增量或选定歌曲列表)"""
    file_names = []
    if req:
        if req.file_names:
            file_names.extend(req.file_names)
        if req.song_ids:
            # 根据 song_ids 从媒体库查询出对应物理文件名
            all_songs = get_history_songs(limit=1000)
            target_ids = set(req.song_ids)
            for s in all_songs:
                if s["id"] in target_ids and s.get("filename"):
                    file_names.append(s["filename"])
    
    # 若未指定则为全量扫描 MUSIC_DIR 增量同步
    res = await netease_start_upload(file_names=file_names if file_names else None)
    if not res.get("success") and res.get("code") == 409:
        raise HTTPException(status_code=409, detail=res.get("message"))
    return res

@app.get("/api/netease/upload/status")
async def api_netease_upload_status():
    """获取网易云上传任务实时进度与日志"""
    return netease_get_upload_status()

@app.post("/api/netease/upload/cancel")
async def api_netease_upload_cancel():
    """主动中止当前网易云上传任务"""
    return await netease_cancel_upload()

STATIC_DIR = os.path.join(BASE_DIR, "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host=HOST, port=PORT, reload=True)
