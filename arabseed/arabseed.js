async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2(
            "https://passthrough-worker.simplepostrequest.workers.dev/?url=https://a.asd.homes/wp-content/themes/Elshaikh2021/Ajaxat/SearchingTwo.php&type=formdata&body=search=" 
            + encodeURIComponent(keyword) 
            + "&type=all"
        );
        const html = await response.text();

        const regex = /<a href="([^"]+)">[\s\S]*?<img[^>]+data-src="([^"]+)"[^>]*>[\s\S]*?<h4>(.*?)<\/h4>/g;

        let match;
        const tempResults = [];

        while ((match = regex.exec(html)) !== null) {
            const cleanedTitle = match[3].replace(/الموسم\s+\S+\s+الحلقة\s+\S+.*$/u, '').trim();

            tempResults.push({
                href: match[1].trim(),
                image: match[2].trim(),
                title: cleanedTitle
            });
        }

        const combined = [];
        const seen = new Set();

        for (const item of tempResults) {
            if (!seen.has(item.title)) {
                seen.add(item.title);
                combined.push(item);
            }
        }

        return JSON.stringify(combined);
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

        const match = html.match(/<p class="descrip">(.*?)<\/p>/s);
        const description = match ? match[1].trim() : "N/A";

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

async function extractEpisodes(url) {
    const results = [];
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<em>(\d+)<\/em>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10)
            });
        }

        if (results.length === 0) {
            results.push({
                href: url,
                number: 1
            });
        }

        return JSON.stringify(results.reverse());
    } catch (err) {
        return JSON.stringify([{
            href: url,
            number: 1
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();
        
        const match = html.match(/href="([^"]+)"[^>]*class="watchBTn"/);
        if (match) {
            const extractedUrl = match[1].replace(/&amp;/g, '&');
            const headers = {
                "Referer": "https://a.asd.homes/"
            };
            const extractedResponse = await fetchv2(extractedUrl, headers);
            const extractedHtml = await extractedResponse.text();
            
            const embedMatch = extractedHtml.match(/data-link="([^"]+)"/);
            if (embedMatch) {
                const embedUrl = embedMatch[1];
                const embedResponse = await fetchv2(embedUrl, headers);
                const embedHtml = await embedResponse.text();
                
                const sourceMatch = embedHtml.match(/<source src="([^"]+)"/);
                if (sourceMatch) {
                    return sourceMatch[1];
                }
            }
        }
    } catch (err) {
        console.log(err);
    }
    
    return "https://files.catbox.moe/avolvc.mp4";
}

