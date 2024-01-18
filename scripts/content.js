// flomo Result：
// {
//     "code": 0,
//     "message": "已记录",
//     "memo": {
//         "creator_id": 996526,
//         "source": "incoming_webhook",
//         "content": "<p></p>",
//         "tags": [],
//         "updated_at": "2024-01-15 12:31:54",
//         "created_at": "2024-01-15 12:31:54",
//         "linked_memos": [],
//         "linked_count": 0,
//         "slug": "OTk5MzgxNzI"
//     }
// }

// {
//     "content": "<p>#ReadNotes/卡片笔记写作法 #Symbol/学习动机 是优秀学生最重要的指标之一，仅次于他们掌控自己学习过程的感觉。</p><p>如果我们被一个看似不值得做的项目困住，会非常沮丧；而看到我们认同的项目在推进，则会让我们备受鼓舞。</p><p>因此，在工作的每一步，我们都可以问自己：“这件事有什么有趣的地方？”或在阅读时常常问自己：“与这件事相关的事情中，哪些值得我们记录下来？”那么，除了根据兴趣挑选信息，我们还可以对工作中遇到的问题进行详细阐释，发掘出我们以前不知道的方面，从而延伸自己的兴趣。</p><p> https://v.flomoapp.com/mine/?memo_id=OTk0MTExODY </p>",
//     "creator_id": 996526,
//     "source": "ios",
//     "tags": [
//         "ReadNotes/卡片笔记写作法",
//         "ReadNotes",
//         "Symbol/学习动机",
//         "Symbol"
//     ],
//     "pin": 0,
//     "created_at": "2024-01-11 22:57:53",
//     "updated_at": "2024-01-11 23:52:34",
//     "deleted_at": null,
//     "slug": "OTk0MTA3ODc",
//     "linked_count": 0,
//     "files": [],
//     "created_at_long": 1704985073,
//     "deleted_at_long": 0,
//     "updated_at_long": 1704988354,
//     "links": [
//         "https://v.flomoapp.com/mine/?memo_id=OTk0MTExODY"
//     ],
//     "id": 24
// }

import * as Utils from "./consts.js";

const DEFAULT_INJECT_JS_PATH = "/scripts/inject.js";

// 发送数据到 popup
function sendMessage(cmd, data, callback) {
    chrome.runtime.sendMessage({ cmd: "popup.notify", data: data }, function (response) {
        console.log("[content] -> send chrome message: " + cmd, data);
        if (callback) callback(response);
    });
}

// 监听 chrome 消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[content] -> receive chrome message: ", request);

    const cmd = request.cmd;
    if (cmd == "content.injectJs") {
        injectJs(request.data.jsPath);
        sendResponse({});
        return;
    }

    if (cmd == "content.flomoToNotion") {
        getFlomoMemos();
        sendResponse({});
        return;
    }

    const data = request.data;
    if (cmd == "content.push.flomo") {
        pushFlomo(data);
    }
    if (cmd == "content.push.notion") {
        pushNotion(data);
    }
    sendResponse({});
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

// 获取 background DOM
function getBackgroundDOM() {
    var bgPageDOM = chrome.extension.getBackgroundPage();
    //bg.test(); // 访问bg的函数
    //alert(bg.document.body.innerHTML); // 访问bg的DOM
    return bgPageDOM;
}

// 发送数据到 flomo
function pushFlomo(data) {
    sendMessage("popup.notify", { code: 1, message: "发送数据到 flomo 成功" });
}

// 发送数据到 notion
function pushNotion(data) {
    sendMessage("popup.notify", { code: 1, message: "发送数据到 Notion 成功" });
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


// flomo 数据保存到 Notion
// TODO：配置 Notion 时增加链接检测，使用数据库查询接口判断，同时判断数据库是否初始化了对应的字段，如没有，则提示初始化
function flomoToNotion() {
    // 获取 momos 数据
    const memos = Utils.loadFlomoMemos();
    // 获取 Notion 数据
    const dbResults = Utils.loadNotionDatabase();
    const map1 = new Map(
        dbResults.map((dbResult) => {
            return [dbResult.slug, dbResult];
        })
    );

    memos.forEach((memo, index) => {
        // 转换 momos 数据到 notion create page json
        const requestJSON = memo2CreateRequest(memo);
        //const requestJSON = memo2UpdateRequest(memo);
        saveNotionPage(requestJSON);
        updateNotionPage(requestJSON);
    });
}



