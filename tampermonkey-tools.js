// noinspection JSUnusedGlobalSymbols,JSUnresolvedFunction

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
 * @param value
 * @returns {{}}
 */
function parseURL(value) {
    let url = new URL(value)
    let params = new URLSearchParams(url.searchParams)
    let obj = {}
    params = Object.fromEntries(params)
    obj.protocol = url.protocol
    obj.hostname = url.hostname
    obj.port = url.port
    obj.pathname = url.pathname
    obj.search = params
    obj.hash = url.hash
    return obj
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
    let doc;
    let {finalUrl, responseText,} = value;
    doc = text2document(responseText);
    let base = doc.querySelector("head > base");
    if (!base) {
        let url = parseURL(finalUrl);
        base = document.createElement("base");
        let base_url = `${url.protocol}//${url.hostname}/`;
        base.setAttribute("href", base_url);
        doc.head.appendChild(base)
    }
    doc.href = finalUrl;
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
 * 使用 XHR 创建 网络请求 和 IO
 * @param href 链接
 * @param arg  参数
 * @returns {Promise<unknown>}
 */
async function request(href, arg = {}) {
    let {
        referrer,
        // 超时时间
        timeout, time_out,
        // 重试次数
        retry_times, retryTimes,
        // 覆盖发送给服务器的头部,强制 text/xml 作为 mime-type
        overrideMimeType, mime_type,
        // 进度
        onprogress, on_progress
    } = arg || {};

    let _referrer = referrer || location.href
    let _retry_times = retry_times || retryTimes || 3;
    // noinspection PointlessArithmeticExpressionJS
    let _time_out = timeout || time_out || 10 ** 3 * 60 * 1;
    let _mime_type = overrideMimeType || mime_type || undefined;
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
            let request_body = {
                url: href,
                method: "GET",
                time_out: _time_out,
                overrideMimeType: _mime_type,
                headers: {
                    "referrer": _referrer,
                    "Cache-Control": "no-cache",
                    "Content-Type": "text/html;charset=" + document.characterSet,
                },
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
                    _on_progress && _on_progress(loaded, total)
                },
            };
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
        })
    }

    return retry(run, _retry_times);
}

/**
 * 请求 指定页面 的源码
 * @param href      链接地址
 * @param options   配置参数
 * @returns {Promise<Document>}
 */
async function html(href, options = {}) {
    return request(href, Object.assign(options || {}, {
        overrideMimeType: "text/html;charset=" + document.characterSet,
    })).then(function (res) {
        // let {status, statusText, finalUrl, response, responseText, responseXML} = res;
        return response2document(res);
    }).then(function (doc) {
        return doc;
    });
}

/**
 * 请求 指定资源的 字节流
 * @param href      链接地址
 * @param options   配置参数
 * @returns {Promise<*>}
 */
async function stream(href, options = {}) {
    return request(href, Object.assign(options || {}, {
        overrideMimeType: "text/plain; charset=x-user-defined",
    }));
}