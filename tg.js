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
    if(dbg){
        fs.writeFileSync('debug.html', text, {encoding: 'utf-8'});
    }
    const page = htmlparser.parse(text);
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
    if(msg_url){
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
        if(forwardedFromUrl){
            forwardedFromUrl = forwardedFromUrl.getAttribute('href');
        }else{
            forwardedFromUrl = 'https://error.com/'
        }
        var forwardedFromChannelName = forwardedFromElement.querySelector('span');
        if(forwardedFromChannelName){
            forwardedFromChannelName = forwardedFromChannelName.textContent;
        }else{
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

async function getTGCMessages(url){
    var urlObj;
    if(!url.startsWith('http')){
        url = 'https://t.me/' + url;
    }
    try {
        urlObj = new URL(url);
    } catch (error) {
        return {error: 'Wrong url ' + url};
    }
    const preview_url = convertUrlToTGPreview(url);
    const root = await get(preview_url, 0);
    const messages = parseMessages(root);
    return messages;
}

async function test(){
    const id = '';
    if(id && id.length > 0){
        getTGCMessages(id).then(function (messages) {
            console.log(messages);
        });
    }
}

exports.getTGCMessages = getTGCMessages;
test();