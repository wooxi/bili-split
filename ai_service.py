import json
import re
import time
import requests
from typing import Optional, Dict, Any
from config import load_settings

UNCERTAIN_KEYWORDS = [
    '摇滚', '现场', 'Live', 'live', 'suno', 'Suno', 'AI', 'ai', 
    '翻唱', 'Cover', 'cover', '原唱', '改编', 'remix', 'Remix',
    '纯音', '吉他', '钢琴', '民谣', '慢摇', 'DJ', '串烧', '合辑'
]

def needs_ai_confirmation(raw_text: str) -> bool:
    text = raw_text.strip()
    if any(k in text for k in UNCERTAIN_KEYWORDS):
        return True
    if " - " not in text and " —— " not in text:
        return True
    return False

def ai_normalize_song(raw_title: str, uploader: str = "群星", context_desc: str = "") -> Optional[Dict[str, str]]:
    """调用 AI 大模型对歌曲名和歌手名进行标准化规范 (动态读取最新设置)"""
    cfg = load_settings()
    api_base = cfg.get("ai_api_base", "").rstrip('/')
    api_key = cfg.get("ai_api_key", "").strip()
    model = cfg.get("ai_model", "gemini-3.8-flash").strip()

    if not api_key or not api_base:
        return None

    system_prompt = """你是一个专业的本地音乐曲库整理专家。你的任务是将杂乱的B站音乐视频标题规范化为标准的音乐元数据。
输出必须是严格的 JSON 格式: {"artist": "歌手名", "title": "歌名"}

【核心规则】
1. 歌手 (artist):
   - 提取真实的歌手、音乐人或翻唱UP主（如 Agroce、周杰伦）。
   - 绝对禁止把“摇滚现场”、“现场版”、“国语经典”、“民谣”等风格/场景词当作歌手！
   - 如果视频是 UP主 使用 Suno/AI 改编，歌手填 UP主（例如 Agroce），切忌填“摇滚现场”。

2. 歌名 (title):
   - 提取歌曲的真实核心名称（例如 心墙、晴天）。
   - 必须剥离营销词与画质音质词（如 4K、60帧、Hi-Res音质、高音质、纯享版、无杂音、动态歌词）。
   - 必须剥离风格分类词（如“摇滚现场”、“现场版”、“伤感慢摇”、“纯音乐”），这些是风格不是歌名！
   - 版本规范：如果是 Suno/AI 改编，附上 (Suno AI)；如果是翻唱且知道原唱，附上 (Cover 原唱)；如果是 Live，附上 (Live)。示例: "心墙 (Suno AI)" 或 "白夜 (Cover 尹姝贻)"。

3. 输出要求: 仅输出 JSON 对象，不要包含 markdown 代码块或其他解释。"""

    user_prompt = f"""待整理的视频标题: "{raw_title}"
视频UP主: "{uploader}"
视频简介补充信息: "{context_desc[:300] if context_desc else ''}"

请按规则输出标准的 JSON:"""

    try:
        url = f"{api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1,
            "max_tokens": 150
        }
        
        resp = requests.post(url, headers=headers, json=payload, timeout=8)
        if resp.status_code == 200:
            result = resp.json()
            content = result["choices"][0]["message"]["content"].strip()
            json_match = re.search(r'\{[^{}]*\}', content)
            if json_match:
                parsed = json.loads(json_match.group(0))
                artist = parsed.get("artist", "").strip()
                title = parsed.get("title", "").strip()
                if artist and title:
                    return {"artist": artist, "title": title}
    except Exception as e:
        print(f"AI 规范化调用异常: {e}")
        
    return None

def test_ai_connection(api_base: str, api_key: str, model: str) -> dict:
    """测试 AI 网关连通性与模型可用性"""
    try:
        url = f"{api_base.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": model.strip(),
            "messages": [
                {"role": "user", "content": "hello"}
            ],
            "max_tokens": 5
        }
        t0 = time.time()
        resp = requests.post(url, headers=headers, json=payload, timeout=6)
        elapsed = round(time.time() - t0, 2)
        if resp.status_code == 200:
            return {"ok": True, "message": f"连接成功 (耗时 {elapsed}s)", "status": 200}
        else:
            return {"ok": False, "message": f"接口返回错误: HTTP {resp.status_code} - {resp.text[:100]}", "status": resp.status_code}
    except Exception as e:
        return {"ok": False, "message": f"连接异常: {str(e)}", "status": 500}
