import * as Utils from "./utils.js";

const Menus = {
    flomo: "添加到 flomo",
    notion: "添加到 Notion",
    markdown: "复制到 Markdown",
};

// 访问 popup
// var views = chrome.extension.getViews({ type: "popup" });
// if (views.length > 0) {
//     console.log(views[0].location.href);
// }

const Notion = {
    versionName: "Notion-Version",
    versionValue: "2022-06-28",
    createJSON: "/data/notion-create-page.json",
    initdbJSON: "/data/notion-init-db.json",
    initMemoJSON: "/data/notion-init-memo.json",
};
const Flomo = {
    linkURL: "https://v.flomoapp.com/mine/?memo_id=",
};

// 注册页面右键菜单
// chrome.runtime.onInstalled.addListener(async () => {
//     chrome.action.setBadgeText({
//         text: "OFF",
//     });
//     for (const [key, name] of Object.entries(Menus)) {
//         chrome.contextMenus.create({
//             id: key,
//             title: name,
//             type: "normal",
//             contexts: ["selection"], // 只有当选中文字时才会出现此右键菜单
//         });
//     }
// });

// 右键事件监听
// chrome.contextMenus.onClicked.addListener((item, tab) => {
//     const key = item.menuItemId;
//     const pageUrl = item.pageUrl;
//     const selectionText = item.selectionText;
//     console.log("onClicked: " + JSON.stringify(item));
// });

// 监听消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[background] -> receive chrome message: ", request);
    const cmd = request.cmd;
    const data = request.data;
    if (cmd == "background.flomoToNotion") {
        flomoToNotion(data.databaseId, data.memos, function (result) {
            console.log("[background] -> flomo to notion result: ", result);
            sendResponse(result);
        });
        return true;
    } else if (cmd == "background.send.flomo") {
        sendFlomo(data.content, data.title, data.url, function (result) {
            console.log("[background] -> send flomo result: ", result);
            sendResponse(result);
        });
        return true;
    } else if (cmd == "background.send.notion") {
        sendNotion(data.databaseId, data.content, data.title, data.url, function (result) {
            console.log("[background] -> send notion result: ", result);
            sendResponse(result);
        });
        return true;
    }
});

// 加载 JSON
async function loadJSON(jsonPath) {
    console.log("[background] -> load json path: ", jsonPath);
    let _json;
    await fetch(chrome.runtime.getURL(jsonPath))
        .then((response) => response.json())
        .then((json) => {
            _json = json;
        });
    console.log("[background] -> load json result: ", _json);
    return _json;
}

// 发送数据到 flomo
async function sendFlomo(content, title, url, callback) {
    let result = { code: -1, message: "flomo: 保存失败！" };

    let flomoApi;
    await chrome.storage.local.get(["flomoApi"]).then((result) => {
        flomoApi = result["flomoApi"];
    });

    const requestBody = JSON.stringify({ content: `${title}<p>${content}<p>${url}` });
    console.log("[background] -> send flomo body:", requestBody);

    await fetch(flomoApi, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            result = { code: data.code, message: `flomo: ${data.message}` };
            console.log("[background] -> send flomo success: ", result);
        })
        .catch((error) => {
            result = { code: -2, message: "flomo: 请求失败，请检查网络链接" };
            console.error("[background] -> send flomo error: ", result);
        });
    if (callback) {
        callback(result);
    } else {
        Utils.sendMessage("popup.notify", result);
    }
}

async function notionHeaders() {
    const notionApiKey = (await chrome.storage.local.get(["notionApiKey"]))["notionApiKey"];
    let headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", "Bearer " + notionApiKey);
    headers.append(Notion.versionName, Notion.versionValue);
    return headers;
}

// 发送数据到 Notion
async function sendNotion(databaseId, content, title, url, callback) {
    let createJSON = await loadJSON(Notion.createJSON);
    createJSON.parent.database_id = databaseId;
    createJSON.properties.Name.title[0].text.content = title;
    createJSON.properties.URL.url = url;
    createJSON.properties.CreatedAt.date.start = Utils.formaData();
    createJSON.properties.LasteditedAt.date.start = Utils.formaData();
    createJSON.children[0].paragraph.rich_text[0].text.content = content;
    const tags = content.match(/#\S+/g);
    if (tags && tags.length > 0) {
        tags.forEach((tag, index) => {
            createJSON.properties.Tags.multi_select[index] = { name: tag.substring(1) };
        });
    }

    const requestBody = JSON.stringify(createJSON);
    const headers = await notionHeaders();
    console.log("[background] -> send notion request:", headers.values(), requestBody);

    let result = { code: -1, message: "保存数据失败" };
    await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> save notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            const message = data.object == "error" ? data.message : "保存数据成功";
            result = { code: code, message: `Notion: ${message}` };
        })
        .catch((error) => {
            console.error("[background] -> save notion error: ", error);
            result = { code: -2, message: "请求失败，请检查网络链接" };
        });
    if (callback) {
        callback(result);
    } else {
        Utils.sendMessage("popup.notify", result);
    }
}

// flomo 数据保存到 Notion
// TODO：配置 Notion 时增加链接检测，使用数据库查询接口判断，同时判断数据库是否初始化了对应的字段，如没有，则提示初始化
async function flomoToNotion(databaseId, memos, callback) {
    let count = 0;
    let total = memos.length;
    const slugPageMap = new Map();
    const pageSlugsMap = new Map();

    for (const memo of memos) {
        // 转换 momos 数据到 notion create page json
        const result = await saveNotionPage(databaseId, memo);
        if (result.code == 0) {
            slugPageMap.set(memo.slug, result.data.id);
            if (memo.links && memo.links.length > 0) {
                const slugs = Utils.getSlugs(memo.links);
                pageSlugsMap.set(result.data.id, slugs);
            }
            Utils.sendMessage("popup.flomo2notion.progress", { code: 0, steps: "save.notion", message: `导入数据中 ${++count}/${total}` });
        } else {
            console.error("[background] -> save notion error: ", result.error);
        }
    }
    
    count = 0;
    total = pageSlugsMap.size;
    const keys = pageSlugsMap.keys();
    for (const pageId of keys) {
        const slugs = pageSlugsMap.get(pageId);
        if (slugs && slugs.length > 0) {
            const memoIds = slugs.map((slug) => {
                return slugPageMap.get(slug);
            });
            await initNotionMemo(pageId, memoIds);
        }
        Utils.sendMessage("popup.flomo2notion.progress", { code: 0, steps: "save.notion", message: `更新关联中 ${++count}/${total}` });
    }
    
    Utils.sendMessage("popup.flomo2notion.progress", { code: 0, steps: "save.notion", message: `导入完成` });

    let result = { code: 0, message: "保存数据完成" };
    if (callback) {
        callback(result);
    } else {
        Utils.sendMessage("popup.notify", result);
    }
}

// 用promise模拟封装一个睡眠函数
function sleep(millsecond) {
    return new Promise(function (resolve) {
        setTimeout(resolve, millsecond);
    });
}

// Notion 初始化 database
async function initNotionDatabase(databaseId) {
    const initDBJSON = await loadJSON(Notion.initdbJSON);
    initDBJSON.properties.MEMO.relation.database_id = databaseId;
    return await fetchNotion(`https://api.notion.com/v1/databases/${databaseId}`, "PATCH", initDBJSON);
}

// Notion 更新数据属性
async function initNotionMemo(pageId, memoIds) {
    const initMemoJSON = await loadJSON(Notion.initMemoJSON);
    memoIds.forEach((memoId, index) => {
        initMemoJSON.properties.MEMO.relation[index] = { id: memoId };
    });
    return await fetchNotion(`https://api.notion.com/v1/pages/${pageId}`, "PATCH", initMemoJSON);
}

// Notion 添加数据
async function saveNotionPage(databaseId, memo) {
    let createJSON = await loadJSON(Notion.createJSON);
    createJSON.parent.database_id = databaseId;
    createJSON.properties.Name.title[0].text.content = memo.slug;
    const tags = memo.tags;
    tags.forEach((tag, index) => {
        createJSON.properties.Tags.multi_select[index] = { name: tag };
    });
    createJSON.properties.CreatedAt.date.start = memo.created_at.replaceAll("/", "-");
    createJSON.properties.LasteditedAt.date.start = memo.updated_at.replaceAll("/", "-");
    createJSON.properties.Slug.rich_text[0].text.content = memo.slug;
    createJSON.properties.Slug.rich_text[0].plain_text = memo.slug;
    createJSON.properties.URL.url = Flomo.linkURL + memo.slug;
    createJSON.children[0].paragraph.rich_text[0].text.content = memo.content.substring(0, 2000);
    return await fetchNotion("https://api.notion.com/v1/pages", "POST", createJSON);
}

async function fetchNotion(url, method, body) {
    let result;
    const headers = await notionHeaders();
    await fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(body),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> fetch notion request:", url, method, body, data);
            if (data.object == "error") {
                result = { code: -1, message: data.message, error: data };
            } else {
                result = { code: 0, data: data };
            }
        })
        .catch((error) => {
            console.error("[background] -> fetch notion request:", url, method, body, error);
            result = { code: -2, message: "请求异常，请检测网络链接", error: error };
        });
    return new Promise((resolve, reject) => {
        resolve(result);
    });
}

// Notion 查询 database
async function loadNotionDatabase(databaseId, callback) {
    let notionDatas = [];
    const headers = await notionHeaders();
    console.log("[background] -> query notion request:", notionHeaders);
    await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: headers,
        body: "{}",
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> query notion success: ", data);
            const results = data.results;
            notionDatas = results
                .filter((o) => {
                    return o.properties.Slug.rich_text && o.properties.Slug.rich_text.length > 0;
                })
                .forEach((result, index) => {
                    return {
                        pageId: result.id,
                        slug: result.properties.Slug.rich_text[0].text.content,
                        url: result.properties.URL.url,
                        createdAt: result.properties.CreatedAt.date.start,
                        lasteditedAt: result.properties.LasteditedAt.date.start,
                    };
                });
            const code = data.object == "error" ? -1 : 0;
            const message = data.object == "error" ? "获取 Notion 数据失败：" + data.message : "获取 Notion 数据成功";
            if (callback) {
                callback({ code: code, steps: "load.notion", message: message });
            }
        })
        .catch((error) => {
            console.error("[background] -> query notion error: ", error);
            if (callback) {
                callback({ code: -2, steps: "load.notion", message: "获取 Notion 数据失败" }, notionDatas);
            }
        });
    return notionDatas;
}

function toNotionDBData(result) {
    const inlinks = [];
    const outlinks = [];
    const links = result.links;
    if (links && links.length > 0) {
        links.forEach((link, index) => {
            if (link.startsWith(Flomo.linkURL)) {
                inlinks.push(link.substring(link.lastIndexOf("/")));
            } else {
                outlinks.push(link);
            }
        });
    }
    return {
        pageId: result.id,
        slug: result.properties.Slug.rich_text[0].text.content,
        url: result.properties.URL.url,
        createAt: result.properties.CreateAt.date.start,
        lasteditedAt: result.properties.LasteditedAt.date.start,
        inlinks: inlinks,
        outlinks: outlinks,
    };
}

// Notion 更新数据属性
async function updateNotionPageProperties(pageId, updatePropertiesJSON) {
    const requestBody = JSON.stringify(updateJSON);
    const headers = await notionHeaders();
    console.log("[background] -> update notion properties request:", headers, requestBody);

    await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> update notion properties success: ", data);
            const code = data.object == "error" ? -1 : 0;
            Utils.sendMessage("popup.flomo2notion.progress", { code: code, steps: "update.notion", message: "更新 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[background] -> update notion properties error: ", error);
            Utils.sendMessage("popup.flomo2notion.progress", { code: -2, steps: "update.notion", message: "更新 Notion 数据失败" });
        });
}

// Notion 更新数据 block
async function updateNotionPageBlock(blockId, updateBlockJSON) {
    const requestBody = JSON.stringify(updateJSON);
    const headers = await notionHeaders();
    console.log("[background] -> update notion block request:", headers, requestBody);

    await fetch(`https://api.notion.com/v1/blocks/${blockId}`, {
        method: "PATCH",
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> update notion block success: ", data);
            const code = data.object == "error" ? -1 : 0;
            Utils.sendMessage("popup.flomo2notion.progress", { code: code, steps: "update.notion", message: "更新 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[background] -> update notion block error: ", error);
            Utils.sendMessage("popup.flomo2notion.progress", { code: -2, steps: "update.notion", message: "更新 Notion 数据失败" });
        });
}
