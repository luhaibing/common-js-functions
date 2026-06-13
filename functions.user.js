// noinspection JSUnusedGlobalSymbols,DuplicatedCode

/**
 * 学习和编写 tampermonkey 脚本时常用的函数
 */

// ------------------------------- function  -------------------------------
/**
 * 日志输出
 * @param args
 */
function log(...args) {
    console.log(...args);
}

/**
 * 获取字符串的字节
 * 中文字符占2个，其他占1个字节
 * @param str
 * @returns {number}
 */
function str2len(str) {
    let strlen = 0;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 255) {
            //如果是汉字，则字符串长度加2
            strlen += 2;
        } else {
            strlen++;
        }
    }
    return strlen;
}

// ------------------------------- check -------------------------------

/**
 * 是否可迭代
 * @param obj
 * @returns {boolean}
 */
function isIterable(obj) {
    return Boolean(obj && (typeof obj[Symbol.iterator] === "function"));
}

/**
 * 是否为对象
 * @param obj
 * @returns {boolean}
 */
function isObject(obj) {
    return Boolean(obj && (Object.prototype.toString.call(obj) === "[object Object]"));
}

/**
 * 是否为字符串
 * @param obj
 * @returns {boolean}
 */
function isStr(obj) {
    return Boolean(obj && (typeof obj === "string"));
}

/**
 * 是否为函数
 * @param obj
 * @returns {boolean}
 */
function isFunction(obj) {
    return Boolean(obj && (typeof obj === "function"));
}

/**
 * 有效字符串
 * @param value
 * @returns {boolean}
 */
function isValidStr(value) {
    return Boolean(isStr(value) && value.trim().length > 0);
}

/**
 * 包含子项的迭代对象
 * @param value
 * @returns {boolean}
 */
function isValidIterable(value) {
    return Boolean(isIterable(value) && Array.from(value).length > 0);
}

/**
 * 所有子项都满足条件
 * @param iterable
 * @param predicate
 * @returns {boolean}
 */
function all(iterable, predicate) {
    if (!isValidIterable(iterable) || !predicate) {
        return false;
    }
    const values = Array.from(iterable);
    const invert = function (value) {
        return Boolean(!predicate(value));
    }
    const find = values.find(invert);
    return Boolean(find === null || find === undefined);
}

/**
 * 任意子项满足条件
 * @param iterable
 * @param predicate
 * @returns {boolean}
 */
function any(iterable, predicate) {
    if (!isValidIterable(iterable) || !predicate) {
        return false;
    }
    const values = Array.from(iterable);
    const find = values.find(predicate);
    return Boolean(find !== null && find !== undefined);
}

// -------------------------------- web --------------------------------

/**
 * 解析链接
 * @param value 链接
 * @returns {Object}
 */
function parseURL(value) {
    const url = new URL(value);
    // https://user:pass@example.com:8080/path?query=1&key=2#hash
    const obj = {

        // 读写

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
            if (v == null || v.trim().length == 0) {
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
            if (v == null || v.trim().length == 0) {
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
            if (v == null || v.trim().length == 0) {
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
            if (v == null || v.trim().length == 0 || v.trim() == "/") {
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
            if (v == null || v.trim().length == 0) {
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
            if (v == null || v.trim().length == 0) {
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
            if (v == null || v.size == 0) {
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

        // 只读

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

    }
    return obj;
}

/**
 * html字符串 转 document 对象
 * @param value
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
        }
    } else {
        log('No string to convert to DOM was found.', value);
    }
}

/**
 * xhr 响应转 document 对象
 * @param value
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

// ------------------------------- singleton -------------------------------

const singletonMap = new Map();

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
        }).join('、');
    }

    // number|boolean|string|object|function|symbol|bigint|undefined|null
    const key = (args.length === 0) ? prototype.name : `${prototype.name}-${keys(args)}`;
    let value = singletonMap.get(key);
    if (!value) {
        value = new prototype(...args);
        singletonMap.set(key, value);
    }
    return value;
}

// ---------------------------------- UI ----------------------------------

/**
 * 创建 Button
 * @param text
 * @param func
 * @param style
 * @param attributes
 * @returns {HTMLButtonElement}
 */
function button(text, func, style = null, attributes = null) {
    // 创建按钮
    const button_node = document.createElement('button');
    // 按钮设置 class
    if (attributes) {
        Object.keys(attributes).forEach(function (k) {
            const v = attributes[k];
            button_node.setAttribute(k, v);
        });
    }
    // 设置文本和事件
    button_node.innerHTML = text;
    button_node.onclick = func;
    // 页面主题添加 按钮(当前未设置样式)
    document.body.appendChild(button_node);

    if (!style) {
        function default_button_class_name() {
            const random_code = Math.floor(Math.random() * 10 ** 10);
            return `button${random_code}`;
        }

        function default_style(class_name) {
            return `.${class_name}{
                position:fixed;
                right:5%;
                top:15%;
                width: 55px;
                height: 55px;
                border-radius:50%;
                border: none;
                background-color: #f44949;
                border: 1px solid #f44949;
                color:#fff;
                z-index:50;
            }
            .${class_name}:active{
                background-color: #ca8e9f;
            }
            .${class_name}:hover{
                background-color: #ca8e9f;
            }`;
        }

        const class_name = default_button_class_name();
        style = default_style(class_name);
        button_node.setAttribute('class', class_name);
    }

    // 创建 style 标签
    const style_node = document.createElement('style');
    // 设置 button 样式 (根据CSS选择器定位标签并设置)
    style_node.innerText = style;
    // 查询并获取 head
    const head_node = document.querySelector('head');
    // 将 style 加入 head
    head_node.appendChild(style_node);

    Object.assign(button_node, {
        _enabled: true, toggle: function (value) {
            this._enabled = value;
        }, disable: function () {
            this.toggle(false);
        }, enable: function () {
            this.toggle(true);
        }, enabled: function () {
            return this._enabled;
        }, text: function (value) {
            this.innerText = value;
        },
    });

    return button_node;
}

// ------------------------------- Level -------------------------------

function query_by_css(rule, doc) {
    const finds = doc.querySelectorAll(rule);
    return Array.from(finds);
}

function query_by_xpath(rule, doc) {
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

    const query = doc.evaluate(rule, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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


/**
 * 根据规则查询节点
 * @param rule
 * @param doc
 * @param name
 * @returns {*[]}
 */
function query(rule, doc = document, name = null) {
    doc = doc || document;
    if (!isValidStr(rule)) {
        if (name) {
            throw `${name}.rule must be a valid string.`;
        } else {
            throw "rule must be a valid string.";
        }
    }
    const is_xpath = rule.slice(0, 1) === '/' || rule.slice(0, 2) === './' || rule.slice(0, 2) === '(/' || rule.slice(0, 3) === 'id(';
    if (is_xpath) {
        return query_by_xpath(rule, doc);
    } else {
        return query_by_css(rule, doc);
    }
}

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
     * @param rule
     * @param doc
     * @param name
     * @returns {[]|*[]}
     */
    query(rule, doc, name) {
        return query(rule, doc, name);
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


// ------------------------------- prototype -------------------------------

/**
 * xhr响应 转 字节数组
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

/**
 * 去重
 * @param predicate
 * @returns {*[]}
 * @returns {Array<*>}
 */
Array.prototype.distinct = function (predicate = null) {
    const values = [];
    const key = (value) => {
        return value ? predicate?.call(this, value) ?? JSON.stringify(value) : null;
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
        if (!dict[k]) {
            dict[k] = 1;
            values.push(value);
        }
    }

    return values;
}

/**
 * 纠正、修正
 * @param predicate
 * @returns {*|Array}
 */
Array.prototype.correct = function (predicate = null) {
    return predicate ? predicate?.(this) : this;
}


// ------------------------------- Promise/async -------------------------------

/**
 * 异步池限制并发数
 * @param limit 并发数
 * @param arr   数据的数组
 * @param func  可执行函数
 * @param args  参数
 * @returns {Promise<Awaited<*>[]>}
 */
async function asyncPool(limit, arr, func, ...args) {
    // 所有任务
    const all = [];
    // 预先执行的任务
    const executing = [];
    for (const item of arr) {
        const promise = Promise.resolve().then(function () {
            return func(item, ...args);
        });
        // 方便最后统一获取结果
        all.push(promise);
        if (limit >= arr.length) {
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
 * 失败后重试
 * @param func  需要包装的函数
 * @param times 最大重试次数
 * @param throwable 验证响应[不通过时抛出异常]
 * @returns {Promise<*>}
 */
// 条件
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

const delay = async function (time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

/**
 * 发起 xhr 请求
 * {@link https://www.tampermonkey.net/documentation.php?ext=dhdg#GM_xmlhttpRequest}
 * @param href
 * @param method
 * @param headers
 * @param data
 * @param anonymous
 * @param cookie
 * @param timeout
 * @param responseType
 * @param overrideMimeType
 * @param user
 * @param password
 * @param on_progress
 * @param onProgress
 * @param onprogress
 * @returns {Promise<never>|Promise<unknown>}
 */
function xmr(href, {
    method, headers, data, anonymous, cookie, timeout, responseType, overrideMimeType, user, password,
    on_progress, onProgress, onprogress,
} = {}) {
    /*
    binary, nocache, revalidate, context, fetch,onreadystatechange,
    onabort, on_abort, onAbort,
    onerror, on_error, onError,
    onloadstart, on_loadstart, onLoadstart,
    ontimeout, on_timeout, onTimeout,
    onload, on_load, onLoad,
    */
    /*
    onabort = onabort || on_abort || onAbort || undefined;
    onerror = onerror || on_error || onError || undefined;
    onloadstart = onloadstart || on_loadstart || onLoadstart || undefined;
    ontimeout = ontimeout || on_timeout || onTimeout || undefined;
    onload = onload || on_load || onLoad || undefined;
    */
    if (!href) {
        return Promise.reject("href can not be blank.");
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
            if (href.includes("?")) {
                joiner = href.endsWith("?") || href.endsWith("&") ? "" : "&";
            }
            href = `${href}${joiner}${data}`;
            data = undefined;
        }
    } else if (method === "POST") {
        responseType = responseType ?? "json";
        headers = Object.assign(headers || {}, {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        });
    }

    timeout = timeout || Math.round(10 ** 3 * 60 * 1.5);

    const _on_progress = onprogress || on_progress || onProgress || undefined;

    const body = {
        url: href,
        method,
        timeout,
        headers,
        data,
        anonymous,
        cookie,
        responseType,
        overrideMimeType,
        user,
        password,
    };

    return new Promise(function (resolve, reject) {
        const start_time = new Date();
        const on_success = function (response) {
            log("reqTime : ", (new Date() - start_time), " ; ", href);
            resolve(response);
        };
        const on_failure = function (reason) {
            log("reqTime : ", (new Date() - start_time), " ; ", href);
            reject(reason);
        };
        // noinspection JSUnresolvedFunction
        GM_xmlhttpRequest(Object.assign(body, {
            onload: on_success,
            onabort: on_failure,
            onerror: on_failure,
            ontimeout: on_failure,
            onprogress: function ({lengthComputable, loaded, total,}) {
                if (!lengthComputable) {
                    return;
                }
                // _on_progress && _on_progress(loaded, total)
                // _on_progress?.call(this, loaded, total)
                _on_progress?.(loaded, total)
            },
        }));
    });
}

/**
 *
 * @param href
 * @param method
 * @param headers
 * @param data
 * @param anonymous
 * @param cookie
 * @param timeout
 * @param responseType
 * @param overrideMimeType
 * @param user
 * @param password
 * @param on_progress
 * @param onProgress
 * @param onprogress
 * @param retryTimes
 * @returns {Promise<*>}
 */
function request(href, {
    method, headers, data, anonymous, cookie, timeout, responseType, overrideMimeType, user, password,
    on_progress, onProgress, onprogress,
} = {}, retryTimes = 10) {
    retryTimes = retryTimes || 10;
    const func = function () {
        return xmr(href, {
            method, headers, data, anonymous, cookie, timeout, responseType, overrideMimeType, user, password,
            on_progress, onProgress, onprogress,
        });
    }
    return retry(func, retryTimes);
}

/**
 * 请求 指定页面 的源码
 * @param value
 * @param method
 * @param headers
 * @param data
 * @param anonymous
 * @param cookie
 * @param timeout
 * @param responseType
 * @param overrideMimeType
 * @param user
 * @param password
 * @param on_progress
 * @param onProgress
 * @param onprogress
 * @param retryTimes
 * @returns {Promise<Document>}
 */
function fetch(value, {
    method, headers, data, anonymous, cookie, timeout, responseType, overrideMimeType, user, password,
    on_progress, onProgress, onprogress,
} = {}, retryTimes = 10) {
    const body = arguments[1] || {};
    body.headers = Object.assign(body.headers || {}, {
        "referrer": location.href,
        "Cache-Control": "no-cache",
        "Content-Type": "text/html;charset=" + document.characterSet,
    });
    return request(value, Object.assign(body, {
        method: "GET",
        overrideMimeType: "text/html;charset=" + document.characterSet,
    }), retryTimes).then(function (res) {
        return response2document(res);
    });
}

/**
 * 请求 指定资源的 字节流
 * @param value
 * @param retryTimes
 * @param method
 * @param headers
 * @param data
 * @param anonymous
 * @param cookie
 * @param timeout
 * @param responseType
 * @param overrideMimeType
 * @param user
 * @param password
 * @param on_progress
 * @param onProgress
 * @param onprogress
 * @returns {Promise<*>}
 */
function stream(value, {
    method, headers, data, anonymous, cookie, timeout, responseType, overrideMimeType, user, password,
    on_progress, onProgress, onprogress,
} = {}, retryTimes = 10) {
    const body = arguments[1] || {};
    body.headers = Object.assign(body.headers || {}, {
        "referrer": location.href,
        "Cache-Control": "no-cache",
        "Content-Type": "text/html;charset=" + document.characterSet,
    });
    return request(value, Object.assign(body, {
        method: "GET",
        overrideMimeType: "text/plain; charset=x-user-defined",
    }), retryTimes);
}

/**
 * 翻译（google翻译）
 * @param word
 * @returns {Promise<string>}
 */
async function translate(word) {
    const st = encodeURIComponent(word.trim());
    const res = await request("https://www.google.com/async/translate?vet=12ahUKEwixq63V3Kn3AhUCJUQIHdMJDpkQqDh6BAgCECw..i&ei=CbNjYvGCPYLKkPIP05O4yAk&yv=3", 10, {
        method: 'POST',
        responseType: '',
        data: {"async": `translate,sl:auto,tl:zh-CN,st:${st},id:1650701080679,qc:true,ac:false,_id:tw-async-translate,_pms:s,_fmt:pc`,}
    }).then(function (res) {
        return response2document(res);
    });
    return res?.querySelector("#tw-answ-target-text")?.textContent ?? "";
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * 请求 指定页面 的源码
 * @param {string} value 链接
 * @returns {Promise<Document>}
 */
function html(value) {
    return new Promise((resolve, reject) => {
        let iframe = document.createElement('iframe');
        // 隐藏，或设置为可见用于调试
        iframe.style.display = 'none';
        iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms';
        iframe.style.width = '100%';
        iframe.src = value;
        document.body.appendChild(iframe);
        iframe.onload = function () {
            resolve(iframe.contentDocument);
            document.body.removeChild(iframe);
        }
    })
}
