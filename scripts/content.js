const DEFAULT_INJECT_JS_PATH = "/scripts/inject.js";

// 监听 chrome 消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[content] -> receive chrome message: ", request);
    const cmd = request.cmd;
    if (cmd == "content.injectJs") {
        injectJs(request.data.jsPath, function (result) {
            console.log("[content] -> inject js result: ", result);
            sendResponse(result);
        });
        return true;
    } else if (cmd == "content.load.flomo") {
        loadFlomoMemos(function (result) {
            console.log("[content] -> load flomo result: ", result);
            sendResponse(result);
        });
        return true;
    }
});

// 监听浏览器 window 对象消息，主要来自 inject.js 读取的页面数据
window.addEventListener(
    "message",
    function (message) {
        const cmd = message.cmd;
        if (cmd == "inject.flomo.memos") {
            console.log("[content] -> receive window message: ", message);
            chrome.runtime.sendMessage({ cmd: "popup.notify", data: data }, function (response) {
                console.log("[content] -> receive window  message：" + response);
            });
        }
    },
    false
);

// 获取鼠标选中内容
function getSelection() {
    // TODO：
}

// 数据复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard
        .writeText(text)
        .then(function () {
            console.log("[content] -> text to clipboard: ", text);
        })
        .catch(function (err) {
            console.log("[content] -> text to clipboard error: ", text, err);
        });
}

// 向页面注入JS
function injectJs(jsPath, callback) {
    jsPath = jsPath || DEFAULT_INJECT_JS_PATH;
    console.log("[content] -> inject js, jsPath: ", jsPath);
    let result;
    try {
        let script = document.createElement("script");
        script.setAttribute("id", "inject-scripts-id");
        script.setAttribute("type", "text/javascript");
        // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
        script.src = chrome.runtime.getURL(jsPath);
        document.body.appendChild(script);
        console.log("[content] -> inject js success: ", jsPath);
    } catch (error) {
        console.log("[content] -> inject js error: ", jsPath, error);
        result = { code: 0, message: error.message };
    }
    if (callback) {
        callback(result);
    }
}

// 发送数据到 popup
function sendMessage(cmd, data, callback) {
    console.log("[content] -> send chrome message: ", cmd, data);
    chrome.runtime.sendMessage({ cmd: cmd, data: data }, function (response) {
        if (callback) callback(response);
    });
}

// 获取所有 flomo 数据
async function loadFlomoMemos(callback) {
    let memos;
    const request = indexedDB.open("flomo");
     request.onsuccess = function (event) {
        console.log("[content] -> 数据库打开成功");
        const dbRequest = event.target.result;
        const transaction = dbRequest.transaction(["memos"], "readonly");
        const objectStore = transaction.objectStore("memos");
        const osRequest = objectStore.getAll();
        osRequest.onsuccess =  function (event) {
            memos = event.target.result;
            if(memos) {
                memos = memos.filter(o => {
                    return o.deleted_at_long <= 0;
                });
            }
            console.log("[content] -> flomo memos: ", memos);
            if (callback) {
                callback({ code: 0, message: "读取 flomo 数据成功", data: memos });
            }
        };
        osRequest.onerror = function (event) {
            console.error("[content] -> 事务失败", event);
            if (callback) {
                callback({ code: -3, message: "读取 flomo 数据失败" });
            }
        };
    };
    request.onerror = function (event) {
        console.error("[content] -> 数据库打开失败", event);
        if (callback) {
            callback({ code: -3, message: "读取 flomo 数据失败" });
        }
    };
    return memos;
}
