// Web 平台适配层：设置存储、对话框、剪贴板与提示
window.d2bt = {
    storageGetAll: function (prefix) {
        const result = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    result[key] = localStorage.getItem(key);
                }
            }
        } catch (e) {
            console.warn("d2bt.storageGetAll", e);
        }
        return JSON.stringify(result);
    },

    getItem: function (key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("d2bt.getItem", e);
            return null;
        }
    },

    setItem: function (key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("d2bt.setItem", e);
        }
    },

    confirm: function (title, message, accept, cancel) {
        const text = [title, message].filter(Boolean).join("\n\n");
        try {
            return Promise.resolve(window.confirm(text));
        } catch (e) {
            return Promise.resolve(false);
        }
    },

    prompt: function (title, message, initialValue) {
        const text = [title, message].filter(Boolean).join("\n\n");
        try {
            return Promise.resolve(window.prompt(text, initialValue ?? ""));
        } catch (e) {
            return Promise.resolve(null);
        }
    },

    actionSheet: function (title, cancel, buttons) {
        return new Promise(function (resolve) {
            const overlay = document.createElement("div");
            overlay.className = "d2bt-overlay";
            const panel = document.createElement("div");
            panel.className = "d2bt-sheet";
            if (title) {
                const heading = document.createElement("div");
                heading.className = "d2bt-sheet-title";
                heading.textContent = title;
                panel.appendChild(heading);
            }
            (buttons || []).forEach(function (text) {
                const button = document.createElement("button");
                button.type = "button";
                button.textContent = text;
                button.onclick = function () {
                    document.body.removeChild(overlay);
                    resolve(text);
                };
                panel.appendChild(button);
            });
            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "d2bt-sheet-cancel";
            cancelButton.textContent = cancel || "取消";
            cancelButton.onclick = function () {
                document.body.removeChild(overlay);
                resolve(null);
            };
            panel.appendChild(cancelButton);
            overlay.appendChild(panel);
            overlay.onclick = function (event) {
                if (event.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            };
            document.body.appendChild(overlay);
        });
    },

    toast: function (message) {
        try {
            const toast = document.createElement("div");
            toast.className = "d2bt-toast";
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.classList.add("d2bt-toast-hide");
                setTimeout(function () {
                    toast.remove();
                }, 300);
            }, 2200);
        } catch (e) {
            console.warn("d2bt.toast", e);
        }
    },

    copyText: function (text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).catch(function () {
                d2bt.fallbackCopy(text);
            });
        }
        d2bt.fallbackCopy(text);
        return Promise.resolve();
    },

    fallbackCopy: function (text) {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try {
            document.execCommand("copy");
        } catch (e) {
            console.warn("d2bt.copyText", e);
        }
        document.body.removeChild(area);
    },

    downloadText: function (fileName, text) {
        try {
            const blob = new Blob([text], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(function () {
                URL.revokeObjectURL(url);
            }, 1000);
        } catch (e) {
            console.warn("d2bt.downloadText", e);
        }
    },

    readText: function () {
        if (navigator.clipboard && navigator.clipboard.readText) {
            return navigator.clipboard.readText().catch(function () {
                return null;
            });
        }
        return Promise.resolve(null);
    },

    // 设置与 C# WebSettingsStore 共用 d2bt. 前缀与 JSON 值格式
    getSetting: function (key, fallback) {
        try {
            const raw = localStorage.getItem("d2bt." + key);
            if (raw === null) {
                return fallback;
            }
            return JSON.parse(raw);
        } catch (e) {
            console.warn("d2bt.getSetting", e);
            return fallback;
        }
    },

    setSetting: function (key, value) {
        try {
            localStorage.setItem("d2bt." + key, JSON.stringify(value));
        } catch (e) {
            console.warn("d2bt.setSetting", e);
        }
    },

    applySettings: function () {
        try {
            const font = String(d2bt.getSetting("FontInt", 0));
            document.documentElement.setAttribute("data-font", font);

            const background = String(d2bt.getSetting("BackgroundColorInt", 1));
            document.documentElement.setAttribute("data-bg", background);

            const twoColumn = d2bt.getSetting("TwoColumnLayout", true);
            document.documentElement.setAttribute("data-layout", String(twoColumn) === "false" ? "single" : "two");

            const scaleMap = { "2": 1.1, "1": 1.05, "0": 1, "-1": 0.95, "-2": 0.9 };
            const scale = scaleMap[String(d2bt.getSetting("FontSizeIndex", 0))] ?? 1;
            document.documentElement.style.removeProperty("zoom");
            document.documentElement.style.setProperty("--font-scale", String(scale));
        } catch (e) {
            console.warn("d2bt.applySettings", e);
        }
    },

    // 按需加载第三方脚本，避免首屏加载体积
    loadScript: function (src) {
        d2bt._scripts = d2bt._scripts || {};
        if (d2bt._scripts[src]) {
            return d2bt._scripts[src];
        }
        d2bt._scripts[src] = new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = new URL(src, document.baseURI).toString();
            script.async = true;
            script.onload = resolve;
            script.onerror = function () {
                reject(new Error("script load failed: " + src));
            };
            document.head.appendChild(script);
        });
        return d2bt._scripts[src];
    },

    captureBuildImage: async function (selector, hideSelectors) {
        try {
            if (typeof htmlToImage === "undefined" || typeof htmlToImage.toPng !== "function") {
                await d2bt.loadScript("js/html-to-image.js");
            }
            const element = document.querySelector(selector);
            if (!element || typeof htmlToImage === "undefined") {
                return "";
            }
            const background = (getComputedStyle(document.documentElement).getPropertyValue("--bg") || "#0d0d0d").trim();
            const hides = hideSelectors || [];
            const dataUrl = await htmlToImage.toPng(element, {
                backgroundColor: background,
                pixelRatio: Math.min(2, window.devicePixelRatio || 1),
                cacheBust: true,
                width: element.scrollWidth,
                height: element.scrollHeight,
                filter: function (node) {
                    if (!node || typeof node.matches !== "function") {
                        return true;
                    }
                    return !hides.some(function (hide) {
                        return node.matches(hide);
                    });
                }
            });
            return dataUrl || "";
        } catch (e) {
            console.warn("d2bt.captureBuildImage", e);
            return "";
        }
    },

    saveBuildImage: async function (selector, hideSelectors) {
        try {
            const dataUrl = await d2bt.captureBuildImage(selector, hideSelectors);
            if (!dataUrl) {
                return false;
            }
            const now = new Date();
            const pad = function (value) {
                return String(value).padStart(2, "0");
            };
            const name = "TD2Build"
                + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
                + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds())
                + ".png";
            const link = document.createElement("a");
            link.href = dataUrl;
            link.download = name;
            document.body.appendChild(link);
            link.click();
            link.remove();
            return true;
        } catch (e) {
            console.warn("d2bt.saveBuildImage", e);
            return false;
        }
    },

    copyBuildImage: async function (selector, hideSelectors) {
        try {
            if (!navigator.clipboard || !window.ClipboardItem) {
                return false;
            }
            const dataUrl = await d2bt.captureBuildImage(selector, hideSelectors);
            if (!dataUrl) {
                return false;
            }
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            return true;
        } catch (e) {
            console.warn("d2bt.copyBuildImage", e);
            return false;
        }
    },

    decodeQrImage: async function (dataUrl) {
        try {
            if (typeof jsQR !== "function") {
                await d2bt.loadScript("js/jsQR.js");
            }
            if (typeof jsQR !== "function") {
                return "";
            }
            const image = new Image();
            await new Promise(function (resolve, reject) {
                image.onload = resolve;
                image.onerror = reject;
                image.src = dataUrl;
            });
            const canvas = document.createElement("canvas");
            canvas.width = image.naturalWidth || image.width;
            canvas.height = image.naturalHeight || image.height;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
            return code && code.data ? code.data : "";
        } catch (e) {
            console.warn("d2bt.decodeQrImage", e);
            return "";
        }
    },

    reload: function () {
        location.reload();
    },

    // 配装页全局快捷键：由页面注册，离开页面时注销
    registerShortcuts: function (dotNetRef) {
        d2bt.unregisterShortcuts();
        d2bt._shortcutRef = dotNetRef;
        d2bt._shortcutHandler = function (event) {
            if (event.repeat) {
                return;
            }
            const target = event.target;
            const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
            const typing = tag === "input" || tag === "select" || tag === "textarea" || (target && target.isContentEditable);
            const send = function (action) {
                try {
                    dotNetRef.invokeMethodAsync("OnShortcut", action);
                } catch (e) {
                    console.warn("d2bt.shortcut", e);
                }
            };

            if (event.key === "Escape") {
                send("escape");
                return;
            }
            if (typing || event.metaKey) {
                return;
            }
            if (event.altKey) {
                if (event.key >= "1" && event.key <= "3") {
                    event.preventDefault();
                    send("calc:" + (Number(event.key) - 1));
                }
                return;
            }
            if (event.ctrlKey) {
                if (event.key.toLowerCase() === "s") {
                    event.preventDefault();
                    send("save");
                }
                return;
            }

            const key = event.key;
            const lower = key.toLowerCase();
            const digit = /^Digit([1-3])$/.exec(event.code || "");
            if (digit) {
                event.preventDefault();
                const index = Number(digit[1]) - 1;
                send((event.shiftKey ? "weapon:" : "select:") + index);
                return;
            }

            const pickMap = { q: 0, w: 1, a: 2, s: 3, z: 4, x: 5 };
            if (Object.prototype.hasOwnProperty.call(pickMap, lower)) {
                event.preventDefault();
                send("pick:" + pickMap[lower]);
                return;
            }
            if (/^F[1-4]$/.test(key)) {
                event.preventDefault();
                send("tab:" + (Number(key.slice(1)) - 1));
                return;
            }
            if (key === "?" || (key === "/" && event.shiftKey)) {
                event.preventDefault();
                send("help");
            }
        };
        document.addEventListener("keydown", d2bt._shortcutHandler);
    },

    unregisterShortcuts: function () {
        if (d2bt._shortcutHandler) {
            document.removeEventListener("keydown", d2bt._shortcutHandler);
            d2bt._shortcutHandler = null;
        }
        d2bt._shortcutRef = null;
    },

    // 页面隐藏或关闭时同步保存当前配装草稿；引用由页面创建和释放，这里只管理监听器。
    registerPageSave: function (dotNetRef) {
        d2bt.unregisterPageSave();
        d2bt._pageSaveRef = dotNetRef;
        d2bt._pageSaveHandler = function () {
            const target = d2bt._pageSaveRef;
            if (!target) {
                return;
            }
            try {
                target.invokeMethod("SaveDraftSync");
            } catch (e) {
                console.warn("d2bt.pageSave", e);
            }
        };
        d2bt._pageSaveVisibilityHandler = function () {
            if (document.visibilityState === "hidden") {
                d2bt._pageSaveHandler();
            }
        };
        window.addEventListener("pagehide", d2bt._pageSaveHandler);
        document.addEventListener("visibilitychange", d2bt._pageSaveVisibilityHandler);
    },

    unregisterPageSave: function () {
        if (d2bt._pageSaveHandler) {
            window.removeEventListener("pagehide", d2bt._pageSaveHandler);
            d2bt._pageSaveHandler = null;
        }
        if (d2bt._pageSaveVisibilityHandler) {
            document.removeEventListener("visibilitychange", d2bt._pageSaveVisibilityHandler);
            d2bt._pageSaveVisibilityHandler = null;
        }
        d2bt._pageSaveRef = null;
    },

    // 注册离线 Service Worker；地址基于 <base href> 解析，兼容 / 与 /web/ 子路径
    registerServiceWorker: function () {
        if (!("serviceWorker" in navigator)) {
            return;
        }
        // 本地调试禁用离线缓存：旧缓存会让 launch.json 启动后仍看到上一次的页面样式
        if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname)) {
            navigator.serviceWorker.getRegistrations().then(function (regs) {
                regs.forEach(function (reg) { reg.unregister(); });
            }).catch(function () { });
            return;
        }
        window.addEventListener("load", function () {
            try {
                const url = new URL("serviceworker.js", document.baseURI).toString();
                navigator.serviceWorker.register(url).catch(function (e) {
                    console.warn("d2bt.registerServiceWorker", e);
                });
            } catch (e) {
                console.warn("d2bt.registerServiceWorker", e);
            }
        });
    }
};

d2bt.registerServiceWorker();
