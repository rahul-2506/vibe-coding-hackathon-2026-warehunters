import fetch from 'node-fetch';

async function dumpDivs() {
    const fullQuery = `site:amazon.in iphone`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(fullQuery)}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    try {
        const response = await fetch(url, { headers, timeout: 6000 });
        const html = await response.text();
        
        console.log('HTML contains "<div":', html.includes('<div'));
        
        // Find first 10 divs
        let pos = 0;
        for (let i = 0; i < 15; i++) {
            pos = html.indexOf('<div', pos);
            if (pos === -1) break;
            const end = html.indexOf('>', pos);
            console.log(`Div ${i + 1}: ${html.substring(pos, end + 1)}`);
            pos = end + 1;
        }

        // Find links that look like external links
        console.log('\nSample external links:');
        let lPos = 0;
        let count = 0;
        while ((lPos = html.indexOf('href="http', lPos)) !== -1 && count < 10) {
            const end = html.indexOf('"', lPos + 6);
            const link = html.substring(lPos + 6, end);
            if (!link.includes('duckduckgo.com')) {
                console.log(link);
                count++;
            }
            lPos = end + 1;
        }

    } catch (e) {
        console.error(e);
    }
}

dumpDivs();
