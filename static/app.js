// ==============================================================
// BiliSplit - 前端主控制逻辑 (系统级工作站架构 + 主题引擎 + 批量管理)
// ==============================================================

// 全局应用状态
let currentVideo = null;
let currentTaskId = null;
let pollTimer = null;
let currentPlaylist = [];
let currentTrackIndex = -1;
let libraryData = [];
let selectedSongIds = new Set();

// DOM 引用 - 导航与视图
const navWorkstation = document.getElementById('navWorkstation');
const navTasks = document.getElementById('navTasks');
const navLibrary = document.getElementById('navLibrary');
const navSettings = document.getElementById('navSettings');
const navActiveTaskBadge = document.getElementById('navActiveTaskBadge');
const navLibraryCountBadge = document.getElementById('navLibraryCountBadge');

const viewWorkstation = document.getElementById('viewWorkstation');
const viewTasks = document.getElementById('viewTasks');
const viewLibrary = document.getElementById('viewLibrary');
const viewSettings = document.getElementById('viewSettings');
const viewTitle = document.getElementById('viewTitle');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');

const quickTaskIndicator = document.getElementById('quickTaskIndicator');
const quickTaskText = document.getElementById('quickTaskText');
const sidebarMusicPath = document.getElementById('sidebarMusicPath');
const sidebarPlatformText = document.getElementById('sidebarPlatformText');

// DOM 引用 - 工作台
const urlInput = document.getElementById('urlInput');
const parseBtn = document.getElementById('parseBtn');
const workstationEmpty = document.getElementById('workstationEmpty');
const editorPanel = document.getElementById('editorPanel');

const videoCover = document.getElementById('videoCover');
const videoTitle = document.getElementById('videoTitle');
const videoOwner = document.getElementById('videoOwner');
const sourceBadge = document.getElementById('sourceBadge');
const durationBadge = document.getElementById('durationBadge');
const albumInput = document.getElementById('albumInput');
const formatSelect = document.getElementById('formatSelect');
const loudnormToggle = document.getElementById('loudnormToggle');
const fadeToggle = document.getElementById('fadeToggle');

const trackTableBody = document.getElementById('trackTableBody');
const trackCountBadge = document.getElementById('trackCountBadge');
const aiNormalizeAllBtn = document.getElementById('aiNormalizeAllBtn');
const swapAllBtn = document.getElementById('swapAllBtn');
const addTrackBtn = document.getElementById('addTrackBtn');
const startProcessBtn = document.getElementById('startProcessBtn');

const progressBox = document.getElementById('progressBox');
const progressStep = document.getElementById('progressStep');
const progressPct = document.getElementById('progressPct');
const progressBar = document.getElementById('progressBar');

const completedBox = document.getElementById('completedBox');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const outputFileList = document.getElementById('outputFileList');

// DOM 引用 - 任务队列
const tasksTableBody = document.getElementById('tasksTableBody');
const refreshTasksBtn = document.getElementById('refreshTasksBtn');

// DOM 引用 - 媒体库
const librarySearchInput = document.getElementById('librarySearchInput');
const libraryStats = document.getElementById('libraryStats');
const libraryTableBody = document.getElementById('libraryTableBody');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const batchActionBar = document.getElementById('batchActionBar');
const batchCountText = document.getElementById('batchCountText');
const batchDeselectBtn = document.getElementById('batchDeselectBtn');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');

// DOM 引用 - 系统配置
const cfgMusicDir = document.getElementById('cfgMusicDir');

// DOM 引用 - 全局常驻播放器
const globalAudio = document.getElementById('globalAudio');
const playerCoverImg = document.getElementById('playerCoverImg');
const playerCoverPlaceholder = document.getElementById('playerCoverPlaceholder');
const playerTitle = document.getElementById('playerTitle');
const playerArtist = document.getElementById('playerArtist');
const playerPlayBtn = document.getElementById('playerPlayBtn');
const playerPrevBtn = document.getElementById('playerPrevBtn');
const playerNextBtn = document.getElementById('playerNextBtn');
const playerCurrentTime = document.getElementById('playerCurrentTime');
const playerDuration = document.getElementById('playerDuration');
const playerSeeker = document.getElementById('playerSeeker');
const playerVolume = document.getElementById('playerVolume');
const playerDownloadBtn = document.getElementById('playerDownloadBtn');

// -------------------------------------------------------------
// 1. 主题管理引擎 (默认高级浅色纸质极简，支持一键切换曜石深色)
// -------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const isDark = theme === 'dark';
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        themeToggleBtn.setAttribute('title', '切换至浅色模式');
        themeToggleBtn.innerHTML = `<i data-lucide="moon" class="w-4 h-4 text-emerald-400"></i>`;
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        themeToggleBtn.setAttribute('title', '切换至深色模式');
        themeToggleBtn.innerHTML = `<i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>`;
    }
    localStorage.setItem('theme', theme);
    lucide.createIcons();
}

themeToggleBtn.addEventListener('click', () => {
    const isCurrentDark = document.documentElement.classList.contains('dark');
    applyTheme(isCurrentDark ? 'light' : 'dark');
});

// -------------------------------------------------------------
// 2. 初始化与配置加载
// -------------------------------------------------------------
async function init() {
    initTheme();

    try {
        const resp = await fetch('/api/config');
        const cfg = await resp.json();
        if (sidebarMusicPath) sidebarMusicPath.innerText = cfg.music_dir;
        if (cfgMusicDir) cfgMusicDir.innerText = cfg.music_dir;
        if (sidebarPlatformText) sidebarPlatformText.innerText = cfg.platform === 'posix' ? 'Linux 容器' : 'Windows';
        if (loudnormToggle) loudnormToggle.checked = cfg.enable_loudnorm;
        if (fadeToggle) fadeToggle.checked = cfg.enable_fade;
        if (formatSelect) formatSelect.value = cfg.default_format || 'flac';
    } catch (e) {
        console.error('加载系统配置异常:', e);
    }

    loadLibrary();
    checkActiveTasksOnLoad();
}

// -------------------------------------------------------------
// 3. 视图切换逻辑 (Sidebar Navigation)
// -------------------------------------------------------------
const views = {
    workstation: { el: viewWorkstation, btn: navWorkstation, title: '音频提取工作台' },
    tasks: { el: viewTasks, btn: navTasks, title: '任务执行历史与断点队列' },
    library: { el: viewLibrary, btn: navLibrary, title: '持久化媒体曲库 (/music)' },
    settings: { el: viewSettings, btn: navSettings, title: '系统环境与持久化参数' }
};

function switchView(target) {
    Object.keys(views).forEach(key => {
        const v = views[key];
        if (key === target) {
            v.el.classList.remove('hidden');
            v.btn.className = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#1c263b] text-slate-900 dark:text-white transition cursor-pointer font-semibold';
            viewTitle.innerText = v.title;
        } else {
            v.el.classList.add('hidden');
            v.btn.className = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#161e2e] transition cursor-pointer';
        }
    });

    if (target === 'library') loadLibrary(librarySearchInput ? librarySearchInput.value.trim() : '');
    if (target === 'tasks') loadTasksHistory();
    lucide.createIcons();
}

navWorkstation.addEventListener('click', () => switchView('workstation'));
navTasks.addEventListener('click', () => switchView('tasks'));
navLibrary.addEventListener('click', () => switchView('library'));
navSettings.addEventListener('click', () => switchView('settings'));

if (quickTaskIndicator) {
    quickTaskIndicator.addEventListener('click', () => switchView('tasks'));
}

// -------------------------------------------------------------
// 4. 时间格式化辅助
// -------------------------------------------------------------
function strToSec(str) {
    if (!str) return 0;
    const parts = str.trim().split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Number(str) || 0;
}

function secToStr(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// -------------------------------------------------------------
// 5. 工作台：解析 B 站链接
// -------------------------------------------------------------
parseBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    parseBtn.disabled = true;
    parseBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>读取中...</span>`;
    lucide.createIcons();

    try {
        const resp = await fetch('/api/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.detail || '解析失败');

        currentVideo = data;
        renderVideoHeader(data);
        renderTrackTable(data.tracks);

        workstationEmpty.classList.add('hidden');
        editorPanel.classList.remove('hidden');
        completedBox.classList.add('hidden');
        progressBox.classList.add('hidden');

    } catch (e) {
        alert(e.message);
    } finally {
        parseBtn.disabled = false;
        parseBtn.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i><span>解析提取</span>`;
        lucide.createIcons();
    }
});

function renderVideoHeader(data) {
    videoCover.src = data.cover_url ? ('/api/cover-proxy?url=' + encodeURIComponent(data.cover_url)) : '';
    videoTitle.innerText = data.title;
    videoOwner.innerText = data.uploader;
    durationBadge.innerText = data.duration_str;
    albumInput.value = data.album_title || data.title;

    const sourceMap = {
        'ugc_season': '官方合集',
        'multi_page': '多P合集',
        'comment': '评论打点',
        'description': '简介打点',
        'single': '单视频'
    };
    sourceBadge.innerText = sourceMap[data.source_type] || '自动提取';
}

function renderTrackTable(tracks) {
    trackTableBody.innerHTML = '';
    trackCountBadge.innerText = `${tracks.length} 首合集单曲`;

    tracks.forEach((track, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover transition';

        tr.innerHTML = `
            <td class="py-2.5 px-3 text-center font-mono text-slate-400 dark:text-slate-500 text-[11px]">${idx + 1}</td>
            <td class="py-1.5 px-2">
                <input type="text" class="cell-input artist-input font-medium text-emerald-600 dark:text-emerald-400" value="${track.artist || ''}">
            </td>
            <td class="py-1.5 px-2">
                <div class="flex items-center gap-1.5">
                    <input type="text" class="cell-input title-input font-medium text-slate-900 dark:text-slate-100 flex-1" value="${track.title || ''}">
                    ${track.is_ai ? '<span class="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-mono">AI</span>' : ''}
                </div>
            </td>
            <td class="py-1.5 px-2 text-center">
                <div class="flex items-center justify-center gap-1 font-mono text-[11px]">
                    <input type="text" class="cell-input start-input text-center w-14" value="${track.start_str || secToStr(track.start_sec)}">
                    <span class="text-slate-400 dark:text-slate-600">~</span>
                    <input type="text" class="cell-input end-input text-center w-14" value="${track.end_str || secToStr(track.end_sec)}">
                </div>
            </td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px] duration-cell">
                ${track.duration_str || secToStr(track.end_sec - track.start_sec)}
            </td>
            <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button class="ai-single-btn p-1 hover:bg-purple-500/20 rounded text-purple-600 dark:text-purple-400 transition" title="AI 校对">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="swap-single-btn p-1 hover:bg-slate-100 dark:hover:bg-[#161e2e] rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition" title="互换歌手与歌名">
                        <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="del-single-btn p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-500 transition" title="删除">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>
        `;

        const artistInput = tr.querySelector('.artist-input');
        const titleInput = tr.querySelector('.title-input');
        const startInput = tr.querySelector('.start-input');
        const endInput = tr.querySelector('.end-input');
        const durationCell = tr.querySelector('.duration-cell');

        artistInput.addEventListener('input', (e) => { track.artist = e.target.value.trim(); });
        titleInput.addEventListener('input', (e) => { track.title = e.target.value.trim(); });

        const syncTimes = () => {
            const s = strToSec(startInput.value);
            const e = strToSec(endInput.value);
            track.start_sec = s;
            track.end_sec = e;
            track.start_str = startInput.value;
            track.end_str = endInput.value;
            durationCell.innerText = secToStr(Math.max(0, e - s));
        };
        startInput.addEventListener('blur', syncTimes);
        endInput.addEventListener('blur', syncTimes);

        // 单曲 AI 规范
        tr.querySelector('.ai-single-btn').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>`;
            lucide.createIcons();
            try {
                const resp = await fetch('/api/ai-normalize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: track.raw_title || `${track.artist} - ${track.title}`,
                        uploader: currentVideo.uploader,
                        desc: currentVideo.title
                    })
                });
                const res = await resp.json();
                if (res.artist && res.title) {
                    track.artist = res.artist;
                    track.title = res.title;
                    track.is_ai = res.is_ai;
                    renderTrackTable(currentVideo.tracks);
                }
            } catch (err) {
                alert('AI 规范化失败');
            } finally {
                btn.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i>`;
                lucide.createIcons();
            }
        });

        // 互换
        tr.querySelector('.swap-single-btn').addEventListener('click', () => {
            const t = track.artist;
            track.artist = track.title;
            track.title = t;
            artistInput.value = track.artist;
            titleInput.value = track.title;
        });

        // 删除
        tr.querySelector('.del-single-btn').addEventListener('click', () => {
            currentVideo.tracks.splice(idx, 1);
            renderTrackTable(currentVideo.tracks);
        });

        trackTableBody.appendChild(tr);
    });

    lucide.createIcons();
}

// 批量 AI 规范
aiNormalizeAllBtn.addEventListener('click', async () => {
    if (!currentVideo || !currentVideo.tracks || currentVideo.tracks.length === 0) return;
    aiNormalizeAllBtn.disabled = true;
    aiNormalizeAllBtn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i><span>处理中...</span>`;
    lucide.createIcons();

    try {
        for (const track of currentVideo.tracks) {
            const resp = await fetch('/api/ai-normalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: track.raw_title || `${track.artist} - ${track.title}`,
                    uploader: currentVideo.uploader,
                    desc: currentVideo.title
                })
            });
            const res = await resp.json();
            if (res.artist && res.title) {
                track.artist = res.artist;
                track.title = res.title;
                track.is_ai = res.is_ai;
            }
        }
        renderTrackTable(currentVideo.tracks);
    } catch (e) {
        alert('批量处理失败');
    } finally {
        aiNormalizeAllBtn.disabled = false;
        aiNormalizeAllBtn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3 text-purple-600 dark:text-purple-400"></i><span>AI 规范歌名</span>`;
        lucide.createIcons();
    }
});

// 全局互换
swapAllBtn.addEventListener('click', () => {
    if (!currentVideo || !currentVideo.tracks) return;
    currentVideo.tracks.forEach(t => {
        const tmp = t.artist;
        t.artist = t.title;
        t.title = tmp;
    });
    renderTrackTable(currentVideo.tracks);
});

// 加曲
addTrackBtn.addEventListener('click', () => {
    if (!currentVideo) return;
    const last = currentVideo.tracks[currentVideo.tracks.length - 1];
    const s = last ? last.end_sec : 0;
    const e = s + 180;
    currentVideo.tracks.push({
        id: currentVideo.tracks.length + 1,
        artist: '群星',
        title: '新曲目',
        start_sec: s,
        end_sec: e,
        start_str: secToStr(s),
        end_str: secToStr(e),
        duration_str: secToStr(180)
    });
    renderTrackTable(currentVideo.tracks);
});

// 执行切歌处理
startProcessBtn.addEventListener('click', async () => {
    if (!currentVideo || !currentVideo.tracks || currentVideo.tracks.length === 0) return;

    startProcessBtn.disabled = true;
    progressBox.classList.remove('hidden');
    completedBox.classList.add('hidden');

    try {
        const payload = {
            bvid: currentVideo.bvid,
            album: albumInput.value.trim() || currentVideo.title,
            cover_url: currentVideo.cover_url,
            format: formatSelect.value,
            tracks: currentVideo.tracks,
            use_loudnorm: loudnormToggle.checked,
            use_fade: fadeToggle.checked
        };

        const resp = await fetch('/api/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resData = await resp.json();
        if (!resp.ok) throw new Error(resData.detail || '提交失败');

        currentTaskId = resData.task_id;
        startTaskPolling(currentTaskId);

    } catch (err) {
        alert(err.message);
        startProcessBtn.disabled = false;
        progressBox.classList.add('hidden');
    }
});

// -------------------------------------------------------------
// 6. 任务轮询与断点续提机制 (刷新页面不丢失)
// -------------------------------------------------------------
function startTaskPolling(taskId) {
    if (pollTimer) clearInterval(pollTimer);
    
    quickTaskIndicator.classList.remove('hidden');
    navActiveTaskBadge.classList.remove('hidden');

    pollTimer = setInterval(async () => {
        try {
            const resp = await fetch(`/api/task/${taskId}`);
            if (!resp.ok) {
                stopTaskPolling();
                return;
            }
            const data = await resp.json();

            progressBar.style.width = `${data.progress}%`;
            progressPct.innerText = `${data.progress}%`;
            progressStep.innerText = data.step || '处理中...';
            quickTaskText.innerText = `${data.progress}% ${data.step ? data.step.substring(0, 15) : ''}`;

            if (data.status === 'completed') {
                stopTaskPolling();
                startProcessBtn.disabled = false;
                progressBox.classList.add('hidden');
                showCompleted(taskId, data);
                loadLibrary();
                loadTasksHistory();
            } else if (data.status === 'error') {
                stopTaskPolling();
                startProcessBtn.disabled = false;
                progressStep.innerText = '出错';
                alert(data.step);
                loadTasksHistory();
            }
        } catch (e) {
            console.error('进度轮询异常:', e);
        }
    }, 1200);
}

function stopTaskPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    quickTaskIndicator.classList.add('hidden');
    navActiveTaskBadge.classList.add('hidden');
}

// 页面载入时自动检测是否有正在执行的后台任务
async function checkActiveTasksOnLoad() {
    try {
        const resp = await fetch('/api/tasks/recent');
        const data = await resp.json();
        const tasks = data.tasks || [];
        const running = tasks.find(t => t.status === 'processing' || t.status === 'pending');
        if (running) {
            startTaskPolling(running.id);
        }
    } catch (e) {
        console.error('检测后台运行任务失败:', e);
    }
}

function showCompleted(taskId, data) {
    completedBox.classList.remove('hidden');
    downloadZipBtn.href = `/api/download/${taskId}/zip`;

    const outPlaylist = (data.files || []).map(f => ({
        title: f.title,
        artist: f.artist,
        src: `/api/download/${taskId}/track/${encodeURIComponent(f.filename)}`,
        cover: currentVideo ? currentVideo.cover_url : ''
    }));

    outputFileList.innerHTML = '';
    data.files.forEach((f, fIdx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#090c10] rounded-lg border border-slate-200 dark:border-[#1f2a3d] text-xs transition-colors duration-200';
        const streamUrl = `/api/download/${taskId}/track/${encodeURIComponent(f.filename)}`;

        item.innerHTML = `
            <div class="flex items-center gap-2.5 truncate">
                <button class="play-item-btn w-6 h-6 rounded-md bg-white dark:bg-[#161e2e] hover:bg-slate-100 dark:hover:bg-[#1c263b] border border-slate-200 dark:border-[#1f2a3d] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-brand transition cursor-pointer flex-shrink-0 shadow-sm">
                    <i data-lucide="play" class="w-3 h-3 fill-current ml-0.5"></i>
                </button>
                <div class="truncate">
                    <span class="font-medium text-slate-900 dark:text-white">${f.title}</span>
                    <span class="text-slate-500 ml-1.5 font-mono text-[11px]">${f.artist} · ${f.size_mb} MB</span>
                </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
                <a href="${streamUrl}" download="${f.filename}" class="p-1 hover:text-emerald-600 text-slate-400 transition" title="下载单曲">
                    <i data-lucide="download" class="w-3.5 h-3.5"></i>
                </a>
            </div>
        `;

        item.querySelector('.play-item-btn').addEventListener('click', () => {
            playTrackFromList(outPlaylist, fIdx);
        });

        outputFileList.appendChild(item);
    });

    lucide.createIcons();
}

// -------------------------------------------------------------
// 7. 任务队列历史管理与智能重试 (Tasks Queue)
// -------------------------------------------------------------
refreshTasksBtn.addEventListener('click', () => loadTasksHistory());

async function loadTasksHistory() {
    try {
        const resp = await fetch('/api/tasks/recent');
        const data = await resp.json();
        const tasks = data.tasks || [];

        tasksTableBody.innerHTML = '';
        if (tasks.length === 0) {
            tasksTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-12 text-center text-slate-500 font-mono text-xs">
                        暂无任务历史记录
                    </td>
                </tr>
            `;
            return;
        }

        tasks.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'table-row-hover transition';

            let statusBadge = '';
            if (t.status === 'completed') {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">已完成</span>';
            } else if (t.status === 'processing') {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-brand/10 text-emerald-600 dark:text-brand border border-brand/20 font-medium flex items-center justify-center gap-1"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>处理中</span>';
            } else if (t.status === 'error') {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-medium">异常中断</span>';
            } else {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-medium">等待中</span>';
            }

            const dateStr = (t.updated_at || t.created_at || '').substring(0, 16);

            tr.innerHTML = `
                <td class="py-2.5 px-3">
                    <div class="font-medium text-slate-900 dark:text-white truncate max-w-sm">${t.title || t.album}</div>
                    <div class="text-[10px] text-slate-500 font-mono">${t.bvid} · 共 ${t.total_tracks} 首歌</div>
                </td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                <td class="py-2.5 px-3 text-center">
                    <div class="w-full flex items-center gap-2">
                        <div class="flex-1 h-1 bg-slate-100 dark:bg-[#090c10] rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-600 dark:bg-brand" style="width: ${t.progress || 0}%"></div>
                        </div>
                        <span class="text-[10px] font-mono text-slate-500 w-8">${t.progress || 0}%</span>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-center font-mono uppercase text-[10px] text-slate-500">${t.format || 'flac'}</td>
                <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[10px]">${dateStr}</td>
                <td class="py-2.5 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        ${t.status !== 'completed' ? `
                            <button class="retry-task-btn px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#161e2e] dark:hover:bg-[#1c263b] rounded text-[11px] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 cursor-pointer" data-id="${t.id}" title="断点续提 (自动跳过已完成歌曲)">
                                <i data-lucide="play" class="w-3 h-3 fill-current"></i>
                                <span>继续</span>
                            </button>
                        ` : `
                            <a href="/api/download/${t.id}/zip" class="p-1 text-slate-400 hover:text-emerald-600 transition" title="下载 ZIP">
                                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                            </a>
                        `}
                    </div>
                </td>
            `;

            const retryBtn = tr.querySelector('.retry-task-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    try {
                        await fetch(`/api/tasks/retry/${id}`, { method: 'POST' });
                        startTaskPolling(id);
                        loadTasksHistory();
                    } catch (err) {
                        alert('启动续提失败');
                    }
                });
            }

            tasksTableBody.appendChild(tr);
        });

        lucide.createIcons();

    } catch (e) {
        console.error('加载任务队列异常:', e);
    }
}

// -------------------------------------------------------------
// 8. 媒体曲库管理 (支持多选、全选、一键批量删除)
// -------------------------------------------------------------
let libraryDebounce = null;
if (librarySearchInput) {
    librarySearchInput.addEventListener('input', (e) => {
        clearTimeout(libraryDebounce);
        libraryDebounce = setTimeout(() => {
            loadLibrary(e.target.value.trim());
        }, 250);
    });
}

function updateBatchBar() {
    const count = selectedSongIds.size;
    if (count > 0) {
        batchActionBar.classList.remove('hidden');
        batchCountText.innerText = `已选择 ${count} 首曲目`;
    } else {
        batchActionBar.classList.add('hidden');
    }

    // 更新全选框状态
    const totalVisible = document.querySelectorAll('.song-checkbox').length;
    if (totalVisible > 0 && count === totalVisible) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (count > 0 && count < totalVisible) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}

// 全选/取消全选
selectAllCheckbox.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.song-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const id = parseInt(cb.dataset.id);
        if (isChecked) {
            selectedSongIds.add(id);
        } else {
            selectedSongIds.delete(id);
        }
    });
    updateBatchBar();
});

// 取消选择按钮
batchDeselectBtn.addEventListener('click', () => {
    selectedSongIds.clear();
    document.querySelectorAll('.song-checkbox').forEach(cb => { cb.checked = false; });
    updateBatchBar();
});

// 一键批量删除
batchDeleteBtn.addEventListener('click', async () => {
    const count = selectedSongIds.size;
    if (count === 0) return;

    if (!confirm(`确认彻底删除选中的 ${count} 首歌曲？文件将从磁盘物理移除。`)) return;

    batchDeleteBtn.disabled = true;
    batchDeleteBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>正在删除...</span>`;
    lucide.createIcons();

    try {
        const resp = await fetch('/api/history/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedSongIds) })
        });

        const res = await resp.json();
        selectedSongIds.clear();
        updateBatchBar();
        loadLibrary(librarySearchInput ? librarySearchInput.value.trim() : '');
    } catch (e) {
        alert('批量删除失败: ' + e.message);
    } finally {
        batchDeleteBtn.disabled = false;
        batchDeleteBtn.innerHTML = `<i data-lucide="trash-2" class="w-3.5 h-3.5"></i><span>一键批量删除</span>`;
        lucide.createIcons();
    }
});

async function loadLibrary(keyword = '') {
    try {
        const url = keyword ? `/api/history?keyword=${encodeURIComponent(keyword)}` : '/api/history';
        const resp = await fetch(url);
        const data = await resp.json();
        libraryData = data.songs || [];

        if (navLibraryCountBadge) navLibraryCountBadge.innerText = libraryData.length;
        if (libraryStats) libraryStats.innerText = `${libraryData.length} 首曲目`;

        libraryTableBody.innerHTML = '';
        if (libraryData.length === 0) {
            libraryTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-12 text-center text-slate-400 dark:text-slate-600 text-xs font-mono">
                        ${keyword ? '未找到匹配曲目' : '曲库暂无已归档歌曲'}
                    </td>
                </tr>
            `;
            selectAllCheckbox.checked = false;
            updateBatchBar();
            return;
        }

        const libPlaylist = libraryData.map(song => ({
            title: song.title,
            artist: song.artist,
            src: `/api/stream-song/${encodeURIComponent(song.filename)}`,
            cover: song.cover_url || ''
        }));

        libraryData.forEach((song, idx) => {
            const tr = document.createElement('tr');
            tr.className = 'table-row-hover transition';
            const streamUrl = `/api/stream-song/${encodeURIComponent(song.filename)}`;
            const sizeMb = (song.file_size / (1024 * 1024)).toFixed(2);
            const dateStr = (song.created_at || '').substring(0, 10);
            const isChecked = selectedSongIds.has(song.id);

            tr.innerHTML = `
                <td class="py-2.5 px-3 text-center">
                    <input type="checkbox" class="song-checkbox rounded border-slate-300 dark:border-slate-700 text-emerald-600 cursor-pointer" data-id="${song.id}" ${isChecked ? 'checked' : ''}>
                </td>
                <td class="py-2.5 px-2 text-center font-mono text-slate-400 dark:text-slate-500 text-[11px]">${idx + 1}</td>
                <td class="py-2 px-3">
                    <div class="flex items-center gap-2.5">
                        <button class="play-lib-btn w-6 h-6 rounded bg-slate-100 dark:bg-[#090c10] hover:bg-slate-200 dark:hover:bg-[#1c263b] border border-slate-200 dark:border-[#1f2a3d] flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer flex-shrink-0 shadow-sm" title="播放此曲">
                            <i data-lucide="play" class="w-3 h-3 fill-current ml-0.5"></i>
                        </button>
                        <div class="truncate">
                            <div class="font-medium text-slate-900 dark:text-white truncate">${song.title}</div>
                            <div class="text-[11px] text-slate-500 truncate">${song.artist}</div>
                        </div>
                    </div>
                </td>
                <td class="py-2 px-3 text-slate-600 dark:text-slate-400 truncate text-[11px]">${song.album || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#090c10] border border-slate-200 dark:border-[#1f2a3d] text-slate-600 dark:text-slate-400 font-medium">
                        ${song.format || 'flac'}
                    </span>
                </td>
                <td class="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">${sizeMb} M</td>
                <td class="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">${dateStr}</td>
                <td class="py-2 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <a href="${streamUrl}" download="${song.filename}" class="p-1 text-slate-400 hover:text-emerald-600 transition" title="下载文件">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        </a>
                        <button class="del-lib-btn p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer" data-id="${song.id}" title="彻底删除">
                            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            `;

            // 复选框变更
            const cb = tr.querySelector('.song-checkbox');
            cb.addEventListener('change', (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.checked) {
                    selectedSongIds.add(id);
                } else {
                    selectedSongIds.delete(id);
                }
                updateBatchBar();
            });

            // 绑定各自专属独立播放
            tr.querySelector('.play-lib-btn').addEventListener('click', () => {
                playTrackFromList(libPlaylist, idx);
            });

            // 绑定单个删除
            tr.querySelector('.del-lib-btn').addEventListener('click', async (e) => {
                if (!confirm(`确认彻底删除歌曲 "${song.title}"？文件将从磁盘物理移除。`)) return;
                const id = e.currentTarget.dataset.id;
                try {
                    await fetch(`/api/history/${id}`, { method: 'DELETE' });
                    selectedSongIds.delete(parseInt(id));
                    updateBatchBar();
                    loadLibrary(librarySearchInput ? librarySearchInput.value.trim() : '');
                } catch (err) {
                    alert('删除失败');
                }
            });

            libraryTableBody.appendChild(tr);
        });

        updateBatchBar();
        lucide.createIcons();

    } catch (e) {
        console.error('加载媒体库失败:', e);
    }
}

// -------------------------------------------------------------
// 9. 全局常驻播放器 (完美按键状态切换 + 左右切歌 + 自动连播)
// -------------------------------------------------------------
function playTrackFromList(list, index) {
    if (!list || list.length === 0 || index < 0 || index >= list.length) return;
    currentPlaylist = list;
    currentTrackIndex = index;
    playTrack(list[index]);
}

function playPrevTrack() {
    if (!currentPlaylist || currentPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    playTrack(currentPlaylist[currentTrackIndex]);
}

function playNextTrack() {
    if (!currentPlaylist || currentPlaylist.length === 0) return;
    currentTrackIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    playTrack(currentPlaylist[currentTrackIndex]);
}

function playTrack({ title, artist, src, cover }) {
    playerTitle.innerText = title || '未知曲目';
    playerArtist.innerText = artist || '-';
    playerDownloadBtn.href = src;
    playerDownloadBtn.download = `${artist} - ${title}.flac`;

    if (cover) {
        playerCoverImg.src = cover.startsWith('http') ? ('/api/cover-proxy?url=' + encodeURIComponent(cover)) : cover;
        playerCoverImg.classList.remove('hidden');
        playerCoverPlaceholder.classList.add('hidden');
    } else {
        playerCoverImg.classList.add('hidden');
        playerCoverPlaceholder.classList.remove('hidden');
    }

    globalAudio.src = src;
    globalAudio.play();
}

playerPlayBtn.addEventListener('click', () => {
    if (!globalAudio.src) return;
    if (globalAudio.paused) {
        globalAudio.play();
    } else {
        globalAudio.pause();
    }
});

if (playerPrevBtn) playerPrevBtn.addEventListener('click', playPrevTrack);
if (playerNextBtn) playerNextBtn.addEventListener('click', playNextTrack);

// 播放按键状态精准切换 (三角 ▶ / 双竖线 ⏸)
globalAudio.addEventListener('play', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-current"></i>`;
    lucide.createIcons();
});

globalAudio.addEventListener('pause', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current ml-0.5"></i>`;
    lucide.createIcons();
});

// 单曲结束自动切下一首
globalAudio.addEventListener('ended', playNextTrack);

globalAudio.addEventListener('timeupdate', () => {
    if (!globalAudio.duration) return;
    playerCurrentTime.innerText = secToStr(globalAudio.currentTime);
    playerDuration.innerText = secToStr(globalAudio.duration);
    playerSeeker.value = (globalAudio.currentTime / globalAudio.duration) * 100;
});

playerSeeker.addEventListener('input', (e) => {
    if (!globalAudio.duration) return;
    globalAudio.currentTime = (e.target.value / 100) * globalAudio.duration;
});

playerVolume.addEventListener('input', (e) => {
    globalAudio.volume = parseFloat(e.target.value);
});

// 运行初始化
init();
