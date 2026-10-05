const fs = require('fs');
const path = require('path');

// 保证即使 NeteaseCloudMusicApi 内部有 warning 或异常也不污染 stdout 的 JSON 输出
let api;
try {
    api = require('NeteaseCloudMusicApi');
} catch (e) {
    try {
        api = require('/ssd/docker/bili-split/netease_uploader/node_modules/NeteaseCloudMusicApi');
    } catch (e2) {
        console.error(JSON.stringify({ success: false, error: '未能加载 NeteaseCloudMusicApi 模块: ' + (e2.message || e2) }));
        process.exit(1);
    }
}

// 解析命令行参数
const args = process.argv.slice(2);
const command = args[0] || 'help';

function getArg(flag, defaultValue = null) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return defaultValue;
}

function normalizeTitle(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/\.(flac|mp3|m4a|wav|aac)$/i, '')
        .replace(/[\s_\-–—·/\\()[\]（）【】「」《》'"`]+/g, '')
        .trim();
}

let activeLockFile = null;

function cleanupLock() {
    try {
        if (activeLockFile && fs.existsSync(activeLockFile)) {
            fs.unlinkSync(activeLockFile);
        }
    } catch (e) {}
}

process.on('exit', cleanupLock);
process.on('SIGINT', () => { cleanupLock(); process.exit(0); });
process.on('SIGTERM', () => { cleanupLock(); process.exit(0); });
process.on('uncaughtException', (err) => {
    const msg = err ? (err.message || String(err)) : '未知未捕获异常';
    console.error(JSON.stringify({ event: 'crash', error: msg }));
    cleanupLock();
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    const msg = reason ? (reason.message || String(reason)) : '未知未处理Promise拒绝';
    console.error(JSON.stringify({ event: 'crash', error: msg }));
    cleanupLock();
    process.exit(1);
});

// 1. 查询网易云账号与云盘状态
async function handleStatus() {
    const cookieFile = getArg('--cookie-file');
    let cookie = getArg('--cookie');

    if (!cookie && cookieFile && fs.existsSync(cookieFile)) {
        try {
            cookie = fs.readFileSync(cookieFile, 'utf-8').trim();
        } catch (e) {}
    }

    if (!cookie) {
        console.log(JSON.stringify({
            success: true,
            isLogin: false,
            message: '未配置登录凭证'
        }));
        return;
    }

    try {
        const statusRes = await api.login_status({ cookie });
        const profile = statusRes.body?.data?.profile;

        if (!profile || !profile.userId) {
            console.log(JSON.stringify({
                success: true,
                isLogin: false,
                message: '凭证已失效或未登录'
            }));
            return;
        }

        // 获取云盘容量概况
        let cloudInfo = { count: 0, size: 0, maxSize: 0 };
        try {
            const cloudRes = await api.user_cloud({ limit: 1, cookie });
            if (cloudRes.body) {
                cloudInfo = {
                    count: cloudRes.body.count || 0,
                    size: cloudRes.body.size || 0,
                    maxSize: cloudRes.body.maxSize || 0
                };
            }
        } catch (ce) {}

        console.log(JSON.stringify({
            success: true,
            isLogin: true,
            profile: {
                userId: profile.userId,
                nickname: profile.nickname,
                avatarUrl: profile.avatarUrl,
                vipType: profile.vipType
            },
            cloud: cloudInfo
        }));
    } catch (e) {
        console.log(JSON.stringify({
            success: false,
            isLogin: false,
            error: e ? (e.message || String(e)) : '网络状态查询失败'
        }));
    }
}

// 2. 扫码登录：生成 Key
async function handleQrKey() {
    try {
        const keyRes = await api.login_qr_key({});
        const unikey = keyRes.body?.data?.unikey;
        if (!unikey) {
            console.log(JSON.stringify({ success: false, error: '未能获取二维码 Key' }));
            return;
        }
        console.log(JSON.stringify({ success: true, unikey }));
    } catch (e) {
        console.log(JSON.stringify({ success: false, error: e?.message || String(e) }));
    }
}

// 3. 扫码登录：生成二维码图像
async function handleQrCreate() {
    const key = getArg('--key');
    if (!key) {
        console.log(JSON.stringify({ success: false, error: '缺少 --key 参数' }));
        return;
    }
    try {
        const qrRes = await api.login_qr_create({ key, qrimg: true });
        const data = qrRes.body?.data || {};
        console.log(JSON.stringify({
            success: true,
            qrurl: data.qrurl || '',
            qrimg: data.qrimg || ''
        }));
    } catch (e) {
        console.log(JSON.stringify({ success: false, error: e?.message || String(e) }));
    }
}

// 4. 扫码登录：检查扫码授权状态
async function handleQrCheck() {
    const key = getArg('--key');
    if (!key) {
        console.log(JSON.stringify({ success: false, error: '缺少 --key 参数' }));
        return;
    }
    try {
        const checkRes = await api.login_qr_check({ key });
        const body = checkRes.body || {};
        console.log(JSON.stringify({
            success: true,
            code: body.code,
            message: body.message || '',
            cookie: checkRes.cookie || body.cookie || ''
        }));
    } catch (e) {
        console.log(JSON.stringify({ success: false, error: e?.message || String(e) }));
    }
}

// 5. 批量同步推送至网易云云盘
async function handleUpload() {
    const cookieFile = getArg('--cookie-file');
    const lockFile = getArg('--lock-file');
    const stateFile = getArg('--state-file');
    const musicDir = getArg('--music-dir', '/music');
    const specifiedFiles = getArg('--files'); // 逗号分隔的文件名列表

    if (lockFile) {
        activeLockFile = lockFile;
        // 单实例锁排他校验
        if (fs.existsSync(lockFile)) {
            try {
                const oldPid = parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10);
                if (oldPid && oldPid > 0) {
                    process.kill(oldPid, 0); // 探测进程存活
                    console.log(JSON.stringify({
                        event: 'locked',
                        error: `已有上传进程正在运行中 (PID: ${oldPid})，安全退出以防止重复并发！`
                    }));
                    process.exit(0);
                }
            } catch (e) {
                // 历史陈旧锁，直接清理
                try { fs.unlinkSync(lockFile); } catch(ex) {}
            }
        }
        try {
            fs.writeFileSync(lockFile, String(process.pid), 'utf-8');
        } catch(e) {}
    }

    // 辅助状态写入器
    function writeState(stateObj) {
        if (!stateFile) return;
        try {
            stateObj.updatedAt = Date.now();
            fs.writeFileSync(stateFile, JSON.stringify(stateObj, null, 2), 'utf-8');
        } catch (e) {}
    }

    let state = {
        status: 'running',
        pid: process.pid,
        total: 0,
        current: 0,
        currentFile: '',
        currentSize: '',
        uploaded: 0,
        skipped: 0,
        failed: 0,
        percent: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
        message: '正在准备同步任务...'
    };
    writeState(state);

    // 读取 Cookie
    if (!cookieFile || !fs.existsSync(cookieFile)) {
        state.status = 'failed';
        state.message = '未找到有效登录凭证，请先扫码登录！';
        writeState(state);
        console.log(JSON.stringify({ event: 'error', error: state.message }));
        cleanupLock();
        return;
    }

    const cookie = fs.readFileSync(cookieFile, 'utf-8').trim();
    if (!cookie) {
        state.status = 'failed';
        state.message = '凭证为空，请重新登录！';
        writeState(state);
        console.log(JSON.stringify({ event: 'error', error: state.message }));
        cleanupLock();
        return;
    }

    // 验证账号并拉取云盘已有歌曲构建全量查重索引
    let cloudTitleSet = new Set();
    let cloudSongsTotal = 0;
    try {
        console.log(JSON.stringify({ event: 'log', level: 'info', text: '正在验证网易云凭证并同步云盘索引...' }));
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore && offset < 5000) {
            const cloudRes = await api.user_cloud({ limit, offset, cookie });
            const list = cloudRes.body?.data || [];
            cloudSongsTotal = cloudRes.body?.count || list.length;

            list.forEach(item => {
                if (item.songName) cloudTitleSet.add(normalizeTitle(item.songName));
                if (item.fileName) cloudTitleSet.add(normalizeTitle(item.fileName));
                if (item.artist && item.songName) {
                    cloudTitleSet.add(normalizeTitle(`${item.artist}-${item.songName}`));
                }
            });

            if (cloudRes.body?.hasMore && list.length === limit) {
                offset += limit;
            } else {
                hasMore = false;
            }
        }
        console.log(JSON.stringify({
            event: 'log',
            level: 'success',
            text: `已建立云端查重索引，现有云盘曲目 ${cloudSongsTotal} 首`
        }));
    } catch (e) {
        console.log(JSON.stringify({
            event: 'log',
            level: 'warn',
            text: '获取云盘索引警告: ' + (e?.message || String(e))
        }));
    }

    // 确定待上传文件清单
    let targetFiles = [];
    if (specifiedFiles) {
        const fileNames = specifiedFiles.split(',').map(f => f.trim()).filter(Boolean);
        targetFiles = fileNames.filter(f => {
            const fullP = path.isAbsolute(f) ? f : path.join(musicDir, f);
            return fs.existsSync(fullP);
        }).map(f => path.basename(f));
    } else {
        if (fs.existsSync(musicDir)) {
            const allFiles = fs.readdirSync(musicDir);
            targetFiles = allFiles.filter(f => f.endsWith('.flac') || f.endsWith('.mp3'));
        }
    }

    if (targetFiles.length === 0) {
        state.status = 'completed';
        state.message = '未发现需要同步的音乐文件';
        state.percent = 100;
        writeState(state);
        console.log(JSON.stringify({ event: 'done', total: 0, uploaded: 0, skipped: 0, failed: 0 }));
        cleanupLock();
        return;
    }

    state.total = targetFiles.length;
    console.log(JSON.stringify({
        event: 'init',
        total: targetFiles.length,
        cloudCount: cloudSongsTotal
    }));

    for (let i = 0; i < targetFiles.length; i++) {
        const filename = targetFiles[i];
        const fullPath = path.isAbsolute(filename) ? filename : path.join(musicDir, filename);

        const normName = normalizeTitle(filename);
        const normPureTitle = normalizeTitle(filename.replace(/^[^-]+-\s*/, ''));

        state.current = i + 1;
        state.currentFile = filename;
        state.percent = Math.round(((i) / targetFiles.length) * 1000) / 10;

        // 1. 云端查重与秒级跳过
        if (cloudTitleSet.has(normName) || cloudTitleSet.has(normPureTitle)) {
            state.skipped++;
            writeState(state);
            console.log(JSON.stringify({
                event: 'skip',
                index: i + 1,
                total: targetFiles.length,
                filename: filename,
                reason: 'already_in_cloud'
            }));
            continue;
        }

        if (!fs.existsSync(fullPath)) {
            state.failed++;
            writeState(state);
            console.log(JSON.stringify({
                event: 'error',
                index: i + 1,
                total: targetFiles.length,
                filename: filename,
                error: '本地文件不存在'
            }));
            continue;
        }

        const stat = fs.statSync(fullPath);
        const sizeMb = (stat.size / 1024 / 1024).toFixed(1);
        state.currentSize = `${sizeMb} MB`;
        writeState(state);

        console.log(JSON.stringify({
            event: 'uploading',
            index: i + 1,
            total: targetFiles.length,
            filename: filename,
            size: `${sizeMb} MB`
        }));

        // 2. 执行上传，带有单曲故障重试容错（防止偶发502/网络断开杀死整个任务）
        let uploadSuccess = false;
        let lastErrorMsg = '';

        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const fileBuffer = fs.readFileSync(fullPath);
                const res = await api.cloud({
                    songFile: {
                        name: filename,
                        data: fileBuffer
                    },
                    cookie: cookie
                });

                if (res?.body && (res.body.code === 200 || res.body.code === 201)) {
                    uploadSuccess = true;
                    const songData = res.body.songData || {};
                    cloudTitleSet.add(normName);
                    cloudTitleSet.add(normPureTitle);
                    state.uploaded++;

                    console.log(JSON.stringify({
                        event: 'success',
                        index: i + 1,
                        total: targetFiles.length,
                        filename: filename,
                        songId: songData.id || 0,
                        songName: songData.name || filename
                    }));
                    break;
                } else {
                    lastErrorMsg = `返回码: ${res?.body?.code || '未知'}`;
                }
            } catch (err) {
                lastErrorMsg = err ? (err.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))) : '未知错误';
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 2500)); // 重试前等待
                }
            }
        }

        if (!uploadSuccess) {
            state.failed++;
            console.log(JSON.stringify({
                event: 'error',
                index: i + 1,
                total: targetFiles.length,
                filename: filename,
                error: lastErrorMsg
            }));
        }

        state.percent = Math.round(((i + 1) / targetFiles.length) * 1000) / 10;
        writeState(state);

        // 保护性延时，避免网易云接口并发频控
        await new Promise(r => setTimeout(r, 1500));
    }

    state.status = 'completed';
    state.percent = 100;
    state.message = `同步完成！新增: ${state.uploaded}，跳过: ${state.skipped}，失败: ${state.failed}`;
    writeState(state);

    console.log(JSON.stringify({
        event: 'done',
        total: targetFiles.length,
        uploaded: state.uploaded,
        skipped: state.skipped,
        failed: state.failed
    }));

    cleanupLock();
}

async function main() {
    switch (command) {
        case 'status':
            await handleStatus();
            break;
        case 'qr_key':
            await handleQrKey();
            break;
        case 'qr_create':
            await handleQrCreate();
            break;
        case 'qr_check':
            await handleQrCheck();
            break;
        case 'upload':
            await handleUpload();
            break;
        default:
            console.log(JSON.stringify({
                success: false,
                error: '未知指令: ' + command + '。可用指令: status, qr_key, qr_create, qr_check, upload'
            }));
            break;
    }
}

main().catch(err => {
    const msg = err ? (err.message || String(err)) : '发生严重异常';
    console.error(JSON.stringify({ success: false, error: msg }));
    cleanupLock();
    process.exit(1);
});
