/**
 * 学习和编写 tampermonkey 脚本时常用的函数
 */

/**
 * 打印
 * @param args
 */
function print(...args) {
    console.log(...args);
}


/**
 * 解析链接
 * @param value 链接
 * @returns {{}}
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
        let {protocol, hostname} = parseInt(finalUrl);
        node = (doc ?? document).createElement("base");
        let base_url = `${protocol}//${hostname}/`;
        node.setAttribute("href", base_url);
        doc.head.appendChild(node)
    }
    return doc;
}

/**
 * 异步池限制并发数
 * @param limit 并发数
 * @param arr   数据的数组
 * @param func  可执行函数
 * @param args  参数
 * @returns {Promise<Awaited<unknown>[]>}
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
                print("reqTime : ", (new Date() - start_time), " ; ", href);
                resolve(response);
            };
            let on_failure = function (reason) {
                print("reqTime : ", (new Date() - start_time), " ; ", href);
                reject(reason);
            };
            let request_body = Object.assign(_params || {}, {
                url: href,
                method: method,
                timeout: _timeout,
                headers: headers,
                data,
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

    /**
     * 失败后重试
     * @param func  需要包装的函数
     * @param times 最大重试次数
     * @returns {Promise<unknown>}
     */
    function retry(func, times) {
        let use = times;
        return new Promise(async function (resolve, reject) {
            while (use--) {
                try {
                    let response = await func();
                    resolve(response);
                    break;
                } catch (error) {
                    if (!use) {
                        reject(error);
                    }
                }
            }
        });
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
 * 是否可迭代
 * @param obj
 * @returns {boolean}
 */
function isIterable(obj) {
    return obj && typeof obj[Symbol.iterator] === 'function';
}

function isObject(obj) {
    return obj && Object.prototype.toString.call(obj) === "[object Object]";
}

