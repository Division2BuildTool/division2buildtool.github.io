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
            const background = String(d2bt.getSetting("BackgroundColorInt", 1));
            document.documentElement.setAttribute("data-bg", background);

            const zoomMap = { "2": 1.1, "1": 1.05, "0": 1, "-1": 0.95, "-2": 0.9 };
            const zoom = zoomMap[String(d2bt.getSetting("FontSizeIndex", 0))] ?? 1;
            document.documentElement.style.zoom = String(zoom);
        } catch (e) {
            console.warn("d2bt.applySettings", e);
        }
    },

    reload: function () {
        location.reload();
    },

    // 注册离线 Service Worker；地址基于 <base href> 解析，兼容 / 与 /web/ 子路径
    registerServiceWorker: function () {
        if (!("serviceWorker" in navigator)) {
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
