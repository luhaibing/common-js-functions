/**
 * 学习和编写 tampermonkey 脚本时常用的函数
 */

/**
 * 日志输出
 * @param args
 */
function log(...args) {
    console.log(...args);
}

/**
 * 解析链接
 * @param value 链接
 * @returns {Object}
 */
function parseURL(value) {
    let url = new URL(value);
    let params = new URLSearchParams(url.searchParams);
    let obj = {};
    params = Object.fromEntries(params);
    obj.protocol = url.protocol;
    obj.hostname = url.hostname;
    obj.port = url.port;
    obj.pathname = url.pathname;
    obj.search = params;
    obj.hash = url.hash;
    return obj;
}

/**
 * html字符串 转 document 对象
 * @param value
 * @returns {Document}
 */
function text2document(value) {
    let doc;
    try {
        /*
        创建 Document 的两种方法
        1.
        new DOMParser().parseFromString(string, mimeType)
        mimeType	            doc.constructor
        text/html	            Document
        text/xml	            XMLDocument
        application/xml	        XMLDocument
        application/xhtml+xml   XMLDocument
        image/svg+xml	        XMLDocument

        2.
        let document.implementation.createHTMLDocument("");
        doc.documentElement.innerHTML = html_str;
        */
        // doc = document.implementation.createHTMLDocument("");
        // doc.documentElement.innerHTML = value;
        doc = new DOMParser().parseFromString(value, "text/html");
    } catch (error) {
        throw error;
    }
    return doc;
}

/**
 * xhr 响应转 document 对象
 * @param value
 * @returns {Document}
 */
function response2document(value) {
    let {finalUrl, responseText,} = value;
    let doc = text2document(responseText);
    doc.href = finalUrl;
    let node = doc.querySelector("head > base");
    if (!node) {
        let {protocol, hostname} = parseURL(finalUrl);
        node = (doc ?? document).createElement("base");
        let base_url = `${protocol}//${hostname}/`;
        node.setAttribute("href", base_url);
        doc.head.appendChild(node)
    }
    doc.base_url = node.href;
    return doc;
}

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
        let promise = Promise.resolve().then(function () {
            return func(item, ...args);
        });
        // 方便最后统一获取结果
        all.push(promise);
        if (limit >= arr.length) {
            // 限制数 大于 数组长度
            continue;
        }
        let wrap = promise.then(function (v) {
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
 * @param verify 验证响应
 * @returns {Promise<*>}
 */
// 条件
function retry(func, times = 5, verify = null) {
    let use = times || 5;
    return new Promise(async function (resolve, reject) {
        while (true) {
            try {
                use--;
                let response = await func();
                verify?.(response)
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
 *
 * @param href
 * @param method
 * @param data
 * @param params
 * @param headers
 * @param timeout
 * @param retrytimes
 * @param options
 * @returns {Promise<*>}
 */
function request(
    href,
    method = "GET",
    data = {},
    params = {},
    headers = {},
    timeout = 10 ** 3 * 60 * 1,
    retrytimes = 3,
    options = {},
) {
    method = method ? method.toUpperCase().trim() : "GET";
    if (!href || !["GET", "POST"].includes(method)) {
        return;
    }
    if (isObject(data)) {
        data = Object.keys(data).map(function (key) {
            let value = encodeURIComponent(data[key]);
            return `${key}=${value}`;
        }).join("&");
    }
    let _params = {...params};
    delete _params.headers;
    if (method === "GET") {
        params.responseType = params.responseType ?? "document";
        if (data) {
            let joiner = "?";
            if (href.includes("?")) {
                joiner = href.endsWith("?") || href.endsWith("&") ? "" : "&";
            }
            href = `${href}${joiner}${data}`;
        }
    } else if (method === "POST") {
        params.responseType = params.responseType ?? "json";
        headers = Object.assign(headers || {}, {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        });
    }
    let {
        onprogress, on_progress,   // 进度
    } = options || {};

    // noinspection PointlessArithmeticExpressionJS
    let _timeout = timeout || 10 ** 3 * 60 * 1;
    let _retrytimes = retrytimes || 3;
    let _on_progress = onprogress || on_progress || undefined;

    /**
     * 发起请求
     * @returns {Promise<unknown>}
     */
    function run() {
        return new Promise(function (resolve, reject) {
            let start_time = new Date();
            let on_success = function (response) {
                log("reqTime : ", (new Date() - start_time), " ; ", href);
                resolve(response);
            };
            let on_failure = function (reason) {
                log("reqTime : ", (new Date() - start_time), " ; ", href);
                reject(reason);
            };
            let request_body = Object.assign(_params || {}, {
                url: href,
                method: method,
                timeout: _timeout,
                headers: headers,
                data: data,
                onload: on_success,
                onabort: on_failure,
                onerror: on_failure,
                ontimeout: on_failure,
                onprogress: function (event) {
                    if (!event.lengthComputable) {
                        return;
                    }
                    let loaded = event.loaded;
                    let total = event.total;
                    // _on_progress && _on_progress(loaded, total,)
                    // _on_progress?.call(this, loaded, total,)
                    _on_progress?.(loaded, total,)
                },
            })
            GM_xmlhttpRequest(request_body);
        })
    }

    return retry(run, _retrytimes);
}


/**
 * 请求 指定页面 的源码
 * @param value      链接地址
 * @param timeout
 * @param retrytimes
 * @param options   配置参数
 * @returns {Promise<Document>}
 */
async function html(
    value,
    timeout = 10 ** 3 * 60 * 1,
    retrytimes = 3,
    options = {},
) {
    return request(
        value,
        "GET",
        undefined,
        {
            "overrideMimeType": "text/html;charset=" + document.characterSet,
        },
        {
            "referrer": location.href,
            "Cache-Control": "no-cache",
            "Content-Type": "text/html;charset=" + document.characterSet,
        },
        timeout,
        retrytimes,
        options,
    ).then(function (res) {
        // let {status, statusText, finalUrl, response, responseText, responseXML} = res;
        return response2document(res);
    }).then(function (doc) {
        return doc;
    });
}

/**
 * 请求 指定资源的 字节流
 * @param value      链接地址
 * @param timeout
 * @param retrytimes
 * @param options   配置参数
 * @returns {Promise<*>}
 */
async function stream(
    value,
    timeout = 10 ** 3 * 60 * 1,
    retrytimes = 3,
    options = {},
) {
    let {href} = typeof value == "string" ? {href: value,} : value;
    return request(
        href,
        "GET",
        undefined,
        {
            "overrideMimeType": "text/plain; charset=x-user-defined",
        },
        {
            "referrer": location.href,
            "Cache-Control": "no-cache",
            "Content-Type": "text/html;charset=" + document.characterSet,
        },
        timeout,
        retrytimes,
        options,
    );
}


/**
 * 翻译（google翻译）
 * @param word
 * @returns {Promise<string|string>}
 */
async function translate(word) {
    const st = encodeURIComponent(word.trim());
    const res = await request(
        "https://www.google.com/async/translate?vet=12ahUKEwixq63V3Kn3AhUCJUQIHdMJDpkQqDh6BAgCECw..i&ei=CbNjYvGCPYLKkPIP05O4yAk&yv=3",
        "POST",
        {
            "async": `translate,sl:auto,tl:zh-CN,st:${st},id:1650701080679,qc:true,ac:false,_id:tw-async-translate,_pms:s,_fmt:pc`,
        },
        {
            "responseType": "",
        }
    ).then(function (res) {
        return response2document(res);
    });
    return res?.querySelector("#tw-answ-target-text")?.textContent ?? "";
}

/**
 * xhr响应 转 字节数组
 * @returns {Promise<Uint8Array>}
 */
Promise.prototype.response2array = function () {
    return this.then(function (res) {
        // let responseText = res.responseText
        let {responseText} = res;
        if (!responseText) {
            // response 转化 Uint8Array 失败
            throw "response translating Uint8Array failed."
        }
        let data = new Uint8Array(responseText.length)
        let index = 0;
        while (index < responseText.length) {
            data[index] = responseText.charCodeAt(index);
            index++;
        }
        return data;
    });
}

/**
 * NodeList 转 Array(数组)
 * @returns {Node[]}
 */
NodeList.prototype.toArray = function () {
    return Array.from(this);
}


/**
 * 是否可迭代
 * @param obj
 * @returns {boolean}
 */
function isIterable(obj) {
    return Boolean(obj && typeof obj[Symbol.iterator] === 'function');
}

/**
 * 是否为对象
 * @param obj
 * @returns {boolean}
 */
function isObject(obj) {
    return Boolean(obj && Object.prototype.toString.call(obj) === "[object Object]");
}

/**
 * 是否为字符串
 * @param obj
 * @returns {boolean}
 */
function isString(obj) {
    return Boolean(obj && typeof obj === "string");
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
        let code = str.charCodeAt(i);
        if (code > 255) {//如果是汉字，则字符串长度加2
            strlen += 2;
        } else {
            strlen++;
        }
    }
    return strlen;
}

////////////////////////////////////////////////////////////////////////////////

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
    let button_node = document.createElement('button');
    // 按钮设置 class
    if (attributes) {
        Object.keys(attributes).forEach(function (k) {
            let v = attributes[k];
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
            let random_code = Math.floor(Math.random() * 10 ** 10);
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
            }
            .${class_name}:active{
                background-color: #ca8e9f;
            }
            .${class_name}:hover{
                background-color: #ca8e9f;
            }`;
        }

        let class_name = default_button_class_name();
        style = default_style(class_name);
        button_node.setAttribute('class', class_name);
    }

    // 创建 style 标签
    let style_node = document.createElement('style');
    // 设置 button 样式 (根据CSS选择器定位标签并设置)
    style_node.innerText = style;
    // 查询并获取 head
    let head_node = document.querySelector('head');
    // 将 style 加入 head
    head_node.appendChild(style_node);

    Object.assign(button_node, {
        _enabled: true,
        toggle: function (value) {
            this._enabled = value;
        },
        disable: function () {
            this.toggle(false);
        },
        enable: function () {
            this.toggle(true);
        },
        enabled: function () {
            return this._enabled;
        },
        text: function (value) {
            this.innerText = value;
        },
    });

    return button_node;
}

////////////////////////////////////////////////////////////////////////////////

/**
 * 站点、链接
 * 主要用于匹配和检查站点
 */
class Link {

    /**
     * 主机
     */
    host;

    /**
     * 路径
     */
    path;

    static is_valid_string(value) {
        return isString(value) && value.trim().length > 0;
    }

    static is_valid_Iterable(value) {
        return !isString(value) && isIterable(value) && Array.from(value ?? []).length > 0;
    }

    constructor(host, path, verify = true) {
        verify = verify ?? true
        if (verify && !(Link.is_valid_string(host) || host instanceof RegExp || Link.is_valid_Iterable(host))) {
            throw "host can not be blank or undefined.";
        }
        this.host = host;
        this.path = path ?? [/.*/];
    }

    /**
     * 匹配
     * @param href
     */
    match(href) {
        function _run(target, rules,) {
            target = target.trim();
            rules = rules || [];
            for (const rule of rules) {
                if (isString(rule,) && target === rule.trim()) {
                    return true;
                } else if (rule instanceof RegExp && rule.test(target,)) {
                    return true;
                }
            }
            return false;
        }

        href = href ?? location.href;
        let value = parseURL(href,);
        let {host, path,} = this;
        let hosts, paths;

        if (isString(host,)) {
            hosts = [host.trim()];
        } else if (host instanceof RegExp) {
            hosts = [host,];
        } else if (isIterable(host,)) {
            hosts = Array.from(host,);
        } else {
            hosts = null;
        }
        if (!_run(value.hostname, hosts,)) {
            return false;
        }
        if (isString(path,)) {
            paths = [path.trim()]
        } else if (path instanceof RegExp) {
            paths = [path,];
        } else if (isIterable(path,)) {
            paths = Array.from(path,);
        } else {
            paths = [/.*/];
        }
        return _run(value.pathname, paths);
    }

}

/**
 * 查询
 * 方便元素定位和查询
 */
class Hunter extends Link {

    constructor(host, path, verify = true) {
        super(host, path, verify);
    }

    query(rule, node, doc,) {
        if (!isString(rule)) {
            throw "rule must be a string.";
        }
        if (!doc) {
            throw "doc not found.";
        }
        if (!node) {
            throw "node not found.";
        }
        if (rule.slice(0, 1) === '/' || rule.slice(0, 2) === './' || rule.slice(0, 2) === '(/' || rule.slice(0, 3) === 'id(') {
            return this.query_by_xpath(rule, node, doc,);
        } else {
            return this.query_by_css(rule, node, doc,);
        }
    }

    query_by_xpath(rule, node, doc,) {
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

        let query = doc.evaluate(rule, node, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        let values = [];
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

    query_by_css(rule, node, doc,) {
        let finds = node.querySelectorAll(rule);
        return Array.from(finds);
    }

}

/**
 * 执行
 */
class Runner extends Hunter {

    _runnable;

    constructor(runnable, host, path, verify = true) {
        super(host, path, verify);
        if (!runnable) {
            throw "runnable can not be null."
        }
        this._runnable = runnable;
    }

    /**
     * 主体方法执行前
     */
    process_after() {
    }

    /**
     * 主体方法执行后
     */
    process_before() {
    }

    /**
     * 主体方法
     * @param args
     * @returns {any}
     */
    process(...args) {
        this.process_before(...args);
        let result = this._runnable?.call(this, ...args);
        this.process_after(...args);
        return result;
    }

}