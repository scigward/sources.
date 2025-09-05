async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://fireani.me/api/anime/search?q=${encodedKeyword}`);
        const data = await JSON.parse(responseText);

        const transformedResults = data.data.map(anime => ({
            title: anime.title,
            image: `https://fireani.me/img/posters/${anime.poster}`,
            href: anime.slug
        }));
        console.log(transformedResults);
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(slug) {
    try {
        const encodedID = encodeURIComponent(slug);
        const response = await fetch(`https://fireani.me/api/anime?slug=${encodedID}`);
        const data = await JSON.parse(response);
        
        const animeInfo = data.data;
        
        const transformedResults = [{
            description: animeInfo.desc || 'No description available', 
            aliases: `Alternate Titles: ${animeInfo.alternate_titles || 'Unknown'}`,  
            airdate: `Aired: ${animeInfo.start ? animeInfo.start : 'Unknown'}`
        }];
        
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
        description: 'Error loading description',
        aliases: 'Duration: Unknown',
        airdate: 'Aired: Unknown'
        }]);
  }
}

async function extractEpisodes(slug) {
    try {
        const encodedID = encodeURIComponent(slug);
        const response = await fetch(`https://fireani.me/api/anime?slug=${encodedID}`);
        const data = await JSON.parse(response);

        let episodeCounter = 1; 

        const episodes = data.data.anime_seasons.reduce((acc, season) => {
            if (season.season.toLowerCase() === "filme") return acc; // Skip "Filme" season

            const seasonEpisodes = season.anime_episodes || [];
            seasonEpisodes.forEach(episode => {
                acc.push({
                    href: `${encodedID}&season=${season.season}&episode=${episode.episode}`,
                    number: episodeCounter
                });
                episodeCounter++;
            });
            return acc;
        }, []);

        console.log(episodes);
        return JSON.stringify(episodes);
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

async function extractStreamUrl(id) {
    try {
        const encodedID = `https://fireani.me/api/anime/episode?slug=${id}`;
        const response = await fetch(`${encodedID}`);
        const data = await JSON.parse(response);

        const voeStream = data.data.anime_episode_links.find(link => link.name === 'VOE' && link.lang === 'ger-sub');

        if (voeStream) {
            const newLink = voeStream.link.replace('https://voe.sx/e/', 'https://alejandrocenturyoil.com/e/');
            const tempHTML = await fetch(newLink);

            const htmlContent = await tempHTML;

            const scriptMatch = htmlContent.match(/var\s+sources\s*=\s*({.*?});/s);
            if (scriptMatch) {
                let rawSourcesData = scriptMatch[1];
                const hlsMatch = rawSourcesData.match(/['"]hls['"]\s*:\s*['"]([^'"]+)['"]/);
                if (hlsMatch) {
                    const hlsEncodedUrl = hlsMatch[1]; 

                    const decodedUrl = base64Decode(hlsEncodedUrl);
                    console.log(decodedUrl);
                    return decodedUrl;
                } else {
                    console.log('HLS URL not found in the sources data.');
                }
            } else {
                console.log('No sources variable found in the page.');
            }
        }
        return null;
    } catch (error) {
        console.log('Fetch error:', error);
        return null;
    }
}


//Credits to @hamzenis for decoder <3
function base64Decode(str) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';

    str = String(str).replace(/=+$/, '');

    if (str.length % 4 === 1) {
        throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, idx = 0; (buffer = str.charAt(idx++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}

