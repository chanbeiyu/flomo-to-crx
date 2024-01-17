// // flomo Result：
// // {
// //     "code": 0,
// //     "message": "已记录",
// //     "memo": {
// //         "creator_id": 996526,
// //         "source": "incoming_webhook",
// //         "content": "<p></p>",
// //         "tags": [],
// //         "updated_at": "2024-01-15 12:31:54",
// //         "created_at": "2024-01-15 12:31:54",
// //         "linked_memos": [],
// //         "linked_count": 0,
// //         "slug": "OTk5MzgxNzI"
// //     }
// // }

const DEFAULT_INJECT_JS_PATH = "/scripts/inject.js";

// 监听浏览器 window 对象消息，主要来自 inject.js 读取的页面数据
window.addEventListener(
    "message",
    function (message) {
        const cmd = message.cmd;
        if (cmd == "inject.flomo.memos") {
            console.log("[content] -> receive window message: ", message);
            chrome.runtime.sendMessage({ cmd: "active.notify", data: data }, function (response) {
                console.log("[content] -> receive window  message：" + response);
            });
        }
    },
    false
);

// 监听 chrome 消息，主要来自 popup 和 background.js
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[content] -> receive runtime message: ", request);
    
    const cmd = request.cmd;
    if (cmd == "active.injectJs") {
        injectJs();
        sendResponse({});
        return;
    }

    const data = request.data;
    if (cmd == "active.push.flomo") {
        pushFlomo(data);
    }
    if (cmd == "active.push.notion") {
        pushNotion(data);
    }
    sendResponse({});
});

// 发送数据到 popup
function sendMessage(cmd, data) {
    chrome.runtime.sendMessage({ cmd: "active.notify", data: data }, function (response) {
        console.log("收到来自后台的回复：" + response);
    });
}

// 发送数据到 flomo
function pushFlomo(data) {
    sendMessage("active.notify", { code: 1, message: "发送数据到 flomo 成功" });
}

// 发送数据到 notion
function pushNotion(data) {
    sendMessage("active.notify", { code: 1, message: "发送数据到 Notion 成功" });
}

// 向页面注入JS
function injectJs(jsPath) {
    jsPath = jsPath || DEFAULT_INJECT_JS_PATH;
    console.log("[content] -> inject js, jsPath: ", jsPath);

    let script = document.createElement("script");
    script.setAttribute("id", "inject-scripts-id");
    script.setAttribute("type", "text/javascript");
    // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
    script.src = chrome.runtime.getURL(jsPath);
    document.body.appendChild(script);

    console.log("[content] -> inject js success");
}
