// ==UserScript==
// @name            蠕虫 2
// @namespace       http://tampermonkey.net/
// @version         0.4
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
// noinspection DuplicatedCode

(function () {
    'use strict';

    /** @type {HTMLButtonElement} 下载按钮 */
    let btn;

    // ---------------------- 模型 ----------------------

    /**
     * 找到的子项
     * @typedef {Object} Item
     * @property {String} href - 连接
     * @property {String|null} file - 文件名
     */

    /**
     * 下载子项
     */
    class Entity {

        static MAX_LENGTH = 250
        static M = /(magnet:\?xt=urn:btih:?([\da-f]{40}|[\da-z]{32}))(?=[^\da-z])/;
        static P = /(.*).(jpg|png|webp|gif)/i;
        static V = /(.*).(mp4|avi|wmv|mov|rmvb)/i;

        // ----------------------------------------------------------------

        /** 文本 */
        static TEXT = 1;
        /** 链接 */
        static HREF = Entity.TEXT << 1;
        /** 图片 */
        static PHOTO = (Entity.TEXT << 2) + Entity.HREF;
        /** 封面 */
        static COVER = (Entity.TEXT << 3) + Entity.PHOTO;
        /** 视频 */
        static VIDEO = (Entity.TEXT << 4) + Entity.HREF;
        /** 文件 */
        static FILE = (Entity.TEXT << 5) + Entity.HREF;

        // ----------------------------------------------------------------

        /** @type {String|null} 名字 */
        name;
        /** @type {String|null} 内容 */
        content;
        /** @type {number} 期望为整数，例如 0, 1, 2... */
        type;
        /** @type {Map<String,*>|null} 请求头 */
        headers;

        /**
         *
         * @param {String|null} name - 名字
         * @param {String|null} content - 内容
         * @param {number} type - 类型
         * @param {Map<String,*>|null} headers - 请求头
         * @param {Document|null} doc - 文档
         */
        constructor(name, content, type, {headers, doc}) {
            Entity.requireValidStr(name, "name");
            if ((type & Entity.HREF) === Entity.HREF) {
                Entity.requireURL(content, "content");
            } else {
                Entity.requireValidStr(content, "content");
            }
            this.name = name.trim();
            this.content = content.trim();
            this.type = type;
            if (!headers && doc) {
                // noinspection JSUnresolvedReference
                let href = doc.URL ?? doc.href;
                if (href) {
                    try {
                        const url = parseURL(href);
                        // noinspection JSValidateTypes
                        headers = {
                            "Referer": url.href,
                            "Origin": url.origin,
                            "User-Agent": navigator.userAgent,
                            "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
                        }
                    } catch (err) {
                        log(err);
                    }
                }
            }
            this.headers = headers;
        }

        // ----------------------------------------------------------------

        /**
         * 检查是否为有效的字符串
         * @param {*} value - 值
         * @param {String} name - 名字
         */
        static requireValidStr(value, name) {
            if (!isValidStr(value)) {
                throw `${name} must be a valid string.`;
            }
        }

        /**
         * 检查是否为有效的 URL
         * @param {String|URL|Object} value
         * @param name
         */
        static requireURL(value, name) {
            if (value instanceof URL) {
                return;
            }
            if (value instanceof Object && "href" in value) {
                let url;
                if (isFinite(value.href)) {
                    url = value.href();
                } else {
                    url = value.href;
                }
                parseURL(url);
            } else if (isValidStr(value)) {
                parseURL(value);
            } else {
                throw `${name} must be a valid URL.`;
            }
        }

        // ----------------------------------------------------------------

        /**
         *
         * @param {String} name
         * @param {String} href
         * @param {RegExp|null} pattern
         * @param {String|null} default_suffix
         * @param {Number} type
         * @param {Document} doc
         * @param {Map<String,*>|null} headers
         * @returns {Entity|null}
         */
        static href(name, href, pattern, default_suffix, type = Entity.HREF, {headers, doc}) {
            if (!name) {
                if (!pattern || !default_suffix) {
                    throw "pattern and default_suffix can not be blank.";
                }
                let i1 = href.lastIndexOf("/");
                let base_name = href.substring(i1 + 1);
                let array = pattern.exec(base_name);
                // noinspection JSUnresolvedFunction
                let [_, file_name, suffix] = array || [href, CryptoJS.MD5(href).toString(), default_suffix];
                name = `${file_name.replace(/\//g, " ")}.${suffix || default_suffix}`;
            }
            if (!href) {
                throw "href can not be blank.";
            }
            if (href.startsWith("//")) {
                let protocol;
                try {
                    protocol = parseURL(doc.baseURI).protocol;
                } catch (error) {
                    protocol = "https:"
                }
                href = `${protocol}${href}`;
            } else if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`;
            }
            if (!/^https?/.test(href)) {
                log("href error.");
                return null;
            }
            return new Entity(name, href, type ?? Entity.HREF, {headers, doc});
        }

        /**
         * 封面
         * @param {String} name
         * @param {String} href
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         * @returns {Entity}
         */
        static cover(name, href, {headers, doc}) {
            return Entity.href(name, href, Entity.P, "jpg", Entity.COVER, {headers, doc});
        }

        /**
         * 图片
         * @param {String} name
         * @param {String} href
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         * @returns {Entity}
         */
        static photo(name, href, {headers, doc}) {
            return Entity.href(name, href, Entity.P, "jpg", Entity.PHOTO, {headers, doc});
        }

        /**
         * 视频
         * @param {String} name
         * @param {String} href
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         * @returns {Entity}
         */
        static video(name, href, {headers, doc}) {
            return Entity.href(name, href, Entity.V, "mp4", Entity.VIDEO, {headers, doc});
        }

        /**
         * 文件
         * @param {String} name
         * @param {String} href
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         * @returns {Entity}
         */
        static file(name, href, {headers, doc}) {
            return Entity.href(name, href, null, null, Entity.FILE, {headers, doc: doc});
        }

        /**
         * 文本
         * @param {String} name
         * @param {String} content
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         * @returns {Entity}
         */
        static text(name, content, {headers, doc}) {
            return new Entity(name, content, Entity.TEXT, {headers, doc});
        }

    }

    /**
     * 解析得到的数据模型
     */
    class Resource {

        /** @type {String|null} 页面链接 */
        href;
        /** @type {String|null} 标题 */
        title;
        /** @type {String|null} 简码 */
        code;
        /** @type {String|null} 副标题 */
        subTitle;
        /** @type {String|null} 描述 */
        desc;
        /** @type {String|null} 日期 */
        date;

        /** @type {Entity[]|null} 作者 */
        actors = null;
        /** @type {Entity[]|null} 种类 */
        categories;
        /** @type {Entity[]|null} 标签 */
        tags;

        /** @type {Entity|null} 封面 */
        cover;
        /** @type {Entity[]|null} 图片 */
        photos;
        /** @type {Entity[]|null} 视频 */
        videos;
        /** @type {Entity[]|null} 磁力 */
        manages;
        /** @type {Entity[]|null} 附件 */
        attachments;

        /** @type {Document|null} */
        doc;
        /** @type {Map<String,*>|null} */
        headers;

        constructor(
            href,
            title,
            code,
            subTitle,
            desc,
            date,
            actors,
            categories,
            tags,
            cover,
            photos,
            videos,
            manages,
            attachments,
            doc,
            headers,
        ) {
            this.href = href ?? "";
            isValidStr(title) && (this.title = title?.trim());
            isValidStr(code) && (this.code = code?.trim());
            isValidStr(subTitle) && (this.subTitle = subTitle?.trim());
            isValidStr(desc) && (this.desc = desc?.trim());
            isValidStr(date) && (this.date = date?.trim());

            isValidIterable(actors) && (this.actors = []).push(...actors);
            isValidIterable(categories) && (this.categories = []).push(...categories);
            isValidIterable(tags) && (this.tags = []).push(...tags);

            isValidStr(cover) && (this.cover = cover?.trim());
            isValidIterable(photos) && (this.photos = []).push(...photos);
            isValidIterable(videos) && (this.videos = []).push(...videos);
            isValidIterable(manages) && (this.manages = []).push(...manages);
            isValidIterable(attachments) && (this.attachments = []).push(...attachments);

            this.doc = doc;
            if (!headers) {
                try {
                    let url = parseURL(href);
                    headers = {
                        "Referer": url.href,
                        "Origin": url.origin,
                        "User-Agent": navigator.userAgent,
                        "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
                    }
                } catch (err) {
                    log(err);
                }
            }
            this.headers = headers;
        }

        json() {
            return JSON.stringify(this);
        }

        /**
         * 解构
         * @param {Item|Entity|null} value
         * @returns {[String|null, String|null]}
         */
        static destruction(value) {
            let name = null;
            let href = null;
            if (value instanceof Entity) {
                name = value.name ?? value["name"];
                href = value.content ?? value["content"];
            } else if (value instanceof Object && value.hasOwnProperty("name") && value.hasOwnProperty("content")) {
                name = value.name ?? value["name"];
                href = value.content ?? value["content"];
            } else if (value instanceof Object && value.hasOwnProperty("file") && value.hasOwnProperty("href")) {
                name = value.file ?? value["file"];
                href = value.href ?? value["href"];
            } else if (isValidStr(value)) {
                href = value;
            }
            return [name?.trim(), href?.trim()];
        }

        /**
         *
         * @param {String} href - 页面链接
         * @param {String|null} title - 标题
         * @param {String|null} code - 简码
         * @param {String|null} subTitle - 副标题
         * @param {String|null} desc - 描述
         * @param {String|Date|null} date - 日期
         *
         * @param {Item[]|null} actors - 作者
         * @param {Item[]|null} categories - 种类
         * @param {Item[]|null} tags - 标签
         *
         * @param {Item|Entity|null} cover - 封面
         * @param {Item[]|Entity[]|null} photos - 图片
         * @param {Item[]|Entity[]|null} videos - 视频
         * @param {Item[]|Entity[]|null} manages - 磁力
         * @param {Item[]|Entity[]|null} attachments - 附件
         *
         * @param {Document} doc - 页面文档
         * @param {Map<String,*>} headers - 请求头
         */
        static from({
                        href,
                        title,
                        code,
                        subTitle,
                        desc,
                        date,

                        actors,
                        categories,
                        tags,

                        cover,
                        photos,
                        videos,
                        manages,
                        attachments,

                        doc,
                        headers,
                    }
        ) {
            if (cover instanceof Entity) {
                // cover = cover;
            } else if (cover instanceof Object && cover.hasOwnProperty("name") && cover.hasOwnProperty("content")) {
                const file = cover["name"];
                const href = cover["content"];
                cover = Entity.cover(file, href, {headers, doc,});
            } else if (cover instanceof Object && cover.hasOwnProperty("href") && cover.hasOwnProperty("file")) {
                const file = cover["file"];
                const href = cover["href"];
                cover = Entity.cover(file, href, {headers, doc,});
            } else if (isValidStr(cover)) {
                try {
                    const url = parseURL(cover);
                    const splits = url.pathname.split("/");
                    const suffix = Entity.P.exec(cover)?.[2] || "jpg";
                    let name;
                    if (isValidStr(code)) {
                        name = code + "." + suffix
                    } else if (isValidStr(title)) {
                        name = title.substring(0, Entity.MAX_LENGTH) + "." + suffix
                    } else {
                        const filename = splits[splits.length - 1];
                        if (filename.endsWith(suffix)) {
                            name = filename;
                        } else {
                            name = filename + "." + suffix;
                        }
                    }
                    // noinspection JSCheckFunctionSignatures
                    cover = Entity.cover(name, cover, {headers, doc,});
                } catch (e) {
                    log(e)
                }
            }

            const ps = []
            const vs = []
            const as = []
            const ms = []

            for (const value of photos ?? []) {
                const [name, href] = Resource.destruction(value);
                const entry = Entity.photo(name, href, {headers, doc,});
                ps.push(entry);
            }

            for (const value of videos ?? []) {
                const [name, href] = Resource.destruction(value);
                const entry = Entity.video(name, href, {headers, doc,});
                vs.push(entry);
            }

            for (const value of attachments ?? []) {
                const [name, href] = Resource.destruction(value);
                const entry = Entity.file(name, href, {headers, doc,});
                as.push(entry);
            }

            if (isValidIterable(manages)) {
                const names = {};
                for (const manage of manages) {
                    let [name, code] = Resource.destruction(manage);
                    if (!code) {
                        continue
                    }
                    // noinspection JSUnresolvedReference
                    name = name ?? CryptoJS.MD5(code).toString();
                    if (Entity.P.test(code)) {
                        code = Entity.P.exec(code)[0];
                    }
                    if (name.endsWith(".torrent")) {
                        name = name.slice(0, -8);
                    }
                    if (name.endsWith(".mp4")) {
                        name = name.slice(0, -4);
                    }
                    name = name.toUpperCase();
                    let filename;
                    if (name in names) {
                        names[name].push(name);
                        const length = names[name].length;
                        filename = `${name} ${length}.url`;
                    } else {
                        names[name] = [name];
                        filename = name + ".url";
                    }
                    filename = `U/${filename}`;
                    const content = `[InternetShortcut]\r\nURL=${code}\r\nIconIndex=0\r\nIDList=\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]`;
                    ms.push(Entity.text(filename, content, {headers, doc}))
                }
            }
            return new Resource(
                href,
                title,
                code,
                subTitle,
                desc,
                date,

                actors,
                categories,
                tags,

                cover,
                ps,
                vs,
                ms,
                as,

                doc,
                headers,
            )
        }

    }

    // ---------------------- 下载 ----------------------

    /**
     * 下载的超类
     */
    class Download {
        /** @type {String} 文件名 */
        name;

        constructor(name) {
            Entity.requireValidStr(name, "name");
            this.name = name.trim();
        }

    }

    /**
     * 下载单个文件
     */
    class RemoteFile extends Download {

        /** @type {number} 期望为整数，例如 0, 1, 2... */
        type;
        /** @type {String} 文件链接 */
        value;
        /** @type {Map<String,*>} 请求头 */
        headers;

        constructor(name, href, {headers, doc,}) {
            super(name);
            Entity.requireValidStr(href, "href")
            this.href = href.trim();
            if (!headers && doc) {
                let href = doc.URL ?? doc.href;
                if (href) {
                    try {
                        const url = parseURL(href);
                        headers = {                      // 在这里定义请求头
                            "Referer": url.href,
                            "Origin": winurl.origin,
                            "User-Agent": navigator.userAgent,
                            "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
                        }
                    } catch (err) {
                        log(err);
                    }
                }
            }
            this.headers = headers;
        }

    }

    /**
     * 下载多个个文件
     */
    class ZipFile extends Download {

        /** @type {Array<Entity>} 需要下载的内容数组 */
        entries;

        constructor(name, entries) {
            super(name);
            if (entries && !isIterable(entries)) {
                throw "entries must be an iterable.";
            }
            entries = (entries && Array.from(entries)) || [];
            entries = entries.filter(function (entry) {
                return entry;
            });
            this.entries = entries;
        }

        static from(resource, filename, {headers, doc}) {
            const entries = [];
            let {
                title,
                code,
                actors,
                cover,
                photos,
                videos,
                manages,
                attachments,
            } = resource;
            if (!filename) {
                let actor = actors && actors.length > 1 ? ` - ${actors.map(function (e) {
                    // noinspection JSUnresolvedReference
                    return e.name ?? e.innerText ?? e.toString();
                }).join('、')}` : "";
                if (code && isValidStr(code) && title && isValidStr(title)) {
                    if (title.trim().includes(code.trim())) {
                        filename = title.trim();
                    } else {
                        filename = `${code.trim()} ${title.trim()}`;
                    }
                } else if (code && isValidStr(code)) {
                    filename = code.trim();
                } else if (title && isValidStr(title)) {
                    filename = title.trim();
                } else {
                    filename = Date.now().toString();
                }
                if (actor.length > 0) {
                    actor = ` - ${actor}`;
                }
                if (filename.length + actor.length <= Entity.MAX_LENGTH) {
                    filename = filename + actor;
                } else {
                    const diff = filename.length + actor.length - Entity.MAX_LENGTH
                    filename = filename.substring(Entity.MAX_LENGTH - diff) + actor;
                }
            }
            filename = filename.replace("/", ",");
            if (cover) {
                entries.push(cover);
            }
            cover && entries.push(cover);
            photos && entries.push(...photos);
            videos && entries.push(...videos);
            manages && entries.push(...manages);
            attachments && entries.push(...attachments);
            entries.push(Entity.text(`${filename}.json`, resource.json(), {headers, doc}));
            return new ZipFile(filename, entries);
        }

    }

    // ---------------------- 站点 ----------------------

    // noinspection JSValidateTypes
    /**
     * 站点
     */
    class Site extends NodeQuery {

        /**
         * 节点
         * @typedef {Object} Node
         * @property {String} node - 主机名
         * @property {String|NodeDesc|NodeDesc[]} property - 路径
         * @property {String|NodeDesc|NodeDesc[]} attribute - 查询参数
         */

        /**
         * 节点描述
         * @typedef {Object} NodeDesc
         * @property {String} key - 键
         * @property {String} name - 名
         * @property {RegExp|null|function(String,Document, URL):String} covert - 转换
         */

        /**
         * 节点值
         * @typedef {Element|Item|Entity|String|null} NodeValue
         */

        /**
         * 同步生成节点
         * @typedef {function(Document, URL): NodeValue} SyncNodeValueFun
         */

        /**
         * 异步生成节点
         * @typedef {function(Document, URL): Promise<NodeValue>} AsyncNodeValueFun
         */

        /**
         * 同步生成节点(生成器)
         * @typedef {function(Document, URL): Generator<NodeValue, void, *>} GenNodeValueFun
         */

        /**
         * 异步生成节点(生成器)
         * @typedef {function(Document, URL): AsyncGenerator<NodeValue, void, *>} AsyncGenNodeValueFun
         */

        /**
         * 标题类型：节点配置、字符串或标题生成函数
         * @typedef {Node|String|SyncNodeValueFun|AsyncNodeValueFun|GenNodeValueFun|AsyncGenNodeValueFun} NodeType
         */

        /** @type{NodeType|NodeType[]|null} 标题 */
        title;
        /** @type{NodeType|NodeType[]|null} 简码 */
        code;
        /** @type{NodeType|NodeType[]|null} 子标题 */
        subTitle;
        /** @type{NodeType|NodeType[]|null} 描述 */
        desc;
        /** @type{NodeType|NodeType[]|null} 日期 */
        date;

        /** @type{NodeType|NodeType[]|null} 作者 */
        actors;
        /** @type{NodeType|NodeType[]|null} 种类 */
        categories;
        /** @type{NodeType|NodeType[]|null} 标记 */
        tags;

        /** @type{NodeType|NodeType[]|null} 封面 */
        cover;
        /** @type{NodeType|NodeType[]|null} 图片 */
        photos;
        /** @type{NodeType|NodeType[]|null} 视频 */
        videos;
        /** @type{NodeType|NodeType[]|null} 磁力 */
        manages;
        /** @type{NodeType|NodeType[]|null} 附件 */
        attachments;

        constructor({host, path, search}) {
            super(host, path, search);
        }

        /**
         * 解析页面文档获取资源
         * @param {Document} doc 页面文档
         * @returns {Promise<Resource>}
         */
        async parse(doc) {
            // noinspection JSUnresolvedReference
            const href = doc.URL ?? doc.href;
            const url = new URL(href);
            const code = await this.parseCode(doc, url);
            const title = await this.parseTitle(doc, url);
            const subtitle = await this.parseSubtitle(doc, url);
            const desc = await this.parseDesc(doc, url);
            const date = await this.parseDate(doc, url);
            const actors = await this.parseActors(doc, url);
            const categories = await this.parseCategories(doc, url);
            const tags = await this.parseTags(doc, url);

            const cover = await this.parseCover(doc, url);
            const photos = await this.parsePhotos(doc, url);
            const videos = await this.parseVideos(doc, url);
            const manages = await this.parseManages(doc, url);
            const attachments = await this.parseAttachments(doc, url);
            return Resource.from({
                href: href,
                code: code,
                title: title,
                subTitle: subtitle,
                desc: desc,
                date: date,
                actors: actors,
                categories: categories,
                tags: tags,

                cover: cover,
                photos: photos,
                videos: videos,
                manages: manages,
                attachments: attachments,

                doc: doc,
            });
        }

        /**
         * 执行
         * @generator
         * @param {Document} doc - 页面文档
         * @returns {AsyncGenerator<Download, void, *>}
         */
        async* process(doc) {
            await super.process(doc);
            const resource = await this.parse(doc);
            const filename = await this.filename(resource, doc);
            yield ZipFile.from(resource, filename, {doc});
        }

        /**
         * 窗口关闭
         * @returns {Promise<void>}
         */
        async close() {
        }

        /**
         * 下载完成保存时的文件名
         * @param {Resource} resource - 节点解析结果
         * @param {Document} doc - 页面文档
         * @return {Promise<String|null>}
         */
        async filename(resource, doc) {
            const code = resource.code;
            if (isValidStr(code)) {
                return code;
            }
            const title = resource.title;
            if (isValidStr(title)) {
                return title;
            }
            return new Date().toString();
        }

        /**
         * 解析获取标题
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseTitle(doc, url) {
            let {title} = this;
            return await this.node2value(doc, title, url);
        }

        /**
         * 解析获取简码
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseCode(doc, url) {
            let {code} = this;
            return await this.node2value(doc, code, url);
        }

        /**
         * 解析获取副标题
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseSubtitle(doc, url) {
            let {subtitle} = this;
            return await this.node2value(doc, subtitle, url);
        }

        /**
         * 解析获取描述
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseDesc(doc, url) {
            let {desc} = this;
            return await this.node2value(doc, desc, url);
        }

        /**
         * 解析获取日期
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseDate(doc, url) {
            let {date} = this;
            return await this.node2value(doc, date, url);
        }

        /**
         * 解析获取作者
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseActors(doc, url) {
            let {actors} = this;
            return await this.node2values(doc, actors, url);
        }

        /**
         * 解析获取种类
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseCategories(doc, url) {
            let {categories} = this;
            return await this.node2values(doc, categories, url);
        }

        /**
         * 解析获取标签
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseTags(doc, url) {
            let {tags} = this;
            return await this.node2values(doc, tags, url);
        }

        /**
         * 解析获取封面
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseCover(doc, url) {
            let {cover} = this;
            return await this.node2value(doc, cover, url);
        }

        /**
         * 解析获取图片
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parsePhotos(doc, url) {
            let {photos} = this;
            return await this.node2values(doc, photos, url);
        }

        /**
         * 解析获取视频
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseVideos(doc, url) {
            let {videos} = this;
            return await this.node2values(doc, videos, url);
        }

        /**
         * 解析获取磁力链接
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseManages(doc, url) {
            let {manages} = this;
            return await this.node2values(doc, manages, url);
        }

        /**
         * 解析获取附件
         * @param {Document} doc - 页面文档
         * @param {URL} url - 页面链接
         * @returns {Promise<NodeValue>}
         */
        async parseAttachments(doc, url) {
            let {attachments} = this;
            return await this.node2values(doc, attachments, url);
        }

        /**
         * 搜索
         * @generator
         * @param {String} value
         * @param {Document} doc - 页面文档
         * @returns {AsyncGenerator<Resource, void, *>}
         */
        async* search(value, doc) {
        }

        /** 拆分单独下载一个封面
         * @generator
         * @param {Download} value - 下载项
         * @param {Map<String,*>} headers - 请求头
         * @param {Document} doc - 页面文档
         * @return {AsyncGenerator<Download, void, *>}
         */
        async* generateCover(value, {headers, doc}) {
            if (value instanceof ZipFile) {
                const find = value.entries.find(function (entry) {
                    return entry.type === Entity.COVER
                });
                if (find) {
                    yield new RemoteFile(find.name, find.content, null, {headers, doc})
                }
            }
            yield value
        }

    }

    /**
     * 分页站点
     */
    class PagingSite extends Site {

        /** @type{NodeType|NodeType[]|null} 下一页 */
        next;

        /** @type{NodeType|NodeType[]|null} 页面内容、用于验证是否访问成功 */
        children;

        /** @type{NodeType|NodeType[]|null} 导航 */
        navigation;

        /** @type{Boolean} 是否显示指示器 */
        display = true;

        // TODO:

    }

    // ---------------------- FC2搜索 ----------------------

    // ---------------------- JavBus ----------------------
    class JavBus extends Site {

        constructor() {
            super({
                host: [
                    /^www\.buscdn\./i,
                    /^www\.javsee\./i,
                    /^www\.javbus\./i,
                    /^www\.busjav\./i,
                    /^www\.busfan\./i,
                    /^www\.seejav\./i,
                    /^www\.dmmsee\./i,
                    /^www\.fanbus\./i,
                    /^www\.seedmm\./i,
                ],
                path: /^\/((en|ja|ko)\/)?[0-9a-z]+[_-]?[0-9a-z]+(_\d+-\d+-\d+)?$/i,
            });
        }

        title = function (doc, url, name) {
            return this.node2value(doc, "//div[@class='container']/h3[text()]/text()", "title");
        }

        code = [
            {
                node: "div.col-md-3.info > p:nth-child(1) > span:nth-child(2)",
                property: "innerText",
            },
            async function (doc, ...args) {
                let href = doc.URL;
                return href.split("/").at(-1)
            }]

        cover = {
            node: "a.bigImage[href] > img[src]",
            property: "src",
        }

        date = "//div[contains(@class,'info')]/p/span[@class='header' and (starts-with(text(),'發行日期') or starts-with(text(),'출시일') or starts-with(text(),'発売日') or starts-with(text(),'Release Date'))]/../text()";

        categories = {
            node: "//div[contains(@class,'info')]/p/span[@class='header' and (starts-with(text(),'系列') or starts-with(text(),'시리즈') or starts-with(text(),'シリーズ') or starts-with(text(),'Series'))]/../a[@href]",
            attribute: "href",
            property: {key: "innerText", name: "name"},
        }

        tags = {
            node: "div.info > p > span.genre > label > a[href]",
            attribute: {key: "href", n: "href"},
            property: {key: "innerText", n: "name"},
        }

        photos = {
            node: "#sample-waterfall > a.sample-box[href]",
            attribute: "href",
        }

        manages = {
            node: "#magnet-table > tr > td:first-child > a[href]",
            // attribute: {key: "href", name: "code", format: /magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}/},
            attribute: {key: "href", name: "code", format: Entity.P},
            property: {key: "innerText", name: "name"},
        }

        actors = {
            node: "div.info > ul > div.star-box > li > div.star-name > a[href]",
            attribute: ["href"],
            property: {key: "innerText", name: "name"},
        }

        async filename(resource, doc) {
            const code = resource.code;
            const title = resource.title;
            const actors = resource.actors;
            if (isValidStr(code) && isValidIterable(actors) && actors.length > 1) {
                let actor = actors && actors.length > 1 ? ` - ${actors.map(function (e) {
                    return e.name ?? e.innerText ?? e.toString();
                }).join('、')}` : "";
                return `${code} - ${actor}`;
            } else if (isValidStr(code)) {
                return code;
            } else if (isValidStr(title)) {
                return title;
            } else {
                return new Date().toString();
            }
        }

        async* process(doc) {
            const resource = await this.parse(doc);
            const filename = await this.filename(resource, doc);
            const zip = ZipFile.from(resource, filename, {doc});
            // noinspection JSCheckFunctionSignatures
            yield* this.generateCover(zip, {doc});
        }

    }

    // ---------------------- 麻豆 ----------------------
    // ---------------------- R18hub ----------------------
    // ---------------------- BabePedia ----------------------
    // ---------------------- R18.clickme ----------------------
    // ---------------------- Adult.contents.fc2 ----------------------
    // ---------------------- Fd2ppv ----------------------
    // ---------------------- Fc2db ----------------------
    // ---------------------- Av.fhd ----------------------
    // ---------------------- Jav.pop.Mov ----------------------
    // ---------------------- Jav.ip ----------------------
    // ---------------------- Porn.av ----------------------
    // ---------------------- tk-tube8 ----------------------

    // ----------------------------------------------------------------

    const SITES = Object.assign([
        singleton(JavBus),
        // singleton(Madou),
        // singleton(R18hubPhotos),
        // singleton(R18hubActor),
        // singleton(BabePedia),
        // singleton(R18ClickMe),
        // singleton(Fc2Content),
        // singleton(Fd2ppv),
        // singleton(Fd2ppvActor),
        // singleton(Fc2db),
        // singleton(Fc2dbActor),
        // singleton(Fc2dbActress),
        // singleton(AvFhd),
        // singleton(JavPopMov),
        // singleton(JavIp),
        // singleton(PornAv),
        // singleton(TkTube8Fc2),
    ], {
        /**
         * @param {String} value
         * @returns {Site|null}
         */
        match: function (value) {
            value = value ?? location.href ?? document.URL;
            for (const site of this) {
                if (site.match(value)) {
                    return site;
                }
            }
            return null;
        },
    })
    const site = SITES.match(location.href);
    if (!site) {
        return;
    }

    async function download(value, configs) {
        if (!(value instanceof Download)) {
            return null;
        }
        const defaultHeaders = function () {
            return {                      // 在这里定义请求头
                "Referer": window.location.href,
                "Origin": window.location.origin,
                "User-Agent": navigator.userAgent,
                "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
            }
        }
        let {on_start, on_progress, on_success, on_failure} = configs || {};
        if (value instanceof RemoteFile) {
            const file = value.name;
            const url = value.href;
            const headers = value.headers ?? defaultHeaders();
            let total = 1;
            let downloaded = 0;
            on_start && on_start(total);
            on_progress && on_progress(downloaded, total);
            return new Promise(async function (resolve, reject) {
                // noinspection JSUnresolvedReference,JSUnusedLocalSymbols
                GM_download({
                    url: url,
                    name: file,
                    headers: headers,
                    onload: function ({loaded, total, mode}) {
                        resolve()
                    },
                    onerror: function ({id, error, details}) {
                        reject(error);
                    },
                    onprogress: function ({loaded, total}) {
                    },
                    ontimeout: function (response) {
                        reject("超时");
                    },
                });
            }).then(function () {
                on_success && on_success(total);
                return true;
            }).catch(function (reason) {
                on_failure && on_failure(reason);
                throw reason;
            });
        } else if (value instanceof ZipFile) {
            /** @type {Map<Entity,Boolean>} */
            const result = new Map();
            let {name, entries} = value;
            // noinspection JSUnresolvedFunction
            let zip = new JSZip();
            // noinspection JSUnresolvedFunction
            let folder = zip.folder(name);
            let downloaded = 0;
            let total = entries.length;
            on_start && on_start(total);
            /**
             * @param {Entity} item
             * @return {Promise<Map<Entity, Boolean>[]>}
             */
            let func = function (item) {
                let {type, content, name: file, headers} = item;
                if (type === Entity.TEXT) {
                    const blob = new Blob([content], {type: "text/plain"});
                    downloaded++;
                    on_progress && on_progress(downloaded, total);
                    // 压入zip中
                    folder.file(file, blob, {binary: true});
                    result.set(item, true);
                } else if ((type & Entity.HREF) === Entity.HREF) {
                    return stream(
                        content, 10, {
                            responseType: "blob",
                            headers: headers ?? defaultHeaders(),
                            timeout: 10 ** 3 * 30
                        })
                        .then(function (response) {
                            const {responseText, status} = response;
                            if (!responseText) {
                                throw "response 转化 Uint8Array 失败.";
                            }
                            if (status < 200 || status >= 300) {
                                throw `响应码 : ${status}.`;
                            }
                            const data = new Uint8Array(responseText.length);
                            let index = 0;
                            while (index < responseText.length) {
                                data[index] = responseText.charCodeAt(index);
                                index++;
                            }
                            return data;
                        })
                        .then(function (data) {
                            // noinspection JSCheckFunctionSignatures
                            let blob = new Blob([data]); // 转为Blob类型
                            if (blob.size < 2 ** 10) {
                                log("文件大小有问题 ; " + content);
                                return
                            }
                            folder.file(file, blob, {binary: true}); // 压入zip中
                        })
                        .then(function () {
                            log("成功 : " + content,);
                            downloaded++;
                            on_progress && on_progress(downloaded, total);
                        })
                        .then(function () {
                            result.set(item, true);
                        })
                        .catch(function (reason) {
                            log("失败 : " + content, " ; ", reason);
                            result.set(item, false);
                        })
                        .then(async function () {
                            return result;
                        });
                }
            }

            await asyncPool(entries, func, Math.min(10, entries.length));

            return Promise.resolve()
                .then(function () {
                    // noinspection JSUnresolvedFunction
                    return zip.generateAsync({type: "blob", base64: true})
                })
                .then(function (content) {
                    let file_name = `${name}.zip`;
                    // noinspection JSUnresolvedFunction
                    saveAs(content, file_name);
                })
                .then(function () {
                    on_success && on_success(total);
                })
                .catch(function (reason) {
                    on_failure && on_failure(reason);
                })
                .finally(function () {
                })
                .then(function () {
                    return result;
                });
        } else {
            return null;
        }
    }

    async function downloads(doc, site, configs) {
        /**
         * @type {AsyncGenerator<Download,void,Boolean>|Generator<Download,void,Boolean>}
         */
        let generator = await site?.run(doc);
        let element;
        let value;
        let done;
        let previous;
        do {
            element = await generator.next(previous);
            value = element.value;
            done = element.done;
            if (value) {
                try {
                    log("下载开始 : " + JSON.stringify(value));
                    await download(value, configs);
                    previous = true;
                } catch (err) {
                    previous = false;
                    log(err);
                }
            }
        } while (!done)
        site && await (site?.close());
    }

    // noinspection JSUnusedAssignment
    btn = button(function (button) {
        button.textContent = "Down";
        button.id = "worm_download"
        button.class = "Download"
        Object.assign(button.style, {
            position: 'fixed',
            right: '15%',
            bottom: '15%',
            height: '46px',      // 高度保持固定
            // width: "100%",
            borderRadius: '23px',
            backgroundColor: '#F44949',
            border: '1px solid #FFF',
            color: '#FFF',
            zIndex: '50',
            padding: "10px",
            // ========== 禁止换行 + 溢出处理 ==========
            whiteSpace: 'nowrap',          // 强制文字不换行
            overflow: 'hidden',           // 溢出隐藏
            textOverflow: 'ellipsis',     // 溢出显示省略号（可选）
        });
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#CA8E9F';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#F44949';
        });
        button.addEventListener('mousedown', () => {
            button.style.backgroundColor = '#CA8E9F';
        });
        button.addEventListener('mouseup', () => {
            button.style.backgroundColor = '#F44949';
        });
        button.onclick = async function () {
            if (!button.enabled()) {
                alert("下载中,请勿重复点击");
                return;
            }
            button.disable();
            button.text("Conn.");
            await downloads(document, site, {
                on_start: function (total) {
                    button.text(`0/${total}`);
                }, on_progress: function (progress, total) {
                    button.text(`${progress}/${total}`);
                }, on_success: function () {
                    button.text('Done');
                }, on_failure: function () {
                    button.text("Fail")
                },
            });
            button.enable();
        };
        document.body.appendChild(button);
    });

})();