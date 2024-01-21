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
const pad = (timeEl, total = 2, str = "0") => {
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

// 发送消息
export const sendMessageToConetnt = (cmd, data, callback) => {
    //console.log("[utils] -> send message to conetnt: ", cmd, data);
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { cmd: cmd, data: data }, function (response) {
            if (callback) callback(response);
        });
    });
};

export const sendMessage = (cmd, data, callback) => {
    if (cmd.startsWith("content.")) {
        sendMessageToConetnt(cmd, data, callback);
    } else {
        //console.log("[utils] -> send message: ", cmd, data);
        chrome.runtime.sendMessage({ cmd: cmd, data: data }, function (response) {
            if (callback) callback(response);
        });
    }
};

export const callPopFunction = (funName, data) => {
    var views = chrome.extension.getViews({ type: "popup" });
    if (views.length > 0) {
        views[0][funName](data);
    }
};

export const storage = (data) => {
    chrome.storage.local.set(data).then(() => {
        console.log("[utils] -> set storage: ", data);
    });
};
