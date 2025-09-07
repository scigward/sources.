async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://tn.honadrama.us/?s=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<div class="movie"><a href="([^"]+)".*?<img src="([^"]+)"[^>]*>.*?<h3>(.*?)<\/h3>/gs;
        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: match[2].trim(),
                href: match[1].trim()
            });
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

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const descriptionMatch = (/<div class="StoryMovie">(.*?)<\/div>/s.exec(html) || [])[1];

        return JSON.stringify([{
            description: descriptionMatch ? descriptionMatch.trim() : "N/A",
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

async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<a href="([^"]+)" class="WatchButton">/;
        const match = regex.exec(html);

        if (match) {
            results.push({
                href: match[1].trim(),
                number: 1
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const serverRegex = /<li\s+([^>]*?)data-server="(\d+)"\s+data-q="(\d+)"[^>]*>/g;
        const servers = [];
        let match;
        while ((match = serverRegex.exec(html)) !== null) {
            servers.push({
                server: match[2],
                q: match[3]
            });
        }

        let uqloadUrl = null;

        for (const s of servers) {
            const ajaxUrl = `https://tn.honadrama.us/wp-admin/admin-ajax.php?action=serverPost&server=${s.server}&q=${s.q}`;
            const serverResp = await fetchv2(ajaxUrl);
            const serverHtml = await serverResp.text();

            const iframeMatch = /<iframe\s+[^>]*src="([^"]*uqload\.[a-z]{2,3}[^"]*)"/i.exec(serverHtml);

            if (iframeMatch) {
                uqloadUrl = iframeMatch[1];
                console.log("[Debug] Uqload iframe found:"+ uqloadUrl);
                break;
            }
        }

        if (!uqloadUrl) {
            return "https://files.catbox.moe/avolvc.mp4";
        }

        const uqResp = await fetchv2(uqloadUrl);
        const uqHtml = await uqResp.text();

        const mp4Match = /sources:\s*\["([^"]+\.mp4)"]/i.exec(uqHtml);
        if (mp4Match) {
            return mp4Match[1];
        } else {
            console.log("[Debug] No MP4 found in uqload page, returning default");
            return "https://files.catbox.moe/avolvc.mp4";
        }

    } catch (err) {
        console.log("[Error] Fetching stream failed:", err);
        return "https://files.catbox.moe/avolvc.mp4";
    }
}

