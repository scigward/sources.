///////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Main Functions          //////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

async function searchResults(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const searchApiUrl = `https://aniworld.to/ajax/seriesSearch?keyword=${encodedKeyword}`;
    const responseText = await fetch(searchApiUrl);

    const data = await JSON.parse(responseText);

    const transformedResults = data.map((anime) => ({
      title: anime.name,
      image: `https://aniworld.to${anime.cover}`,
      href: `https://aniworld.to/anime/stream/${anime.link}`,
    }));

    return JSON.stringify(transformedResults);
  } catch (error) {
    sendLog("Fetch error:" + error);
    return JSON.stringify([{ title: "Error", image: "", href: "" }]);
  }
}

async function extractDetails(url) {
  try {
    const fetchUrl = `${url}`;
    const text = await fetch(fetchUrl);

    const descriptionRegex =
      /<p\s+class="seri_des"\s+itemprop="accessibilitySummary"\s+data-description-type="review"\s+data-full-description="([^"]*)".*?>(.*?)<\/p>/s;
    const aliasesRegex = /<h1\b[^>]*\bdata-alternativetitles="([^"]+)"[^>]*>/i;

    const aliasesMatch = aliasesRegex.exec(text);
    let aliasesArray = [];
    if (aliasesMatch) {
      aliasesArray = aliasesMatch[1].split(",").map((a) => a.trim());
    }

    const descriptionMatch = descriptionRegex.exec(text) || [];

    const airdateMatch = "Unknown"; // TODO: Implement airdate extraction

    const transformedResults = [
      {
        description: descriptionMatch[1] || "No description available",
        aliases: aliasesArray[0] || "No aliases available",
        airdate: airdateMatch,
      },
    ];

    return JSON.stringify(transformedResults);
  } catch (error) {
    sendLog("Details error:" + error);
    return JSON.stringify([
      {
        description: "Error loading description",
        aliases: "Duration: Unknown",
        airdate: "Aired: Unknown",
      },
    ]);
  }
}

async function extractEpisodes(url) {
  try {
    const baseUrl = "https://aniworld.to";
    const fetchUrl = `${url}`;
    const html = await fetch(fetchUrl);

    const finishedList = [];
    const seasonLinks = getSeasonLinks(html);

    for (const seasonLink of seasonLinks) {
      const seasonEpisodes = await fetchSeasonEpisodes(
        `${baseUrl}${seasonLink}`
      );
      finishedList.push(...seasonEpisodes);
    }

    // Replace the field "number" with the current index of each item, starting from 1
    finishedList.forEach((item, index) => {
      item.number = index + 1;
    });

    return JSON.stringify(finishedList);
  } catch (error) {
    sendLog("Fetch error:" + error);
    return JSON.stringify([{ number: "0", href: "" }]);
  }
}

async function extractStreamUrl(url) {
  try {
    const baseUrl = "https://aniworld.to";
    const fetchUrl = `${url}`;
    const text = await fetch(fetchUrl);

    const finishedList = [];
    const languageList = getAvailableLanguages(text);
    const videoLinks = getVideoLinks(text);

    for (const videoLink of videoLinks) {
      const language = languageList.find(
        (l) => l.langKey === videoLink.langKey
      );
      if (language) {
        finishedList.push({
          provider: videoLink.provider,
          href: `${baseUrl}${videoLink.href}`,
          language: language.title,
        });
      }
    }

    // Select the hoster
    const selectedHoster = selectHoster(finishedList);
    const provider = selectedHoster.provider;
    const providerLink = selectedHoster.href;
    if (provider === "Error") {
      sendLog("No video found");
      return JSON.stringify([{ provider: "Error", link: "" }]);
    }
    sendLog("Selected provider: " + provider);
    sendLog("Selected link: " + providerLink);

    const videoPage = await fetch(providerLink);
    sendLog("Video Page: " + videoPage.length);

    const winLocRegex = /window\.location\.href\s*=\s*['"]([^'"]+)['"]/;
    const winLocMatch = winLocRegex.exec(videoPage);
    let winLocUrl = null;
    if (!winLocMatch) {
      winLocUrl = providerLink;
    } else {
      winLocUrl = winLocMatch[1];
    }

    const hlsSourceResponse = await fetch(winLocUrl);
    const hlsSourcePage =
      typeof hlsSourceResponse === "object"
        ? await hlsSourceResponse.text()
        : await hlsSourceResponse;
    sendLog("Provider: " + provider);
    sendLog("URL: " + winLocUrl);
    sendLog("HLS Source Page: " + hlsSourcePage.length);
    
    switch (provider) {
      case "VOE":
      try {
        const voeJson = voeExtractor(hlsSourcePage);
        return voeJson?.source || JSON.stringify([{ provider: "Error", link: "" }]);
      } catch (error) {
        sendLog("VOE extractor error: " + error);
        return JSON.stringify([{ provider: "Error", link: "" }]);
      }

      case "SpeedFiles":
      try {
        const speedfilesUrl = await speedfilesExtractor(hlsSourcePage);
        return speedfilesUrl || JSON.stringify([{ provider: "Error", link: "" }]);
      } catch (error) {
        sendLog("Speedfiles extractor error: " + error);
        return JSON.stringify([{ provider: "Error", link: "" }]);
      }

      case "Vidmoly":
      try {
        const vidmolyUrl = vidmolyExtractor(hlsSourcePage);
        return vidmolyUrl || JSON.stringify([{ provider: "Error", link: "" }]);
      } catch (error) {
        sendLog("Vidmoly extractor error: " + error);
        return JSON.stringify([{ provider: "Error", link: "" }]);
      }

      default:
      sendLog("Unsupported provider:", provider);
      return JSON.stringify([{ provider: "Error", link: "" }]);
    }
    // END OF VOE EXTRACTOR

    // Extract the sources variable and decode the hls value from base64
    const sourcesRegex = /var\s+sources\s*=\s*({[^}]+})/;
    const sourcesMatch = sourcesRegex.exec(hlsSourcePage);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;

    return sourcesString;
  } catch (error) {
    sendLog("ExtractStreamUrl error:" + error);
    return JSON.stringify([{ provider: "Error1", link: "" }]);
  }
}

function selectHoster(finishedList) {
  let firstVideo = null;
  let provider = null;

  // Define the preferred providers and languages
  const providerList = ["Vidmoly", "SpeedFiles", "VOE"];
  const languageList = ["Deutsch", "mit Untertitel Deutsch"];
  

  for (const providerName of providerList) {
    for (const language of languageList) {
      const video = finishedList.find(
        (video) => video.provider === providerName && video.language === language
      );
      if (video) {
        provider = providerName;
        firstVideo = video;
        break;
      }
    }
    if (firstVideo) break;
  }

  // Default to the first video if no match is found
  if (!firstVideo) {
    firstVideo = finishedList[0];
  }

    if (firstVideo) {
      return {
        provider: provider,
        href: firstVideo.href,
      };
    } else {
      sendLog("No video found");
      return {
        provider: "Error",
        href: "https://error.org",
      };
    }
}

//Thanks to Ibro and Cufiy
async function vidmolyExtractor(html) {
  sendLog("Vidmoly extractor");
  sendLog(html);
    const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
    const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
    const fallback = /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;


    let match = html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    sendLog("Vidmoly extractor: Match found");
    const decodedHtml = atob(match[1]); // Decode base64
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);

    if (!iframeMatch) {
        sendLog("Vidmoly extractor: No iframe match found");
        return null;
    }

    const streamUrl = iframeMatch[1].startsWith("//") ? "https:" + iframeMatch[1] : iframeMatch[1];
    sendLog("Vidmoly extractor: Stream URL: " + streamUrl);

    const responseTwo = await fetchv2(streamUrl);
    const htmlTwo = await responseTwo.text();

    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    sendLog(m3u8Match ? m3u8Match[1] : null);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    sendLog("Vidmoly extractor: No match found, using fallback");
  //  regex the sources: [{file:"this_is_the_link"}]
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;

    return sourcesString;
  }
}
    

// Thanks to Cufiy
function speedfilesExtractor(sourcePageHtml) {
  // get var _0x5opu234 = "THIS_IS_AN_ENCODED_STRING"
  const REGEX = /var\s+_0x5opu234\s*=\s*"([^"]+)"/;
  const match = sourcePageHtml.match(REGEX);
  if (match == null || match[1] == null) {
    sendLog("Could not extract from Speedfiles source");
    return null;
  }

  const encodedString = match[1];
  sendLog("Encoded String:" + encodedString);

  // Step 1: Base64 decode the initial string
  let step1 = atob(encodedString);
  sendLog("Step 1:" + step1);

  // Step 2: Swap character cases and reverse
  let step2 = step1
    .split("")
    .map((c) =>
      /[a-zA-Z]/.test(c)
        ? c === c.toLowerCase()
          ? c.toUpperCase()
          : c.toLowerCase()
        : c
    )
    .join("");
  sendLog("Step 2:" + step2);
  let step3 = step2.split("").reverse().join("");
  sendLog("Step 3:" + step3);

  // Step 3: Base64 decode again and reverse
  let step4 = atob(step3);
  sendLog("Step 4:" + step4);
  let step5 = step4.split("").reverse().join("");
  sendLog("Step 5:" + step5);

  // Step 4: Hex decode pairs
  let step6 = "";
  for (let i = 0; i < step5.length; i += 2) {
    step6 += String.fromCharCode(parseInt(step5.substr(i, 2), 16));
  }
  sendLog("Step 6:" + step6);

  // Step 5: Subtract 3 from character codes
  let step7 = step6
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - 3))
    .join("");
  sendLog("Step 7:" + step7);

  // Step 6: Final case swap, reverse, and Base64 decode
  let step8 = step7
    .split("")
    .map((c) =>
      /[a-zA-Z]/.test(c)
        ? c === c.toLowerCase()
          ? c.toUpperCase()
          : c.toLowerCase()
        : c
    )
    .join("");
  sendLog("Step 8:" + step8);
  let step9 = step8.split("").reverse().join("");
  sendLog("Step 9:" + step9);

  // return atob(step9);
  let decodedUrl = atob(step9);
  sendLog("Decoded URL:" + decodedUrl);
  return decodedUrl;
}



/**
 * @name voeExtractor
 * @author Cufiy
 */

function voeExtractor(html, url = null) {
// Extract the first <script type="application/json">...</script>
    const jsonScriptMatch = html.match(
      /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!jsonScriptMatch) {
      sendLog("No application/json script tag found");
      return null;
    }


    const obfuscatedJson = jsonScriptMatch[1].trim();

  let data;
  try {
    data = JSON.parse(obfuscatedJson);
  } catch (e) {
    throw new Error("Invalid JSON input.");
  }
  if (!Array.isArray(data) || typeof data[0] !== "string") {
    throw new Error("Input doesn't match expected format.");
  }
  let obfuscatedString = data[0];

  // Step 1: ROT13
  let step1 = voeRot13(obfuscatedString);

  // Step 2: Remove patterns
  let step2 = voeRemovePatterns(step1);

  // Step 3: Base64 decode
  let step3 = voeBase64Decode(step2);

  // Step 4: Subtract 3 from each char code
  let step4 = voeShiftChars(step3, 3);

  // Step 5: Reverse string
  let step5 = step4.split("").reverse().join("");

  // Step 6: Base64 decode again
  let step6 = voeBase64Decode(step5);

  // Step 7: Parse as JSON
  let result;
  try {
    result = JSON.parse(step6);
  } catch (e) {
    throw new Error("Final JSON parse error: " + e.message);
  }
  sendLog("Decoded JSON:", result);

  // check if direct_access_url is set, not null and starts with http
  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      result.source
        .map((source) => source.direct_access_url)
        .find((url) => url && url.startsWith("http"));
    if (streamUrl) {
      sendLog("Voe Stream URL: " + streamUrl);
      return streamUrl;
    } else {
      sendLog("No stream URL found in the decoded JSON");
    }
  }
  return result;
}

function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
        ? c
        : c - 26
    );
  });
}

function voeRemovePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let result = str;
  for (const pat of patterns) {
    result = result.split(pat).join("");
  }
  return result;
}

function voeBase64Decode(str) {
  // atob is available in browsers and Node >= 16
  if (typeof atob === "function") {
    return atob(str);
  }
  // Node.js fallback
  return Buffer.from(str, "base64").toString("utf-8");
}

function voeShiftChars(str, shift) {
  return str
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - shift))
    .join("");
}

////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////////
////////////////////////////      for ExtractEpisodes     ////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////

// Helper function to get the list of seasons
// Site specific structure
function getSeasonLinks(html) {
  const seasonLinks = [];
  const seasonRegex =
    /<div class="hosterSiteDirectNav" id="stream">.*?<ul>(.*?)<\/ul>/s;
  const seasonMatch = seasonRegex.exec(html);
  if (seasonMatch) {
    const seasonList = seasonMatch[1];
    const seasonLinkRegex = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let seasonLinkMatch;
    const filmeLinks = [];
    while ((seasonLinkMatch = seasonLinkRegex.exec(seasonList)) !== null) {
      const [_, seasonLink] = seasonLinkMatch;
      if (seasonLink.endsWith("/filme")) {
        filmeLinks.push(seasonLink);
      } else {
        seasonLinks.push(seasonLink);
      }
    }
    seasonLinks.push(...filmeLinks);
  }
  return seasonLinks;
}

// Helper function to fetch episodes for a season
// Site specific structure
async function fetchSeasonEpisodes(url) {
  try {
    const baseUrl = "https://aniworld.to";
    const fetchUrl = `${url}`;
    const text = await fetch(fetchUrl);

    // Updated regex to allow empty <strong> content
    const regex =
      /<td class="seasonEpisodeTitle">\s*<a[^>]*href="([^"]+)"[^>]*>.*?<strong>([^<]*)<\/strong>.*?<span>([^<]+)<\/span>.*?<\/a>/g;

    const matches = [];
    let match;
    let holderNumber = 0;

    while ((match = regex.exec(text)) !== null) {
      const [_, link] = match;
      matches.push({ number: holderNumber, href: `${baseUrl}${link}` });
    }

    return matches;
  } catch (error) {
    sendLog("FetchSeasonEpisodes helper function error:" + error);
    return [{ number: "0", href: "https://error.org" }];
  }
}

////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////
////////////////////////////      for ExtractStreamUrl    ////////////////////////
/////////////////////////////////////////////////////////////////////////////////

// Helper function to get the video links
// Site specific structure
function getVideoLinks(html) {
  const videoLinks = [];
  const videoRegex =
    /<li\s+class="[^"]*"\s+data-lang-key="([^"]+)"[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>.*?<h4>([^<]+)<\/h4>.*?<\/a>.*?<\/li>/gs;
  let match;

  while ((match = videoRegex.exec(html)) !== null) {
    const [_, langKey, href, provider] = match;
    videoLinks.push({ langKey, href, provider });
  }

  return videoLinks;
}

// Helper function to get the available languages
// Site specific structure
function getAvailableLanguages(html) {
  const languages = [];
  const languageRegex =
    /<img[^>]*data-lang-key="([^"]+)"[^>]*title="([^"]+)"[^>]*>/g;
  let match;

  while ((match = languageRegex.exec(html)) !== null) {
    const [_, langKey, title] = match;
    languages.push({ langKey, title });
  }

  return languages;
}

// Helper function to fetch the base64 encoded string
function base64Decode(str) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";

  str = String(str).replace(/=+$/, "");

  if (str.length % 4 === 1) {
    throw new Error(
      "'atob' failed: The string to be decoded is not correctly encoded."
    );
  }

  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
}

// Debugging function to send logs
async function sendLog(message) {
    // send http://192.168.2.130/sora-module/log.php?action=add&message=message
    console.log(message);

    await fetch('http://192.168.2.130/sora-module/log.php?action=add&message=' + encodeURIComponent(message))
    .catch(error => {
        console.error('Error sending log:', error);
    });
}
