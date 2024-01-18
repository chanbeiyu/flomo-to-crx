export const Menus = {
  flomo: "添加到 flomo",
  notion: "添加到 Notion",
  markdown: "复制到 Markdown",
};

export const Notion = {
    versionName: "Notion-Version",
    versionValue: "2022-06-28",
    createMethod: "POST",
    createURL: "https://api.notion.com/v1/pages",
    createJSON: "/data/notion-create-page.json",
    queryMethod: "POST",
    queryURL: "https://api.notion.com/v1/databases/${databaseId}/query",
    initdbMethod: "PATCH",
    initdbURL: "https://api.notion.com/v1/databases/${databaseId}",
    initdbJSON: "/data/notion-init-db.json",
};

export const Flomo = {
    siteURL: "https://v.flomoapp.com",
    linkURL: "https://v.flomoapp.com/mine/?memo_id=",
};
