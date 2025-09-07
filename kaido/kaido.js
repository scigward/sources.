async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://kaido.to/search?keyword=" + encodeURIComponent(keyword));
        const html = await response.text();

        const itemRegex = /<div class="flw-item">([\s\S]*?)<div class="clearfix"><\/div>/g;
        let itemMatch;

        while ((itemMatch = itemRegex.exec(html)) !== null) {
            const block = itemMatch[1];

            const hrefMatch = block.match(/<a href="([^"]+)"[^>]*class="film-poster-ahref[^"]*"[^>]*>/);
            let href = hrefMatch ? hrefMatch[1].trim() : "";
            if (href && href.includes('?')) {
                href = href.split('?')[0];
            }

            const imgMatch = block.match(/<img[^>]*data-src="([^"]+)"[^>]*>/);
            const image = imgMatch ? imgMatch[1].trim() : "";

            const titleMatch = block.match(/<h3 class="film-name">[^>]*<a[^>]*>([^<]+)<\/a>/);
            let extractedTitle = titleMatch ? titleMatch[1].trim() : "";
            extractedTitle = cleanTitle(extractedTitle);

            if (href || image || extractedTitle) {
                results.push({
                    title: extractedTitle,
                    image,
                    href
                });
            }
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

function cleanTitle(title) {
    return title
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "");
}


async function extractDetails(id) {
    try {
        const response = await fetchv2("https://kaido.to" + id);
        const html = await response.text();

        const descMatch = html.match(/<div class="film-description m-hide">[\s\S]*?<div class="text">([\s\S]*?)<\/div>/);
        const description = descMatch ? descMatch[1].trim() : "N/A";

        return JSON.stringify([{
            description: description,
            aliases: "N/A",
            airdate: "N/A"
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}

async function extractEpisodes(id) {
    const results = [];
    try {
        const numericIdMatch = id.match(/-(\d+)$/);
        const numericId = numericIdMatch ? numericIdMatch[1] : id;

        const response = await fetchv2("https://kaido.to/ajax/episode/list/" + numericId);
        const data = await response.json();
        const html = data.html;

        const regex = /<a[^>]*class="ssl-item\s+ep-item"[\s\S]*?data-number="(\d+)"[\s\S]*?href="([^"]+)"[\s\S]*?>[\s\S]*?data-jname="([^"]+)"/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[2].trim(),
                number: parseInt(match[1], 10)
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error",
            title: "Error"
        }]);
    }
}

async function extractStreamUrl(id) {
    try {
        const epMatch = id.match(/ep=(\d+)$/);
        const numericId = epMatch ? epMatch[1] : id;

        const url = "https://kaido.to/ajax/episode/servers?episodeId=" + numericId;
        console.log(url);

        const response = await fetchv2(url);
        const json = await response.json();
        console.log(JSON.stringify(json));

        const html = json.html;
        const serverMatch = html.match(/<div class="item server-item"[^>]*data-id="(\d+)"[^>]*>\s*<a[^>]*>Vidstreaming<\/a>/);
        const vidstreamingId = serverMatch ? serverMatch[1] : null;

        const someResponse = await fetchv2("https://kaido.to/ajax/episode/sources?id=" + vidstreamingId);
        const someJson = await someResponse.json();
        console.log(JSON.stringify(someJson));

        const link = someJson.link;
        const codeMatch = link.match(/\/e-1\/([a-zA-Z0-9]+)\?/);
        const code = codeMatch ? codeMatch[1] : null;

        const anotherResponse = await fetchv2("https://rapid-cloud.co/embed-2/v2/e-1/getSources?id=" + code);
        const anotherJson = await anotherResponse.json();
        console.log(JSON.stringify(anotherJson));

        const streamFile = anotherJson.sources && anotherJson.sources.length > 0 ? anotherJson.sources[0].file : null;
        const subtitleFile = anotherJson.tracks && anotherJson.tracks.length > 0 ? anotherJson.tracks[0].file : null;

        const result = {
            stream: streamFile,
            subtitles: subtitleFile
        };

        return JSON.stringify(result);
    } catch (err) {
        return "https://files.catbox.moe/avolvc.mp4";
    }
}
