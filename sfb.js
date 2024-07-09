const htmlparser = require('node-html-parser');
const fs = require('fs');

var headers = {};

async function get(url, dbg) {
    var res = await fetch(url, {
        "body": null,
        "method": "GET",
        "headers": headers
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (dbg) {
        fs.writeFileSync('debug.html', text, { encoding: 'utf-8' });
    }
    const page = htmlparser.parse(text);
    return page;
}


async function randomPicURL() {
    const page = await get('https://safebooru.org/index.php?page=post&s=random', 1);
    if (page.error) {
        return page;
    }
    const metaTags = page.querySelectorAll('meta');
    var url;
    metaTags.forEach((tag) => {
        const property = tag.getAttribute('property');
        if (property == 'og:image') {
            url = tag.getAttribute('content');
        }
    });
    if(url){
        return url;
    }
    return { error: 'parse' };
}

async function test() {
    const url = await randomPicURL();
    console.log(url);
}
exports.randomPicURL = randomPicURL;
// test();