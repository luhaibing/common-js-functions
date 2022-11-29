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
 * html字符串 转 document 对象
 * @param value
 * @returns {Document}
 */
function text2document(value) {
    let doc;
    try {
        doc = document.implementation.createHTMLDocument("");
        doc.documentElement.innerHTML = value;
    } catch (error) {
        throw error;
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
    const executings = [];
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
            executings.splice(executings.indexOf(wrap), 1)
            return v;
        });
        executings.push(wrap);
        if (executings.length < limit) {
            // 需要执行的数组长度 小于 限制数
            continue;
        }
        // 等待完成其中最先获得结果的一个
        await Promise.race(executings);
    }
    // Promise实例 每部分只会执行一次
    // 如果 Promise实例 先添加到 executings 执行过一次 最后在 Promise.all() 只会得到结果(得到结果)
    return Promise.all(all);
}

/**
 * 使用 XHR 创建 网络请求 和 IO
 * @param href 链接
 * @param arg  参数
 * @returns {Promise<unknown>}
 */
async function request(href, arg) {
    let {
        // 超时时间
        timeout, time_out,
        // 重试次数
        retry_times, retryTimes,
        // 覆盖发送给服务器的头部,强制 text/xml 作为 mime-type
        overrideMimeType, mime_type,
    } = arg;

    let _retry_times = retry_times || retryTimes || 3;
    let _time_out = timeout || time_out || 10 ** 3 * 60 * 1;
    let _mime_type = overrideMimeType || mime_type || undefined;

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
                    "referrer": location.href,
                    "Cache-Control": "no-cache",
                    "Content-Type": "text/html;charset=" + document.characterSet,
                },
                onload: on_success,
                onabort: on_failure,
                onerror: on_failure,
                ontimeout: on_failure,
            };
            GM_xmlhttpRequest(request_body);
        })
    }

    /**
     * 失败后重试
     * @param func
     * @param times
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
 * @param href
 * @returns {Promise<Document>}
 */
async function html(href,) {
    return request(href, {
        overrideMimeType: "text/html;charset=" + document.characterSet,
    }).then(function (response) {
        return text2document(response.responseText)
    }).then(function (doc) {
        print(doc);
        return doc;
    });
}

/**
 * 请求 指定资源的 字节流
 * @param href
 * @returns {Promise<*>}
 */
async function stream(href) {
    return request(href, {
        overrideMimeType: "text/plain; charset=x-user-defined",
    });
}