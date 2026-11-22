// 网页版离线支持：预缓存应用外壳，离线时回退到缓存的 index.html
const CACHE_VERSION = "v19";
const SHELL_CACHE = `d2bt-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `d2bt-assets-${CACHE_VERSION}`;
const SHELL_PREFIX = "d2bt-";

// 所有地址都基于 Service Worker 作用域解析，兼容 / 与 /web/ 等子路径部署
const scopeUrl = path => new URL(path, self.registration.scope).toString();

const SHELL_FILES = [
    "",
    "index.html",
    "css/app.css",
    "js/platform.js",
    "manifest.webmanifest",
    "favicon-app.png",
    "icon-192.png",
    "icon-512.png",
    "fonts/HKYTW3_Borda.ttf",
    "_framework/blazor.webassembly.js",
    "_framework/blazor.boot.json",
    "_framework/dotnet.js"
];

// 这些文件用网络优先，离线时回退缓存，避免发布后继续使用旧启动文件
const NETWORK_FIRST_FILES = new Set([
    scopeUrl("_framework/blazor.webassembly.js"),
    scopeUrl("_framework/blazor.boot.json")
]);

const STATIC_EXTENSIONS = /\.(css|js|png|jpe?g|gif|svg|webp|ico|ttf|otf|woff2?)$/i;

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL_CACHE);
        await Promise.all(SHELL_FILES.map(async file => {
            try {
                await cache.add(new Request(scopeUrl(file), { cache: "reload" }));
            } catch (e) {
                // 单个文件失败不阻断安装，例如开发服务器尚未生成 _framework
                console.warn("[sw] 预缓存失败", file, e);
            }
        }));
        await cacheBootModules(cache);
        await self.skipWaiting();
    })());
});

// 提前缓存 dotnet.js 动态加载的模块，保证首次访问后即可离线启动
async function cacheBootModules(cache) {
    try {
        const response = await fetch(scopeUrl("_framework/blazor.boot.json"), { cache: "reload" });
        if (!response.ok) {
            return;
        }
        const boot = await response.json();
        const resources = boot.resources || {};
        const modules = new Set();
        Object.values(resources).forEach(group => {
            if (group && typeof group === "object" && !Array.isArray(group)) {
                Object.keys(group).forEach(name => {
                    if (name.endsWith(".js")) {
                        modules.add(name);
                    }
                });
            }
        });
        await Promise.all(Array.from(modules).map(async name => {
            try {
                await cache.add(new Request(scopeUrl("_framework/" + name), { cache: "reload" }));
            } catch (e) {
                console.warn("[sw] 预缓存启动模块失败", name, e);
            }
        }));
    } catch (e) {
        console.warn("[sw] 读取 blazor.boot.json 失败", e);
    }
}

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith(SHELL_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(handleNavigate(request));
        return;
    }

    if (NETWORK_FIRST_FILES.has(url.href)) {
        event.respondWith(networkFirst(request));
        return;
    }

    // dotnet.js 动态导入的启动模块需要离线可用，其余启动资源交给 Blazor 自身缓存
    if (url.pathname.includes("/_framework/") && url.pathname.endsWith(".js")) {
        event.respondWith(networkFirst(request));
        return;
    }

    if (url.pathname.includes("/_framework/")) {
        return;
    }

    if (STATIC_EXTENSIONS.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, event));
    }
});

async function handleNavigate(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            return response;
        }
        return (await cachedIndex()) || response;
    } catch (e) {
        const cached = await cachedIndex();
        if (cached) {
            return cached;
        }
        return new Response(
            "<!DOCTYPE html><meta charset=\"utf-8\"><title>离线</title><p>当前处于离线状态，且页面尚未缓存。</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
}

async function cachedIndex() {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(scopeUrl("index.html")))
        || (await cache.match(self.registration.scope))
        || null;
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
            return response;
        }
        const cached = await caches.match(request);
        return cached || response;
    } catch (e) {
        const cached = await caches.match(request);
        return cached || new Response("", { status: 504 });
    }
}

async function staleWhileRevalidate(request, event) {
    const cache = await caches.open(ASSET_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then(async response => {
        if (response && response.ok) {
            await cache.put(request, response.clone());
        }
        return response;
    }).catch(() => null);

    // 命中缓存时用 waitUntil 保持后台更新，避免 Service Worker 提前退出
    if (cached) {
        event.waitUntil(network);
        return cached;
    }

    const response = await network;
    return response || new Response("", { status: 504 });
}
