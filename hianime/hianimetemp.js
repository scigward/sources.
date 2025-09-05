async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://bshar1865-hianime.vercel.app/api/v2/hianime/search?q=${encodedKeyword}&language=dub`);
        const data = JSON.parse(responseText);

        const filteredAnimes = data.data.animes.filter(anime => anime.episodes.dub !== null); 

        
        const transformedResults = data.data.animes.map(anime => ({
            title: anime.name,
            image: anime.poster,
            href: `https://hianime.to/watch/${anime.id}`
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
    try {
        const match = url.match(/https:\/\/hianime\.to\/watch\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://bshar1865-hianime.vercel.app/api/v2/hianime/anime/${encodedID}`);
        const data = JSON.parse(response);
        
        const animeInfo = data.data.anime.info;
        const moreInfo = data.data.anime.moreInfo;

        const transformedResults = [{
            description: animeInfo.description || 'No description available',
            aliases: `Duration: ${animeInfo.stats?.duration || 'Unknown'}`,
            airdate: `Aired: ${moreInfo?.aired || 'Unknown'}`
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

async function extractEpisodes(url) {
    try {
        const match = url.match(/https:\/\/hianime\.to\/watch\/(.+)$/);
        const encodedID = match[1];
        const response = await fetch(`https://bshar1865-hianime.vercel.app/api/v2/hianime/anime/${encodedID}/episodes`);
        const data = JSON.parse(response);

        const transformedResults = data.data.episodes.map(episode => ({
            href: `https://hianime.to/watch/${encodedID}?ep=${episode.episodeId.split('?ep=')[1]}`,
            number: episode.number
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

async function extractStreamUrl(url) {
    try {
        const match = url.match(/https:\/\/hianime\.to\/watch\/(.+)$/);
        if (!match) throw new Error("Invalid URL format");
        const encodedID = match[1];
        
        const response = await fetch(`https://bshar1865-hianime.vercel.app/api/v2/hianime/episode/sources?animeEpisodeId=${encodedID}&category=dub`);
        const responseTwo = await fetch(`https://bshar1865-hianime.vercel.app/api/v2/hianime/episode/sources?animeEpisodeId=${encodedID}&category=sub`);
        
        const data = JSON.parse(response);
        const dataTwo = JSON.parse(responseTwo);
        
        const hlsSource = data.data.sources.find(source => source.type === 'hls');
        const subtitleTrack = dataTwo.data.tracks?.find(track => track.label === 'English');
        
        const result = {
            stream: hlsSource ? hlsSource.url : null,
            subtitles: subtitleTrack ? subtitleTrack.file : null
        };
        
        return JSON.stringify(result);
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}



