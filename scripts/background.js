import { Menus } from "./consts.js";

// 访问 popup
// var views = chrome.extension.getViews({ type: "popup" });
// if (views.length > 0) {
//     console.log(views[0].location.href);
// }

// 发送消息
function sendMessage(cmd, data, callback) {
    console.log("[background] -> send chrome message: " + cmd, data);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {cmd: cmd, data: data}, function (response) {
            if (callback) callback(response);
        });
    });
}

// 监听消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[background] -> receive chrome message: ", request);

    const cmd = request.cmd;
    const data = request.data;
    

    sendResponse({});
});


// 注册页面右键菜单
chrome.runtime.onInstalled.addListener(async () => {
    for (const [key, name] of Object.entries(Menus)) {
        chrome.contextMenus.create({
            id: key,
            title: name,
            type: "normal",
            contexts: ["selection"], // 只有当选中文字时才会出现此右键菜单
        });
    }
});

// 右键事件监听
chrome.contextMenus.onClicked.addListener((item, tab) => {
    const key = item.menuItemId;
    const pageUrl = item.pageUrl;
    const selectionText = item.selectionText;
    console.log("onClicked: " + JSON.stringify(item))
});


