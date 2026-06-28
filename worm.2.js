// ==UserScript==
// @name            蠕虫 2
// @namespace       http://tampermonkey.net/
// @version         0.2
// @description     特定站点的资源下载器
// @author          Mercer
// @icon            https://raw.githubusercontent.com/luhaibing/common-js-functions/main/worm.webp
// @match           *://*/*
// @require         https://raw.githubusercontent.com/luhaibing/common-js-functions/refs/heads/main/tampermonkey.functions.js
// @require         https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
// @require         https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js
// @grant           GM_xmlhttpRequest
// @grant           GM_setClipboard
// @grant           GM_download
// @grant           window.close
// ==/UserScript==

(function () {
    'use strict';

    /**
     * 项
     * @typedef {Object} Item
     * @property {String} href - 连接
     * @property {String|null} file - 文件名
     * @property {Map<String, *>} headers - 自定义请求头，例如 {"User-Agent": "Mozilla/5.0"}
     */


})();
