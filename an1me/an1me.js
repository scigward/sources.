async function searchResults(keyword) {
    const results = [];
    
    try {
        const response = await fetchv2("https://an1me.to/search/?s_keyword=" + encodeURIComponent(keyword));
        const html = await response.text();
        
        const cardPattern = /<div class="w-full bg-gradient-to-t from-primary to-transparent rounded overflow-hidden shadow shadow-primary">([\s\S]*?)<\/div>\s*<\/div>/g;
        
        let cardMatch;
        while ((cardMatch = cardPattern.exec(html)) !== null) {
            const cardHtml = cardMatch[1];
            
            const imgMatch = cardHtml.match(/<img src=["'](https:\/\/cdn\.myanimelist\.net\/images\/[^"']+)["']/);
            
            const titleMatch = cardHtml.match(/<span data-nt-title[^>]*class=["'][^"']*show[^"']*["'][^>]*>([^<]+)<\/span>/);
            
            const hrefMatch = cardHtml.match(/<a[^>]+href=["'](https:\/\/an1me\.to\/anime\/[^"']+)["']/);
            
            if (imgMatch && titleMatch && hrefMatch) {
                results.push({
                    title: titleMatch[1].trim(),
                    image: imgMatch[1].trim(),
                    href: hrefMatch[1].trim()
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

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const match = html.match(/<div data-synopsis.*?>([\s\S]*?)<\/div>/);
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
        const responseOne = await fetchv2(url);
        const htmlOne = await responseOne.text();
        const matchOne = htmlOne.match(/<a href="(https:\/\/an1me\.to\/watch\/[^"]+)" class="flex items-center gap-1 text-sm md:text-base justify-center md:justify-start px-3 md:px-5 py-2 bg-accent-3 rounded-lg">[\s\S]*?Παρακολουθηστε\s*<\/a>/);
        const episodeUrl = matchOne ? matchOne[1].trim() : null;

        if (!episodeUrl) throw new Error("No episode link found");

        console.log("Fetching episodes from: " + episodeUrl);

        const response = await fetchv2(episodeUrl);
        const html = await response.text();

        const regex = /<a href="(.*?)".*?data-episode-search-query=".*?">[\s\S]*?<span class="episode-list-item-number">\s*(\d+)\s*<\/span>/g;
        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10)
            });
        }

        if (results.length === 0 && episodeUrl) {
            results.push({
                href: episodeUrl,
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
        const sources = await getSourcesFromEpisode(url);
        if(sources == null) return null;

        const streams = await extractStreamsFromSources(sources);
        if(streams == null) return null;
        console.log("Streams: " + JSON.stringify(streams));

        const streamUrl = streams[0].stream;
        console.log("Stream URL: " + streamUrl);
        return streamUrl;
    } catch (err) {
        return "https://files.catbox.moe/avolvc.mp4";
    }
}

async function getSourcesFromEpisode(url) {
    const sources = [];
    try {
        const res = await fetchv2(url);
        const html = await res.text();

        const regex = /<span[^>]+data-embed-id="([^"]+)"[^>]*>/gi;
        let match;

        while ((match = regex.exec(html)) !== null) {
            const dataEmbedId = match[1];
            const [_, iframeBase64] = dataEmbedId.split(":");
            if (!iframeBase64) continue;

            const iframeHtml = atob(iframeBase64);

            const srcMatch = iframeHtml.match(/src\s*=\s*["']([^"']+)["']/i);
            if (!srcMatch) continue;

            const isSub = /class="[^"]*player-sub[^"]*"/.test(match[0]);

            sources.push({
                source: srcMatch[1],
                audio: isSub ? 'original' : 'Greek'
            });
        }

        return sources;
    } catch (e) {
        console.error('Error extracting source: ' + e.message);
        return [];
    }
}

async function extractStreamsFromSources(sources) {
  const streams = [];

  for(let source of sources) {
      try {
          const res = await fetchv2(source.source);
          const html = await res.text();

          const jsonString = html.match(/params[\s]*=[\s]*(\{[^;]*);/)?.[1];
          if(jsonString == null) continue;

          const json = JSON.parse(jsonString);
          if(json?.sources == null || json.sources.length <= 0) continue;

          for(let s of json.sources) {
              const resolution = s?.html ?? null;
              let arrayLength = streams.push(source);
              let i = arrayLength - 1;

              streams[i].stream = s.url;
              streams[i].resolution = resolution != null ? resolution.slice(0, -1) : null;
          }

          
      } catch(e) {
          console.warn('Error extracting stream: ' + e.message);
      }
  }

  return streams.filter(source => source.stream != null);
}
