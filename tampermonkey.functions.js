/**
 * 学习和编写 Tampermonkey 脚本时常用的函数
 */

// ------------------------------- function  -------------------------------

/**
 * 日志打印
 * @param {*} args - 参数
 */
function log(...args) {
    console.log(...args);
}

/**
 * 获取字符串的字节数
 * 非西欧字符占2个字节, 其他占1个字节
 * @param {String} value
 * @returns {Number}
 */
function str2len(value) {
    const isCJK = function (code) {
        return (code >= 0x4E00 && code <= 0x9FFF) ||   // 基本区
            (code >= 0x3400 && code <= 0x4DBF) ||   // 扩展 A
            (code >= 0x20000 && code <= 0x2A6DF) || // 扩展 B
            (code >= 0xF900 && code <= 0xFAFF) ||   // 兼容汉字
            (code >= 0x2F800 && code <= 0x2FA1F);   // 兼容补充
    }
    let length = 0;
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if ((isCJK(code))) {
            //如果是汉字，则字符串长度加2
            length += 2;
        } else {
            length++;
        }
    }
    return length;
}

// ------------------------------- check -------------------------------

/**
 * 是否可迭代
 * @param {*} value
 * @returns {Boolean}
 */
function isIterable(value) {
    return Boolean(value && (typeof value[Symbol.iterator] === "function"));
}

/**
 * 是否为对象
 * @param {*} value
 * @returns {Boolean}
 */
function isObject(value) {
    return Boolean(value && (Object.prototype.toString.call(value) === "[object Object]"));
}

/**
 * 是否为字符串
 * @param {*} value
 * @returns {Boolean}
 */
function isStr(value) {
    return Boolean(value && (typeof value === "string"));
}

/**
 * 是否为函数
 * @param {*} value
 * @returns {Boolean}
 */
function isFunction(value) {
    return Boolean(value && (typeof value === "function"));
}

/**
 * 有效字符串
 * @param {*} value
 * @returns {Boolean}
 */
function isValidStr(value) {
    return Boolean(isStr(value) && value.trim().length > 0);
}

/**
 * 包含子项的迭代对象
 * @param {*} value
 * @returns {Boolean}
 */
function isValidIterable(value) {
    return Boolean(isIterable(value) && Array.from(value).length > 0);
}

/**
 * 所有子项都满足条件
 * @param value
 * @param predicate
 * @returns {Boolean}
 */
function all(value, predicate) {
    if (!isValidIterable(value) || !predicate) {
        return false;
    }
    const values = Array.from(value);
    const invert = function (value) {
        return Boolean(!predicate(value));
    }
    const find = values.find(invert);
    return Boolean(find === null || find === undefined);
}

/**
 * 任意子项满足条件
 * @param value
 * @param predicate
 * @returns {Boolean}
 */
function any(value, predicate) {
    if (!isValidIterable(value) || !predicate) {
        return false;
    }
    const values = Array.from(value);
    const find = values.find(predicate);
    return Boolean(find !== null && find !== undefined);
}

// ------------------------------- singleton -------------------------------

const SingletonMap = new Map();

/**
 * 单例
 * @param prototype
 * @param args
 * @returns {any}
 */
function singleton(prototype, ...args) {
    if (!prototype) {
        throw "prototype can not be null.";
    }

    function keys(values) {
        return values.map(function (value) {
            if (value === null) {
                return "null:";
            } else if (value === undefined) {
                return "undefined:";
            } else {
                // typeof : number, boolean, string, undefined, object, function, symbol, bigint
                return `${typeof (value)}:${value}`
            }
        }).join(';');
    }

    // number|boolean|string|object|function|symbol|bigint|undefined|null
    const key = (args.length === 0) ? prototype.name : `${prototype.name}-${keys(args)}`;
    let value = SingletonMap.get(key);
    if (!value) {
        value = new prototype(...args);
        SingletonMap.set(key, value);
    }
    return value;
}

// ------------------------------- types.js -------------------------------

/**
 * 请求参数
 * @typedef {Object} XmlhttpRequestOptions
 * @property {String} method - 请求方法，如 GET、POST、HEAD 等
 * @property {Dict<String, String>} headers - 自定义请求头，例如 {"User-Agent": "Mozilla/5.0"}
 * @property {String|FormData|Blob|File|Array|ArrayBuffer|FormData|URLSearchParams|Object} data - 要发送的数据，常用于 POST 请求
 * @property {Number} timeout - 请求超时时间，单位为毫秒 (ms)
 * @property {'arraybuffer'|'blob'|'json'|'stream'} responseType - 期望的响应数据类型，如 json、arraybuffer、blob
 * @property {function(XmlhttpResponse): void} onabort - 请求被中止时触发
 * @property {function(XmlhttpResponse): void} onerror - 请求发生错误时触发
 * @property {function(ProgressEvent): void} onloadstart - 加载开始时执行的回调函数，如果 responseTypes 设置为 stream，则可访问流对象
 * @property {function(ProgressEvent): void} onprogress - 请求有新进度时触发
 * @property {function(XmlhttpResponse): void} onreadystatechange - 请求的 readyState 状态发生改变时触发
 * @property {function(XmlhttpResponse): void} ontimeout - 请求超时时触发
 * @property {function(XmlhttpResponse): void} onload - 请求成功完成时触发。响应对象会作为参数传入
 * @property {String} cookie - 添加到请求中的 Cookie
 * @property {Object} cookiePartition - 分区 Cookie 的 partition key(v5.2+)
 * @property {Boolean} binary - 以二进制模式发送 data 字符串
 * @property {Object} context - 自定义属性，会原样附加到 response 对象中，方便在回调中传递数据
 * @property {String} overrideMimeType - 覆盖响应的 MIME 类型
 * @property {Boolean} anonymous - 设为 true 时，请求将不携带 Cookies
 * @property {Boolean} nocache - 禁止缓存,完全跳过缓存，每次都向服务器请求一份全新的资源
 * @property {Boolean} revalidate - 重新验证可能缓存的内容, 有条件地使用缓存。如果缓存有效，则使用；如果无效或过期，则向服务器重新验证并获取新内容
 * @property {Boolean} fetch - 使用 fetch API 替代 XHR(⚠️ 会导致 timeout 和 onprogress 失效)
 * @property {'follow'|'error'|'manual'} redirect - 重定向处理策略(build 6180+)
 * @property {String} user - HTTP 认证用户名
 * @property {String} password - HTTP 认证密码
 * @property {XmlhttpRequestProxyConfig} proxy - 代理配置(仅 Firefox)
 *
 * @property {function(XmlhttpResponse): void} onAbort 请求被中止时触发
 * @property {function(XmlhttpResponse): void} on_abort 请求被中止时触发
 * @property {function(XmlhttpResponse): void} onError 请求发生错误时触发
 * @property {function(XmlhttpResponse): void} on_error 请求发生错误时触发
 * @property {function(XmlhttpResponse): void} onLoadstart 加载开始时执行的回调函数，如果 responseTypes 设置为 stream，则可访问流对象
 * @property {function(XmlhttpResponse): void} on_loadstart 加载开始时执行的回调函数，如果 responseTypes 设置为 stream，则可访问流对象
 * @property {function(XmlhttpResponse): void} onProgress 请求有新进度时触发
 * @property {function(XmlhttpResponse): void} on_progress 请求有新进度时触发
 * @property {function(XmlhttpResponse): void} onTimeout 请求超时时触发
 * @property {function(XmlhttpResponse): void} on_timeout 请求超时时触发
 * @property {function(XmlhttpResponse): void} onLoad 请求成功完成时触发。响应对象会作为参数传入
 * @property {function(XmlhttpResponse): void} on_load 请求成功完成时触发。响应对象会作为参数传入
 */

/**
 * 响应
 * @typedef {Object} XmlhttpResponse
 * @property {Number} status - HTTP 状态码
 * @property {String} statusText - HTTP 状态文本
 * @property {String} responseText - 响应文本
 * @property {Object} response - 响应数据(如果设置了 responseType)
 * @property {Document} responseXML - 响应作为 XML 文档
 * @property {String} responseHeaders - 响应头字符串
 * @property {String} finalUrl - 最终 URL(经过重定向后)
 * @property {Number} readyState - 请求状态码
 */

/**
 * 代理
 * @typedef {Object} XmlhttpRequestProxyConfig
 * @property {'direct'|'http'|'https'|'socks'|'socks4'} type - 代理类型
 * @property {String} host - 代理主机
 * @property {Number} port - 代理端口
 * @property {String} username - SOCKS 用户名
 * @property {String} password - SOCKS 密码
 * @property {Boolean} proxyDNS - 通过代理解析 DNS
 * @property {Number} failoverTimeout - 故障转移超时(秒)
 * @property {String} proxyAuthorizationHeader - Proxy-Authorization 头
 */

// ------------------------------- prototype -------------------------------

/**
 * 去重
 * @template T 当前数组类型
 * @param {function(T): *} predicate
 * @returns {Array|*[]}
 */
Array.prototype.distinct = function (predicate = null) {
    if (predicate == null) {
        return this;
    } else {
        const values = [];
        const key = function (value) {
            return value ? predicate(value) ?? JSON.stringify(value) : null;
        }
        // 1.双for循环，外层循环，内层比较，如果有相同就跳过，不同就push进新数组，在return新数组
        /*
        const length = this.length;
        for (let i = 0; i < length; i++) {
            for (let j = i + 1; j < length; j++) {
                const k1 = key(this[i]);
                const k2 = key(this[j]);
                if (k1 === k2) {
                    j = ++i;
                }
            }
            values.push(this[i])
        }
        */
        // 2.Array 利用 indexof()、includes(),Set 利用 has().
        /*
        const keys = new Set();
        Array.from([]).includes()
        for (const value of this) {
            const k = key(value);
            if (!keys.has(k)) {
                keys.add(k);
                values.push(value);
            }
        }
        */
        // 3.利用对象的属性不能相同的特点进行去重
        const dict = {};
        for (const value of this) {
            const k = key(value);
            if (!(k in dict)) {
                dict[k] = 1;
                values.push(value);
            }
        }
        return values;
    }
}

/**
 * 纠正、修正数组
 * @template T - 当前数组类型
 * @template Y - 结果数组类型
 * @param {(function(T[]): Y[])|null} predicate - 接收当前数组，返回修正后的数组
 * @returns {Y[]}
 */
Array.prototype.let = function (predicate = null) {
    return predicate ? predicate?.(this) : this;
}

/**
 * XmlhttpResponse 转 字节数组
 * @returns {Promise<Uint8Array>}
 */
Promise.prototype.response2array = function () {
    return this.then(function (res) {
        const {responseText} = res;
        if (!responseText) {
            // response 转化 Uint8Array 失败
            throw "response translating Uint8Array failed."
        }
        const data = new Uint8Array(responseText.length);
        let index = 0;
        while (index < responseText.length) {
            data[index] = responseText.charCodeAt(index);
            index++;
        }
        return data;
    });
}

// ------------------------------- Promise/async -------------------------------

/**
 * 失败后重试
 * @template T - 当前数组类型
 * @param {(function(): T)} func - 需要包装的函数
 * @param {Number} times - 最大重试次数
 * @param {(function(T): void)} throwable - 验证响应[不通过时抛出异常]
 * @returns {Promise<*>}
 */
async function retry(func, times = 5, throwable = null) {
    let use = times || 5;
    return new Promise(async function (resolve, reject) {
        while (true) {
            try {
                use--;
                const response = await func();
                throwable?.(response)
                resolve(response);
                break;
            } catch (error) {
                if (use) {
                    continue;
                }
                reject(error);
                break;
            }
        }
    });
}

/**
 * 异步池限制并发数
 * @template T - 当前数组类型
 * @param {*[]} elements - 数据
 * @param {(function(*,number,...): T)} func - 执行函数
 * @param {Number} limit - 并发数
 * @param {*} args - 参数
 * @returns {Promise<Awaited<*>[]>}
 */
async function asyncPool(elements, func, limit = 5, ...args) {
    // 所有任务
    const all = [];
    // 预先执行的任务
    const executing = [];
    for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const promise = Promise.resolve().then(function () {
            return func(element, i, ...args);
        });
        // 方便最后统一获取结果
        all.push(promise);
        if (limit >= elements.length) {
            // 限制数 大于 数组长度
            continue;
        }
        const wrap = promise.then(function (v) {
            // 完成后将自身从正在执行的数组中移除
            executing.splice(executing.indexOf(wrap), 1)
            return v;
        });
        executing.push(wrap);
        if (executing.length < limit) {
            // 需要执行的数组长度 小于 限制数
            continue;
        }
        // 等待完成其中最先获得结果的一个
        await Promise.race(executing);
    }
    // Promise实例 每部分只会执行一次
    // 如果 Promise实例 先添加到 executing 执行过一次 最后在 Promise.all() 只会得到结果(得到结果)
    return Promise.all(all);
}

/**
 * 延迟 value ms
 * @param {Number} value - 链接
 * @returns {Promise<void>}
 */
async function delay(value) {
    return new Promise(function (resolve) {
        setTimeout(resolve, value);
    });
}

// -------------------------------- web --------------------------------

/**
 * 解析链接
 * @param {String} value - 链接
 * @returns {Object}
 */
function parseURL(value) {
    const url = new URL(value);
    // https://user:pass@example.com:8080/path?query=1&key=2#hash
    return {

        //// 读写

        // https: 协议方案，包含最后的 ':'
        get protocol() {
            return url.protocol;
        },
        set protocol(v) {
            url.protocol = v;
        },

        // user 在域名之前指定的用户名
        get username() {
            const v = url.username;
            if (v == null || v.trim().length === 0) {
                return null;
            }
            return v.trim();
        },
        set username(v) {
            url.username = v;
        },

        // pass 在域名之前指定的密码
        get password() {
            const v = url.password;
            if (v == null || v.trim().length === 0) {
                return null;
            }
            return v.trim();
        },
        set password(v) {
            url.password = v;
        },

        // example.com 域名（不包含端口）
        get hostname() {
            return url.hostname;
        },
        set hostname(v) {
            url.hostname = v;
        },

        // 8080 端口号（字符串类型）
        get port() {
            const v = url.port;
            if (v == null || v.trim().length === 0) {
                return null;
            }
            return v.trim();
        },
        set port(v) {
            url.port = v;
        },

        // /path 路径，以 / 开头
        get pathname() {
            const v = url.pathname;
            if (v == null || v.trim().length === 0 || v.trim() === "/") {
                return null;
            }
            return v.trim();
        },
        set pathname(v) {
            url.pathname = v;
        },

        // ?query=1&key=2 查询字符串，以 ? 开头
        get search() {
            const v = url.search;
            if (v == null || v.trim().length === 0) {
                return null;
            }
            return v.trim();
        },
        set search(v) {
            if (v == null) {
                url.search = "";
            } else {
                url.search = v;
            }
        },

        // #hash 片段标识符，以 # 开头
        get hash() {
            const v = url.hash;
            if (v == null || v.trim().length === 0) {
                return null;
            }
            return v.trim();
        },
        set hash(v) {
            url.hash = v;
        },

        // {"query":1, "key":2} 查询参数的 URLSearchParams 对象
        get searchParams() {
            const v = url.searchParams;
            if (v == null || v.size === 0) {
                return null;
            }
            return v;
        },
        set searchParams(v) {
            if (typeof v == "string") {
                this.search = v;
            } else {
                url.searchParams = v;
            }
        },

        //// 只读

        // https://user:pass@example.com:8080/path?query=1#hash 完整的 URL 字符串
        get href() {
            return url.href;
        },

        // https://example.com:8080 源（协议+域名+端口）
        get origin() {
            return url.origin;
        },

        // example.com:8080 域名 + 端口（包含 ':'）
        get host() {
            return url.host;
        },

    };
}

/**
 * 查询元素
 * @param {Document} doc - 文档
 * @param {String} value - 节点规则
 * @returns {Element[]|null}
 */
function query(doc, value) {
    function css(doc, value) {
        const finds = doc.querySelectorAll(value);
        return Array.from(finds);
    }

    function xpath(doc, value) {
        function snapshot2value(snapshot) {
            if (snapshot instanceof HTMLElement) {
                return snapshot;
            } else if (snapshot instanceof Text) {
                return snapshot.nodeValue;
            } else if (snapshot instanceof Attr) {
                return snapshot.nodeValue;
            }
            return snapshot
        }

        const query = doc.evaluate(value, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const values = [];
        try {
            for (let i = 0; i < query.snapshotLength; i++) {
                const value = query.snapshotItem(i);
                values.push(snapshot2value(value));
            }
        } catch (reason) {
            log(reason);
        }
        return values;
    }

    doc = doc || document;
    const isXpath = value.slice(0, 1) === '/' || value.slice(0, 2) === './' || value.slice(0, 2) === '(/' || value.slice(0, 3) === 'id(';
    if (isXpath) {
        return xpath(doc, value);
    } else {
        return css(doc, value);
    }
}

/**
 * html字符串 转 document
 * @param {String} value - html字符串
 * @returns {Document}
 */
function str2document(value) {
    /*
     创建 Document 的两种方法
     1.
     new DOMParser().parseFromString(string, mimeType)
     mimeType	                doc.constructor
     text/html	                Document
     text/xml	                XMLDocument
     application/xml	        XMLDocument
     application/xhtml+xml      XMLDocument
     image/svg+xml	            XMLDocument

     2.
     let document.implementation.createHTMLDocument("");
     doc.documentElement.innerHTML = html_str;
     */
    if (value) {
        if (!/html/i.test(document.documentElement.nodeName)) {
            return (new DOMParser).parseFromString(value, 'application/xhtml+xml');
        }
        try {
            return (new DOMParser).parseFromString(value, 'text/html');
        } catch (error) {
            log(error);
            // throw error;
        }
        let doc;
        if (document.implementation.createHTMLDocument) {
            doc = document.implementation.createHTMLDocument('ADocument');
        } else {
            try {
                doc = document.cloneNode(!1);
                doc.appendChild(doc.importNode(document.documentElement, !1));
                doc.appendChild(doc.createElement('head'));
                doc.appendChild(doc.createElement('body'));
            } catch (error) {
                log(error);
                // throw error;
            }
        }
        if (doc) {
            const r = document.createRange();
            // const n = r.createContextualFragment(value);
            r.createContextualFragment(value);
            r.selectNodeContents(document.body);
            for (let a, o = {
                TITLE: !0, META: !0, LINK: !0, STYLE: !0, BASE: !0
            }, i = doc.body, s = i.childNodes, c = s.length - 1; c >= 0; c--) {
                a = s[c];
                o[a.nodeName] && i.removeChild(a);
            }
            return doc;
        } else {
            return null;
        }
    } else {
        log('No string to convert to DOM was found.', value);
    }
}

/**
 * xhr 响应转 document 对象
 * @param {*} value
 * @returns {Document}
 */
function response2document(value) {
    const {finalUrl, responseText,} = value;
    const doc = str2document(responseText);
    if (!doc) {
        return null;
    }
    let node = doc.querySelector("head > base");
    if (!node) {
        const {origin} = parseURL(finalUrl);
        node = doc.createElement("base");
        node.setAttribute("href", origin);
        doc.head.appendChild(node);
    }
    if (!doc.URL.startsWith(doc.baseURI)) {
        doc.URL = finalUrl;
    }
    return doc;
}

// -------------------------------- http --------------------------------

/**
 * iframe 配置回调函数类型
 * @callback IframeConfigCallback
 * @param {HTMLIFrameElement} iframe - 要配置的 iframe DOM 元素
 * @param {String} src - 要加载的链接地址
 * @returns {void}
 */

/**
 * 请求 指定页面 的源码
 * @param {String} value - 页面内容或链接地址
 * @param {IframeConfigCallback} [options] - iframe 配置回调函数
 */
function html(value, options = (iframe, value) => {
    // 隐藏，或设置为可见用于调试
    iframe.style.display = 'none';
    iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms';
    iframe.style.width = '100%';
    iframe.src = value;
}) {
    return new Promise((resolve, reject) => {
        try {
            const iframe = document.createElement('iframe');
            options(iframe, value);
            document.body.appendChild(iframe);
            iframe.onload = function () {
                resolve(iframe.contentDocument);
                document.body.removeChild(iframe);
            }
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * 发送 HTTP 请求
 * @param {String} value - 请求地址
 * @param {XmlhttpRequestOptions} options - 请求配置
 * @returns {Promise<XmlhttpResponse>}
 */
function xmlhttpRequest(value, options = {}) {
    let {
        // 核心请求参数
        method,
        headers,
        data,
        timeout,
        responseType,

        // 回调函数参数
        onabort,
        onerror,
        onloadstart,
        onprogress,
        onreadystatechange,
        ontimeout,
        onload,

        // 高级参数
        cookie,
        cookiePartition,
        binary,
        context,
        overrideMimeType,

        // 请求行为控制
        anonymous,
        nocache,
        revalidate,
        fetch,
        redirect,

        // 认证与代理
        user,
        password,
        proxy,

        // 兼容
        onAbort,
        on_abort,

        onError,
        on_error,

        onLoadstart,
        on_loadstart,

        onProgress,
        on_progress,

        onTimeout,
        on_timeout,

        onLoad,
        on_load,
    } = options;
    if (!isValidStr(value)) {
        return Promise.reject("value can not be blank.");
    }
    method = method ? method.toUpperCase().trim() : "GET";
    if (!["GET", "POST"].includes(method)) {
        return Promise.reject(`${method} request could not handle.`);
    }
    if (isObject(data)) {
        data = Object.keys(data).map((key) => `${key}=${encodeURIComponent(data[key])}`).join("&");
    }
    if (method === "GET") {
        responseType = responseType ?? "document";
        if (data) {
            let joiner = "?";
            if (value.includes("?")) {
                joiner = value.endsWith("?") || value.endsWith("&") ? "" : "&";
            }
            value = `${value}${joiner}${data}`;
            data = undefined;
        }
    } else if (method === "POST") {
        responseType = responseType ?? "json";
        headers = Object.assign(headers || {}, {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        });
    }

    timeout = timeout || Math.round(10 ** 3 * 60 * 1.5);

    onabort = onabort || onAbort || on_abort || undefined;
    onerror = onerror || onError || on_error || undefined;
    onloadstart = onloadstart || onLoadstart || on_loadstart || undefined;
    onprogress = onprogress || onProgress || on_progress || undefined;
    ontimeout = ontimeout || onTimeout || on_timeout || undefined;
    onload = onload || onLoad || on_load || undefined;

    const body = {
        url: value,

        // 核心请求参数
        method,
        headers,
        data,
        timeout,
        responseType,

        // 高级参数
        cookie,
        cookiePartition,
        binary,
        context,
        overrideMimeType,

        // 请求行为控制
        anonymous,
        nocache,
        revalidate,
        fetch,
        redirect,

        // 认证与代理
        user,
        password,
        proxy,

    };
    return new Promise(function (resolve, reject) {
        let timestamp = new Date();
        // noinspection JSUnresolvedFunction
        GM_xmlhttpRequest(Object.assign(body, {
            // 回调函数参数
            onloadstart: function (response) {
                timestamp = new Date();
                log(`onloadstart : ${value} ; ${timestamp} ; ${response}`);
                onloadstart && onloadstart(response);
            },
            onabort: function (response) {
                log(`onabort : ${value} ; ${new Date() - timestamp} ; ${response}`);
                onabort && onabort(response);
                reject(response);
            },
            onerror: function (response) {
                log(`onerror : ${value} ; ${new Date() - timestamp} ; ${response}`);
                onerror && onerror(response);
                reject(response);
            },
            ontimeout: function (response) {
                log(`ontimeout : ${value} ; ${new Date() - timestamp} ; ${response}`);
                ontimeout && ontimeout(response);
                reject(response);
            },
            onload: function (response) {
                log(`onload : ${value} ; ${new Date() - timestamp} ; ${response}`);
                onload && onload(response);
                resolve(response);
            },
            onprogress: onprogress,
            onreadystatechange: onreadystatechange,
        }));
    });
}

/**
 * 发送 HTTP 请求
 * @param {String} value - 请求地址
 * @param {Number} tries - 重试次数
 * @param {XmlhttpRequestOptions} options - 请求配置
 * @returns {Promise<*>}
 */
function request(value, tries, options = {}) {
    tries = tries || 10;
    const func = function () {
        return xmlhttpRequest(value, options);
    }
    return retry(func, tries);
}

/**
 * 请求 指定页面 的源码
 * @param {String} value - 请求地址
 * @param {Number} tries - 重试次数
 * @param {XmlhttpRequestOptions} options - 请求配置
 * @returns {Promise<Document>}
 */
function fetch(value, tries, options = {}) {
    const headers = {
        "referrer": location.href,
        "Cache-Control": "no-cache",
        "Content-Type": "text/html;charset=" + document.characterSet,
    };
    options.headers = Object.assign(options.headers || {}, headers);
    options = Object.assign(options, {
        method: "GET",
        overrideMimeType: "text/html;charset=" + document.characterSet,
    });
    return request(value, tries, options)
        .then(function (res) {
            return response2document(res);
        });
}

/**
 * 请求 指定资源的 字节流
 * 请求 指定页面 的源码
 * @param {String} value - 请求地址
 * @param {Number} tries - 重试次数
 * @param {XmlhttpRequestOptions} options - 请求配置
 * @returns {Promise<*>}
 */
function stream(value, tries, options = {}) {
    const headers = {
        "referrer": location.href,
        "Cache-Control": "no-cache",
        "Content-Type": "text/html;charset=" + document.characterSet,
    };
    options.headers = Object.assign(options.headers || {}, headers);
    options = Object.assign(options, {
        method: "GET",
        overrideMimeType: "text/plain;charset=x-user-defined",
    });
    return request(value, tries, options);
}

/**
 * 翻译（google翻译）
 * @param value
 * @returns {Promise<string>}
 */
async function translate(value) {
    const st = encodeURIComponent(value.trim());
    const res = await request("https://www.google.com/async/translate?vet=12ahUKEwixq63V3Kn3AhUCJUQIHdMJDpkQqDh6BAgCECw..i&ei=CbNjYvGCPYLKkPIP05O4yAk&yv=3", 10, {
        method: 'POST',
        responseType: '',
        data: {"async": `translate,sl:auto,tl:zh-CN,st:${st},id:1650701080679,qc:true,ac:false,_id:tw-async-translate,_pms:s,_fmt:pc`,}
    }).then(function (res) {
        return response2document(res);
    });
    return res?.querySelector("#tw-answ-target-text")?.textContent ?? "";
}

// ---------------------------------- UI ----------------------------------

/**
 * 创建 Button
 * @param predicate
 * @return {HTMLButtonElement}
 */
function button(predicate) {
    const button = document.createElement('button');
    predicate(button)
    return button;
}

// -------------------------------- 类 --------------------------------

class Link {
    // # 私有属性，只能在本类中使用
    /**
     * 主机
     */
    #host;
    /**
     * 路径
     */
    #path;
    /**
     * 参数
     */
    #search;

    constructor(host, path = null, search = null) {
        function _checkType(value) {
            return isValidStr(value) || value instanceof RegExp
        }

        if (!(_checkType(host) || all(host, _checkType))) {
            throw "host must be string or Regex.";
        }
        this.#host = host;
        this.#path = path || null;
        this.#search = search || null;
    }

    get host() {
        return this.#host;
    }

    get path() {
        return this.#path;
    }

    get search() {
        return this.#search;
    }

    // noinspection SpellCheckingInspection
    match(href) {
        function _match(value, elements) {
            elements = elements || [];
            for (const element of elements) {
                if (isStr(element) && value === element) {
                    return true;
                } else if (element instanceof RegExp && element.test(value)) {
                    return true;
                }
            }
            return false;
        }

        function _input2values(value, defaultValue) {
            const values = [];
            if (isStr(value)) {
                values.push(value);
            } else if (value instanceof RegExp) {
                values.push(value);
            } else if (isIterable(value)) {
                const vs = Array.from(value);
                for (const v of vs) {
                    values.push(..._input2values(v, defaultValue));
                }
            } else if (defaultValue) {
                values.push(defaultValue);
            }
            return values;
        }

        const {host, path, search} = this;

        href = href ?? location.href;
        const value = parseURL(href);

        return _match(value.hostname, _input2values(host)) && _match(value.pathname, _input2values(path, /.*/)) && _match(value.search, _input2values(search, /.*/));

    }

}

class Queried extends Link {

    /**
     * 根据规则查询节点
     * 注：这一重继承没有多大意义，只是习惯 aop 的编程思想
     * @param {String} rule
     * @param {Document} doc
     * @param {String} name
     * @returns {[]|*[]}
     */
    query(doc, rule, name) {
        return query(doc, rule);
    }

}

class Runner extends Queried {

    #runnable;

    constructor(runnable, host, path = null, search = null) {
        super(host, path, search);
        if (typeof runnable !== 'function') {
            throw new Error("runnable must be a function.");
        }
        this.#runnable = runnable;
    }

    /**
     * 主体方法执行前
     */
    run_after(...args) {
    }

    /**
     * 主体方法执行前
     */
    run_before(...args) {
    }

    /**
     * 主体方法
     * @param args
     * @returns {any}
     */
    async run(...args) {
        this.run_before(...args);
        const result = await this.#runnable?.call(this, ...args);
        this.run_after(result, ...args);
        return result;
    }

}

class Processor extends Runner {

    constructor(host, path = null, search = null) {
        super(async function (...args) {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            return await this.process(...args);
        }, host, path, search);
    }

    async process(...args) {
    }

}
