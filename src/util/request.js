import request from 'request';
import FileCookieStore from 'tough-cookie-filestore';
import Cache from './cache';

const cookieCache = new Cache('cookie');
const j = request.jar(new FileCookieStore(cookieCache.cacheFile));
const r = request.defaults({
    method: 'POST',
    headers: {
        'Referer': 'https://mp.weixin.qq.com',
        'Host': 'mp.weixin.qq.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
    },
    json: true,
    jar: j,
    followAllRedirects: true,
    followOriginalHttpMethod: true
});

const WechatRequest = (options) => {
    return new Promise((resolve, reject) => {
        r(options, (e, r, body) => {
            if (e) {
                reject(e);
            } else {
                resolve(body);
            }
        });
    });
};

WechatRequest.get = (...options) => {
    return r.get(...options);
};

WechatRequest.login = (url, form, options) => {
    return WechatRequest(Object.assign({
        url: url,
        form: form,
    }, options));
};

WechatRequest.getJSON = (url, refererurl, options) => {
    return WechatRequest(Object.assign({
        method: 'GET',
        headers: {
            'Referer': refererurl,
        },
        url: url,
    }, options));
};

WechatRequest.postPayload = (url, refererurl, form, options) => {
    return WechatRequest(Object.assign({
        headers: {
            'Referer': refererurl,
            'Host': 'game.weixin.qq.com',
        },
        url: url,
        form: JSON.stringify(form),
    }, options));
};

WechatRequest.cookies = () => {
    let cookies = j.getCookies('https://mp.weixin.qq.com');
    let obj = {};
    cookies.forEach(c => {
        obj[c.key] = c.value;
    });
    return obj;
};

export default WechatRequest;