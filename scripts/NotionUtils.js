

async function initdb(databaseId, memo) {
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


// memo 对象转换为 create page json
async function memo2CreatePage(databaseId, memo) {
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



