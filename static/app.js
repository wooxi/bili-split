// 全局应用状态
let currentVideo = null;
let currentTaskId = null;
let pollTimer = null;
let libraryData = [];

// DOM 元素引用 - 视图切换
const viewWorkstationBtn = document.getElementById('viewWorkstationBtn');
const viewLibraryBtn = document.getElementById('viewLibraryBtn');
const workstationView = document.getElementById('workstationView');
const libraryView = document.getElementById('libraryView');
const libraryCountTag = document.getElementById('libraryCountTag');
const headerPathBadge = document.getElementById('headerPathBadge');

// DOM 元素引用 - 工作台
const urlInput = document.getElementById('urlInput');
const parseBtn = document.getElementById('parseBtn');
const emptyState = document.getElementById('emptyState');
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
const taskStatusText = document.getElementById('taskStatusText');

const progressBox = document.getElementById('progressBox');
const progressStep = document.getElementById('progressStep');
const progressPct = document.getElementById('progressPct');
const progressBar = document.getElementById('progressBar');

const completedBox = document.getElementById('completedBox');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const outputFileList = document.getElementById('outputFileList');

// DOM 元素引用 - 媒体库
const librarySearchInput = document.getElementById('librarySearchInput');
const libraryStats = document.getElementById('libraryStats');
const libraryTableBody = document.getElementById('libraryTableBody');

// DOM 元素引用 - 全局底部音频播放器
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

// 当前活动播放列表与索引
let currentPlaylist = [];
let currentTrackIndex = -1;

// -------------------------------------------------------------
// 1. 初始化与配置加载
// -------------------------------------------------------------
async function init() {
    try {
        const resp = await fetch('/api/config');
        const cfg = await resp.json();
        if (headerPathBadge) headerPathBadge.innerText = cfg.music_dir;
        if (loudnormToggle) loudnormToggle.checked = cfg.enable_loudnorm;
        if (fadeToggle) fadeToggle.checked = cfg.enable_fade;
    } catch (e) {
        console.error('初始化配置失败:', e);
    }
    loadLibrary();
}

// -------------------------------------------------------------
// 2. 视图切换逻辑
// -------------------------------------------------------------
function switchView(viewName) {
    if (viewName === 'workstation') {
        workstationView.classList.remove('hidden');
        libraryView.classList.add('hidden');
        viewWorkstationBtn.className = 'px-3 py-1 rounded-md bg-surface-active text-white font-medium transition cursor-pointer flex items-center gap-1.5';
        viewLibraryBtn.className = 'px-3 py-1 rounded-md text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center gap-1.5';
    } else {
        workstationView.classList.add('hidden');
        libraryView.classList.remove('hidden');
        viewLibraryBtn.className = 'px-3 py-1 rounded-md bg-surface-active text-white font-medium transition cursor-pointer flex items-center gap-1.5';
        viewWorkstationBtn.className = 'px-3 py-1 rounded-md text-slate-400 hover:text-slate-200 transition cursor-pointer flex items-center gap-1.5';
        loadLibrary(librarySearchInput ? librarySearchInput.value.trim() : '');
    }
    lucide.createIcons();
}

viewWorkstationBtn.addEventListener('click', () => switchView('workstation'));
viewLibraryBtn.addEventListener('click', () => switchView('library'));

// -------------------------------------------------------------
// 3. 辅助转换函数
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
// 4. 工作台：解析视频
// -------------------------------------------------------------
parseBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;

    parseBtn.disabled = true;
    parseBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>解析中</span>`;
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

        emptyState.classList.add('hidden');
        editorPanel.classList.remove('hidden');
        completedBox.classList.add('hidden');
        progressBox.classList.add('hidden');

    } catch (e) {
        alert(e.message);
    } finally {
        parseBtn.disabled = false;
        parseBtn.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i><span>解析</span>`;
        lucide.createIcons();
    }
});

function renderVideoHeader(data) {
    videoCover.src = data.cover_url ? ('/api/cover-proxy?url=' + encodeURIComponent(data.cover_url)) : '';
    videoTitle.innerText = data.title;
    videoOwner.innerText = data.uploader;
    durationBadge.innerText = data.duration_str;
    albumInput.value = data.title;

    const sourceMap = {
        'comment': '评论打点',
        'description': '简介打点',
        'multi_page': '多P合集',
        'single': '单视频'
    };
    sourceBadge.innerText = sourceMap[data.source_type] || '自动提取';
}

function renderTrackTable(tracks) {
    trackTableBody.innerHTML = '';
    trackCountBadge.innerText = `${tracks.length} 首`;

    tracks.forEach((track, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'table-row-hover transition';

        tr.innerHTML = `
            <td class="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">${idx + 1}</td>
            <td class="py-1.5 px-2">
                <input type="text" class="cell-input artist-input font-medium text-emerald-300" value="${track.artist || ''}">
            </td>
            <td class="py-1.5 px-2">
                <div class="flex items-center gap-1.5">
                    <input type="text" class="cell-input title-input font-medium text-slate-100 flex-1" value="${track.title || ''}">
                    ${track.is_ai ? '<span class="text-[9px] px-1 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">AI</span>' : ''}
                </div>
            </td>
            <td class="py-1.5 px-2 text-center">
                <div class="flex items-center justify-center gap-1 font-mono text-[11px]">
                    <input type="text" class="cell-input start-input text-center w-14" value="${track.start_str || secToStr(track.start_sec)}">
                    <span class="text-slate-600">~</span>
                    <input type="text" class="cell-input end-input text-center w-14" value="${track.end_str || secToStr(track.end_sec)}">
                </div>
            </td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px] duration-cell">
                ${track.duration_str || secToStr(track.end_sec - track.start_sec)}
            </td>
            <td class="py-2.5 px-3 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button class="ai-single-btn p-1 hover:bg-purple-900/40 rounded text-purple-400 transition" title="AI 校对">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="swap-single-btn p-1 hover:bg-surface-hover rounded text-slate-400 hover:text-white transition" title="互换歌手与歌名">
                        <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
                    </button>
                    <button class="del-single-btn p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400 transition" title="删除">
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

        // 单曲 AI 校对
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

        // 单曲互换
        tr.querySelector('.swap-single-btn').addEventListener('click', () => {
            const t = track.artist;
            track.artist = track.title;
            track.title = t;
            artistInput.value = track.artist;
            titleInput.value = track.title;
        });

        // 单曲删除
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
        aiNormalizeAllBtn.innerHTML = `<i data-lucide="sparkles" class="w-3 h-3 text-purple-400"></i><span>AI 规范</span>`;
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
    taskStatusText.innerText = '正在提交任务...';

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
        pollTaskProgress(currentTaskId);

    } catch (err) {
        alert(err.message);
        startProcessBtn.disabled = false;
        progressBox.classList.add('hidden');
        taskStatusText.innerText = '就绪';
    }
});

function pollTaskProgress(taskId) {
    if (pollTimer) clearInterval(pollTimer);

    pollTimer = setInterval(async () => {
        try {
            const resp = await fetch(`/api/task/${taskId}`);
            const data = await resp.json();

            progressBar.style.width = `${data.progress}%`;
            progressPct.innerText = `${data.progress}%`;
            progressStep.innerText = data.step || '处理中...';
            taskStatusText.innerText = data.step || '处理中...';

            if (data.status === 'completed') {
                clearInterval(pollTimer);
                startProcessBtn.disabled = false;
                progressBox.classList.add('hidden');
                taskStatusText.innerText = '归档完成';
                showCompleted(taskId, data);
                loadLibrary();
            } else if (data.status === 'error') {
                clearInterval(pollTimer);
                startProcessBtn.disabled = false;
                taskStatusText.innerText = '出错';
                alert(data.step);
            }
        } catch (e) {
            console.error('进度轮询异常:', e);
        }
    }, 1000);
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
        item.className = 'flex items-center justify-between p-2.5 bg-surface-base rounded-lg border border-surface-border text-xs';
        const streamUrl = `/api/download/${taskId}/track/${encodeURIComponent(f.filename)}`;

        item.innerHTML = `
            <div class="flex items-center gap-2.5 truncate">
                <button class="play-item-btn w-6 h-6 rounded-md bg-surface-card hover:bg-surface-active flex items-center justify-center text-slate-300 hover:text-emerald-400 transition cursor-pointer flex-shrink-0">
                    <i data-lucide="play" class="w-3 h-3 fill-current ml-0.5"></i>
                </button>
                <div class="truncate">
                    <span class="font-medium text-white">${f.title}</span>
                    <span class="text-slate-500 ml-1.5 font-mono text-[11px]">${f.artist} · ${f.size_mb} MB</span>
                </div>
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
                <a href="${streamUrl}" download="${f.filename}" class="p-1 hover:text-emerald-400 text-slate-400 transition" title="下载单曲">
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
// 5. 媒体库管理 (SQLite)
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

async function loadLibrary(keyword = '') {
    try {
        const url = keyword ? `/api/history?keyword=${encodeURIComponent(keyword)}` : '/api/history';
        const resp = await fetch(url);
        const data = await resp.json();
        libraryData = data.songs || [];

        if (libraryCountTag) libraryCountTag.innerText = libraryData.length;
        if (libraryStats) libraryStats.innerText = `${libraryData.length} 首曲目`;

        libraryTableBody.innerHTML = '';
        if (libraryData.length === 0) {
            libraryTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-12 text-center text-slate-600 text-xs font-mono">
                        ${keyword ? '未找到匹配曲目' : '曲库暂无已归档歌曲'}
                    </td>
                </tr>
            `;
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

            tr.innerHTML = `
                <td class="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">${idx + 1}</td>
                <td class="py-2 px-3">
                    <div class="flex items-center gap-2.5">
                        <button class="play-lib-btn w-6 h-6 rounded bg-surface-base hover:bg-surface-active flex items-center justify-center text-slate-300 hover:text-emerald-400 transition cursor-pointer flex-shrink-0">
                            <i data-lucide="play" class="w-3 h-3 fill-current ml-0.5"></i>
                        </button>
                        <div class="truncate">
                            <div class="font-medium text-white truncate">${song.title}</div>
                            <div class="text-[11px] text-slate-500 truncate">${song.artist}</div>
                        </div>
                    </div>
                </td>
                <td class="py-2 px-3 text-slate-400 truncate text-[11px]">${song.album || '-'}</td>
                <td class="py-2 px-3 text-center">
                    <span class="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-base border border-surface-border text-slate-400">
                        ${song.format || 'mp3'}
                    </span>
                </td>
                <td class="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">${sizeMb} M</td>
                <td class="py-2 px-3 text-center font-mono text-slate-500 text-[11px]">${dateStr}</td>
                <td class="py-2 px-3 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                        <a href="${streamUrl}" download="${song.filename}" class="p-1 text-slate-500 hover:text-emerald-400 transition" title="下载文件">
                            <i data-lucide="download" class="w-3.5 h-3.5"></i>
                        </a>
                        <button class="del-lib-btn p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer" data-id="${song.id}" title="删除记录">
                            <i data-lucide="trash" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            `;

            tr.querySelector('.play-lib-btn').addEventListener('click', () => {
                playTrackFromList(libPlaylist, idx);
            });

            tr.querySelector('.del-lib-btn').addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                try {
                    await fetch(`/api/history/${id}`, { method: 'DELETE' });
                    loadLibrary(librarySearchInput ? librarySearchInput.value.trim() : '');
                } catch (err) {
                    alert('删除失败');
                }
            });

            libraryTableBody.appendChild(tr);
        });

        lucide.createIcons();

    } catch (e) {
        console.error('加载媒体库失败:', e);
    }
}

// -------------------------------------------------------------
// 6. 全局底部音频播放器控制 (支持列表联动、左右切歌、自动连播)
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
    playerDownloadBtn.download = `${artist} - ${title}.mp3`;

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

// 播放按键状态精准切换 (三角 / 双竖线)
globalAudio.addEventListener('play', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="pause" class="w-4 h-4 fill-current"></i>`;
    lucide.createIcons();
});

globalAudio.addEventListener('pause', () => {
    playerPlayBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4 fill-current ml-0.5"></i>`;
    lucide.createIcons();
});

// 歌曲播放结束自动切换下一首
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
