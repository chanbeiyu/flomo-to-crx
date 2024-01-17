function notify(message, error = false, times = 2000) {
    $("#message").text(message);
    $("#message").fadeIn();
    setTimeout(function () {
        $("#message").fadeOut();
    }, times);
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("[popup] -> receive runtime message: ", request);

    const cmd = request.cmd;
    const data = request.data;

    if (cmd == "active.notify") {
        notify(data.message);
    }
    sendResponse({});
});

$(function () {

    $(".tabs .tab-title").on("click", function () {
        $(".tabs .active").removeClass("active");
        $(this).addClass("active");
        $(".root").fadeOut(0);
        $("#" + $(this).attr("for")).fadeIn();
    });

    let title;
    let url;
    getCurrentTab(function (tabs) {
        title = tabs[0].title;
        url = tabs[0].url;
        $("#link-text").html(tabs[0].title);

        if (url.startsWith(Flomo.siteURL)) {
            $("#flomo-to-notion").attr("disabled", false);
            sendMessage("active.injectJs");
        }
    });

    chrome.storage.local.get(["flomoApi"]).then((result) => {
        $("#flomo-api").val(result["flomoApi"]);
    });
    chrome.storage.local.get(["notionApiKey"]).then((result) => {
        $("#notion-api-key").val(result["notionApiKey"]);
    });
    chrome.storage.local.get(["notionDatabaseId"]).then((result) => {
        $("#notion-database-id").val(result["notionDatabaseId"]);
    });
    chrome.storage.local.get(["memosTextarea"]).then((result) => {
        if (result["memosTextarea"]) {
            $("#memos-textarea").val(result["memosTextarea"]);
            $("#memos-save").attr("disabled", false);
            $("#memos-counts").text($("#memos-textarea").val().length);
        } else {
            $("#memos-save").attr("disabled", true);
        }
    });

    $("#flomo-api").on("change", function () {
        let data = { flomoApi: $("#flomo-api").val() };
        chrome.storage.local.set(data).then(() => {
            console.log("[popup] -> set storage flomoApi: ", data);
        });
    });
    $("#notion-api-key").on("change", function () {
        let data = { notionApiKey: $("#notion-api-key").val() };
        chrome.storage.local.set(data).then(() => {
            console.log("[popup] -> set storage notionApiKey: ", data);
        });
    });
    $("#notion-database-id").on("change", function () {
        let data = { notionDatabaseId: $("#notion-database-id").val() };
        chrome.storage.local.set(data).then(() => {
            console.log("[popup] -> set storage notionDatabaseId: ", data);
        });
    });

    $("#memos-textarea").on("change", function () {
        let memosTextarea = $("#memos-textarea").val();
        if (memosTextarea) {
            let data = { memosTextarea: memosTextarea };
            chrome.storage.local.set(data).then(() => {
                console.log("[popup] -> set storage memosTextarea: ", data);
            });
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

        if (!flomo && !notion) {
            notify("请先选择保存位置");
            return false;
        }

        if (flomo) {
            sendFlomo(content, url).then((result) => {
                console.log("[popup] -> save flomo result: ", result);
                notify("flomo: " + result.message, result.code == 0);
                if (result.code == 1) {
                    $("#memos-textarea").val("");
                }
            });
        }

        if (notion) {
            sendNotion(content, title, url).then((result) => {
                console.log("[popup] -> save flomo result: ", result);
                notify("Notion: " + result.message, result.code == 0);
                if (result.code == 1) {
                    $("#memos-textarea").val("");
                }
            });
        }
    });
});
