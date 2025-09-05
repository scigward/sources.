async function searchResults(keyword) {
    const results = [];
    const response = await fetchv2(`https://www.animetoast.cc/?s=${keyword}`);
    const html = await response.text();

    const regex = /<a href="(https:\/\/www\.animetoast\.cc\/[^"]+)"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: match[2].trim(),
            image: match[3].trim(),
            href: match[1].trim()
        });
    }
    return JSON.stringify(results);
}

async function extractDetails(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();

    let description = '';
    const descriptionRegex = /<p>(?:<img[^>]*>)?(.*?)<\/p>/s;
    const descriptionMatch = html.match(descriptionRegex);

    if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1].trim();
    }

    results.push({
        description: description,
        aliases: 'N/A',
        airdate: 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();
    
    const tabRegex = /<li[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>Voe<\/a>\s*<\/li>/g;
    const tabMatches = [...html.matchAll(tabRegex)];
    
    if (tabMatches.length > 0) {
      const tabHref = tabMatches[0][1].trim();
      const tabId = tabHref.startsWith('#') ? tabHref.substring(1) : tabHref;
      console.error(tabHref);
      const divRegex = new RegExp(`<div id="${tabId}"[^>]*>(.*?)<\/div>`, 's');
      const divMatch = html.match(divRegex);
      
      if (divMatch) {
        const epRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Ep\.\s*(\d+)\s*<\/a>/g;
        const epMatches = [...divMatch[1].matchAll(epRegex)];
        
        results.push(...epMatches.map(match => ({
          href: match[1], 
          number: parseInt(match[2], 10)
        })));
      }
    }
    console.error(JSON.stringify(results));
    return JSON.stringify(results);
  }


async function extractStreamUrl(url) {
    const response = await fetchv2(url);
    const html = await response.text();

    const voeRegex = /<a href="https:\/\/voe\.sx\/([a-zA-Z0-9]+)"[^>]*>/;
    const match = html.match(voeRegex);

    if (match && match[1]) {
        const videoId = match[1];
        const streamUrl = `https://kristiesoundsimply.com/e/${videoId}`;

        const streamResponse = await fetchv2(streamUrl);
        const streamHtml = await streamResponse.text();

        const mp4Regex = /'mp4': '([^']+)'/;
        const mp4Match = streamHtml.match(mp4Regex);

        if (mp4Match && mp4Match[1]) {
            const decodedUrl = atob(mp4Match[1]); 
            return decodedUrl;
        }
    }
    return null;
}
