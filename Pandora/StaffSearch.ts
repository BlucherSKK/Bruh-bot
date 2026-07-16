import express from 'express';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { ContentChannels, BOT_DIR, TAG_MAPPING } from './constants';
import { type Client } from 'discord.js';
import { bruh_notify, BruhNotifyType } from './note';
import { spawn } from 'node:child_process';
import { GELBOORU_USER_ID, GELBOORU_API_KEY} from '../gelbu.json';


const MAX_SIZE = 10 * 1024 * 1024;
const DOWNLOAD_DIR = path.join(BOT_DIR, "/content");
const PORT = 3000;

const TAGS_FILE = path.join(process.cwd(), 'Pandora', 'active_tags.txt');

const TOTAL_LIMIT = 500;


const axiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://gelbooru.com/index.php?page=post&s=list'
    }
};

function getActiveTags(): string[] {
    try {
        if (fs.existsSync(TAGS_FILE)) {
            const data = fs.readFileSync(TAGS_FILE, 'utf-8');
            const tags = data.split('\n').map(t => t.trim()).filter(t => t.length > 0);
            console.log("Loaded active tags:", tags);
            return tags;
        }
    } catch (e) {
        console.error("Failed to load active tags", e);
    }
    console.log("Using default TAG_MAPPING keys");
    return Object.keys(TAG_MAPPING);
}

function saveActiveTags(tags: string[]) {
    try {
        fs.ensureFileSync(TAGS_FILE);
        fs.writeFileSync(TAGS_FILE, tags.join('\n'));
        console.log("Saved active tags:", tags);
    } catch (e) {
        console.error("Failed to save active tags", e);
    }
}

async function optimizeImage(filePath: string): Promise<boolean> {
    try {
        if (!(await fs.pathExists(filePath))) return false;
        const stats = await fs.stat(filePath);
        if (stats.size <= MAX_SIZE) return true;

        const ext = path.extname(filePath).toLowerCase();
        const directory = path.dirname(filePath);
        const fileName = path.basename(filePath, ext);
        const tempJpgPath = path.join(directory, `${fileName}_tmp.jpg`);
        const finalJpgPath = path.join(directory, `${fileName}.jpg`);

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', ['-y', '-i', filePath, '-q:v', '4', tempJpgPath]);
            ffmpeg.on('close', (code) => code === 0 ? resolve(true) : reject());
            ffmpeg.on('error', reject);
        });

        await fs.remove(filePath);
        const newStats = await fs.stat(tempJpgPath);
        if (newStats.size > MAX_SIZE) {
            await fs.remove(tempJpgPath);
            return false;
        }
        await fs.move(tempJpgPath, finalJpgPath, { overwrite: true });
        return true;
    } catch (err) {
        if (await fs.pathExists(filePath)) await fs.remove(filePath);
        return false;
    }
}

function getFolderIdByName(name: string): string | null {
    const entry = Object.entries(ContentChannels).find(([id, val]) => val === name);
    return entry ? entry[0] : null;
}

const app = express();
app.use(express.json());

app.get('/api/tags', (req: any, res: any) => {
    res.json(getActiveTags());
});

app.post('/api/tags', (req: any, res: any) => {
    if (Array.isArray(req.body.tags)) {
        saveActiveTags(req.body.tags);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false });
    }
});

/**
 * ПРОКСИ ДЛЯ КАРТИНОК (Для быстрого обхода CORS и Hotlinking)
 */
app.get('/proxy', async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('No URL');

    try {
        const response = await axios.get(imageUrl, {
            ...axiosConfig,
            responseType: 'stream',
            timeout: 10000
        });
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send('Proxy error');
    }
});

/**
 * API С ПОТОКОВОЙ ПОДГРУЗКОЙ (SSE)
 */
app.get('/api/images', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let isClosed = false;
    req.on('close', () => { isClosed = true; });

    const currentTags = getActiveTags();
    const ITEMS_PER_TAG = Math.floor(TOTAL_LIMIT / (currentTags.length || 1));
    const addedIds = new Set();

    for (const tag of currentTags) {
        if (isClosed) break;

        const mapping = TAG_MAPPING[tag];
        let targetNames = mapping ? (Array.isArray(mapping) ? mapping : [mapping]) : [];
        
        let targets = targetNames
        .map(name => ({ name, id: getFolderIdByName(name) }))
        .filter(t => t.id !== null);

        // Если тег не из стандартного списка, даём возможность сохранить в любой канал
        if (targets.length === 0) {
            targets = Object.entries(ContentChannels).map(([id, name]) => ({ id, name }));
        }

        if (targets.length === 0) continue;

        try {
            await new Promise(r => setTimeout(r, 1000));

            const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tag)}&limit=${ITEMS_PER_TAG}&api_key=${GELBOORU_API_KEY}&user_id=${GELBOORU_USER_ID}`;

            const response = await axios.get(url, axiosConfig);
            const data = response.data?.post;

            if (data && Array.isArray(data)) {
                const processed = [];
                for (const i of data) {
                    if (addedIds.has(i.id)) continue;
                    
                    let alreadyDownloaded = false;
                    const ext = path.extname(new URL(i.file_url).pathname) || '.jpg';
                    for (const t of targets) {
                        const targetDir = path.join(DOWNLOAD_DIR, t.id!);
                        const originalFile = path.join(targetDir, `${i.id}${ext}`);
                        const jpgFile = path.join(targetDir, `${i.id}.jpg`);
                        
                        if (await fs.pathExists(originalFile) || await fs.pathExists(jpgFile)) {
                            alreadyDownloaded = true;
                            break;
                        }
                    }

                    if (alreadyDownloaded) continue;

                    addedIds.add(i.id);
                    processed.push({
                        id: i.id,
                        previewUrl: i.preview_url,
                        sampleUrl: i.sample_url,
                        fullUrl: i.file_url,
                        tagUsed: tag,
                        targets: targets,
                        width: i.width,
                        height: i.height
                    });
                }

                if (processed.length > 0) {
                    res.write(`data: ${JSON.stringify(processed)}\n\n`);
                }
            }
        } catch (e: any) {
            console.error(`Tag ${tag} failed:`, e.response?.status === 401 ? 'Unauthorized' : e.message);
            res.write(`data: []\n\n`);
        }
    }
    res.write('event: end\ndata: done\n\n');
    res.end();
});

/**
 * Сохранение изображения
 */
app.post('/api/save', async (req, res) => {
    const { fullUrl, folder, id } = req.body;
    const targetDir = path.join(DOWNLOAD_DIR, folder);

    try {
        await fs.ensureDir(targetDir);

        const ext = path.extname(new URL(fullUrl).pathname) || '.jpg';
        const currentFilePath = path.join(targetDir, `${id}${ext}`);

        const response = await axios.get(fullUrl, {
            ...axiosConfig,
            responseType: 'arraybuffer'
        });

        await fs.writeFile(currentFilePath, response.data);
        const isOk = await optimizeImage(currentFilePath);
        res.json({ success: isOk });
    } catch (e: any) {
        console.error(`Save failed for ${id}:`, e.message);
        res.status(500).json({ success: false });
    }
});

const html = `<!DOCTYPE html>
<html>
<head>
<title>Staff Search</title>
<style>
body { background: #111; color: #ccc; font-family: 'Segoe UI', sans-serif; display: flex; height: 100vh; margin: 0; overflow: hidden; }
#sidebar { width: 300px; background: #222; padding: 20px; display: flex; flex-direction: column; gap: 10px; border-right: 2px solid #333; z-index: 10; }
#sidebar h3 { margin: 0 0 10px 0; color: #fff; }
#sidebar textarea { flex: 1; background: #111; color: #ccc; border: 1px solid #444; border-radius: 4px; padding: 10px; resize: none; font-family: monospace; white-space: pre; }
#sidebar button { padding: 10px; background: #0096fa; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
#sidebar button:active { transform: scale(0.95); }
#main-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; overflow-y: auto; }
.img-wrapper {
    background: #000; border: 3px solid #333; border-radius: 12px; overflow: hidden;
    box-shadow: 0 20px 50px rgba(0,0,0,0.8); margin-bottom: 20px;
    position: relative; min-width: 400px; min-height: 500px;
    display: flex; align-items: center; justify-content: center;
}
#display { height: 75vh; width: auto; display: block; object-fit: contain; z-index: 2; transition: opacity 0.2s; }
.controls { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; max-width: 90%; margin-bottom: 20px; }
.action-btn { padding: 15px 35px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: 0.2s; }
.action-btn:active { transform: scale(0.95); }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.save { background: #0096fa; color: white; }
.drop { background: #444; color: #aaa; }
#info { margin-bottom: 10px; margin-top: 20px; font-family: monospace; font-size: 15px; }
#loaderBox { position: absolute; z-index: 1; text-align: center; }
.loader {
    width: 40px; height: 40px; border: 4px solid #333; border-bottom-color: #0096fa;
    border-radius: 50%; animation: rotation 1s linear infinite; display: inline-block;
}
@keyframes rotation { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
.badge { background: #333; padding: 2px 8px; border-radius: 4px; margin: 0 4px; font-weight: bold; }
</style>
</head>
<body>
<div id="sidebar">
    <h3>Active Tags</h3>
    <textarea id="tagsInput"></textarea>
    <button onclick="saveTags()">Save & Reload</button>
</div>
<div id="main-content">
    <div id="info">Waiting for data...</div>
    <div class="img-wrapper">
        <div id="loaderBox" style="display:none;"><span class="loader"></span><br>Loading Image...</div>
        <img id="display" src="" />
    </div>
    <div class="controls" id="btnContainer"></div>
</div>

<script>
let list = [];
let index = 0;
let eventSource = null;

async function loadTags() {
    try {
        const res = await fetch('/api/tags');
        const tags = await res.json();
        document.getElementById('tagsInput').value = tags.join('\\n');
    } catch(e) { console.error(e); }
}

async function saveTags() {
    const text = document.getElementById('tagsInput').value;
    const tags = text.split('\\n').map(t => t.trim()).filter(t => t.length > 0);
    try {
        await fetch('/api/tags', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ tags })
        });
        location.reload(); // Reload
    } catch(e) { console.error(e); }
}

function init() {
    list = []; index = 0;
    document.getElementById('display').src = '';
    document.getElementById('display').style.opacity = '0';
    document.getElementById('info').innerHTML = 'Loading...';
    document.getElementById('btnContainer').innerHTML = '';
    
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/images');

    eventSource.onmessage = (event) => {
        const newData = JSON.parse(event.data);
        const isFirstLoad = list.length === 0;
        list.push(...newData);
        if (isFirstLoad && list.length > 0) render();
        else if (index === list.length - newData.length) render(); // if we were waiting at the end
    };

    eventSource.addEventListener('end', () => {
        eventSource.close();
        document.getElementById('info').innerHTML += " <span style='color:#0096fa'>[All loaded]</span>";
        if (list.length === 0) {
            document.getElementById('info').innerHTML = "No new images found for these tags.";
        }
    });
}

function render() {
    if (index >= list.length || index < 0) return;
    const item = list[index];
    const display = document.getElementById('display');
    const loaderBox = document.getElementById('loaderBox');
    const container = document.getElementById('btnContainer');

    display.style.opacity = "0";
    loaderBox.style.display = "block";

    display.src = '/proxy?url=' + encodeURIComponent(item.sampleUrl || item.previewUrl);

    display.onload = () => {
        display.style.opacity = "1";
        loaderBox.style.display = "none";
    };

    updateCounter();

    container.innerHTML = '<button class="action-btn drop" onclick="prev()">BACK (Backspace)</button>';
    container.innerHTML += '<button class="action-btn drop" onclick="next()">SKIP (Esc)</button>';
    item.targets.forEach(t => {
        const b = document.createElement('button');
        b.className = 'action-btn save';
        b.innerText = item.targets.length > 1 ? "SAVE TO " + t.name : "SAVE (Space)";
        b.onclick = () => doSave(t.id);
        container.appendChild(b);
    });
}

function updateCounter() {
    const item = list[index];
    if (item) {
        document.getElementById('info').innerHTML =
        "ITEM " + (index + 1) + " / " + list.length +
        " | <span class='badge'>" + item.width + "x" + item.height + "</span>" +
        " | TAG: <span class='badge'>#" + item.tagUsed + "</span>";
    }
}

function next() {
    if (index < list.length - 1) {
        index++;
        render();
    } else {
        document.getElementById('info').innerHTML = "End of list";
    }
}

function prev() {
    if (index > 0) {
        index--;
        render();
    }
}

async function doSave(folderId) {
    const item = list[index];
    const buttons = document.querySelectorAll('.action-btn');
    buttons.forEach(b => b.disabled = true);
    try {
        await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ fullUrl: item.fullUrl, folder: folderId, id: item.id })
        });
    } catch (e) { console.error("Save failed", e); }
    buttons.forEach(b => b.disabled = false);
    next();
}

window.addEventListener('keydown', (e) => {
    if (e.target.tagName.toLowerCase() === 'textarea') return;
    
    if (e.code === 'Space') { e.preventDefault(); if(list[index]) doSave(list[index].targets[0].id); }
    if (e.code === 'Escape') { e.preventDefault(); next(); }
    if (e.code === 'Backspace') { e.preventDefault(); prev(); }
});

loadTags();
init();
</script>
</body>
</html>`;

app.get('/', (req, res) => res.send(html));

export function startStaffSearch(client: Client) {
    app.listen(PORT, () => {
        bruh_notify(`Staff Search поднят на [blucherhomelab](http://pixivhandler.blucherhomelab)`, client, BruhNotifyType.PixivServerUP);
    });
}
