async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://a.asd.homes/find/?word=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<li class="box__xs__2[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<h3>(.*?)<\/h3>[\s\S]*?<\/a>/g;

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
    
    const match = html.match(/<div class="post__story">\s*<p>(.*?)<\/p>\s*<\/div>/s);
    
    let description = "N/A";
    
    if (match) {
      const rawDescription = match[1];
      description = rawDescription.replace(/<\/?span[^>]*>/g, '').trim();
      description = description.replace(/\s+/g, ' ');
    }
    
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
        
        const episodesListMatch = html.match(/<ul class="episodes__list[^>]*>([\s\S]*?)<\/ul>/);
        if (!episodesListMatch) {
            results.push({
                href: url,
                number: 1
            });
            return JSON.stringify(results);
        }
        
        const episodesHTML = episodesListMatch[1];
        
        const episodeItemRegex = /<li[^>]*>[\s\S]*?<a href="([^"]+)"[\s\S]*?الحلقة<b>(\d+)<\/b>[\s\S]*?<\/a>[\s\S]*?<\/li>/g;
        let match;
        const episodes = [];
        
        while ((match = episodeItemRegex.exec(episodesHTML)) !== null) {
            const href = match[1].trim();
            const episodeNumber = parseInt(match[2]);
            episodes.push({
                href: href,
                number: episodeNumber
            });
        }
        
        episodes.sort((a, b) => a.number - b.number);
        
        results.push(...episodes);
        
        if (results.length === 0) {
            results.push({
                href: url,
                number: 1
            });
        }
        
        return JSON.stringify(results);
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
        
        const match = html.match(/href="([^"]+)"[^>]*class="btton watch__btn"/);
        console.log("Match found: " + match);
        if (match) {
            const extractedUrl = match[1].replace(/&amp;/g, '&');
            const headers = {
                "Referer": "https://a.asd.homes/"
            };
            const extractedResponse = await fetchv2(extractedUrl, headers);
            const extractedHtml = await extractedResponse.text();
            console.log("Extracted HTML snippet:"+ extractedHtml);
            
            const embedMatch = extractedHtml.match(/<iframe[^>]*src="([^"]+)"/);
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

