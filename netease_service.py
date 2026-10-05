import asyncio
import json
import os
import signal
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from config import DATA_DIR, MUSIC_DIR

ENGINE_DIR = Path(__file__).resolve().parent / "netease_engine"
RUNNER_JS = ENGINE_DIR / "runner.js"
COOKIE_FILE = DATA_DIR / "netease_cookie.txt"
LOCK_FILE = DATA_DIR / "netease_uploader.lock"
STATE_FILE = DATA_DIR / "netease_upload_state.json"

# 全局任务锁与状态
_upload_lock = asyncio.Lock()
_current_process: Optional[asyncio.subprocess.Process] = None

_upload_state: Dict[str, Any] = {
    "status": "idle",  # "idle" | "running" | "completed" | "failed" | "cancelled"
    "total": 0,
    "current": 0,
    "current_file": "",
    "current_size": "",
    "uploaded": 0,
    "skipped": 0,
    "failed": 0,
    "percent": 0.0,
    "message": "空闲中，尚无正在执行的同步任务",
    "logs": [],
    "started_at": None,
    "updated_at": None,
}

def _append_log(level: str, text: str):
    """向状态中添加带时间戳的日志"""
    timestamp = time.strftime("%H:%M:%S")
    entry = {"time": timestamp, "level": level, "text": text}
    logs = _upload_state.setdefault("logs", [])
    logs.append(entry)
    # 最多保留 250 条日志
    if len(logs) > 250:
        logs.pop(0)

def _save_state_to_disk():
    """将状态写入持久化文件"""
    try:
        _upload_state["updated_at"] = time.time()
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(_upload_state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[NetEase] 保存状态文件异常: {e}")

def _load_state_from_disk():
    """从持久化文件恢复状态"""
    global _upload_state
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
                _upload_state.update(saved)
        except Exception as e:
            print(f"[NetEase] 加载历史状态异常: {e}")

# 初始化时加载持久化状态
_load_state_from_disk()

def is_process_alive(pid: int) -> bool:
    """探测指定 PID 是否仍在运行"""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def check_and_clean_stale_lock() -> bool:
    """检查锁文件，若进程已死则清理。返回 True 表示当前有活跃锁"""
    if not LOCK_FILE.exists():
        return False
    try:
        content = LOCK_FILE.read_text(encoding="utf-8").strip()
        pid = int(content) if content.isdigit() else 0
        if pid and is_process_alive(pid):
            return True
        else:
            # 陈旧锁文件，自动回收
            LOCK_FILE.unlink(missing_ok=True)
            if _upload_state.get("status") == "running":
                _upload_state["status"] = "failed"
                _upload_state["message"] = "先前的上传任务异常中止"
                _save_state_to_disk()
            return False
    except Exception as e:
        print(f"[NetEase] 检查锁异常: {e}")
        LOCK_FILE.unlink(missing_ok=True)
        return False

async def get_netease_status() -> dict:
    """获取网易云登录用户信息和云盘容量"""
    check_and_clean_stale_lock()
    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(RUNNER_JS),
            "status",
            "--cookie-file",
            str(COOKIE_FILE),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        raw = stdout.decode("utf-8").strip()
        if raw:
            try:
                data = json.loads(raw)
                return data
            except json.JSONDecodeError:
                pass
        return {"success": False, "isLogin": False, "error": stderr.decode("utf-8") or "响应解析失败"}
    except Exception as e:
        return {"success": False, "isLogin": False, "error": str(e)}

async def create_qr_code() -> dict:
    """生成网易云登录二维码"""
    try:
        # 1. 获取 unikey
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(RUNNER_JS),
            "qr_key",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        key_res = json.loads(stdout.decode("utf-8").strip() or "{}")
        unikey = key_res.get("unikey")
        if not unikey:
            return {"success": False, "error": key_res.get("error", "未能获取登录Key")}

        # 2. 生成二维码图片 Base64
        proc2 = await asyncio.create_subprocess_exec(
            "node",
            str(RUNNER_JS),
            "qr_create",
            "--key",
            unikey,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout2, stderr2 = await proc2.communicate()
        create_res = json.loads(stdout2.decode("utf-8").strip() or "{}")

        return {
            "success": True,
            "unikey": unikey,
            "qrurl": create_res.get("qrurl", ""),
            "qrimg": create_res.get("qrimg", "")
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

async def check_qr_code(key: str) -> dict:
    """轮询二维码扫码状态"""
    try:
        proc = await asyncio.create_subprocess_exec(
            "node",
            str(RUNNER_JS),
            "qr_check",
            "--key",
            key,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        raw = stdout.decode("utf-8").strip()
        data = json.loads(raw or "{}")

        code = data.get("code")
        # 803 表示扫码授权成功，保存凭证
        if code == 803 and data.get("cookie"):
            cookie_content = data["cookie"]
            if isinstance(cookie_content, list):
                cookie_content = "; ".join(cookie_content)
            COOKIE_FILE.write_text(str(cookie_content), encoding="utf-8")

        return data
    except Exception as e:
        return {"success": False, "error": str(e)}

async def logout() -> dict:
    """退出登录"""
    try:
        if COOKIE_FILE.exists():
            COOKIE_FILE.unlink()
        return {"success": True, "message": "已成功退出登录并清除凭证"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def get_upload_status() -> dict:
    """获取当前或最近一次上传任务的实时进度与日志"""
    is_locked = check_and_clean_stale_lock()
    if not is_locked and _upload_state.get("status") == "running":
        _upload_state["status"] = "completed"
        _save_state_to_disk()

    return dict(_upload_state)

async def cancel_upload_task() -> dict:
    """主动取消或中止当前同步任务"""
    global _current_process
    if _current_process and _current_process.returncode is None:
        try:
            _current_process.terminate()
            await asyncio.sleep(0.5)
            if _current_process.returncode is None:
                _current_process.kill()
        except Exception as e:
            print(f"[NetEase] 终止进程异常: {e}")

    LOCK_FILE.unlink(missing_ok=True)
    _upload_state["status"] = "cancelled"
    _upload_state["message"] = "同步任务已被用户主动中止"
    _append_log("warn", "同步任务已被用户中止")
    _save_state_to_disk()
    return {"success": True, "message": "已成功中止同步任务"}

async def start_upload_task(file_names: Optional[List[str]] = None) -> dict:
    """
    发起推送上传任务。
    严格排他锁机制，杜绝并发导致双份上传。
    """
    global _current_process, _upload_state

    # 1. 严格防并发校验
    if check_and_clean_stale_lock():
        return {
            "success": False,
            "code": 409,
            "message": "已有网易云同步任务正在运行中，系统已启动排他锁保护，杜绝重复上传！",
            "current_state": _upload_state
        }

    # 2. 检查凭证
    if not COOKIE_FILE.exists() or not COOKIE_FILE.read_text(encoding="utf-8").strip():
        return {
            "success": False,
            "code": 401,
            "message": "未找到网易云登录凭证，请先在网页端扫码登录！"
        }

    # 3. 初始化状态
    _upload_state.update({
        "status": "running",
        "total": 0,
        "current": 0,
        "current_file": "",
        "current_size": "",
        "uploaded": 0,
        "skipped": 0,
        "failed": 0,
        "percent": 0.0,
        "message": "正在初始化增量同步引擎...",
        "logs": [],
        "started_at": time.time(),
        "updated_at": time.time(),
    })
    _append_log("info", "🚀 启动网易云音乐云盘增量同步引擎...")
    _save_state_to_disk()

    # 4. 构建参数
    cmd = [
        "node",
        str(RUNNER_JS),
        "upload",
        "--cookie-file", str(COOKIE_FILE),
        "--music-dir", str(MUSIC_DIR),
        "--lock-file", str(LOCK_FILE),
        "--state-file", str(STATE_FILE),
    ]

    if file_names:
        clean_names = [Path(f).name for f in file_names]
        cmd.extend(["--files", ",".join(clean_names)])

    # 5. 后台异步执行并实时读取 NDJSON 输出
    async def _runner_worker():
        global _current_process
        try:
            _current_process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # 实时流式读取 stdout
            while True:
                line = await _current_process.stdout.readline()
                if not line:
                    break
                line_str = line.decode("utf-8", errors="replace").strip()
                if not line_str:
                    continue

                try:
                    event_data = json.loads(line_str)
                    evt = event_data.get("event")

                    if evt == "init":
                        _upload_state["total"] = event_data.get("total", 0)
                        cloud_count = event_data.get("cloudCount", 0)
                        _upload_state["message"] = f"云盘已有 {cloud_count} 首，待处理本地曲目 {_upload_state['total']} 首"
                        _append_log("info", f"云盘查重就绪（现有 {cloud_count} 首），待比对本地曲目 {_upload_state['total']} 首")

                    elif evt == "skip":
                        _upload_state["skipped"] += 1
                        _upload_state["current"] = event_data.get("index", _upload_state["current"])
                        fn = event_data.get("filename", "")
                        _upload_state["current_file"] = fn
                        if _upload_state["total"] > 0:
                            _upload_state["percent"] = round((_upload_state["current"] / _upload_state["total"]) * 100, 1)
                        _append_log("skip", f"[{_upload_state['current']}/{_upload_state['total']}] [已在云盘中，秒级跳过] {fn}")

                    elif evt == "uploading":
                        _upload_state["current"] = event_data.get("index", _upload_state["current"])
                        fn = event_data.get("filename", "")
                        sz = event_data.get("size", "")
                        _upload_state["current_file"] = fn
                        _upload_state["current_size"] = sz
                        _upload_state["message"] = f"正在上传 ({_upload_state['current']}/{_upload_state['total']}): {fn}"
                        _append_log("info", f"[{_upload_state['current']}/{_upload_state['total']}] 正在上传: {fn} ({sz})...")

                    elif evt == "success":
                        _upload_state["uploaded"] += 1
                        fn = event_data.get("filename", "")
                        song_id = event_data.get("songId", "")
                        if _upload_state["total"] > 0:
                            _upload_state["percent"] = round((_upload_state["current"] / _upload_state["total"]) * 100, 1)
                        _append_log("success", f"[{_upload_state['current']}/{_upload_state['total']}] ✓ 上传成功: {fn} (ID: {song_id})")

                    elif evt == "error":
                        _upload_state["failed"] += 1
                        fn = event_data.get("filename", "")
                        err_msg = event_data.get("error", "未知错误")
                        if _upload_state["total"] > 0:
                            _upload_state["percent"] = round((_upload_state["current"] / _upload_state["total"]) * 100, 1)
                        _append_log("error", f"[{_upload_state['current']}/{_upload_state['total']}] ✗ 上传失败: {fn} -> {err_msg}")

                    elif evt == "done":
                        _upload_state["status"] = "completed"
                        _upload_state["percent"] = 100.0
                        _upload_state["message"] = f"同步完毕！成功: {_upload_state['uploaded']} 首，跳过: {_upload_state['skipped']} 首，失败: {_upload_state['failed']} 首"
                        _append_log("success", f"🎉 同步完成！新增上传: {_upload_state['uploaded']} 首，去重跳过: {_upload_state['skipped']} 首，失败: {_upload_state['failed']} 首")

                    elif evt == "locked":
                        _upload_state["status"] = "failed"
                        _upload_state["message"] = event_data.get("error", "已被排他锁拦截")
                        _append_log("warn", event_data.get("error", "已有进程运行中"))

                    elif evt == "log":
                        lvl = event_data.get("level", "info")
                        txt = event_data.get("text", "")
                        _append_log(lvl, txt)

                    _save_state_to_disk()

                except json.JSONDecodeError:
                    # 屏蔽第三方底层库打印的非 JSON 格式调试文本 (如 NeteaseCloudMusicApi 内部的 [ERR] 调试输出)
                    pass

            await _current_process.wait()

            if _upload_state["status"] == "running":
                _upload_state["status"] = "completed"
                _upload_state["percent"] = 100.0
                _upload_state["message"] = "同步任务已结束"
                _save_state_to_disk()

        except Exception as ex:
            _upload_state["status"] = "failed"
            _upload_state["message"] = f"执行异常: {ex}"
            _append_log("error", f"任务异常中断: {ex}")
            _save_state_to_disk()
        finally:
            LOCK_FILE.unlink(missing_ok=True)
            _current_process = None

    # 启动后台守护任务，不阻塞 Web 请求
    asyncio.create_task(_runner_worker())

    return {
        "success": True,
        "message": "网易云云盘增量同步任务已在后台发起",
        "current_state": _upload_state
    }
