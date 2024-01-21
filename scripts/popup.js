import * as Utils from "./utils.js";

const Flomo = {
    siteURL: "https://v.flomoapp.com",
};

let messageActive = false;
const messageQueue = [];

// 显示通知信息
function notify(message, error = false, times = 2000) {
    messageQueue.push({ message: message, error: error, times: times });
    if (!messageActive) {
        showNotify();
    }
}
function showNotify() {
    messageActive = true; 
    const m = messageQueue.shift();
    $("#message").text(m.message);
    $("#message").fadeIn();
    setTimeout(function () {
        $("#message").fadeOut(function(){
            if (messageQueue.length > 0) {
                showNotify();
            }
        });
        messageActive = false; 
    }, m.times);
}

function showProgress(data) {
    $("#syncState").text(data.message);
}


// 监听消息
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    //console.log("[popup] -> receive runtime message: ", request);
    const cmd = request.cmd;
    const data = request.data;
    if (cmd == "popup.notify") {
        notify(data.message, data.code == 0);
    }
    if (cmd == "popup.flomo2notion.progress") {
        showProgress(data);
    }
    sendResponse({});
});

const flomoApi = (await chrome.storage.local.get(["flomoApi"]))["flomoApi"];
const notionApiKey = (await chrome.storage.local.get(["notionApiKey"]))["notionApiKey"];
const notionDatabaseId = (await chrome.storage.local.get(["notionDatabaseId"]))["notionDatabaseId"];
const listenerFlomo = (await chrome.storage.local.get(["listenerFlomo"]))["listenerFlomo"];
const listenerNotion = (await chrome.storage.local.get(["listenerNotion"]))["listenerNotion"];
const memosTextarea = (await chrome.storage.local.get(["memosTextarea"]))["memosTextarea"];

$(function () {
    $(".tabs .tab-title").on("click", function () {
        $(".tabs .active").removeClass("active");
        const _this = $(this);
        _this.addClass("active");
        $(".root").fadeOut(0);
        $("#" + _this.attr("for")).fadeIn("slow");
    });

    let url;
    let title;

    Utils.getCurrentTab(function (tabs) {
        title = tabs[0].title;
        url = tabs[0].url;
        $("#link-text").html(tabs[0].title);
        if (url.startsWith(Flomo.siteURL)) {
            $("#flomo-to-notion").attr("disabled", false);
        }
    });

    $("#flomo-api").val(flomoApi);
    $("#notion-api-key").val(notionApiKey);
    $("#notion-database-id").val(notionDatabaseId);
    $("#listener-flomo").prop("checked", listenerFlomo);
    $("#listener-notion").prop("checked", listenerNotion);

    if (memosTextarea) {
        $("#memos-textarea").val(memosTextarea);
        $("#memos-save").attr("disabled", false);
        $("#memos-counts").text($("#memos-textarea").val().length);
    } else {
        $("#memos-save").attr("disabled", true);
    }

    $("#flomo-api").on("change", function () {
        let data = { flomoApi: $("#flomo-api").val() };
        Utils.storage(data);
    });
    $("#notion-api-key").on("change", function () {
        let data = { notionApiKey: $("#notion-api-key").val() };
        Utils.storage(data);
    });
    $("#notion-database-id").on("change", function () {
        let data = { notionDatabaseId: $("#notion-database-id").val() };
        Utils.storage(data);
    });
    $("#listener-flomo").on("change", function () {
        let data = { listenerFlomo: $("#listener-flomo").is(":checked") };
        Utils.storage(data);
    });
    $("#listener-notion").on("change", function () {
        let data = { listenerNotion: $("#listener-notion").is(":checked") };
        Utils.storage(data);
    });

    $("#memos-textarea").on("change", function () {
        let memosTextarea = $("#memos-textarea").val();
        if (memosTextarea) {
            let data = { memosTextarea: memosTextarea };
            Utils.storage(data);
        }
    });
    $("#memos-textarea").on("input", function () {
        if ($("#memos-textarea").val()) {
            $("#memos-save").attr("disabled", false);
            $("#memos-counts").text($("#memos-textarea").val().length);
        } else {
            $("#memos-save").attr("disabled", true);
        }
    });

    $("#memos-save").on("click", function () {
        const flomo = $("#flomo").is(":checked");
        const notion = $("#notion").is(":checked");
        const content = $("#memos-textarea").val();

        if (flomo) {
            Utils.sendMessage("background.send.flomo", { content: content, title: title, url: url }, function (response) {
                console.log("[popup] -> send flomo callback: ", response);
                notify(response.message, response.code == 0);
            });
        }
        if (notion) {
            Utils.sendMessage("background.send.notion", { content: content, title: title, url: url, databaseId: notionDatabaseId }, function (response) {
                console.log("[popup] -> send notion callback: ", response);
                notify(response.message, response.code == 0);
            });
        }
    });

    $("#flomo-to-notion").on("click", function () {
        Utils.sendMessage("content.load.flomo", {}, function (result) {
            console.log("[popup] -> load flomo result: ", result);
            if (result.code == 0 && result.data && result.data.length > 0) {
                Utils.sendMessage("background.flomoToNotion", { databaseId: notionDatabaseId, memos: result.data }, function (response) {
                    console.log("[popup] -> flomoToNotion callback: ", response);
                    //showProgress(response.message);
                });
            }
        });
    });
});
