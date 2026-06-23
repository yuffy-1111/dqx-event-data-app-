// ========== DQXツール Service Worker ==========
//
// キャッシュ戦略の設計：
//
//   network-first（常にサーバーへ、失敗時のみキャッシュ）:
//     - index.html / ルートナビゲーション  ← 起動の入口。必ず最新を取る
//     - launcher.js                         ← HTML_VERSION と LAUNCHER_VERSION の整合性チェックの対象
//     - tools-manifest.json                 ← 新規ツール検知の情報源
//
//   cache-first stale-while-revalidate（キャッシュを即返しつつ裏で更新）:
//     - tools/*.js, icons/, launcher.css など ← バージョン不一致で再読み込みが走れば自動で最新化
//
//   完全バイパス（キャッシュしない・読まない）:
//     - testtool*.js, api.github.com         ← 認証必須のため常時オンライン取得

const CACHE_VERSION = '1.0.7β+';
const CACHE_NAME = `dqx-tools-${CACHE_VERSION}`;

const PRECACHE_URLS = [
    './',
    './index.html',
    './launcher.js',
    './launcher.css',
    './manifest.webmanifest',
    './tools-manifest.json',
    './tools/checker.js',
    './tools/expmercenary.js',
    './tools/version_selector.js',
    './tools/help.js',
    './tools/settings.js',
    './tools/install.js'
];

const NEVER_CACHE_PATTERNS = [
    /testtool/i,
    /api\.github\.com/i
];

// network-first で扱うファイルのパターン
const NETWORK_FIRST_PATTERNS = [
    /\/index\.html$/,
    /\/launcher\.js$/,
    /\/tools-manifest\.json$/
];

function shouldBypassCache(url) {
    return NEVER_CACHE_PATTERNS.some(p => p.test(url));
}

function shouldNetworkFirst(url, req) {
    if (req.mode === 'navigate') return true;
    let path = url;
    try {
        path = new URL(url, self.location.origin).pathname;
    } catch (e) {}
    return NETWORK_FIRST_PATTERNS.some(p => p.test(path));
}

// ---------- install ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
            .catch((e) => console.warn('[SW] precache failed:', e))
    );
});

// ---------- activate ----------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((k) => k.startsWith('dqx-tools-') && k !== CACHE_NAME)
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// ---------- fetch ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = req.url;

    if (shouldBypassCache(url)) return;

    // ===== network-first =====
    if (shouldNetworkFirst(url, req)) {
        event.respondWith(
            fetch(req, { cache: 'no-store' })
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(req)
                        .then((cached) => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // ===== cache-first, stale-while-revalidate =====
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => cached);

            return cached || networkFetch;
        })
    );
});

// ---------- message ----------
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') self.skipWaiting();
});
