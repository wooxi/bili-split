import os
import shutil
import zipfile
import subprocess
import requests
import yt_dlp
from typing import Optional
from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC, ID3NoHeaderError
from mutagen.flac import FLAC, Picture
from mutagen.mp4 import MP4, MP4Cover

from config import (
    BASE_DIR,
    TEMP_DIR,
    DOWNLOADS_DIR,
    MUSIC_DIR,
    ENABLE_LOUDNORM,
    ENABLE_FADE
)
from db import add_song_record

try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/"
}

def is_audio_file_valid(file_path: str) -> bool:
    """
    智能检测音频文件是否完整无损：
    1. 必须存在且大小 > 50KB (杜绝 0 字节或切片残缺文件)
    2. 能通过 Mutagen 元数据解析并探测出有效时长
    """
    if not os.path.exists(file_path):
        return False
    try:
        size = os.path.getsize(file_path)
        if size < 50 * 1024:
            return False
            
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".flac":
            f = FLAC(file_path)
            return f.info.length > 3
        elif ext == ".mp3":
            from mutagen.mp3 import MP3
            m = MP3(file_path)
            return m.info.length > 3
        elif ext == ".m4a":
            m = MP4(file_path)
            return m.info.length > 3
        return True
    except Exception:
        return False

def download_bilibili_audio_direct(bvid: str, output_path: str, progress_hook=None, cid: Optional[int] = None) -> bool:
    """
    直连 B站 官方高保真 CDN 下载音频，支持按 cid 定位多P分集与官方播单
    """
    try:
        if not cid:
            v_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
            v_resp = requests.get(v_url, headers=HEADERS, timeout=8).json()
            if v_resp.get("code") != 0:
                return False
            cid = v_resp["data"]["cid"]
        
        # fnval=16 请求 Dash 高清音频流，支持最高码率无损源
        p_url = f"https://api.bilibili.com/x/player/playurl?bvid={bvid}&cid={cid}&fnval=16&fnver=0&fourk=1"
        p_resp = requests.get(p_url, headers=HEADERS, timeout=8).json()
        audios = p_resp.get("data", {}).get("dash", {}).get("audio", [])
        if not audios:
            return False
            
        # 选择最高带宽/最高码率音频
        best_audio = sorted(audios, key=lambda x: x.get("bandwidth", 0), reverse=True)[0]
        cand_urls = [best_audio.get("baseUrl")] + (best_audio.get("backupUrl") or [])
        
        # 优先选用官方镜像 CDN (*.bilivideo.com)，彻底避免 mcdn.bilivideo.cn
        chosen_url = None
        for u in cand_urls:
            if u and "bilivideo.com" in u and "mcdn" not in u:
                chosen_url = u
                break
        if not chosen_url:
            chosen_url = cand_urls[0]
            
        resp = requests.get(chosen_url, headers=HEADERS, stream=True, timeout=15)
        if resp.status_code != 200:
            return False
            
        total_len = int(resp.headers.get("content-length", 0))
        downloaded = 0
        
        with open(output_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=128 * 1024):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    if progress_hook and total_len > 0:
                        pct = (downloaded / total_len) * 100
                        progress_hook({'status': 'downloading', '_percent_str': f"{pct:.1f}%"})
                        
        return os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        print(f"直连官方 CDN 下载失败，准备回退: {e}")
        return False

def download_audio_source(url_or_bvid: str, output_prefix: str, progress_hook=None) -> str:
    """优先通过官方 CDN 提取高清原音频，失败则回退至 yt-dlp"""
    bvid = None
    if "BV" in url_or_bvid:
        import re
        m = re.search(r'(BV[a-zA-Z0-9]{10})', url_or_bvid)
        if m:
            bvid = m.group(1)
            
    if bvid:
        direct_out = os.path.join(TEMP_DIR, f"{output_prefix}.m4a")
        if download_bilibili_audio_direct(bvid, direct_out, progress_hook=progress_hook):
            return direct_out

    url = f"https://www.bilibili.com/video/{url_or_bvid}" if url_or_bvid.startswith("BV") else url_or_bvid
    out_tmpl = os.path.join(TEMP_DIR, f"{output_prefix}.%(ext)s")
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': out_tmpl,
        'quiet': True,
        'no_warnings': True,
        'user_agent': HEADERS['User-Agent'],
        'referer': HEADERS['Referer'],
        'extractor_args': {
            'bilibili': {
                'prefer_mcdn': ['false']
            }
        },
        'postprocessors': [],
    }
    
    if progress_hook:
        ydl_opts['progress_hooks'] = [progress_hook]

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)
        base_no_ext, _ = os.path.splitext(filename)
        for ext in ['.m4a', '.mp3', '.webm', '.aac', '.flac']:
            cand = base_no_ext + ext
            if os.path.exists(cand):
                return cand
        if os.path.exists(filename):
            return filename
        raise FileNotFoundError(f"未找到下载完成的音频文件: {filename}")

def download_cover(cover_url: str, output_path: str) -> bool:
    if not cover_url:
        return False
    try:
        if cover_url.startswith("//"):
            cover_url = "https:" + cover_url
        resp = requests.get(cover_url, timeout=10, headers=HEADERS)
        if resp.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(resp.content)
            return True
    except Exception as e:
        print(f"下载封面失败: {e}")
    return False

def tag_audio_file(file_path: str, title: str, artist: str, album: str, cover_path: str = None, fmt: str = "flac"):
    """
    为音频写入规范的元数据（FLAC / ID3 / MP4 Tag）
    规范：歌曲名、歌手、专辑名、封面，严格不包含歌词
    """
    try:
        if fmt == "flac":
            audio = FLAC(file_path)
            audio["title"] = title
            audio["artist"] = artist
            audio["album"] = album
            
            if cover_path and os.path.exists(cover_path):
                pic = Picture()
                with open(cover_path, "rb") as f:
                    pic.data = f.read()
                pic.type = 3
                pic.mime = "image/jpeg" if cover_path.endswith((".jpg", ".jpeg")) else "image/png"
                audio.clear_pictures()
                audio.add_picture(pic)
            audio.save()
            
        elif fmt == "mp3":
            try:
                audio = ID3(file_path)
            except ID3NoHeaderError:
                audio = ID3()
            
            audio.add(TIT2(encoding=3, text=title))
            audio.add(TPE1(encoding=3, text=artist))
            audio.add(TALB(encoding=3, text=album))
            
            if cover_path and os.path.exists(cover_path):
                with open(cover_path, "rb") as f:
                    cover_data = f.read()
                mime = "image/jpeg" if cover_path.endswith((".jpg", ".jpeg")) else "image/png"
                audio.add(APIC(
                    encoding=3,
                    mime=mime,
                    type=3,
                    desc="Cover",
                    data=cover_data
                ))
            audio.save(file_path)
            
        elif fmt == "m4a":
            audio = MP4(file_path)
            audio["\xa9nam"] = [title]
            audio["\xa9ART"] = [artist]
            audio["\xa9alb"] = [album]
            if cover_path and os.path.exists(cover_path):
                with open(cover_path, "rb") as f:
                    cover_data = f.read()
                cov_fmt = MP4Cover.FORMAT_JPEG if cover_path.endswith((".jpg", ".jpeg")) else MP4Cover.FORMAT_PNG
                audio["covr"] = [MP4Cover(cover_data, imageformat=cov_fmt)]
            audio.save()
            
    except Exception as e:
        print(f"写入元数据异常 [{file_path}]: {e}")

def cut_and_export_tracks(
    source_audio: str,
    tracks: list,
    album_name: str,
    cover_path: str,
    output_dir: str,
    export_format: str = "flac",
    status_callback = None,
    bvid: str = "",
    cover_url: str = "",
    use_loudnorm: bool = ENABLE_LOUDNORM,
    use_fade: bool = ENABLE_FADE
) -> list:
    """
    工业级全形态合集处理引擎：
    1. 智能断点续提与去重校验：已提取完整曲目自动跳过，残缺/损坏文件自动覆盖重新提取
    2. 平滑进度算法：从 0% 起步，随处理进度线性推进
    3. 音质优化：支持 FLAC 最高无损品质，集成 EBU R128 工业级响度标准化 + 首尾 0.3s 平滑淡出
    """
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(MUSIC_DIR, exist_ok=True)
    generated_files = []
    total_tracks = len(tracks)

    for i, track in enumerate(tracks):
        artist = track.get("artist", "群星").strip()
        title = track.get("title", f"Track {i+1}").strip()
        start_sec = track.get("start_sec", 0)
        end_sec = track.get("end_sec", 0)
        duration_sec = end_sec - start_sec if end_sec > start_sec else 0
        
        filename = f"{artist} - {title}.{export_format}"
        filename = "".join(c for c in filename if c not in r'\/:*?"<>|').strip()
        output_path = os.path.join(output_dir, filename)
        final_dest_path = str(MUSIC_DIR / filename)

        # 进度平滑计算：从第 1 首开始线性推进至 100%
        current_progress = int(((i) / total_tracks) * 100)
        track_bvid = track.get("bvid") or bvid
        dur_str = track.get("duration_str", "")

        # --- 智能查重与文件完整性校验 ---
        if is_audio_file_valid(final_dest_path):
            if status_callback:
                status_callback(
                    current=i + 1,
                    total=total_tracks,
                    track_name=f"{artist} - {title} (已完整存在，跳过)",
                    progress=current_progress
                )
            # 同步复用至本次任务目录
            if not os.path.exists(output_path):
                shutil.copy2(final_dest_path, output_path)
            
            # 确保数据库记录存在
            add_song_record(
                bvid=track_bvid,
                artist=artist,
                title=title,
                album=album_name,
                filename=filename,
                file_path=final_dest_path,
                file_size=os.path.getsize(final_dest_path),
                duration_str=dur_str,
                fmt=export_format,
                cover_url=track.get("cover_url") or cover_url
            )

            generated_files.append({
                "filename": filename,
                "path": output_path,
                "artist": artist,
                "title": title,
                "size": os.path.getsize(final_dest_path)
            })
            continue

        # 未完成或已损坏：开始提取/切分
        if status_callback:
            status_callback(
                current=i + 1,
                total=total_tracks,
                track_name=f"{artist} - {title}",
                progress=current_progress
            )

        track_cid = track.get("cid")
        is_independent_audio = bool(track_cid and (track.get("page", 0) > 1 or track.get("bvid")))

        # 多P或官方播单：独立音频直接拉取
        if is_independent_audio:
            track_raw_file = os.path.join(TEMP_DIR, f"part_{track_bvid}_{track_cid}.m4a")
            if not os.path.exists(track_raw_file):
                download_bilibili_audio_direct(track_bvid, track_raw_file, cid=track_cid)
            input_file = track_raw_file if os.path.exists(track_raw_file) else source_audio
            cmd = ["ffmpeg", "-y", "-i", input_file]
        else:
            # 单视频时间戳切分
            cmd = ["ffmpeg", "-y", "-ss", str(start_sec)]
            if end_sec > start_sec:
                cmd.extend(["-to", str(end_sec)])
            cmd.extend(["-i", source_audio])

        # 构建音频过滤器 (响度标准化 + 淡入淡出)
        audio_filters = []
        if use_loudnorm:
            audio_filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        if use_fade and duration_sec > 2:
            audio_filters.append("afade=t=in:ss=0:d=0.3")
            audio_filters.append(f"afade=t=out:st={duration_sec - 0.3:.2f}:d=0.3")

        if audio_filters:
            cmd.extend(["-af", ",".join(audio_filters)])
        
        # 编码格式选择：默认 FLAC 无损品质
        if export_format == "flac":
            cmd.extend(["-c:a", "flac", "-compression_level", "5"])
        elif export_format == "mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "320k"])
        elif export_format == "m4a":
            cmd.extend(["-c:a", "aac", "-b:a", "256k"])
        else:
            if not audio_filters:
                cmd.extend(["-c", "copy"])
            else:
                cmd.extend(["-c:a", "flac"])
            
        cmd.append(output_path)

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            print(f"FFmpeg 导出错误 [{filename}]: {proc.stderr.decode('utf-8', errors='ignore')}")
            continue

        # 写入元数据
        tag_audio_file(
            file_path=output_path,
            title=title,
            artist=artist,
            album=album_name,
            cover_path=cover_path,
            fmt=export_format
        )

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

        # 持久化至 MUSIC_DIR (直接覆盖旧文件/损坏文件)
        try:
            shutil.copy2(output_path, final_dest_path)
        except Exception as e:
            print(f"复制至 MUSIC_DIR 失败: {e}")

        # 写入 SQLite
        try:
            add_song_record(
                bvid=track_bvid,
                artist=artist,
                title=title,
                album=album_name,
                filename=filename,
                file_path=final_dest_path,
                file_size=file_size,
                duration_str=dur_str,
                fmt=export_format,
                cover_url=track.get("cover_url") or cover_url
            )
        except Exception as e:
            print(f"写入 SQLite 失败: {e}")

        generated_files.append({
            "filename": filename,
            "path": output_path,
            "artist": artist,
            "title": title,
            "size": file_size
        })

    return generated_files

def create_zip_archive(files: list, zip_path: str) -> str:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for f in files:
            file_path = f["path"]
            arcname = f["filename"]
            if os.path.exists(file_path):
                zipf.write(file_path, arcname=arcname)
    return zip_path
