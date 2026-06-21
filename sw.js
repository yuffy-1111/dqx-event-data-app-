// ========== DQXツール Service Worker ==========
// キャッシュ名はバージョンを含める。launcher.js の APP_VERSION と
// tools-manifest.json の launcherVersion を更新するタイミングで
// 必ずこの値も更新すること（更新しないと古いキャッシュが残り続ける）。
const CACHE_VERSION = '3.2.4b';
const CACHE_NAME = `dqx-tools-${CACHE_VERSION}`;

// 起動直後に必要な「殻」となるファイル群（通常ツールのみ）
// テストツール（testtool*.js）は認証必須のため意図的に含めない。
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
    './tools/settings.js'
];

// このパターンに一致するリクエストはキャッシュせず、常にネットワークへ
// （テストツール本体、GitHub APIへの認証付きリクエストなど）
const NEVER_CACHE_PATTERNS = [
    /testtool/i,
    /api\.github\.com/i
];

function shouldBypassCache(url) {
    return NEVER_CACHE_PATTERNS.some(pattern => pattern.test(url));
}

// ---------- install: 殻となるファイルを事前キャッシュ ----------
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
            .catch((e) => console.warn('[SW] precache failed:', e))
    );
});

// ---------- activate: 古いバージョンのキャッシュを削除 ----------
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key.startsWith('dqx-tools-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ---------- fetch: リクエスト振り分け ----------
self.addEventListener('fetch', (event) => {
    const req = event.request;

    // GET以外（POSTなど）はそのままネットワークへ
    if (req.method !== 'GET') return;

    const url = req.url;

    // 認証付き・テストツール関連は完全にバイパス（キャッシュしない・読まない）
    if (shouldBypassCache(url)) {
        return; // ブラウザのデフォルト挙動（素通し）に任せる
    }

    // tools-manifest.json はネットワーク優先（バージョン・新規ツール検知の要）
    // 失敗時のみキャッシュにフォールバックし、本体機能は止めない
    if (url.includes('tools-manifest.json')) {
        event.respondWith(
            fetch(req, { cache: 'no-store' })
                .then((res) => {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    return res;
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    // それ以外の静的ファイルは stale-while-revalidate
    // （即座にキャッシュを返しつつ、裏でネットワーク取得して次回分を更新）
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req)
                .then((res) => {
                    if (res && res.status === 200) {
                        const resClone = res.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    }
                    return res;
                })
                .catch(() => cached); // オフライン時はキャッシュへフォールバック

            return cached || networkFetch;
        })
    );
});

// ---------- メッセージ: ページ側からの強制更新指示を受け付け ----------
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
