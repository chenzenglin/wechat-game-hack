# wechat-game-hack

微信公众号登录。

## 使用

```shell
npm i wechat-game-hack --save
```

```javascript
const Wechat = require('wechat-game-hack');
const API = new Wechat('公众号账号', '公众号密码');
```

### events

#### scan.login

登录认证二维码

```javascript
API.once('scan.login', (filepath) => {
    // 登录二维码图片地址
    console.log(filepath);
});
```

#### vcode 

登录验证码

```javascript
API.once('vcode', (filepath) => {
    // 验证码图片地址
    console.log(filepath);
});
```

### methods

#### login

登录接口

```javascript
/**
 * @desc 登录公众号
 * @param {string} [imgcode] - [可选]验证码
 * @return {Promise<object>} data
 */
API.login().then(data => {
    console.log(data);
}).catch(console.error.bind(console));
```

#### loginchk

检测是否已经登录

```javascript
try {
    let islogin = await API.loginchk();
    console.log('已登录');
} catch(e) {
    console.log('未登录');
}
```

#### qrdecode

二维码解析

```javascript
/**
 * 二维码解析
 * @param {string} url - 远程图片地址/本地图片路径
 * @return {Promise<object>}
 */
API.qrdecode('qrcode-login.png').then((result) => {
    console.log(result.text);
}).catch(console.error.bind(console)); 
```