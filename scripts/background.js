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
};
const Flomo = {
    linkURL: "https://v.flomoapp.com/mine/?memo_id=",
};

// 注册页面右键菜单
chrome.runtime.onInstalled.addListener(async () => {
    chrome.action.setBadgeText({
        text: "OFF",
    });
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
    console.log("onClicked: " + JSON.stringify(item));
});

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
    // 获取 Notion 数据
    const notionPages = await loadNotionDatabase(databaseId);
    // const notionPageMap = new Map(
    //     notionPages.map((dbResult) => {
    //         return [dbResult.slug, dbResult];
    //     })
    // );
    let waitTimes = 0;
    memos.forEach((memo, index) => {
        // 转换 momos 数据到 notion create page json
        setTimeout(function () {
            memo2CreateRequest(databaseId, memo).then((createJSON) => {
                saveNotionPage(createJSON);
            });
        }, waitTimes + 200);
    });

    let result = { code: -1, message: "保存数据..." };
    if (callback) {
        callback(result);
    } else {
        Utils.sendMessage("popup.notify", result);
    }
}

// memo 对象转换为创建 page json 请求体
async function memo2CreateRequest(databaseId, memo) {
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
    return createJSON;
}

// memo 对象转换为更新 page json 请求体
async function memo2UpdateRequest(databaseId, memo) {
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
    createJSON.children[0].paragraph.rich_text[0].text.content = memo.content;
    return createJSON;
}

// Notion 初始化 database
async function initNotionDatabase(databaseId) {
    const initDBJSON = await loadJSON(Notion.initdbJSON);
    const requestBody = JSON.stringify(initDBJSON);
    const headers = await notionHeaders();
    console.log("[background] -> initdb notion request:", headers, requestBody);

    await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
        method: "PATCH",
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[background] -> initdb notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            Utils.sendMessage("popup.flomo2notion.progress", { code: code, steps: "initdb.notion", message: "更新 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[background] -> initdb notion error: ", error);
            Utils.sendMessage("popup.flomo2notion.progress", { code: -2, steps: "initdb.notion", message: "更新 Notion 数据失败" });
        });
}

// Notion 查询 database
async function loadNotionDatabase(databaseId) {
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
            Utils.sendMessage("popup.flomo2notion.progress", { code: code, steps: "load.notion", message: "获取 Notion 数据成功" });
        })
        .catch((error) => {
            console.error("[background] -> query notion error: ", error);
            Utils.sendMessage("popup.flomo2notion.progress", { code: -2, steps: "load.notion", message: "获取 Notion 数据失败" });
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

// Notion 添加数据
async function saveNotionPage(createJSON) {
    const requestBody = JSON.stringify(createJSON);
    const headers = await notionHeaders();
    console.log("[background] -> save notion request:", headers, requestBody);

    await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            //console.log("[background] -> save notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            const message = data.object == "error" ? "保存 Notion 数据失败: " + data.message : "保存 Notion 数据成功";
            if (code != 0) {
                console.error("[background] -> save notion error: ", requestBody, data);
            }
            Utils.sendMessage("popup.flomo2notion.progress", { code: code, steps: "save.notion", message: message });
        })
        .catch((error) => {
            console.error("[background] -> save notion error: ", requestBody, error);
            Utils.sendMessage("popup.flomo2notion.progress", { code: -2, steps: "save.notion", message: "保存 Notion 数据失败" });
        });
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
