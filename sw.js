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

const CACHE_VERSION = '1.0.5β+';
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
// launcher.js は tools/ 配下のツール本体（tools/xxx.js）と区別するため
// パス末尾で判定する
const NETWORK_FIRST_PATTERNS = [
    /\/index\.html$/,
    /\/launcher\.js$/,
    /\/tools-manifest\.json$/
];

function shouldBypassCache(url) {
    return NEVER_CACHE_PATTERNS.some(p => p.test(url));
}

function shouldNetworkFirst(url, req) {
    // ページナビゲーション（アドレスバー入力・リロード等）は常に network-first
    if (req.mode === 'navigate') return true;
    let path = url;
    try {
        path = new URL(url, self.location.origin).pathname;
    } catch (e) {
        // 失敗した場合はそのまま URL 文字列を使う
    }
    return NETWORK_FIRST_PATTERNS.some(p => p.test(path));
}

// クエリパラメータを除去したURLでキャッシュキーを正規化する
// ?v=1.0.1β+ のようなキャッシュバスターが付いていても同じキーで保存・参照する
function normalizeUrl(url) {
    try {
        const u = new URL(url);
        u.search = '';
        return u.toString();
    } catch (e) {
        return url.split('?')[0];
    }
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

    // 認証付き・テストツールは完全素通し
    if (shouldBypassCache(url)) return;

    // ===== network-first =====
    // index.html / launcher.js / tools-manifest.json
    // → 常にサーバーへ。失敗（オフライン）時のみキャッシュから返す
    if (shouldNetworkFirst(url, req)) {
        event.respondWith(
            fetch(req, { cache: 'no-store' })
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        const normReq = new Request(normalizeUrl(req.url));
                        caches.open(CACHE_NAME).then((c) => c.put(normReq, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(normalizeUrl(req.url))
                        .then((cached) => cached || caches.match('./index.html'))
                )
        );
        return;
    }

    // ===== cache-first, stale-while-revalidate =====
    // tools/*.js, icons/, launcher.css など
    // → キャッシュを即座に返しつつ、裏でネットワーク取得して次回用に更新
    // index.html/launcher.jsのバージョン不一致で再読み込みが走ると、
    // ここも一緒に最新キャッシュへ置き換わる
    const normReq = new Request(normalizeUrl(req.url));
    event.respondWith(
        caches.match(normReq).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then((c) => c.put(normReq, clone));
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
