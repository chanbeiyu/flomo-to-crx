import { Notion, Flomo } from "./consts.js";

// 生成 GUID
export const guidGenerator = () => {
    const S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4();
};

// 定义格式化封装函数
export const formaData = (timer = new Date()) => {
    const year = timer.getFullYear();
    const month = timer.getMonth() + 1; // 由于月份从0开始，因此需加1
    const day = timer.getDate();
    const hour = timer.getHours();
    const minute = timer.getMinutes();
    const second = timer.getSeconds();
    return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
};

// 定义具体处理标准
// timeEl 传递过来具体的数值：年月日时分秒
// total 字符串总长度 默认值为2
// str 补充元素 默认值为"0"
export const pad = (timeEl, total = 2, str = "0") => {
    return timeEl.toString().padStart(total, str);
};

// 获取当前 tab
export const getCurrentTab = (callback) => {
    let queryOptions = { active: true, currentWindow: true };
    chrome.tabs.query(queryOptions, function (tabs) {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
        if (callback) {
            callback(tabs);
        }
    });
};

// 发送 chrome 消息
export const sendMessage = (cmd, data) => {
    chrome.runtime.sendMessage({ cmd: cmd, data: data }, function (response) {
        console.log("收到来自后台的回复：" + response);
    });
};

// 获取鼠标选中内容
export const getSelection = () => {
    // TODO：
};

// 数据复制到剪贴板
export const copyToClipboard = (text) => {
    navigator.clipboard
        .writeText(text)
        .then(function () {
            console.log("[popup] -> text to clipboard: ", text);
        })
        .catch(function (err) {
            console.log("[popup] -> text to clipboard error: ", text, err);
        });
};

// 加载 JSON
export const loadJSON = async (jsonPath) => {
    console.log("[popup] -> load json path: ", jsonPath);
    let _json;
    await fetch(jsonPath)
        .then((response) => response.json())
        .then((json) => {
            _json = json;
        });
    console.log("[popup] -> load json result: ", _json);
    return _json;
};

// 发送数据到 flomo
export const sendFlomo = async (content, url) => {
    let result = { code: -1, message: "保存失败！" };

    let flomoApi;
    await chrome.storage.local.get(["flomoApi"]).then((result) => {
        flomoApi = result["flomoApi"];
    });

    const requestBody = JSON.stringify({ content: content + "<p>" + url });
    console.log("[popup] -> fetch notion body:", requestBody);

    await fetch(flomoApi, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            result = { code: data.code, message: data.message };
            console.log("[popup] -> fetch flomo success: ", data);
        })
        .catch((error) => {
            result = { code: -2, message: "请求失败，请检查网络链接" };
            console.error("[popup] -> fetch flomo error: ", error);
        });
    return result;
};

// 发送数据到 Notion
export const sendNotion = async (content, title, url) => {
    let notionApiKey;
    let notionDatabaseId;
    await chrome.storage.local.get(["notionApiKey"]).then((result) => {
        notionApiKey = result["notionApiKey"];
    });
    await chrome.storage.local.get(["notionDatabaseId"]).then((result) => {
        notionDatabaseId = result["notionDatabaseId"];
    });

    let createJSON = loadJSON(Notion.createJSON);
    createJSON.parent.database_id = notionDatabaseId;
    createJSON.properties.Name.title[0].text.content = title;
    createJSON.properties.URL.url = url;
    createJSON.properties.CreateAt.date.start = formaData();
    createJSON.properties.LasteditedAt.date.start = formaData();
    createJSON.children[0].paragraph.rich_text[0].text.content = content;

    const tags = content.match(/#\S+/g);
    tags.forEach((tag, index) => {
        createJSON.properties.Tags.multi_select[index] = { name: tag.substring(1) };
    });

    return await saveNotionPage(createJSON);
};

// 获取所有 flomo 数据
export const loadFlomoMemos = () => {
    let memos;
    const request = indexedDB.open("flomo");
    request.onsuccess = function (event) {
        console.log("[content] -> 数据库打开成功");
        const dbRequest = event.target.result;
        const transaction = dbRequest.transaction(["memos"], "readonly");
        const objectStore = transaction.objectStore("memos");
        const osRequest = objectStore.getAll();
        osRequest.onsuccess = function (event) {
            memos = event.target.result;
            console.log("[content] -> flomo memos: ", memos);
            sendMessage("popup.flomo2notion.progress", { code: 0, steps: "load.flomo", message: "获取 flomo 数据成功" });
        };
        osRequest.onerror = function (event) {
            console.error("[content] -> 事务失败", event);
            sendMessage("popup.flomo2notion.progress", { code: -3, steps: "load.flomo", message: "获取 flomo 数据失败" });
        };
    };
    request.onerror = function (event) {
        console.error("[content] -> 数据库打开失败", event);
        sendMessage("popup.flomo2notion.progress", { code: -3, steps: "load.flomo", message: "获取 flomo 数据失败" });
    };
    return memos;
};

// Notion 查询 database
async function loadNotionDatabase(databaseId) {
    const requestBody = JSON.stringify(createJSON);
    console.log("[popup] -> fetch notion body:", requestBody);

    let notionDatas = [];
    await fetch(Notion.queryURL, {
        method: Notion.queryMethod,
        headers: headers,
        body: {},
    })
        .then((response) => response.json())
        .then((data) => {
            const results = data.results;
            notionDatas = results.forEach((result, index) => {
                return toNotionDBData(result);
            });
            const code = data.object == "error" ? -1 : 0;
            console.log("[popup] -> query notion success: ", data);
            sendMessage("popup.flomo2notion.progress", { code: code, steps: "load.notion", message: "获取 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[popup] -> query notion error: ", error);
            sendMessage("popup.flomo2notion.progress", { code: -2, steps: "load.notion", message: "获取 Notion 数据失败" });
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
        slug: result.Slug.rich_text.text.content,
        url: result.URL.url,
        createAt: result.CreateAt.date.start,
        lasteditedAt: result.LasteditedAt.date.start,
        inlinks: inlinks,
        outlinks: outlinks,
    };
}

// memo 对象转换为 json 请求体
async function memo2CreateRequest(databaseId, memo) {
    let createJSON = await loadJSON(Notion.createJSON);
    createJSON.parent.database_id = databaseId;
    createJSON.Name.title[0].text.content = memo.slug;
    const tags = memo.tags;
    tags.forEach((tag, index) => {
        createJSON.properties.Tags.multi_select[index] = { name: tag };
    });
    createJSON.CreatedAt.date.start = memo.created_at.replaceAll("-", "/");
    createJSON.LasteditedAt.date.start = memo.updated_at.replaceAll("-", "/");
    createJSON.Slug.rich_text[0].text.content = memo.slug;
    createJSON.Slug.rich_text[0].plain_text = memo.slug;
    createJSON.URL.title[0].text.content = Flomo.linkURL + memo.slug;
    createJSON.children[0].paragraph.rich_text[0].text.content = memo.content;
    return createJSON;
}

async function memo2UpdateRequest(databaseId, memo) {
    let createJSON = await loadJSON(Notion.createJSON);
    createJSON.parent.database_id = databaseId;
    createJSON.Name.title[0].text.content = memo.slug;
    const tags = memo.tags;
    tags.forEach((tag, index) => {
        createJSON.properties.Tags.multi_select[index] = { name: tag };
    });
    createJSON.CreatedAt.date.start = memo.created_at.replaceAll("-", "/");
    createJSON.LasteditedAt.date.start = memo.updated_at.replaceAll("-", "/");
    createJSON.Slug.rich_text[0].text.content = memo.slug;
    createJSON.Slug.rich_text[0].plain_text = memo.slug;
    createJSON.URL.title[0].text.content = Flomo.linkURL + memo.slug;
    createJSON.children[0].paragraph.rich_text[0].text.content = memo.content;
    return createJSON;
}

const headers = () => {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", "Bearer " + notionApiKey);
    headers.append(Notion.versionName, Notion.versionValue);
    return headers;
};

async function initNotionDatabase() {
    const initDBJSON = loadJSON(Notion.initdbJSON);
    const requestBody = JSON.stringify(initDBJSON);
    console.log("[popup] -> update notion body:", updateJSON);

    await fetch(Notion.initdbURL, {
        method: Notion.initdbMethod,
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[popup] -> initdb notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            sendMessage("popup.flomo2notion.progress", { code: code, steps: "initdb.notion", message: "更新 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[popup] -> update notion error: ", error);
            sendMessage("popup.flomo2notion.progress", { code: -2, steps: "initdb.notion", message: "更新 Notion 数据失败" });
        });
}

// Notion 添加数据
async function saveNotionPage(createJSON) {
    const requestBody = JSON.stringify(createJSON);
    console.log("[popup] -> save notion body:", requestBody);

    await fetch(Notion.createURL, {
        method: Notion.createMethod,
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[popup] -> save notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            sendMessage("popup.flomo2notion.progress", { code: code, steps: "save.notion", message: "保存 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[popup] -> save notion error: ", error);
            sendMessage("popup.flomo2notion.progress", { code: -2, steps: "save.notion", message: "保存 Notion 数据失败" });
        });
}

async function updateNotionPage(updateJSON) {
    const requestBody = JSON.stringify(updateJSON);
    console.log("[popup] -> update notion body:", updateJSON);

    await fetch(Notion.createURL, {
        method: Notion.createMethod,
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("[popup] -> update notion success: ", data);
            const code = data.object == "error" ? -1 : 0;
            sendMessage("popup.flomo2notion.progress", { code: code, steps: "update.notion", message: "更新 Notion 数据失败" });
        })
        .catch((error) => {
            console.error("[popup] -> update notion error: ", error);
            sendMessage("popup.flomo2notion.progress", { code: -2, steps: "update.notion", message: "更新 Notion 数据失败" });
        });
}
