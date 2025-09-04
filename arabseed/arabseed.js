async function searchResults(keyword) {
  try {
    const response = await networkFetch("https://a.asd.homes/find/?word=" + encodeURIComponent(keyword), {
      timeoutSeconds: 5,
      returnHTML: false
    });

    
    const requests = response.requests || [];
    
    const foundUrls = [];
    if (Array.isArray(requests)) {
      foundUrls.push(...requests.filter(url => 
        typeof url === 'string' && 
        url.includes('a.asd.homes/') && 
        url.includes('%d')
      ));
    }

    const contentUrls = foundUrls.filter(url => {
      return !url.includes('/wp-content/') &&
             !url.includes('/find/') &&
             !url.includes('/series/') &&
             !url.includes('/like__post/') &&
             !url.includes('/selary/') &&
             url !== 'https://a.asd.homes' &&
             url.includes('%d') && 
             url.length > 30; 
    });
    
    const results = contentUrls.map(url => {
      let title = decodeURIComponent(url.replace('https://a.asd.homes/', ''));
      
      title = title.replace(/\/$/, '');
      
      title = title.replace(/^مسلسل-|^فيلم-/, '');
      
      title = title.replace(/-/g, ' ');
      
      return {
        href: url,
        image: "",
        title: title
      };
    });
    console.log(JSON.stringify(results));
    return JSON.stringify(results);
    
  } catch (err) {
    console.error('Search error:', err);
    return JSON.stringify([{
      title: "Error",
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
        
        const match = html.match(/href="([^"]+)"[^>]*class="btton watch__btn"/);
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

