import re
import requests
from typing import List, Dict, Any, Optional

from ai_service import needs_ai_confirmation, ai_normalize_song

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/"
}

TIME_REGEX = r'(?:(?:(\d{1,2}):)?(\d{1,2}):(\d{2}))'

# 常见画质/音质/营销无意义词汇
JUNK_WORDS = [
    r'4k\s*60[帧fps]*', r'1080p\s*60[帧fps]*', r'4k', r'1080p', r'hi-?res\s*音质?', r'高音质', r'无损\s*音质?',
    r'纯享\s*版?', r'完整版', r'超清', r'官方mv', r'自制mv', r'无杂音', r'戴上耳机', r'耳机福利',
    r'沉浸式', r'动态歌词', r'双声道', r'自用[备忘]*', r'车载[cd专享]*', r'重低音', r'环绕音[效]*'
]

# 纯风格/场景词汇（绝不能作为歌名或歌手，必须剔除）
STYLE_WORDS = [
    '摇滚现场', '摇滚版', '摇滚', '现场版', '现场Live', '现场', '纯音乐', '经典老歌',
    '伤感慢摇', '古风', '民谣版', '民谣', '爵士版', '爵士', '吉他弹唱', '钢琴版',
    '慢摇', 'DJ版', '重置版', '改编版', '纯享'
]

def extract_bvid(url_or_text: str) -> Optional[str]:
    url_or_text = url_or_text.strip()
    bv_match = re.search(r'(BV[a-zA-Z0-9]{10})', url_or_text, re.IGNORECASE)
    if bv_match:
        return bv_match.group(1)
    
    short_match = re.search(r'(https?://b23\.tv/[a-zA-Z0-9]+)', url_or_text)
    if short_match:
        try:
            resp = requests.head(short_match.group(1), headers=HEADERS, allow_redirects=True, timeout=5)
            bv_match = re.search(r'(BV[a-zA-Z0-9]{10})', resp.url, re.IGNORECASE)
            if bv_match:
                return bv_match.group(1)
        except Exception:
            pass
            
    return None

def time_str_to_seconds(h_str: Optional[str], m_str: str, s_str: str) -> int:
    h = int(h_str) if h_str else 0
    m = int(m_str)
    s = int(s_str)
    return h * 3600 + m * 60 + s

def seconds_to_time_str(seconds: int) -> str:
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{h:02d}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"

def clean_song_info_rule_based(raw_text: str, default_artist: str = "群星") -> tuple[str, str]:
    """规则引擎：快速纯规则清洗提取歌手与歌名"""
    text = raw_text.strip()
    
    # 1. 过滤开头的序号
    text = re.sub(r'^(?:\[?\d+[\.、\s\-\]）\)]|\(?\d+[\.、\s\-\]）\)]|【\d+】)\s*', '', text)
    
    # 2. 识别 AI歌手前缀，例如 【AI周杰伦】乌梅子酱
    ai_match = re.search(r'[【\[\(（](AI[\u4e00-\u9fa5a-zA-Z0-9]+)[】\]\)）]', text, re.I)
    if ai_match:
        default_artist = ai_match.group(1).strip()
        text = text[:ai_match.start()] + ' ' + text[ai_match.end():]
        
    # 3. 提取 Cover / 翻唱 / 原唱 信息 (支持中英文括号)
    cover_info = ""
    cover_match = re.search(r'[\(（\[【](Cover|cover|原唱[：:]|翻唱)[^\)）\]】]+[\)）\]】]', text)
    if cover_match:
        cover_info = cover_match.group(0).strip('()（）[]【】')
        cover_info = cover_info.replace(':', '：')
        text = text[:cover_match.start()] + ' ' + text[cover_match.end():]
        
    # 4. 彻底剔除外层风格标签（如 【摇滚现场】、【民谣】）
    style_matches = re.findall(r'[【\[]([^】\]]+)[】\]]', text)
    for sm in style_matches:
        text = text.replace(f'【{sm}】', ' ').replace(f'[{sm}]', ' ')
        
    # 5. 精准移除画质/音质营销词
    for jw in JUNK_WORDS:
        text = re.sub(rf'[【\[\(（]?\s*{jw}\s*[】\]\)）]?', ' ', text, flags=re.I)
        
    # 6. 识别合法版本标识 (Suno / AI)
    version_tags = []
    if re.search(r'\b(suno)\b', text, re.I):
        version_tags.append('Suno AI')
        text = re.sub(r'[-_\s]*\b(suno)\b[-_\s]*', ' ', text, flags=re.I)
    elif re.search(r'\bai\b', text, re.I):
        version_tags.append('AI')
        text = re.sub(r'[-_\s]*\bai\b[-_\s]*', ' ', text, flags=re.I)
        
    # 7. 过滤残留的风格词（如“摇滚现场”不应出现在歌名或歌手中）
    for sw in STYLE_WORDS:
        text = re.sub(rf'[\(（]?\s*{sw}\s*[\)）]?', ' ', text)
        
    text = re.sub(r'\s+', ' ', text).strip(' -—~|/丨:')
    
    # 8. 拆分歌手与歌名
    artist = default_artist
    title = text
    
    delims = [r'\s*——\s*', r'\s*—\s*', r'\s+-\s+', r'\s*-\s*', r'\s*/\s*', r'\s*\|\s*']
    for d in delims:
        parts = re.split(d, text, maxsplit=1)
        if len(parts) == 2:
            p1, p2 = parts[0].strip(), parts[1].strip()
            if p1 and p2:
                for sw in STYLE_WORDS:
                    p1 = p1.replace(sw, '').strip()
                    p2 = p2.replace(sw, '').strip()
                if p1:
                    artist = p1
                if p2:
                    title = p2
                break
                
    # 9. 组合最终标题 (歌名 + 规范后缀)
    all_suffixes = []
    if cover_info:
        all_suffixes.append(cover_info)
    for vt in version_tags:
        if vt not in all_suffixes:
            all_suffixes.append(vt)
            
    if all_suffixes:
        suffix_str = " ".join(all_suffixes)
        if suffix_str not in title:
            title = f"{title} ({suffix_str})"
            
    illegal_chars = ['\\', '/', '*', '?', '"', '<', '>', '|']
    for ch in illegal_chars:
        title = title.replace(ch, '')
        artist = artist.replace(ch, '')
        
    title = title.strip().replace(':', '：')
    artist = artist.strip().replace(':', '：')
    
    if not title:
        title = "未知曲目"
        
    return artist, title

def clean_song_info(raw_text: str, default_artist: str = "群星", context_desc: str = "", use_ai: bool = True) -> tuple[str, str, bool]:
    rule_artist, rule_title = clean_song_info_rule_based(raw_text, default_artist=default_artist)
    
    if use_ai and needs_ai_confirmation(raw_text):
        ai_res = ai_normalize_song(raw_text, uploader=default_artist, context_desc=context_desc)
        if ai_res:
            return ai_res["artist"], ai_res["title"], True
            
    return rule_artist, rule_title, False

def parse_text_for_tracks(text: str, total_duration: int, default_artist: str = "群星", context_desc: str = "") -> List[Dict[str, Any]]:
    """从纯文本（简介或评论）中解析时间戳和歌名列表"""
    lines = text.splitlines()
    raw_points = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        match = re.search(TIME_REGEX, line)
        if match:
            h_str, m_str, s_str = match.groups()
            sec = time_str_to_seconds(h_str, m_str, s_str)
            if sec >= total_duration and total_duration > 0:
                continue
                
            raw_title = line[:match.start()] + " " + line[match.end():]
            raw_title = raw_title.strip(" -—~:：|>#\t")
            
            if raw_title:
                raw_points.append({"sec": sec, "raw_title": raw_title})
                
    raw_points.sort(key=lambda x: x["sec"])
    
    unique_points = []
    for pt in raw_points:
        if not unique_points or pt["sec"] > unique_points[-1]["sec"] + 3:
            unique_points.append(pt)
            
    tracks = []
    for i, pt in enumerate(unique_points):
        start_sec = pt["sec"]
        if i + 1 < len(unique_points):
            end_sec = unique_points[i + 1]["sec"]
        else:
            end_sec = total_duration if total_duration > start_sec else start_sec + 240
            
        artist, title, is_ai = clean_song_info(pt["raw_title"], default_artist=default_artist, context_desc=context_desc, use_ai=False)
        
        tracks.append({
            "id": i + 1,
            "artist": artist,
            "title": title,
            "raw_title": pt["raw_title"],
            "start_sec": start_sec,
            "end_sec": end_sec,
            "start_str": seconds_to_time_str(start_sec),
            "end_str": seconds_to_time_str(end_sec),
            "duration_str": seconds_to_time_str(end_sec - start_sec),
            "is_ai": False
        })
        
    return tracks

def fetch_bilibili_video_info(bvid: str) -> Dict[str, Any]:
    """
    调用 B站官方 API 获取视频详情，全面支持三种合集形态：
    1. B站官方合集与播单 (UGC Season)
    2. 多 P 分 P 视频选集 (Multi-page)
    3. 单视频长音频串烧 (简介或评论区时间戳切分)
    """
    view_url = f"https://api.bilibili.com/x/web-interface/view?bvid={bvid}"
    resp = requests.get(view_url, headers=HEADERS, timeout=10)
    data = resp.json()
    
    if data.get("code") != 0:
        raise ValueError(f"获取视频信息失败: {data.get('message', '未知错误')}")
        
    vdata = data["data"]
    aid = vdata["aid"]
    title = vdata["title"]
    desc = vdata.get("desc", "")
    pic = vdata.get("pic", "")
    if pic and pic.startswith("//"):
        pic = "https:" + pic
        
    duration = vdata.get("duration", 0)
    owner_name = vdata.get("owner", {}).get("name", "Bilibili")
    pages = vdata.get("pages", [])
    ugc_season = vdata.get("ugc_season")
    
    tracks = []
    source_type = "unknown"
    album_title = title
    
    # 形态 1: 官方合集与播单列表 (UGC Season)
    if ugc_season:
        sections = ugc_season.get("sections", [])
        season_title = ugc_season.get("title") or title
        album_title = season_title
        source_type = "ugc_season"
        
        track_idx = 1
        for sec in sections:
            for ep in sec.get("episodes", []):
                ep_title = ep.get("title", f"Track {track_idx}")
                ep_bvid = ep.get("bvid", bvid)
                ep_cid = ep.get("cid")
                ep_dur = ep.get("arc", {}).get("duration") or ep.get("page", {}).get("duration", 0)
                ep_pic = ep.get("arc", {}).get("pic") or pic
                if ep_pic and ep_pic.startswith("//"):
                    ep_pic = "https:" + ep_pic
                    
                artist, clean_title, is_ai = clean_song_info(ep_title, default_artist=owner_name, context_desc=desc, use_ai=False)
                tracks.append({
                    "id": track_idx,
                    "artist": artist,
                    "title": clean_title,
                    "raw_title": ep_title,
                    "bvid": ep_bvid,
                    "cid": ep_cid,
                    "page": ep.get("page", {}).get("page", 1),
                    "cover_url": ep_pic,
                    "start_sec": 0,
                    "end_sec": ep_dur,
                    "start_str": "00:00",
                    "end_str": seconds_to_time_str(ep_dur),
                    "duration_str": seconds_to_time_str(ep_dur),
                    "is_ai": False
                })
                track_idx += 1
                
    # 形态 2: 多 P 选集视频 (同一 BV 号下包含 P1 ~ Pn)
    elif len(pages) > 1:
        source_type = "multi_page"
        for i, page in enumerate(pages):
            p_title = page.get("part", f"Track {i+1}")
            p_dur = page.get("duration", 0)
            artist, clean_title, is_ai = clean_song_info(p_title, default_artist=owner_name, context_desc=desc, use_ai=False)
            tracks.append({
                "id": i + 1,
                "artist": artist,
                "title": clean_title,
                "raw_title": p_title,
                "bvid": bvid,
                "cid": page.get("cid"),
                "page": page.get("page", i + 1),
                "cover_url": pic,
                "start_sec": 0,
                "end_sec": p_dur,
                "start_str": "00:00",
                "end_str": seconds_to_time_str(p_dur),
                "duration_str": seconds_to_time_str(p_dur),
                "is_ai": False
            })
            
    # 形态 3A: 单视频长音频串烧 - 简介自带时间戳
    if not tracks and desc:
        desc_tracks = parse_text_for_tracks(desc, duration, default_artist=owner_name, context_desc=desc)
        if len(desc_tracks) >= 2:
            tracks = desc_tracks
            source_type = "description"
            
    # 形态 3B: 单视频长音频串烧 - 评论区课代表置顶/热评打点
    if not tracks:
        try:
            reply_url = f"https://api.bilibili.com/x/v2/reply/main?type=1&oid={aid}&mode=3"
            r_resp = requests.get(reply_url, headers=HEADERS, timeout=8)
            r_data = r_resp.json()
            if r_data.get("code") == 0:
                replies = r_data.get("data", {}).get("replies", []) or []
                top_reply = r_data.get("data", {}).get("top", {}).get("upper")
                if top_reply:
                    replies.insert(0, top_reply)
                    
                for reply in replies[:10]:
                    msg = reply.get("content", {}).get("message", "")
                    cand_tracks = parse_text_for_tracks(msg, duration, default_artist=owner_name, context_desc=desc)
                    if len(cand_tracks) >= 2:
                        tracks = cand_tracks
                        source_type = "comment"
                        break
        except Exception as e:
            print(f"解析评论区时间轴异常: {e}")
            
    # 单曲兜底
    if not tracks:
        artist, clean_title, is_ai = clean_song_info(title, default_artist=owner_name, context_desc=desc)
        tracks = [{
            "id": 1,
            "artist": artist,
            "title": clean_title,
            "raw_title": title,
            "bvid": bvid,
            "cid": vdata.get("cid"),
            "page": 1,
            "cover_url": pic,
            "start_sec": 0,
            "end_sec": duration,
            "start_str": "00:00",
            "end_str": seconds_to_time_str(duration),
            "duration_str": seconds_to_time_str(duration),
            "is_ai": is_ai
        }]
        source_type = "single"
        
    return {
        "bvid": bvid,
        "aid": aid,
        "title": title,
        "album_title": album_title,
        "uploader": owner_name,
        "cover_url": pic,
        "duration": duration,
        "duration_str": seconds_to_time_str(duration),
        "source_type": source_type,
        "tracks": tracks
    }
