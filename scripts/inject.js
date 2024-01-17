getFlomoMemos();

// 获取所有 flomo 数据
function getFlomoMemos() {
    const request = indexedDB.open("flomo");

    request.onerror = function (event) {
        console.log("[inject] -> 数据库打开失败");
    };

    request.onsuccess = function (event) {
        console.log("[inject] -> 数据库打开成功");

        const dbRequest = event.target.result;
        const transaction = dbRequest.transaction(["memos"], "readonly");
        const objectStore = transaction.objectStore("memos");
        const osRequest = objectStore.getAll();

        osRequest.onerror = function (event) {
            console.log("[inject] -> 事务失败");
        };

        osRequest.onsuccess = function (event) {
            const result = event.target.result;
            console.log("[inject] -> flomoMemos: ", result);
            window.postMessage({ cmd: "inject.flomo.memos", data: result }, "*");
        };
    };
}
