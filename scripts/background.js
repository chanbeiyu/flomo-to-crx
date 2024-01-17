import { Menus } from "./consts.js";

chrome.runtime.onInstalled.addListener(async () => {

    // 注册页面右键菜单
    for (const [key, name] of Object.entries(Menus)) {
        chrome.contextMenus.create({
            id: key,
            title: name,
            type: "normal",
            contexts: ["selection"], // 只有当选中文字时才会出现此右键菜单
        });
    }
});

chrome.contextMenus.onClicked.addListener((item, tab) => {
    const key = item.menuItemId;
    const pageUrl = item.pageUrl;
    const selectionText = item.selectionText;
    
    console.log("onClicked: " + JSON.stringify(item))
});

// chrome.browserAction.setBadgeText({ text: 'new' });
// chrome.browserAction.setBadgeBackgroundColor({ color: [255, 0, 0, 255] });

// Add or removes the locale from context menu
// when the user checks or unchecks the locale in the popup
// chrome.storage.onChanged.addListener(({ enabledTlds }) => {
//     if (typeof enabledTlds === 'undefined') return;

//     const allTlds = Object.keys(tldLocales);
//     const currentTlds = new Set(enabledTlds.newValue);
//     const oldTlds = new Set(enabledTlds.oldValue ?? allTlds);
//     const changes = allTlds.map((tld) => ({
//         tld,
//         added: currentTlds.has(tld) && !oldTlds.has(tld),
//         removed: !currentTlds.has(tld) && oldTlds.has(tld)
//     }));

//     for (const { tld, added, removed } of changes) {
//         if (added) {
//             chrome.contextMenus.create({
//                 id: tld,
//                 title: tldLocales[tld],
//                 type: 'normal',
//                 contexts: ['selection']
//             });
//         } else if (removed) {
//             chrome.contextMenus.remove(tld);
//         }
//     }
// });

