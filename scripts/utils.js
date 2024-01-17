const Notion = {
    createURL: "https://api.notion.com/v1/pages",
    createJSON: "/data/notion-create-page.json",
    method: "POST",
    versionName: "Notion-Version",
    versionValue: "2022-06-28",
};

const Flomo = {
    siteURL: "https://v.flomoapp.com",
};

function guidGenerator() {
    const S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4();
}

// 定义格式化封装函数
function formaData(timer = new Date()) {
    const year = timer.getFullYear();
    const month = timer.getMonth() + 1; // 由于月份从0开始，因此需加1
    const day = timer.getDate();
    const hour = timer.getHours();
    const minute = timer.getMinutes();
    const second = timer.getSeconds();
    return `${pad(year, 4)}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}
// 定义具体处理标准
// timeEl 传递过来具体的数值：年月日时分秒
// total 字符串总长度 默认值为2
// str 补充元素 默认值为"0"
function pad(timeEl, total = 2, str = "0") {
    return timeEl.toString().padStart(total, str);
}

async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

function getCurrentTab(callback) {
    let queryOptions = { active: true, currentWindow: true };
    chrome.tabs.query(queryOptions, function (tabs) {
        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
        callback(tabs);
    });
}

function sendMessage(cmd, data) {
    chrome.runtime.sendMessage({ cmd: cmd, data: data }, function (response) {
        console.log("收到来自后台的回复：" + response);
    });
}

function copyToClipboard(text) {
    navigator.clipboard
        .writeText(text)
        .then(function () {
            console.log("[popup] -> text to clipboard: ", text);
        })
        .catch(function (err) {
            console.log("[popup] -> text to clipboard error: ", text, err);
        });
}

async function loadJSON(jsonPath) {
    console.log("[popup] -> load json path: ", jsonPath);
    let _json;
    await fetch(jsonPath)
        .then((response) => response.json())
        .then((json) => {
            _json = json;
        });
    console.log("[popup] -> load json result: ", _json);
    return _json;
}

async function sendFlomo(content, url) {
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
}

async function sendNotion(content, title, url) {
    let result = { code: -1, message: "保存失败！" };

    let notionApiKey;
    let notionDatabaseId;
    await chrome.storage.local.get(["notionApiKey"]).then((result) => {
        notionApiKey = result["notionApiKey"];
    });
    await chrome.storage.local.get(["notionDatabaseId"]).then((result) => {
        notionDatabaseId = result["notionDatabaseId"];
    });

    let createJSON = await loadJSON(Notion.createJSON);
    createJSON.parent.database_id = notionDatabaseId;
    createJSON.properties.Name.title[0].text.content = title;
    createJSON.properties.URL.url = url;
    createJSON.properties.CreateAt.date.start = formaData();
    createJSON.children[0].paragraph.rich_text[0].text.content = content;

    const tags = content.match(/#\S+/g);
    tags.forEach((tag, index) => {
        createJSON.properties.Tags.multi_select[index] = { name: tag };
    });

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", "Bearer " + notionApiKey);
    headers.append(Notion.versionName, Notion.versionValue);

    const requestBody = JSON.stringify(createJSON);
    console.log("[popup] -> fetch notion body:", requestBody);

    await fetch(Notion.createURL, {
        method: Notion.method,
        headers: headers,
        body: requestBody,
    })
        .then((response) => response.json())
        .then((data) => {
            const code = data.object == "error" ? -1 : 0;
            result = { code: code, message: "数据保存成功" };
            console.log("[popup] -> fetch notion success: ", data);
        })
        .catch((error) => {
            result = { code: -2, message: "请求失败，请检查网络链接" };
            console.error("[popup] -> fetch notion error: ", error);
        });

    return result;
}
