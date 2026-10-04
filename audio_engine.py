import os
import shutil
import zipfile
import subprocess
import requests
import yt_dlp
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

# 尝试兼容静态 ffmpeg (开发或未安装系统 ffmpeg 环境时自动生效)
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/"
}

def download_bilibili_audio_direct(bvid: str, output_path: str, progress_hook=None) -> bool:
    """
    直连 B站 官方高保真 CDN 下载音频，彻底规避 PCDN / MCDN (mcdn.bilivideo.cn) 解析失败问题
    """
    try:
        # 1. 取得 cid
        v_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
        v_resp = requests.get(v_url, headers=HEADERS, timeout=8).json()
        if v_resp.get("code") != 0:
            return False
        cid = v_resp["data"]["cid"]
        
        # 2. 请求高清音频流
        p_url = f"https://api.bilibili.com/x/player/playurl?bvid={bvid}&cid={cid}&fnval=16&fnver=0&fourk=1"
        p_resp = requests.get(p_url, headers=HEADERS, timeout=8).json()
        audios = p_resp.get("data", {}).get("dash", {}).get("audio", [])
        if not audios:
            return False
            
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
            
        # 3. 流式分块下载
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
            
    # 策略 1: B站官方高带宽 CDN 直连
    if bvid:
        direct_out = os.path.join(TEMP_DIR, f"{output_prefix}.m4a")
        if download_bilibili_audio_direct(bvid, direct_out, progress_hook=progress_hook):
            return direct_out

    # 策略 2: 回退至 yt-dlp
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
    """下载视频封面图片用于嵌入音频元数据"""
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

def tag_audio_file(file_path: str, title: str, artist: str, album: str, cover_path: str = None, fmt: str = "mp3"):
    """
    为音频写入规范的元数据（ID3 / FLAC / MP4 Tag）
    规范：歌曲名、歌手、专辑名、封面，严格不包含歌词
    """
    try:
        if fmt == "mp3":
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
            
        elif fmt == "flac":
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
    export_format: str = "mp3",
    status_callback = None,
    bvid: str = "",
    cover_url: str = "",
    use_loudnorm: bool = ENABLE_LOUDNORM,
    use_fade: bool = ENABLE_FADE
) -> list:
    """
    Linux / LXC 容器切分歌曲引擎：
    1. 按时间轴毫秒级精准切歌
    2. 音频优化：EBU R128 响度标准化 + 首尾 0.3s 平滑淡入淡出（消除爆音与音量忽大忽小）
    3. 写入 ID3 封面与标准标签
    4. 自动持久化保存至专属音乐目录 MUSIC_DIR (挂载的 NAS / Host 目录) 并记录到 SQLite
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
        
        # 任务临时目录中的文件路径
        output_path = os.path.join(output_dir, filename)

        if status_callback:
            status_callback(
                current=i + 1,
                total=total_tracks,
                track_name=f"{artist} - {title}",
                progress=int(((i + 1) / total_tracks) * 100)
            )

        cmd = ["ffmpeg", "-y", "-ss", str(start_sec)]
        if end_sec > start_sec:
            cmd.extend(["-to", str(end_sec)])
            
        cmd.extend(["-i", source_audio])

        # 构建音频过滤器 (响度标准化 + 淡入淡出)
        audio_filters = []
        if use_loudnorm:
            # 广播级 EBU R128 响度均衡
            audio_filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
        if use_fade and duration_sec > 2:
            # 首尾 0.3s 平滑淡入淡出
            audio_filters.append("afade=t=in:ss=0:d=0.3")
            audio_filters.append(f"afade=t=out:st={duration_sec - 0.3:.2f}:d=0.3")

        if audio_filters:
            cmd.extend(["-af", ",".join(audio_filters)])
        
        if export_format == "mp3":
            cmd.extend(["-c:a", "libmp3lame", "-b:a", "320k"])
        elif export_format == "flac":
            cmd.extend(["-c:a", "flac"])
        elif export_format == "m4a":
            cmd.extend(["-c:a", "aac", "-b:a", "256k"])
        else:
            if not audio_filters:
                cmd.extend(["-c", "copy"])
            else:
                cmd.extend(["-c:a", "aac", "-b:a", "256k"])
            
        cmd.append(output_path)

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            print(f"FFmpeg 导出错误 [{filename}]: {proc.stderr.decode('utf-8', errors='ignore')}")
            continue

        # 写入规范元数据标签
        tag_audio_file(
            file_path=output_path,
            title=title,
            artist=artist,
            album=album_name,
            cover_path=cover_path,
            fmt=export_format
        )

        file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

        # 1. 自动同步保存在 Linux 宿主/NAS 挂载目录 (MUSIC_DIR)
        final_dest_path = str(MUSIC_DIR / filename)
        try:
            shutil.copy2(output_path, final_dest_path)
        except Exception as e:
            print(f"复制至 MUSIC_DIR 目录失败: {e}")

        # 2. 写入 SQLite 历史归档数据库
        try:
            dur_str = track.get("duration_str", "")
            add_song_record(
                bvid=bvid,
                artist=artist,
                title=title,
                album=album_name,
                filename=filename,
                file_path=final_dest_path,
                file_size=file_size,
                duration_str=dur_str,
                fmt=export_format,
                cover_url=cover_url
            )
        except Exception as e:
            print(f"写入 SQLite 历史数据库失败: {e}")

        generated_files.append({
            "filename": filename,
            "path": output_path,
            "artist": artist,
            "title": title,
            "size": file_size
        })

    return generated_files

def create_zip_archive(files: list, zip_path: str) -> str:
    """将拆分好的歌曲文件打包为 ZIP 供一键下载"""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for f in files:
            file_path = f["path"]
            arcname = f["filename"]
            if os.path.exists(file_path):
                zipf.write(file_path, arcname=arcname)
    return zip_path
