const htmlparser = require('node-html-parser');
const fs = require('fs');

var headers = {};

async function get(url, dbg) {
    var res = await fetch(url, {
        "body": null,
        "method": "GET",
        "headers": headers
    });
    if (!res.ok) return { error: 'response not ok from ' + url };
    const text = await res.text();
    if (dbg) {
        fs.writeFileSync('debug.html', text, { encoding: 'utf-8' });
    }
    var page;
    try {
        page = htmlparser.parse(text);
    } catch (error) {
        return { error: 'error htmlparser with ' + url, derror: [error.toString(), text.toString()] };
    }
    return page;
}

function convertUrlToTGPreview(url) {
    const urlParts = url.split('/');
    if (urlParts[2] === 't.me' && urlParts.length === 4) {
        return `https://t.me/s/${urlParts[3]}`;
    }
    return url;
}

function parseMessages(root) {
    const messageElements = root.querySelectorAll('.tgme_widget_message');
    const messages = [];

    messageElements.forEach((messageElement) => {
        const channelElement = messageElement.querySelector('.tgme_widget_message_author a');
        const channelId = channelElement.getAttribute('href').split('/').pop();
        const channelName = channelElement.textContent.trim();

        const textElement = messageElement.querySelector('.tgme_widget_message_text');
        let text = '';
        if (textElement) {
            text = textElement.textContent.trim();
        }

        const footerElement = messageElement.querySelector('.tgme_widget_message_footer');
        const viewsElement = footerElement.querySelector('.tgme_widget_message_views');
        let views = '';
        if (viewsElement) {
            views = viewsElement.textContent.trim();
        }

        let haveVideo = false;
        const mediaElements = messageElement.querySelectorAll('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb');
        const mediaUrls = [];
        mediaElements.forEach((mediaElement) => {
            if (!haveVideo) {
                if (mediaElement.classList.contains('tgme_widget_message_video_thumb')) {
                    haveVideo = true;
                }

            }
            const style = mediaElement.getAttribute('style');
            if (style) {
                const match = style.match(/background-image:url\('(.+)'\)/);
                if (match) {
                    const mediaUrl = match[1];
                    mediaUrls.push(mediaUrl);
                }
            }
        });
        const timeElement = footerElement.querySelector('.tgme_widget_message_date time');
        const time = timeElement.getAttribute('datetime');

        const isEdited = footerElement.querySelector('.tgme_widget_message_meta').textContent.includes('edited');

        const pictureElement = messageElement.querySelector('.tgme_widget_message_user_photo img');
        const tgc_picture = pictureElement.getAttribute('src');

        var msg_url = messageElement.getAttribute('data-post');
        if (msg_url) {
            msg_url = 'https://t.me/' + msg_url;
        }

        var result = {
            tgc_picture,
            tgc_channel_id: channelId,
            tgc_channel_name: channelName,
            views,
            is_edited: isEdited,
            time,
            text,
            mediaUrls,
            haveVideo,
            msg_url
            // TODO: haveFile
            // fileName
        };
        const forwardedFromElement = messageElement.querySelector('.tgme_widget_message_forwarded_from');
        if (forwardedFromElement) {
            var forwardedFromUrl = forwardedFromElement.querySelector('a');
            if (forwardedFromUrl) {
                forwardedFromUrl = forwardedFromUrl.getAttribute('href');
            } else {
                forwardedFromUrl = 'https://error.com/'
            }
            var forwardedFromChannelName = forwardedFromElement.querySelector('span');
            if (forwardedFromChannelName) {
                forwardedFromChannelName = forwardedFromChannelName.textContent;
            } else {
                forwardedFromChannelName = 'FWDTGC name unknown';
            }
            result.forwardedFrom = {
                msg_url: forwardedFromUrl,
                tgc_channel_name: forwardedFromChannelName
            };
        }

        messages.push(result);
    });

    return messages;
}

function sanitizeTGCInput(url) {
    const urlParts = url.split('/');
    for (let i = urlParts.length - 1; i >= 0; i--) {
        const part = urlParts[i];
        if (part && part !== '' && !part.includes('?') && !part.includes('.')) {
            return part;
        }
    }
    return '';
}

function idInAllowedRange(id) {
    return /^[a-zA-Z_0-9]+$/.test(id);
}

function isFirstCharLetter(str) {
    return /^[a-zA-Z]/.test(str);
  }

  
async function getTGCMessages(urlInput) {
    const tgc_id = sanitizeTGCInput(urlInput);
    // https://limits.tginfo.me/
    if (tgc_id.length > 32) {
        return { error: 'Long Telegram id (max 32 chars)' };
    }
    if (tgc_id.length < 4) {
        return { error: 'Small Telegram id (min 4 chars)' };
    }
    if(!isFirstCharLetter(tgc_id)){
        return { error: 'First char in Telegram id must be letter'};
    }
    if(!idInAllowedRange(tgc_id)){
        return { error: 'Allowed Telegram id is a-z,A-Z,_,0-9'};
    }
    const preview_url = 'https://t.me/s/' + tgc_id;
    const root = await get(preview_url, 1);
    if (root.error) {
        return root;
    }
    if(!root.querySelector('.tgme_channel_info_header_title')){
        return {error: 'Telegram id not exists!'};
    }
    if(root.querySelector('.tgme_page_context_link')){
        return {error: 'This TG Channel have enabled "Restrict saving content". Who is enabled this, do not know that this can not stop from screenshotting who want!'};
    }
    if(root.querySelector('.tgme_action_button_new')){
        return { error: 'This is user!'}
    }
    const messages = parseMessages(root);
    return messages;
}

async function test() {
    const id = '';
    if (id && id.length > 0) {
        getTGCMessages(id).then(function (messages) {
            console.log(messages);
        });
    }
}

exports.getTGCMessages = getTGCMessages;
exports.sanitizeTGCInput = sanitizeTGCInput;
// test();