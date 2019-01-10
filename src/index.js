import fs from 'fs';
import events from 'events';
import {
    createHash
} from 'crypto';
import WechatRequest from './util/request';
import {
    login
} from './decorators/index';
import Cache from './util/cache';

export default class Wechat extends events {
    constructor(username, pwd) {
        super();

        this.username = username;
        this.pwd = createHash('md5').update(pwd.substr(0, 16)).digest('hex');
        this.islogin = false;
        this.cache = new Cache('wechat');
        this.data = this.cache._data;
        this.count = 0;
    }
    startlogin(imgcode) {
        let form = {
            username: this.username,
            pwd: this.pwd,
            imgcode: imgcode,
            f: 'json',
            ajax: 1,
            userlang: 'zh_CN',
            lang: 'zh_CN',
            token: ''
        }
        return WechatRequest.login('https://mp.weixin.qq.com/cgi-bin/bizlogin?action=startlogin', form).then(body => {
            if (body.base_resp.ret === 0) {
                return this.login_qrcode();
            } else {
                if (body.base_resp.ret === 200008 || body.base_resp.ret === 200027) {
                    return this.login_vcode();
                } else {
                    return new Promise((resolve, reject) => {
                        reject(body);
                    });
                }
            }
        })
    }
    login_vcode() {
        return new Promise((resolve, reject) => {
            let filename = 'verifycode.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`https://mp.weixin.qq.com/cgi-bin/verifycode?username=${this.username}&r=${Date.now()}`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('vcode', filename);
                reject(filename);
            });
        });
    }
    login_qrcode() {
        return new Promise((resolve, reject) => {
            let filename = 'qrcode-login.png';
            let writeStream = fs.createWriteStream(filename);
            WechatRequest.get(`https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=getqrcode&param=4300`).pipe(writeStream).on('error', reject);
            writeStream.on('finish', () => {
                this.emit('scan.login', filename);
                console.log('请扫描二维码确认登录！');
                resolve(filename);
            });
        })
    }
    checkLogin() {
        const chklogin = (resolve, reject) => {
            WechatRequest.getJSON(`https://mp.weixin.qq.com/cgi-bin/loginqrcode?action=ask&random=${Math.random()}`, 'https://mp.weixin.qq.com').then(body => {
                if (body.status === 1) {
                    resolve(body);
                } else if (body.status === 0 || body.status === 4) {
                    if (this.count < 15) {
                        setTimeout(() => {
                            this.count++;
                            chklogin(resolve, reject);
                        }, 2000);
                    } else {
                        reject(body);
                    }
                } else {
                    reject(body);
                }
            }).catch(reject);
        };
        return new Promise(chklogin);
    }
    doLogin() {
        let form = {
            f: 'json',
            ajax: 1,
            userlang: 'zh_CN',
            lang: 'zh_CN',
            token: ''
        }
        let loginAction = (resolve, reject) => {
            WechatRequest.login(`https://mp.weixin.qq.com/cgi-bin/bizlogin?action=login`, form).then(body => {
                let token = null;
                if (body.base_resp.ret === 0 && (token = body.redirect_url.match(/token=(\d+)/))) {
                    this.data.token = token[1];
                    console.log('登录成功，token=' + this.data.token);
                    resolve(token[1]);
                } else if (body.base_resp.ret === -1) {
                    loginAction(resolve, reject);
                } else {
                    reject(body);
                }
            })
        };
        return new Promise(loginAction);
    }
    exit(data) {
        let exitLogin = (resolve, reject) => {
            resolve(data);
        };
        return new Promise(exitLogin);
    }
    loginstep() {
        return this.checkLogin().then(() => this.doLogin()).catch((data) => this.exit(data));
    }
    loginchk() {
        return new Promise((resolve, reject) => {
            if (this.islogin) {
                resolve(this.data);
            } else if (this.data.token) {
                let req = WechatRequest.get('https://mp.weixin.qq.com', (error, response, body) => {
                    if (error) {
                        reject(error);
                    } else {
                        let redirects = req._redirect.redirects;
                        if (redirects && redirects.length) {
                            let redirectUri = redirects[redirects.length - 1].redirectUri;
                            if (/token=(\d+)/.test(redirectUri)) {
                                this.islogin = true;
                                resolve(this.data);
                            } else {
                                reject();
                            }
                        } else {
                            reject();
                        }
                    }
                });
            } else {
                reject();
            }
        });
    }
    login(imgcode) {
        return new Promise((resolve, reject) => {
            this.loginchk().then(resolve).catch(() => {
                this.startlogin(imgcode).then(() => {
                    this.loginstep().then(resolve).catch(reject);
                }).catch((body) => {
                    resolve(body);
                });
            });
        });
    }
    @login
    getthirdurl() {
        return WechatRequest.getJSON(`https://mp.weixin.qq.com/wxopen/frame?token=${this.data.token}&lang=zh_CN&action=plugin_redirect&f=json&ajax=1&plugin_uin=1002&random=${Math.random()}&type=3`, `https://mp.weixin.qq.com/wxopen/visitanalysis?action=get_visit_analysis_page&lang=zh_CN&type=3&token=${this.data.token}&lang=zh_CN`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.plugin_login_info.third_url;
            } else {
                throw body.base_resp.err_msg;
            }
        });
    }
    @login
    gamelogin(thirdurl, query) {
        let form = {
            appid: query.appid,
            openid: query.openid,
            plugin_id: "game",
            plugin_token: query.plugin_token,
        }
        return WechatRequest.postPayload(`https://game.weixin.qq.com/cgi-bin/gamewxagdatawap/mpadminlogin?uin=&key=&pass_ticket=&QB&`, thirdurl, form).then(body => {
            if (body.errcode === 0 && body.errmsg === 'ok') {
                return 0;
            } else {
                throw body.errmsg;
            }
        });
    }
    @login
    getgamedata(thirdurl, query, time) {
        let detail_index_list = [];
        for (let i = 0; i < 13; i++) {
            let info = {};
            info.in = 'detail';
            info.size_type = 24;
            info.time_period = { start_time: time, duration_seconds: 86400 };
            detail_index_list.push(info);
        }
        detail_index_list[0].stat_type = 19;
        detail_index_list[1].stat_type = 1;
        detail_index_list[2].stat_type = 3;
        detail_index_list[3].stat_type = 2;
        detail_index_list[4].stat_type = 7;
        detail_index_list[5].stat_type = 5;
        detail_index_list[6].stat_type = 6;
        detail_index_list[7].stat_type = 2;
        detail_index_list[7].group_by_type = 7;
        detail_index_list[8].stat_type = 11;
        detail_index_list[8].time_period = { start_time: time - 86400, duration_seconds: 86400 };
        detail_index_list[9].stat_type = 22;
        detail_index_list[9].time_period = { start_time: time - 86400 * 2, duration_seconds: 86400 };
        detail_index_list[10].stat_type = 26;
        detail_index_list[10].time_period = { start_time: time - 86400 * 6, duration_seconds: 86400 };
        detail_index_list[11].stat_type = 8;
        detail_index_list[12].stat_type = 9;
        let form = {
            appid: query.appid,
            auth_type: 8,
            detail_index_list: detail_index_list,
            summary_index_list: []
        }
        return WechatRequest.postPayload(`https://game.weixin.qq.com/cgi-bin/gamewxagdatawap/getwxagstat?uin=&key=&pass_ticket=&QB&`, thirdurl, form).then(body => {
            if (body.errcode === 0 && body.errmsg === 'ok') {
                return body.data.detail_list;
            } else {
                throw body.errcode;
            }
        });
    }
    @login
    getgameflow(gettype, starttime, endtime) {
        return WechatRequest.getJSON(`https://mp.weixin.qq.com/wxopen/weapp_publisher_stat?action=stat&page=1&page_size=90&start=${starttime}&end=${endtime}&pos_type=${gettype}&token=${this.data.token}&appid=&spid=&_=${String(Date.now())}`, `https://mp.weixin.qq.com/wxopen/frame?t=promotion/promotion_frame&token=${this.data.token}&page=applet/data_stat`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.cost_list.cost;
            } else {
                return 1;
            }
        });
    }
    @login
    getonedayin(startdate, enddate) {
        return WechatRequest.getJSON(`https://mp.weixin.qq.com/wxopen/weapp_publisher_stat?action=income&page=1&page_size=10&start_date=${startdate}&end_date=${enddate}&token=${this.data.token}&appid=&spid=&_=${String(Date.now())}`, `https://mp.weixin.qq.com/wxopen/frame?t=promotion/promotion_frame&token=${this.data.token}&page=applet/recharge`).then(body => {
            if (body.base_resp.ret === 0) {
                return body.income_list;
            } else {
                throw body.base_resp.err_msg;
            }
        });
    }
    @login
    gettotalin(startdate, enddate) {
        return WechatRequest.getJSON(`https://mp.weixin.qq.com/wxopen/weapp_publisher_stat?action=income&page=1&page_size=10&start_date=${startdate}&end_date=${enddate}&cont_type=1&token=${this.data.token}&appid=&spid=&_=${String(Date.now())}`, `https://mp.weixin.qq.com/wxopen/frame?t=promotion/promotion_frame&token=${this.data.token}&page=applet/recharge`).then(body => {
            if (body.base_resp.ret === 0) {
                return body;
            } else {
                throw body.base_resp.err_msg;
            }
        });
    }
}