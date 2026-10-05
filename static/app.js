// ==============================================================
// BiliSplit - 前端主控制逻辑 (系统级工作站架构 + 双列/表格排版 + 交互设置)
// ==============================================================

// 全局应用状态
let currentVideo = null;
let currentTaskId = null;
let pollTimer = null;
let currentPlaylist = [];
let currentTrackIndex = -1;
let libraryData = [];
let selectedSongIds = new Set();
let tracklistLayout = 'double'; // 'double' 双列网格 (大合集推荐) 或 'single' 单列表格

// DOM 引用 - 导航与视图
const navWorkstation = document.getElementById('navWorkstation');
const navTasks = document.getElementById('navTasks');
const navLibrary = document.getElementById('navLibrary');
const navNetease = document.getElementById('navNetease');
const navSettings = document.getElementById('navSettings');
const navActiveTaskBadge = document.getElementById('navActiveTaskBadge');
const navLibraryCountBadge = document.getElementById('navLibraryCountBadge');
const navNeteaseBadge = document.getElementById('navNeteaseBadge');

const viewWorkstation = document.getElementById('viewWorkstation');
const viewTasks = document.getElementById('viewTasks');
const viewLibrary = document.getElementById('viewLibrary');
const viewNetease = document.getElementById('viewNetease');
const viewSettings = document.getElementById('viewSettings');
const viewTitle = document.getElementById('viewTitle');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const quickTaskIndicator = document.getElementById('quickTaskIndicator');
const quickTaskText = document.getElementById('quickTaskText');
const quickNeteaseIndicator = document.getElementById('quickNeteaseIndicator');
const quickNeteaseText = document.getElementById('quickNeteaseText');
const headerNeteaseBtn = document.getElementById('headerNeteaseBtn');
const headerNeteaseUserText = document.getElementById('headerNeteaseUserText');
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

const trackGridContainer = document.getElementById('trackGridContainer');
const trackTableContainer = document.getElementById('trackTableContainer');
const trackTableBody = document.getElementById('trackTableBody');
const trackCountBadge = document.getElementById('trackCountBadge');
const trackFilterInput = document.getElementById('trackFilterInput');
const layoutDoubleBtn = document.getElementById('layoutDoubleBtn');
const layoutSingleBtn = document.getElementById('layoutSingleBtn');

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
const completedUploadNeteaseBtn = document.getElementById('completedUploadNeteaseBtn');
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
const batchUploadNeteaseBtn = document.getElementById('batchUploadNeteaseBtn');
const batchDeleteBtn = document.getElementById('batchDeleteBtn');

// DOM 引用 - 网易云同步中心
const neteaseNotLoggedInCard = document.getElementById('neteaseNotLoggedInCard');
const neteaseLoggedInCard = document.getElementById('neteaseLoggedInCard');
const openQrLoginBtn = document.getElementById('openQrLoginBtn');
const neteaseRefreshBtn = document.getElementById('neteaseRefreshBtn');
const neteaseSyncAllBtn = document.getElementById('neteaseSyncAllBtn');
const neteaseReLoginBtn = document.getElementById('neteaseReLoginBtn');
const neteaseLogoutBtn = document.getElementById('neteaseLogoutBtn');
const neteaseUserAvatar = document.getElementById('neteaseUserAvatar');
const neteaseUserNickname = document.getElementById('neteaseUserNickname');
const neteaseVipBadge = document.getElementById('neteaseVipBadge');
const neteaseUserId = document.getElementById('neteaseUserId');
const neteaseCloudCapacityText = document.getElementById('neteaseCloudCapacityText');
const neteaseCloudCapacityBar = document.getElementById('neteaseCloudCapacityBar');

const neteaseStatusBadge = document.getElementById('neteaseStatusBadge');
const neteaseCancelUploadBtn = document.getElementById('neteaseCancelUploadBtn');
const neteaseCurrentIcon = document.getElementById('neteaseCurrentIcon');
const neteaseCurrentFileName = document.getElementById('neteaseCurrentFileName');
const neteaseCurrentFileSize = document.getElementById('neteaseCurrentFileSize');
const neteaseProgressPct = document.getElementById('neteaseProgressPct');
const neteaseProgressBar = document.getElementById('neteaseProgressBar');
const neteaseStepMessage = document.getElementById('neteaseStepMessage');
const neteaseCurrentIndexText = document.getElementById('neteaseCurrentIndexText');

const neteaseMetricTotal = document.getElementById('neteaseMetricTotal');
const neteaseMetricUploaded = document.getElementById('neteaseMetricUploaded');
const neteaseMetricSkipped = document.getElementById('neteaseMetricSkipped');
const neteaseMetricFailed = document.getElementById('neteaseMetricFailed');

const neteaseAutoScrollCheck = document.getElementById('neteaseAutoScrollCheck');
const neteaseClearLogsBtn = document.getElementById('neteaseClearLogsBtn');
const neteaseLogContainer = document.getElementById('neteaseLogContainer');

// DOM 引用 - 扫码登录模态弹窗
const neteaseQrModal = document.getElementById('neteaseQrModal');
const closeNeteaseQrModalBtn = document.getElementById('closeNeteaseQrModalBtn');
const neteaseQrLoading = document.getElementById('neteaseQrLoading');
const neteaseQrImg = document.getElementById('neteaseQrImg');
const neteaseQrOverlay = document.getElementById('neteaseQrOverlay');
const neteaseQrOverlayIcon = document.getElementById('neteaseQrOverlayIcon');
const neteaseQrOverlayText = document.getElementById('neteaseQrOverlayText');
const neteaseQrRefreshBtn = document.getElementById('neteaseQrRefreshBtn');
const neteaseQrStatusDot = document.getElementById('neteaseQrStatusDot');
const neteaseQrStatusText = document.getElementById('neteaseQrStatusText');

// DOM 引用 - 系统配置表单
const cfgDefaultFormat = document.getElementById('cfgDefaultFormat');
const cfgDefaultLayout = document.getElementById('cfgDefaultLayout');
const cfgEnableLoudnorm = document.getElementById('cfgEnableLoudnorm');
const cfgEnableFade = document.getElementById('cfgEnableFade');
const cfgFadeDuration = document.getElementById('cfgFadeDuration');
const cfgSkipExisting = document.getElementById('cfgSkipExisting');
const cfgAiBase = document.getElementById('cfgAiBase');
const cfgAiKey = document.getElementById('cfgAiKey');
const cfgAiModel = document.getElementById('cfgAiModel');
const toggleAiKeyVisibility = document.getElementById('toggleAiKeyVisibility');
const testAiBtn = document.getElementById('testAiBtn');
const aiTestFeedback = document.getElementById('aiTestFeedback');
const saveConfigBtn = document.getElementById('saveConfigBtn');
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
// 1. 主题引擎 (默认高级浅色纸质极简，支持一键切换曜石深色)
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
        
        // 侧边栏与表单绑定
        if (sidebarMusicPath) sidebarMusicPath.innerText = cfg.music_dir;
        if (cfgMusicDir) cfgMusicDir.innerText = cfg.music_dir;
        if (sidebarPlatformText) sidebarPlatformText.innerText = cfg.platform === 'posix' ? 'Linux 容器' : 'Windows';
        
        // 工作台参数同步
        if (loudnormToggle) loudnormToggle.checked = cfg.enable_loudnorm;
        if (fadeToggle) fadeToggle.checked = cfg.enable_fade;
        if (formatSelect) formatSelect.value = cfg.default_format || 'flac';

        tracklistLayout = cfg.tracklist_layout || 'double';
        updateLayoutButtons();

        // 系统配置面板参数同步
        populateSettingsForm(cfg);

    } catch (e) {
        console.error('加载系统配置异常:', e);
    }

    loadLibrary();
    checkActiveTasksOnLoad();
    loadNeteaseStatus();
    checkActiveNeteaseUploadOnLoad();
}

// -------------------------------------------------------------
// 3. 视图切换逻辑 (Sidebar Navigation)
// -------------------------------------------------------------
const views = {
    workstation: { el: viewWorkstation, btn: navWorkstation, title: '音频提取工作台' },
    tasks: { el: viewTasks, btn: navTasks, title: '任务执行历史与断点队列' },
    library: { el: viewLibrary, btn: navLibrary, title: '持久化媒体曲库 (/music)' },
    netease: { el: viewNetease, btn: navNetease, title: '网易云音乐云盘增量同步' },
    settings: { el: viewSettings, btn: navSettings, title: '系统参数与运行设置' }
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
    if (target === 'netease') {
        loadNeteaseStatus();
        fetchNeteaseUploadStatus();
    }
    lucide.createIcons();
}

navWorkstation.addEventListener('click', () => switchView('workstation'));
navTasks.addEventListener('click', () => switchView('tasks'));
navLibrary.addEventListener('click', () => switchView('library'));
navNetease.addEventListener('click', () => switchView('netease'));
navSettings.addEventListener('click', () => switchView('settings'));

if (quickTaskIndicator) {
    quickTaskIndicator.addEventListener('click', () => switchView('tasks'));
}
if (quickNeteaseIndicator) {
    quickNeteaseIndicator.addEventListener('click', () => switchView('netease'));
}
if (headerNeteaseBtn) {
    headerNeteaseBtn.addEventListener('click', () => {
        if (!neteaseUser) {
            openQrLoginModal();
        } else {
            switchView('netease');
        }
    });
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
        renderTrackList();

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

// -------------------------------------------------------------
// 排版切换 (双列卡片 vs 单列详细表格)
// -------------------------------------------------------------
function updateLayoutButtons() {
    if (tracklistLayout === 'double') {
        layoutDoubleBtn.className = 'px-2 py-0.5 rounded bg-white dark:bg-[#1f2a3d] text-slate-900 dark:text-white shadow-sm font-medium transition cursor-pointer flex items-center gap-1 text-[11px]';
        layoutSingleBtn.className = 'px-2 py-0.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px]';
    } else {
        layoutSingleBtn.className = 'px-2 py-0.5 rounded bg-white dark:bg-[#1f2a3d] text-slate-900 dark:text-white shadow-sm font-medium transition cursor-pointer flex items-center gap-1 text-[11px]';
        layoutDoubleBtn.className = 'px-2 py-0.5 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer flex items-center gap-1 text-[11px]';
    }
}

layoutDoubleBtn.addEventListener('click', () => {
    tracklistLayout = 'double';
    updateLayoutButtons();
    renderTrackList();
});

layoutSingleBtn.addEventListener('click', () => {
    tracklistLayout = 'single';
    updateLayoutButtons();
    renderTrackList();
});

// 工作台内实时过滤搜索
if (trackFilterInput) {
    trackFilterInput.addEventListener('input', () => {
        renderTrackList();
    });
}

function renderTrackList() {
    if (!currentVideo || !currentVideo.tracks) return;

    const kw = (trackFilterInput ? trackFilterInput.value.trim() : '').toLowerCase();
    const tracksToRender = currentVideo.tracks.filter(t => {
        if (!kw) return true;
        return (t.title || '').toLowerCase().includes(kw) || (t.artist || '').toLowerCase().includes(kw);
    });

    trackCountBadge.innerText = `${tracksToRender.length} 首曲目`;

    if (tracklistLayout === 'double') {
        trackGridContainer.classList.remove('hidden');
        trackTableContainer.classList.add('hidden');
        renderDoubleColumnGrid(tracksToRender);
    } else {
        trackGridContainer.classList.add('hidden');
        trackTableContainer.classList.remove('hidden');
        renderSingleColumnTable(tracksToRender);
    }

    lucide.createIcons();
}

// 渲染双列紧凑网格 (专为大合集设计，横向不浪费、纵向减半)
function renderDoubleColumnGrid(tracks) {
    trackGridContainer.innerHTML = '';
    if (tracks.length === 0) {
        trackGridContainer.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400 text-xs font-mono">未搜索到匹配曲目</div>`;
        return;
    }

    tracks.forEach((track) => {
        const card = document.createElement('div');
        card.className = 'track-card flex items-center justify-between gap-2 shadow-sm';

        card.innerHTML = `
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <span class="font-mono text-slate-400 text-[11px] w-6 text-center flex-shrink-0">${track.id}</span>
                <div class="flex flex-col flex-1 min-w-0 gap-0.5">
                    <div class="flex items-center gap-1">
                        <input type="text" class="cell-input title-input font-medium text-slate-900 dark:text-white" value="${track.title || ''}" placeholder="歌名">
                        ${track.is_ai ? '<span class="text-[9px] px-1 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-mono flex-shrink-0">AI</span>' : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="text" class="cell-input artist-input text-emerald-600 dark:text-emerald-400 text-[11px] font-medium" value="${track.artist || ''}" placeholder="歌手">
                        <div class="flex items-center gap-0.5 font-mono text-[10px] text-slate-400 flex-shrink-0">
                            <input type="text" class="cell-input start-input w-12 text-center" value="${track.start_str || secToStr(track.start_sec)}">
                            <span>~</span>
                            <input type="text" class="cell-input end-input w-12 text-center" value="${track.end_str || secToStr(track.end_sec)}">
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-1 flex-shrink-0">
                <button class="ai-single-btn p-1 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded transition cursor-pointer" title="AI 校对">
                    <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                </button>
                <button class="swap-single-btn p-1 hover:bg-slate-100 dark:hover:bg-[#161e2e] text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition cursor-pointer" title="互换歌手与歌名">
                    <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
                </button>
                <button class="del-single-btn p-1 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 rounded transition cursor-pointer" title="删除">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;

        bindTrackCardEvents(card, track);
        trackGridContainer.appendChild(card);
    });
}

// 渲染传统单列表格
function renderSingleColumnTable(tracks) {
    trackTableBody.innerHTML = '';
    if (tracks.length === 0) {
        trackTableBody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 text-xs font-mono">未搜索到匹配曲目</td></tr>`;
        return;
    }

    tracks.forEach((track) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover transition';

        tr.innerHTML = `
            <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">${track.id}</td>
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
                    <span class="text-slate-400">~</span>
                    <input type="text" class="cell-input end-input text-center w-14" value="${track.end_str || secToStr(track.end_sec)}">
                </div>
            </td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px] duration-cell">
                ${track.duration_str || secToStr(track.end_sec - track.start_sec)}
            </td>
            <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button class="ai-single-btn p-1 hover:bg-purple-500/20 rounded text-purple-600 dark:text-purple-400 transition cursor-pointer" title="AI 校对">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="swap-single-btn p-1 hover:bg-slate-100 dark:hover:bg-[#161e2e] rounded text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer" title="互换歌手与歌名">
                        <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="del-single-btn p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-500 transition cursor-pointer" title="删除">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>
        `;

        bindTrackCardEvents(tr, track);
        trackTableBody.appendChild(tr);
    });
}

function bindTrackCardEvents(container, track) {
    const artistInput = container.querySelector('.artist-input');
    const titleInput = container.querySelector('.title-input');
    const startInput = container.querySelector('.start-input');
    const endInput = container.querySelector('.end-input');

    artistInput.addEventListener('input', (e) => { track.artist = e.target.value.trim(); });
    titleInput.addEventListener('input', (e) => { track.title = e.target.value.trim(); });

    const syncTimes = () => {
        const s = strToSec(startInput.value);
        const e = strToSec(endInput.value);
        track.start_sec = s;
        track.end_sec = e;
        track.start_str = startInput.value;
        track.end_str = endInput.value;
        track.duration_str = secToStr(Math.max(0, e - s));
    };
    startInput.addEventListener('blur', syncTimes);
    endInput.addEventListener('blur', syncTimes);

    // 单曲 AI 规范
    container.querySelector('.ai-single-btn').addEventListener('click', async (e) => {
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
                renderTrackList();
            }
        } catch (err) {
            alert('AI 规范化失败');
        } finally {
            btn.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i>`;
            lucide.createIcons();
        }
    });

    // 互换
    container.querySelector('.swap-single-btn').addEventListener('click', () => {
        const t = track.artist;
        track.artist = track.title;
        track.title = t;
        artistInput.value = track.artist;
        titleInput.value = track.title;
    });

    // 删除
    container.querySelector('.del-single-btn').addEventListener('click', () => {
        const realIdx = currentVideo.tracks.findIndex(item => item.id === track.id);
        if (realIdx !== -1) {
            currentVideo.tracks.splice(realIdx, 1);
            renderTrackList();
        }
    });
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
        renderTrackList();
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
    renderTrackList();
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
    renderTrackList();
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
            uploader: currentVideo.uploader || '',
            video_title: currentVideo.title || '',
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
// 6. 任务轮询与断点续提机制
// -------------------------------------------------------------
function startTaskPolling(taskId) {
    if (pollTimer) clearInterval(pollTimer);
    
    quickTaskIndicator.classList.remove('hidden');
    navActiveTaskBadge.classList.remove('hidden');
    progressBox.classList.remove('hidden');

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
                // 成功后顶部指示器切换为完成状态，驻留 4 秒后平滑隐去
                quickTaskText.innerText = '✓ 归档已完成 (100%)';
                quickTaskIndicator.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] transition-all';
                setTimeout(() => {
                    stopTaskPolling();
                    quickTaskIndicator.className = 'hidden flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] cursor-pointer';
                }, 4000);

                clearInterval(pollTimer);
                pollTimer = null;
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

async function checkActiveTasksOnLoad() {
    try {
        const resp = await fetch('/api/tasks/recent');
        const data = await resp.json();
        const tasks = data.tasks || [];
        const running = tasks.find(t => t.status === 'processing' || t.status === 'pending');
        if (running) {
            // 刷新页面后自动恢复正在运行的任务展示与进度条
            progressBox.classList.remove('hidden');
            progressBar.style.width = `${running.progress}%`;
            progressPct.innerText = `${running.progress}%`;
            progressStep.innerText = running.step || '正在处理中...';
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
            } else if (t.status === 'interrupted') {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">已中断</span>';
            } else if (t.status === 'error') {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20 font-medium">异常出错</span>';
            } else {
                statusBadge = '<span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-medium">等待中</span>';
            }

            const dateStr = (t.updated_at || t.created_at || '').substring(0, 16);
            const coverSrc = t.cover_url ? ('/api/cover-proxy?url=' + encodeURIComponent(t.cover_url)) : '';
            const biliUrl = t.url || `https://www.bilibili.com/video/${t.bvid}`;
            const videoDisplayName = t.video_title || t.title || t.album;

            tr.innerHTML = `
                <td class="py-2.5 px-3">
                    <div class="flex items-center gap-3">
                        ${coverSrc ? `<img src="${coverSrc}" class="w-12 h-8 object-cover rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-[#1f2a3d] flex-shrink-0" alt="">` : `<div class="w-12 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0"><i data-lucide="music" class="w-3.5 h-3.5"></i></div>`}
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                                <a href="${biliUrl}" target="_blank" class="font-medium text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition truncate max-w-xs flex items-center gap-1" title="在 B站 打开原视频">
                                    <span class="truncate">${videoDisplayName}</span>
                                    <i data-lucide="external-link" class="w-3 h-3 text-slate-400 flex-shrink-0"></i>
                                </a>
                            </div>
                            <div class="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                                <span class="text-slate-600 dark:text-slate-400 font-sans">UP: ${t.uploader || 'Bilibili'}</span>
                                <span>·</span>
                                <span>${t.bvid}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-center">${statusBadge}</td>
                <td class="py-2.5 px-3 text-center">
                    <div class="w-full space-y-1">
                        <div class="flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span>${t.processed_tracks || 0}/${t.total_tracks || 0} 首</span>
                            <span>${t.progress || 0}%</span>
                        </div>
                        <div class="w-full h-1 bg-slate-100 dark:bg-[#090c10] rounded-full overflow-hidden">
                            <div class="h-full bg-emerald-600 dark:bg-brand" style="width: ${t.progress || 0}%"></div>
                        </div>
                    </div>
                </td>
                <td class="py-2.5 px-3 text-center font-mono uppercase text-[10px] text-slate-500">${t.format || 'flac'}</td>
                <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[10px]">${dateStr}</td>
                <td class="py-2.5 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        ${t.status === 'completed' ? `
                            <a href="/api/download/${t.id}/zip" class="p-1 text-slate-400 hover:text-emerald-600 transition" title="下载 ZIP 包">
                                <i data-lucide="archive" class="w-3.5 h-3.5"></i>
                            </a>
                        ` : (t.status === 'processing' ? `
                            <span class="text-[10px] text-emerald-600 font-mono animate-pulse px-2 py-1">进行中</span>
                        ` : `
                            <button class="retry-task-btn px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#161e2e] dark:hover:bg-[#1c263b] rounded text-[11px] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 cursor-pointer" data-id="${t.id}" title="断点续提 (自动跳过已完成歌曲)">
                                <i data-lucide="play" class="w-3 h-3 fill-current"></i>
                                <span>继续</span>
                            </button>
                        `)}
                        <button class="del-task-btn p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer" data-id="${t.id}" title="删除任务记录">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            `;

            const retryBtn = tr.querySelector('.retry-task-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.dataset.id;
                    try {
                        const resp = await fetch(`/api/tasks/retry/${id}`, { method: 'POST' });
                        const res = await resp.json();
                        if (res.status === 'already_running') {
                            alert('该任务已经在后台运行中，请勿重复点击');
                        }
                        startTaskPolling(id);
                        loadTasksHistory();
                    } catch (err) {
                        alert('启动续提失败');
                    }
                });
            }

            const delTaskBtn = tr.querySelector('.del-task-btn');
            if (delTaskBtn) {
                delTaskBtn.addEventListener('click', async (e) => {
                    if (!confirm('确定删除此任务记录？')) return;
                    const id = e.currentTarget.dataset.id;
                    try {
                        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
                        loadTasksHistory();
                    } catch (err) {
                        alert('删除任务失败');
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

batchDeselectBtn.addEventListener('click', () => {
    selectedSongIds.clear();
    document.querySelectorAll('.song-checkbox').forEach(cb => { cb.checked = false; });
    updateBatchBar();
});

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
                <td class="py-2.5 px-3">
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
                <td class="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate text-[11px]">${song.album || '-'}</td>
                <td class="py-2.5 px-3 text-center">
                    <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#090c10] border border-slate-200 dark:border-[#1f2a3d] text-slate-600 dark:text-slate-400 font-medium">
                        ${song.format || 'flac'}
                    </span>
                </td>
                <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">${sizeMb} M</td>
                <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">${dateStr}</td>
                <td class="py-2.5 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <button class="upload-single-netease-btn p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer" data-filename="${song.filename}" title="推送到网易云音乐云盘">
                            <i data-lucide="cloud-upload" class="w-3.5 h-3.5 text-rose-500"></i>
                        </button>
                        <a href="${streamUrl}" download="${song.filename}" class="p-1 text-slate-400 hover:text-emerald-600 transition" title="下载文件">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        </a>
                        <button class="del-lib-btn p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer" data-id="${song.id}" title="彻底删除">
                            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            `;

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

            tr.querySelector('.play-lib-btn').addEventListener('click', () => {
                playTrackFromList(libPlaylist, idx);
            });

            const uploadSingleBtn = tr.querySelector('.upload-single-netease-btn');
            if (uploadSingleBtn) {
                uploadSingleBtn.addEventListener('click', () => {
                    triggerNeteaseUpload([song.filename]);
                });
            }

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
// 9. 系统配置面板交互管理 (支持真实修改、保存与测试 AI)
// -------------------------------------------------------------
function populateSettingsForm(cfg) {
    if (cfgDefaultFormat) cfgDefaultFormat.value = cfg.default_format || 'flac';
    if (cfgDefaultLayout) cfgDefaultLayout.value = cfg.tracklist_layout || 'double';
    if (cfgEnableLoudnorm) cfgEnableLoudnorm.checked = cfg.enable_loudnorm !== false;
    if (cfgEnableFade) cfgEnableFade.checked = cfg.enable_fade !== false;
    if (cfgFadeDuration) cfgFadeDuration.value = String(cfg.fade_duration || 0.3);
    if (cfgSkipExisting) cfgSkipExisting.checked = cfg.skip_existing !== false;
    if (cfgAiBase) cfgAiBase.value = cfg.ai_api_base || '';
    if (cfgAiKey) cfgAiKey.value = cfg.ai_api_key || '';
    if (cfgAiModel) cfgAiModel.value = cfg.ai_model || 'gemini-3.8-flash';
}

// 密码明暗切换
if (toggleAiKeyVisibility && cfgAiKey) {
    toggleAiKeyVisibility.addEventListener('click', () => {
        const isPass = cfgAiKey.type === 'password';
        cfgAiKey.type = isPass ? 'text' : 'password';
        toggleAiKeyVisibility.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i>`;
        lucide.createIcons();
    });
}

// 测试 AI 连通性
if (testAiBtn) {
    testAiBtn.addEventListener('click', async () => {
        testAiBtn.disabled = true;
        testAiBtn.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i><span>测试中...</span>`;
        lucide.createIcons();

        aiTestFeedback.classList.remove('hidden');
        aiTestFeedback.className = 'p-2.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-[#161e2e] text-slate-500';
        aiTestFeedback.innerText = '正在向 AI 大模型网关发送握手验证...';

        try {
            const resp = await fetch('/api/config/test-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ai_api_base: cfgAiBase.value.trim(),
                    ai_api_key: cfgAiKey.value.trim(),
                    ai_model: cfgAiModel.value.trim()
                })
            });
            const res = await resp.json();
            if (res.ok) {
                aiTestFeedback.className = 'p-2.5 rounded-lg text-xs font-mono bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
                aiTestFeedback.innerText = `✓ ${res.message}`;
            } else {
                aiTestFeedback.className = 'p-2.5 rounded-lg text-xs font-mono bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-600 dark:text-rose-400';
                aiTestFeedback.innerText = `✗ ${res.message}`;
            }
        } catch (e) {
            aiTestFeedback.className = 'p-2.5 rounded-lg text-xs font-mono bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-600 dark:text-rose-400';
            aiTestFeedback.innerText = `✗ 网络请求错误: ${e.message}`;
        } finally {
            testAiBtn.disabled = false;
            testAiBtn.innerHTML = `<i data-lucide="zap" class="w-3 h-3 text-purple-600"></i><span>测试连接</span>`;
            lucide.createIcons();
        }
    });
}

// 保存系统配置
if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', async () => {
        saveConfigBtn.disabled = true;
        saveConfigBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>正在保存...</span>`;
        lucide.createIcons();

        try {
            const payload = {
                default_format: cfgDefaultFormat.value,
                tracklist_layout: cfgDefaultLayout.value,
                enable_loudnorm: cfgEnableLoudnorm.checked,
                enable_fade: cfgEnableFade.checked,
                fade_duration: parseFloat(cfgFadeDuration.value) || 0.3,
                skip_existing: cfgSkipExisting.checked,
                ai_api_base: cfgAiBase.value.trim(),
                ai_api_key: cfgAiKey.value.trim(),
                ai_model: cfgAiModel.value.trim()
            };

            const resp = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                // 同步工作台状态
                tracklistLayout = payload.tracklist_layout;
                updateLayoutButtons();
                renderTrackList();
                if (loudnormToggle) loudnormToggle.checked = payload.enable_loudnorm;
                if (fadeToggle) fadeToggle.checked = payload.enable_fade;
                if (formatSelect) formatSelect.value = payload.default_format;

                saveConfigBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>已成功保存！</span>`;
                setTimeout(() => {
                    saveConfigBtn.disabled = false;
                    saveConfigBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>保存系统配置</span>`;
                    lucide.createIcons();
                }, 2000);
            } else {
                throw new Error('保存配置失败');
            }
        } catch (e) {
            alert('保存异常: ' + e.message);
            saveConfigBtn.disabled = false;
            saveConfigBtn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>保存系统配置</span>`;
            lucide.createIcons();
        }
    });
}

// -------------------------------------------------------------
// 10. 全局常驻播放器 (完美按键状态切换 + 左右切歌 + 自动连播)
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

globalAudio.addEventListener('play', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-current"></i>`;
    lucide.createIcons();
});

globalAudio.addEventListener('pause', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current ml-0.5"></i>`;
    lucide.createIcons();
});

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

// ==============================================================
// 11. 网易云音乐云盘与扫码登录控制系统 (NetEase Cloud Music Engine)
// ==============================================================

let neteaseUser = null;
let neteasePollTimer = null;
let qrCheckTimer = null;
let currentQrKey = null;

// 1. 获取并渲染网易云账号状态与云盘容量
async function loadNeteaseStatus() {
    try {
        const resp = await fetch('/api/netease/status');
        const data = await resp.json();

        if (data.success && data.isLogin && data.profile) {
            neteaseUser = data.profile;
            const cloud = data.cloud || { count: 0, size: 0, maxSize: 0 };

            // 渲染已登录状态
            if (neteaseNotLoggedInCard) neteaseNotLoggedInCard.classList.add('hidden');
            if (neteaseLoggedInCard) neteaseLoggedInCard.classList.remove('hidden');

            if (neteaseUserAvatar) neteaseUserAvatar.src = data.profile.avatarUrl || '/static/logo.jpg';
            if (neteaseUserNickname) neteaseUserNickname.innerText = data.profile.nickname || '网易云音乐用户';
            if (neteaseUserId) neteaseUserId.innerText = String(data.profile.userId || '');

            if (neteaseVipBadge) {
                if (data.profile.vipType > 0) {
                    neteaseVipBadge.classList.remove('hidden');
                } else {
                    neteaseVipBadge.classList.add('hidden');
                }
            }

            // 顶部胶囊状态同步
            if (headerNeteaseUserText) headerNeteaseUserText.innerText = `${data.profile.nickname}`;

            // 云盘容量计算
            const usedGb = (cloud.size / (1024 * 1024 * 1024)).toFixed(1);
            const maxGb = cloud.maxSize > 0 ? (cloud.maxSize / (1024 * 1024 * 1024)).toFixed(1) : '60.0';
            const pct = cloud.maxSize > 0 ? Math.min(100, Math.round((cloud.size / cloud.maxSize) * 100)) : 0;

            if (neteaseCloudCapacityText) {
                neteaseCloudCapacityText.innerText = `${usedGb} GB / ${maxGb} GB (共 ${cloud.count} 首曲目)`;
            }
            if (neteaseCloudCapacityBar) {
                neteaseCloudCapacityBar.style.width = `${pct}%`;
            }

        } else {
            neteaseUser = null;
            if (neteaseNotLoggedInCard) neteaseNotLoggedInCard.classList.remove('hidden');
            if (neteaseLoggedInCard) neteaseLoggedInCard.classList.add('hidden');
            if (headerNeteaseUserText) headerNeteaseUserText.innerText = '网易云未登录';
        }

        lucide.createIcons();
    } catch (e) {
        console.error('[NetEase] 获取状态异常:', e);
    }
}

// 2. 扫码登录模态弹窗控制
if (openQrLoginBtn) openQrLoginBtn.addEventListener('click', openQrLoginModal);
if (neteaseReLoginBtn) neteaseReLoginBtn.addEventListener('click', openQrLoginModal);
if (closeNeteaseQrModalBtn) closeNeteaseQrModalBtn.addEventListener('click', closeQrLoginModal);
if (neteaseQrRefreshBtn) neteaseQrRefreshBtn.addEventListener('click', refreshQrCode);

async function openQrLoginModal() {
    if (neteaseQrModal) neteaseQrModal.classList.remove('hidden');
    await refreshQrCode();
    lucide.createIcons();
}

function closeQrLoginModal() {
    if (neteaseQrModal) neteaseQrModal.classList.add('hidden');
    if (qrCheckTimer) {
        clearInterval(qrCheckTimer);
        qrCheckTimer = null;
    }
}

async function refreshQrCode() {
    if (qrCheckTimer) clearInterval(qrCheckTimer);

    if (neteaseQrLoading) neteaseQrLoading.classList.remove('hidden');
    if (neteaseQrImg) neteaseQrImg.classList.add('hidden');
    if (neteaseQrOverlay) neteaseQrOverlay.classList.add('hidden');
    if (neteaseQrRefreshBtn) neteaseQrRefreshBtn.classList.add('hidden');
    if (neteaseQrStatusText) neteaseQrStatusText.innerText = '正在生成二维码...';
    if (neteaseQrStatusDot) neteaseQrStatusDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-ping';

    try {
        const resp = await fetch('/api/netease/qr/create', { method: 'POST' });
        const data = await resp.json();

        if (data.success && data.unikey && data.qrimg) {
            currentQrKey = data.unikey;
            if (neteaseQrImg) {
                neteaseQrImg.src = data.qrimg;
                neteaseQrImg.classList.remove('hidden');
            }
            if (neteaseQrLoading) neteaseQrLoading.classList.add('hidden');
            if (neteaseQrStatusText) neteaseQrStatusText.innerText = '请打开网易云音乐手机 App 扫码';

            // 启动定时状态轮询 (每 1.5 秒检查一次)
            qrCheckTimer = setInterval(async () => {
                try {
                    const checkResp = await fetch(`/api/netease/qr/check?key=${encodeURIComponent(currentQrKey)}`);
                    const checkData = await checkResp.json();
                    const code = checkData.code;

                    if (code === 801) {
                        // 等待扫码
                        if (neteaseQrOverlay) neteaseQrOverlay.classList.add('hidden');
                        if (neteaseQrStatusText) neteaseQrStatusText.innerText = '等待手机端扫码...';
                    } else if (code === 802) {
                        // 扫码成功，待手机端确认
                        if (neteaseQrOverlay) {
                            neteaseQrOverlay.classList.remove('hidden');
                            neteaseQrOverlayIcon.setAttribute('data-lucide', 'smartphone');
                            neteaseQrOverlayIcon.className = 'w-10 h-10 text-rose-500 animate-pulse';
                            neteaseQrOverlayText.innerText = '已扫描成功，请在手机上点击【确认登录】';
                        }
                        if (neteaseQrStatusText) neteaseQrStatusText.innerText = '请在手机端确认授权...';
                        lucide.createIcons();
                    } else if (code === 803) {
                        // 授权登录成功
                        clearInterval(qrCheckTimer);
                        qrCheckTimer = null;

                        if (neteaseQrOverlay) {
                            neteaseQrOverlay.classList.remove('hidden');
                            neteaseQrOverlayIcon.setAttribute('data-lucide', 'check-circle-2');
                            neteaseQrOverlayIcon.className = 'w-10 h-10 text-emerald-500';
                            neteaseQrOverlayText.innerText = '✓ 授权成功，欢迎使用！';
                        }
                        if (neteaseQrStatusText) neteaseQrStatusText.innerText = '登录成功，正在加载数据...';
                        if (neteaseQrStatusDot) neteaseQrStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
                        lucide.createIcons();

                        setTimeout(() => {
                            closeQrLoginModal();
                            loadNeteaseStatus();
                        }, 1200);
                    } else if (code === 800) {
                        // 二维码已过期
                        clearInterval(qrCheckTimer);
                        qrCheckTimer = null;

                        if (neteaseQrOverlay) {
                            neteaseQrOverlay.classList.remove('hidden');
                            neteaseQrOverlayIcon.setAttribute('data-lucide', 'alert-circle');
                            neteaseQrOverlayIcon.className = 'w-10 h-10 text-amber-500';
                            neteaseQrOverlayText.innerText = '二维码已失效，请点击刷新';
                            if (neteaseQrRefreshBtn) neteaseQrRefreshBtn.classList.remove('hidden');
                        }
                        if (neteaseQrStatusText) neteaseQrStatusText.innerText = '二维码已过期';
                        if (neteaseQrStatusDot) neteaseQrStatusDot.className = 'w-2 h-2 rounded-full bg-amber-500';
                        lucide.createIcons();
                    }
                } catch (e) {
                    console.error('[NetEase] 检查扫码状态异常:', e);
                }
            }, 1500);

        } else {
            throw new Error(data.error || '生成登录二维码失败');
        }
    } catch (err) {
        if (neteaseQrLoading) neteaseQrLoading.classList.add('hidden');
        if (neteaseQrStatusText) neteaseQrStatusText.innerText = `错误: ${err.message}`;
    }
}

// 3. 退出网易云账号
if (neteaseLogoutBtn) {
    neteaseLogoutBtn.addEventListener('click', async () => {
        if (!confirm('确定退出当前网易云音乐账号？')) return;
        try {
            await fetch('/api/netease/logout', { method: 'POST' });
            neteaseUser = null;
            loadNeteaseStatus();
        } catch (e) {
            alert('退出登录失败: ' + e.message);
        }
    });
}

if (neteaseRefreshBtn) {
    neteaseRefreshBtn.addEventListener('click', () => {
        loadNeteaseStatus();
        fetchNeteaseUploadStatus();
    });
}

// 4. 发起同步任务控制
async function triggerNeteaseUpload(fileNames = null, songIds = null) {
    // 检查是否登录
    if (!neteaseUser) {
        openQrLoginModal();
        return;
    }

    try {
        const payload = {};
        if (fileNames && fileNames.length > 0) payload.file_names = fileNames;
        if (songIds && songIds.length > 0) payload.song_ids = songIds;

        const resp = await fetch('/api/netease/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await resp.json();

        if (resp.status === 409) {
            alert('已有网易云同步任务正在运行中，系统排他锁已生效，杜绝并发与重复上传！');
            switchView('netease');
            startNeteaseUploadPolling();
            return;
        }

        if (!resp.ok) {
            throw new Error(res.detail || res.message || '发起上传失败');
        }

        // 切换到网易云视图以便实时监视
        switchView('netease');
        startNeteaseUploadPolling();

    } catch (e) {
        alert('启动网易云同步失败: ' + e.message);
    }
}

// 绑定各处触发按钮
if (neteaseSyncAllBtn) {
    neteaseSyncAllBtn.addEventListener('click', () => {
        triggerNeteaseUpload(); // 全量增量同步
    });
}

if (batchUploadNeteaseBtn) {
    batchUploadNeteaseBtn.addEventListener('click', () => {
        const ids = Array.from(selectedSongIds);
        if (ids.length === 0) return;
        triggerNeteaseUpload(null, ids);
    });
}

if (completedUploadNeteaseBtn) {
    completedUploadNeteaseBtn.addEventListener('click', () => {
        triggerNeteaseUpload();
    });
}

if (neteaseCancelUploadBtn) {
    neteaseCancelUploadBtn.addEventListener('click', async () => {
        if (!confirm('确定中止当前的网易云上传任务？已上传成功的曲目将保留在云盘。')) return;
        try {
            await fetch('/api/netease/upload/cancel', { method: 'POST' });
            fetchNeteaseUploadStatus();
        } catch (e) {
            alert('中止失败: ' + e.message);
        }
    });
}

if (neteaseClearLogsBtn) {
    neteaseClearLogsBtn.addEventListener('click', () => {
        if (neteaseLogContainer) {
            neteaseLogContainer.innerHTML = '<div class="text-slate-500">// 日志已清空</div>';
        }
    });
}

// 5. 实时进度与日志轮询监听核心
function startNeteaseUploadPolling() {
    if (neteasePollTimer) clearInterval(neteasePollTimer);

    if (quickNeteaseIndicator) quickNeteaseIndicator.classList.remove('hidden');
    if (navNeteaseBadge) navNeteaseBadge.classList.remove('hidden');

    fetchNeteaseUploadStatus();

    neteasePollTimer = setInterval(() => {
        fetchNeteaseUploadStatus();
    }, 1200);
}

function stopNeteaseUploadPolling() {
    if (neteasePollTimer) {
        clearInterval(neteasePollTimer);
        neteasePollTimer = null;
    }
}

async function fetchNeteaseUploadStatus() {
    try {
        const resp = await fetch('/api/netease/upload/status');
        if (!resp.ok) return;
        const data = await resp.json();

        renderNeteaseUploadState(data);
    } catch (e) {
        console.error('[NetEase] 轮询状态异常:', e);
    }
}

function renderNeteaseUploadState(data) {
    if (!data) return;

    const status = data.status || 'idle';
    const percent = data.percent || 0;

    // 进度条与百分比
    if (neteaseProgressPct) neteaseProgressPct.innerText = `${percent}%`;
    if (neteaseProgressBar) neteaseProgressBar.style.width = `${percent}%`;

    // 顶部与侧边栏指示器
    if (quickNeteaseText) quickNeteaseText.innerText = `云盘同步 ${percent}%`;

    // 当前处理歌曲信息
    if (neteaseCurrentFileName) neteaseCurrentFileName.innerText = data.current_file || (status === 'running' ? '准备中...' : '空闲中');
    if (neteaseCurrentFileSize) neteaseCurrentFileSize.innerText = data.current_size ? `(${data.current_size})` : '';
    if (neteaseStepMessage) neteaseStepMessage.innerText = data.message || '等待发起...';
    if (neteaseCurrentIndexText) neteaseCurrentIndexText.innerText = `${data.current || 0} / ${data.total || 0}`;

    // 4 项指标统计
    if (neteaseMetricTotal) neteaseMetricTotal.innerText = data.total || 0;
    if (neteaseMetricUploaded) neteaseMetricUploaded.innerText = data.uploaded || 0;
    if (neteaseMetricSkipped) neteaseMetricSkipped.innerText = data.skipped || 0;
    if (neteaseMetricFailed) neteaseMetricFailed.innerText = data.failed || 0;

    // 状态徽章与操作按钮
    if (status === 'running') {
        if (neteaseStatusBadge) {
            neteaseStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1';
            neteaseStatusBadge.innerHTML = '<i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i><span>同步中</span>';
        }
        if (neteaseCancelUploadBtn) neteaseCancelUploadBtn.classList.remove('hidden');
        if (quickNeteaseIndicator) quickNeteaseIndicator.classList.remove('hidden');
        if (navNeteaseBadge) navNeteaseBadge.classList.remove('hidden');
        if (neteaseCurrentIcon) neteaseCurrentIcon.classList.add('animate-spin');

    } else if (status === 'completed') {
        if (neteaseStatusBadge) {
            neteaseStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
            neteaseStatusBadge.innerText = '✓ 同步完成';
        }
        if (neteaseCancelUploadBtn) neteaseCancelUploadBtn.classList.add('hidden');
        if (neteaseCurrentIcon) neteaseCurrentIcon.classList.remove('animate-spin');
        if (navNeteaseBadge) navNeteaseBadge.classList.add('hidden');

        // 停止轮询并在 4 秒后隐藏顶部指示器
        stopNeteaseUploadPolling();
        setTimeout(() => {
            if (quickNeteaseIndicator) quickNeteaseIndicator.classList.add('hidden');
        }, 4000);

        // 刷新一次账号容量信息
        loadNeteaseStatus();

    } else if (status === 'cancelled') {
        if (neteaseStatusBadge) {
            neteaseStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
            neteaseStatusBadge.innerText = '已中止';
        }
        if (neteaseCancelUploadBtn) neteaseCancelUploadBtn.classList.add('hidden');
        if (quickNeteaseIndicator) quickNeteaseIndicator.classList.add('hidden');
        if (navNeteaseBadge) navNeteaseBadge.classList.add('hidden');
        if (neteaseCurrentIcon) neteaseCurrentIcon.classList.remove('animate-spin');
        stopNeteaseUploadPolling();

    } else if (status === 'failed') {
        if (neteaseStatusBadge) {
            neteaseStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20';
            neteaseStatusBadge.innerText = '执行异常';
        }
        if (neteaseCancelUploadBtn) neteaseCancelUploadBtn.classList.add('hidden');
        if (quickNeteaseIndicator) quickNeteaseIndicator.classList.add('hidden');
        if (navNeteaseBadge) navNeteaseBadge.classList.add('hidden');
        if (neteaseCurrentIcon) neteaseCurrentIcon.classList.remove('animate-spin');
        stopNeteaseUploadPolling();

    } else {
        if (neteaseStatusBadge) {
            neteaseStatusBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
            neteaseStatusBadge.innerText = '空闲中';
        }
        if (neteaseCancelUploadBtn) neteaseCancelUploadBtn.classList.add('hidden');
        if (quickNeteaseIndicator) quickNeteaseIndicator.classList.add('hidden');
        if (navNeteaseBadge) navNeteaseBadge.classList.add('hidden');
        if (neteaseCurrentIcon) neteaseCurrentIcon.classList.remove('animate-spin');
        stopNeteaseUploadPolling();
    }

    // 渲染实时日志流
    if (neteaseLogContainer && Array.isArray(data.logs) && data.logs.length > 0) {
        neteaseLogContainer.innerHTML = '';
        data.logs.forEach(log => {
            const row = document.createElement('div');
            row.className = 'flex items-start gap-2 leading-relaxed';

            let colorClass = 'text-slate-300';
            let tagBadge = '';

            if (log.level === 'success') {
                colorClass = 'text-emerald-400 font-medium';
                tagBadge = '<span class="text-[10px] text-emerald-500">[成功]</span>';
            } else if (log.level === 'skip') {
                colorClass = 'text-sky-400';
                tagBadge = '<span class="text-[10px] text-sky-500">[跳过]</span>';
            } else if (log.level === 'error') {
                colorClass = 'text-rose-400 font-semibold';
                tagBadge = '<span class="text-[10px] text-rose-500">[失败]</span>';
            } else if (log.level === 'warn') {
                colorClass = 'text-amber-400';
                tagBadge = '<span class="text-[10px] text-amber-500">[警告]</span>';
            } else {
                tagBadge = '<span class="text-[10px] text-slate-500">[信息]</span>';
            }

            row.innerHTML = `
                <span class="text-slate-600 flex-shrink-0 select-none">[${log.time || '--:--:--'}]</span>
                ${tagBadge}
                <span class="${colorClass} break-all flex-1">${log.text || ''}</span>
            `;
            neteaseLogContainer.appendChild(row);
        });

        // 自动滚动到底部
        if (neteaseAutoScrollCheck && neteaseAutoScrollCheck.checked) {
            neteaseLogContainer.scrollTop = neteaseLogContainer.scrollHeight;
        }
    }

    lucide.createIcons();
}

// 6. 刷新页面时检查是否有后台正在运行的网易云同步任务
async function checkActiveNeteaseUploadOnLoad() {
    try {
        const resp = await fetch('/api/netease/upload/status');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.status === 'running') {
            // 刷新恢复活跃任务监视
            startNeteaseUploadPolling();
        } else {
            renderNeteaseUploadState(data);
        }
    } catch (e) {
        console.error('[NetEase] 检查后台任务异常:', e);
    }
}

// 运行初始化
init();
