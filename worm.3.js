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

    /** @type {HTMLButtonElement} */
    let btn;

    // noinspection JSUnusedLocalSymbols
    class Entity {

        static MAX_LENGTH = 250

        static MANAGE_PATTERN = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}/;
        static MANAGE_P = /(magnet:\?xt=urn:btih:?([\da-f]{40}|[\da-z]{32}))(?=[^\da-z])/;
        static P = /(.*).(jpg|png|webp|gif)/i;
        static V = /(.*).(mp4|avi|wmv|mov|rmvb)/i;

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

        /** @type {number} 期望为整数，例如 0, 1, 2... */
        type;
        /** @type {string|null} 名字 */
        name;
        /** @type {string|null} 内容 */
        content;
        /** @type {Map<String,*>|null} 下载时请求头 */
        headers;

        /**
         *
         * @param {string} name
         * @param {string} content
         * @param {number} type
         * @param {Map<String,*>|null} headers
         * @param {Document} doc
         */
        constructor(name, content, type, headers, {doc}) {
            if (!isValidStr(name)) {
                throw "name must be a valid string.";
            }
            if ((type & Entity.HREF) === Entity.HREF) {
                try {
                    parseURL(content)
                } catch (e) {
                    throw "content must be a valid href."
                }
            } else {
                if (!isValidStr(content)) {
                    throw "content must be a valid string.";
                }
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
        static href(name, href, pattern, default_suffix, type = Entity.HREF, headers, {doc}) {
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
            if (!/^https?/.test(href)) {
                log("href error.");
                return null;
            }
            return new Entity(name, href, type ?? Entity.HREF, headers, {doc: doc});
        }

        /**
         *
         * @param {String} name
         * @param {String} href
         * @param {Document} doc
         * @param {Map<String,*>|null} headers
         * @returns {Entity}
         */
        static cover(name, href, doc, headers) {
            return Entity.href(name, href, null, null, Entity.COVER, headers, {doc: doc});
        }

        /**
         *
         * @param {String} name
         * @param {String} href
         * @param {Document} doc
         * @param {Map<String,*>|null} headers
         * @returns {Entity}
         */
        static photo(name, href, doc, headers) {
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
            return Entity.href(name, href, Entity.P, "jpg", Entity.PHOTO, headers, {doc: doc});
        }

        /**
         *
         * @param {String} name
         * @param {String} href
         * @param {Document} doc
         * @param {Map<String,*>|null} headers
         * @returns {Entity}
         */
        static video(name, href, doc, headers) {
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
            return Entity.href(name, href, Entity.V, "mp4", Entity.VIDEO, headers, {doc: doc});
        }

        /**
         *
         * @param {String} name
         * @param {String} href
         * @param {Document} doc
         * @param {Map<String,*>|null} headers
         * @returns {Entity}
         */
        static file(name, href, doc, headers) {
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
            return Entity.href(name, href, null, null, Entity.FILE, headers, {doc: doc});
        }

        /**
         *
         * @param {String} name
         * @param {String} content
         * @param {Document} doc
         * @returns {Entity}
         */
        static text(name, content, {doc}) {
            return new Entity(name, content, Entity.TEXT, null, {doc});
        }
    }

    // noinspection JSUnusedGlobalSymbols
    /**
     * 解析得到的数据模型
     */
    class Resource {

        /** @type {string|null} 链接 */
        href;
        /** @type {string|null} 标题 */
        title;

        /** @type {string|null} 番号 */
        code;
        /** @type {string|null} 副标题 */
        subTitle;
        /** @type {string|null} 描述 */
        desc;
        /** @type {string|Date|null} 时间 */
        date;

        /** @type {Entity|null} 封面 */
        cover;

        /** @type {Array<Entity>|null} */
        actors = null;
        /** @type {Array<Entity>|null} */
        categories;
        /** @type {Array<Entity>|null} */
        tags;

        /** @type {Array<Entity>|null} */
        photos;
        /** @type {Array<Entity>|null} */
        videos;
        /** @type {Array<Entity>|null} */
        manages;
        /** @type {Array<Entity>|null} */
        attachments;

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
            attachments
        ) {
            this.href = href;

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

            const predicate = function (value) {
                return value.href;
            }

            const correction = function (values) {
                return isValidIterable(values) ? values : null;
            }

            this.actors = (this.actors || []).distinct(predicate).let(correction);
            this.categories = (this.categories || []).distinct(predicate).let(correction);
            this.tags = (this.tags || []).distinct(predicate).let(correction);

            this.photos = (this.photos || []).distinct().let(correction);
            this.videos = (this.videos || []).distinct().let(correction);
            this.manages = (this.manages || []).distinct((value) => value.code).let(correction);

        }

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
                        attachments
                    }) {
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
                photos,
                videos,
                manages,
                attachments
            )
        }

        json() {
            return JSON.stringify(this);
        }

    }

    class Download {
        /** @type {string} 文件名 */
        name;

        constructor(name) {
            if (!isValidStr(name)) {
                throw "name must be a valid string.";
            }
            this.name = name.trim();
        }
    }

    /**
     * 需要下载的内容(普通文件)
     */
    class RemoteFile extends Download {
        /** @type {string} 文件链接 */
        href;
        headers;

        constructor(name, href, headers = null, {doc}) {
            super(name);
            if (!isValidStr(href)) {
                throw "href must be a valid string.";
            }
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
     * 需要下载的内容(压缩包)
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

        /**
         * 结构
         * @param {Entity|String|Object} value
         * @return {*[]}
         */
        static destruction(value) {
            let href = null;
            let name = null;
            if (value instanceof Entity) {
                href = value.content ?? value["content"];
                name = value.name ?? value["name"];
            } else if (value.hasOwnProperty("name") && value.hasOwnProperty("content")) {
                href = value.content ?? value["content"];
                name = value.name ?? value["name"];
            } else if (isValidStr(value)) {
                href = value;
            }
            return [href, name];
        }

        /**
         *
         * @param {Resource} resource
         * @param {String|null} filename
         * @param {Document} doc
         * @return {Download}
         */
        static from(resource, filename, doc) {
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
            const entries = [];
            if (cover) {
                if (cover instanceof Entity) {
                    // cover = cover
                } else if (cover instanceof Object && cover.hasOwnProperty("name") && cover.hasOwnProperty("content")) {
                    const name = cover["name"];
                    const href = cover["content"];
                    cover = Entity.cover(name, href, doc);
                } else if (isValidStr(cover)) {
                    try {
                        const url = parseURL(cover);
                        const splits = url.pathname.split("/");
                        // noinspection JSCheckFunctionSignatures
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
                        cover = Entity.cover(name, cover, doc);
                    } catch (e) {
                        log(e)
                        cover = null
                    }
                }
                cover && entries.push(cover);
            }

            for (const value of photos ?? []) {
                const [href, name] = ZipFile.destruction(value);
                const entry = Entity.photo(name, href, doc);
                entries.push(entry);
            }

            for (const value of videos ?? []) {
                const [href, name] = ZipFile.destruction(value);
                const entry = Entity.video(name, href, doc);
                entries.push(entry);
            }

            for (const value of attachments ?? []) {
                const [href, name] = ZipFile.destruction(value);
                const entry = Entity.file(name, href, doc);
                entries.push(entry);
            }

            if (isValidIterable(manages)) {
                const names = {};
                let code;
                let name;
                for (const manage of manages) {
                    if (isValidStr(manage)) {
                        code = manage;
                        name = CryptoJS.MD5(code).toString();
                    } else if (manage instanceof Entity) {
                        code = manage["content"];
                        name = manage["name"].trim();
                    } else if (manage && manage["content"]) {
                        code = manage["content"];
                        name = manage["name"].trim() ?? CryptoJS.MD5(code).toString();
                    } else {
                        continue
                    }
                    if (Entity.MANAGE_P.test(code)) {
                        code = Entity.MANAGE_P.exec(code)[0];
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
                    entries.push(Entity.text(filename, content, {doc}))
                }
            }

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
            entries.push(Entity.text(`${filename}.json`, resource.json(), {doc}));
            return new ZipFile(filename, entries);
        }

    }

    /**
     * 站点
     */
    class Site extends NodeQuery {

        title;
        code;
        desc;
        date;

        cover;

        actors;
        categories;
        tags;

        photos;
        videos;
        manages;
        attachments;

        constructor({host, path, search}) {
            super(host, path, search);
        }

        /**
         * 下载完成保存时的文件名
         * @param doc
         * @param resource
         * @return {Promise<String|null>}
         */
        async filename(doc, resource) {
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
         * 执行
         * @generator
         * @param {Document} doc - 页面文档
         * @returns {AsyncGenerator<Download, void, *>}
         */
        async* process(doc) {
            await super.process(doc);
            const resource = await this.parse(doc);
            const filename = await this.filename(doc, resource);
            yield ZipFile.from(resource, filename, doc);
        }

        /**
         * 窗口关闭
         * @returns {Promise<void>}
         */
        async close() {
        }

        /**
         * 解析页面文档获取资源
         * @param {Document} doc 页面文档
         * @returns {Promise<Resource>}
         */
        async parse(doc) {
            // noinspection JSUnresolvedReference
            const href = doc.URL ?? doc.href;

            const code = await this.parseCode(doc);
            const title = await this.parseTitle(doc);
            const subtitle = await this.parseSubtitle(doc);
            const desc = await this.parseDesc(doc);
            const date = await this.parseDate(doc);
            const actors = await this.parseActors(doc);
            const categories = await this.parseCategories(doc);
            const tags = await this.parseTags(doc);

            const cover = await this.parseCover(doc);
            const photos = await this.parsePhotos(doc);
            const videos = await this.parseVideos(doc);
            const manages = await this.parseManages(doc);
            const attachments = await this.parseAttachments(doc);
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
            });
        }

        /**
         * 解析获取标题
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 标题
         */
        async parseTitle(doc) {
            let {title} = this;
            return await this.node2value(doc, title);
        }

        /**
         * 解析获取番号
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 番号
         */
        async parseCode(doc) {
            let {code} = this;
            return await this.node2value(doc, code);
        }

        /**
         * 解析获取副标题
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 副标题
         */
        async parseSubtitle(doc) {
            let {subtitle} = this;
            return await this.node2value(doc, subtitle);
        }

        /**
         * 解析获取描述
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 描述
         */
        async parseDesc(doc) {
            let {desc} = this;
            return await this.node2value(doc, desc);
        }

        /**
         * 解析获取日期
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 日期
         */
        async parseDate(doc) {
            let {date} = this;
            return await this.node2value(doc, date);
        }

        /**
         * 解析获取作者
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 作者
         */
        async parseActors(doc) {
            let {actors} = this;
            return await this.node2values(doc, actors);
        }

        /**
         * 解析获取种类
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 种类
         */
        async parseCategories(doc) {
            let {categories} = this;
            return await this.node2values(doc, categories);
        }

        /**
         * 解析获取标签
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 标签
         */
        async parseTags(doc) {
            let {tags} = this;
            return await this.node2values(doc, tags);
        }

        /**
         * 解析获取封面
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 封面
         */
        async parseCover(doc) {
            let {cover} = this;
            return await this.node2value(doc, cover);
        }

        /**
         * 解析获取图片
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 图片
         */
        async parsePhotos(doc) {
            let {photos} = this;
            return await this.node2values(doc, photos);
        }

        /**
         * 解析获取视频
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 视频
         */
        async parseVideos(doc) {
            let {videos} = this;
            return await this.node2values(doc, videos);
        }

        /**
         * 解析获取磁力链接
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 磁力链接
         */
        async parseManages(doc) {
            let {manages} = this;
            return await this.node2values(doc, manages);
        }

        /**
         * 解析获取附件
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 附件
         */
        async parseAttachments(doc) {
            let {attachments} = this;
            return await this.node2values(doc, attachments);
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

    }

    /**
     * 分页站点
     */
    class PagingSite extends Site {

        /**
         * 下一页
         */
        next;

        /**
         * 页面内容、用于验证是否访问成功
         */
        children;

        /**
         * 导航
         */
        navigation;

        // 指示器
        display = true;

        /**
         * 下载子项
         * @param {HTMLElement} node
         * @param {Document} doc
         * @param {Resource} resource
         * @param {Number} index
         * @param {String} original
         * @return {AsyncGenerator<Download, void, *>}
         */
        async* processChild(node, doc, resource, index, original) {
        }

        /**
         * 下载子项集
         * @param {Document} doc
         * @param {Resource} resource
         * @param {Number} index
         * @param {String} original
         * @return {AsyncGenerator<Download, void, *>}
         */
        async* processChildren(doc, resource, index, original) {
            let {children} = this;
            const items = await this.node2values(doc, children, "page");
            for (const item of items) {
                yield* this.processChild(item, doc, resource, index, original);
            }
        }

        /**
         * 页面子项大小
         * @param {Document} doc
         * @param {Resource} resource
         * @param {Number} index
         * @param {String} original
         * @return {Promise<number>}
         */
        async childCount(doc, resource, index, original) {
            const children = await this.node2values(doc, this.children, "page");
            return children.length;
        }

        async* process(doc) {
            let {children, next, navigation, display} = this;
            // 下一页链接
            const node2next = async (doc, value) => {
                let tries = 10;
                let result;
                while (tries > 0) {
                    try {
                        result = await this.node2value(doc, value, "next");
                        return result;
                    } catch (err) {
                        log(err);
                    } finally {
                        tries--;
                    }
                }
                return null;
            };
            // 下一页链接转 document
            const next2document = async (value) => {
                let tries = 10;
                let h5;
                let result;
                while (tries > 0) {
                    try {
                        h5 = await html(value);
                        result = await this.node2values(h5, children, "page");
                        if (result) {
                            return h5;
                        }
                    } catch (err) {
                        log(err);
                    } finally {
                        tries--;
                    }
                }
                return null;
            };
            const resource = await this.parse(doc);
            // 指示器
            let cursor;
            if (display) {
                cursor = button(function (view) {
                    view.textContent = "连接中";
                    Object.assign(view.style, {
                        position: 'fixed',
                        right: '15%',
                        bottom: '25%',
                        height: '46px',      // 高度保持固定
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
                    document.body.appendChild(view);
                });
            }
            // 预计子项总数
            let total = 0;
            // 已下载成功数
            let downloaded = 0;
            // 已跳过数
            let skipped = 0;
            // 渲染指示器
            const renderCursor = function (value) {
                if (isValidStr(value)) {
                    cursor?.text(`${downloaded}/${skipped}/${total} ${value}`);
                } else {
                    cursor?.text(`${downloaded}/${skipped}/${total}`);
                }
            };
            // 页码(从 0 开始)
            let index = 0;
            // 原始的链接
            let original = location.href;
            // 当前的 document
            let current = doc;
            current.href = original;
            // 子项的容器
            let container;
            if (children) {
                const find = await this.node2value(current, children);
                find && (container = find.parentElement);
            }
            // 下一页的链接
            let href;
            let element;
            let value;
            let done;
            let result;
            let name;
            do {
                current.index = index;
                // 将新的页面中的子项添加到原始页面
                if (current !== doc) {
                    try {
                        const items = await this.node2values(current, children, "page");
                        for (const item of items) {
                            const node = doc.importNode(item, true);
                            container.appendChild(node);
                        }
                    } catch (e) {
                        log(e);
                    }
                }
                // 使用新的页面的导航替换掉原始页面的导航
                if (current !== doc && navigation != null) {
                    try {
                        const v1 = await this.node2value(doc, navigation, "navigation")
                        const v2 = await this.node2value(current, navigation, "navigation")
                        v1.parentNode.replaceChild(v2, v1);
                    } catch (e) {
                        log(e);
                    }
                }
                const generator = this.processChildren(current, resource, index, original);
                total += await this.childCount(current, resource, index, original);
                do {
                    try {
                        element = await generator.next(result);
                        value = element.value;
                        done = element.done;
                        log("child : " + value);
                        if (value) {
                            result = yield value;
                            downloaded++;
                            name = value?.name ?? (new Date().toString());
                            renderCursor(name);
                        }
                    } catch (err) {
                        skipped++;
                        log(err)
                    }
                } while (!done)
                href = await node2next(doc, next);
                if (!href) {
                    break
                }
                let interrupt = await this.interrupt(href, current, doc)
                if (interrupt) {
                    break
                }
                current = await next2document(href);
                current && (current.href = href);
                href && history.replaceState(null, null, href);
                index++;
            } while (current && navigation);
            renderCursor("Done");
        }

        /**
         * 是否中断
         * @param {String} value 下一页的连接
         * @param {Document} current 当前页
         * @param {Document} origin 原始页
         * @returns {Promise<boolean>}
         */
        async interrupt(value, current, origin) {
            return false;
        }

    }

    // ---------------------- FC2搜索 ----------------------

    class Fc2Finder extends Site {

    }

    class Fc2Search {

        /**
         * @generator
         * @param value
         * @param site
         * @param doc
         * @return {AsyncGenerator<Resource|null, void, *>}
         * @return {AsyncGenerator<Resource, void, *>}
         */
        static async* search(value, site, doc) {
            let result = /fc2([ _-]?[a-z]+)?[ _-](\d+)/i.exec(value);
            if (result && result[2]) {
                value = result[2];
            }
            /** @type {Site[]}*/
            const finders = [
                // TODO:
                // singleton(JavPopMov),
                // singleton(Fd2ppv),
                singleton(JavIp),
                singleton(PornAv),
            ]
            for (const finder of finders) {
                if (finder === site) {
                    continue
                }
                try {
                    yield* finder.search(value, doc);
                } catch (err) {
                    log(err);
                }
            }
        }

    }

    // ----------------------------------------------------------------

    // ---------------------- JavBus ----------------------

    // noinspection JSUnusedGlobalSymbols
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

        title = function (doc) {
            return this.node2value(doc, "//div[@class='container']/h3[text()]/text()", "title");
        }

        code = [
            {
                node: "div.col-md-3.info > p:nth-child(1) > span:nth-child(2)",
                property: "innerText",
            },
            function (doc) {
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
            attribute: {key: "href", name: "code", format: Entity.MANAGE_PATTERN},
            property: {key: "innerText", name: "name"},
        }

        actors = {
            node: "div.info > ul > div.star-box > li > div.star-name > a[href]",
            attribute: ["href"],
            property: {key: "innerText", name: "name"},
        }

        async filename(doc, resource) {
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
            const filename = await this.filename(doc, resource);
            const zip = ZipFile.from(resource, filename, doc);
            if (zip instanceof ZipFile) {
                const find = zip.entries.find(function (entry) {
                    return entry.type === Entity.COVER
                });
                if (find) {
                    yield new RemoteFile(find.name, find.content, null, {doc})
                }
            }
            yield zip
        }

    }

    // ---------------------- MaDou ----------------------

    // noinspection JSUnusedGlobalSymbols
    class MaDou extends Site {

        constructor() {
            super({
                host: [
                    /madouqu\d+\.cc/i,
                    /madouqu\.com/i
                ],
                path: /^\/video\/[0-9a-z]{3,}(-\d+)?\/$/i
            });
        }

        title = async function (doc) {
            let text = (await this.node2values(doc, `div.entry-wrapper > div.entry-content > p`, "title"))
                .map(function (node) {
                    return node.innerText
                })
                .filter(function (node) {
                    return isValidStr(node);
                })[1];
            let indexOf = text.indexOf("：");
            return text.substring(indexOf + 1).split("\n")[0];
        }

        code = async function (doc) {
            let finds = await this.node2values(doc, `div.entry-wrapper > div.entry-content > p`, "code");
            let text = finds.map(function (node) {
                return node.innerText
            }).filter(function (node) {
                return isValidStr(node);
            })[0];

            if (!text) {
                log("href : ", location.href, " ; ", "doc : ", doc.innerHTML)
            }

            let indexOf = text.indexOf("：");
            let sub_text = text.substring(indexOf + 1);
            let p = /[a-zA-Z0-9]/;
            if (p.test(sub_text)) {
                return sub_text;
            }
            let splits = doc.URL.split("/");
            let code = splits[splits.length - 2].toUpperCase();
            let pattern = /([a-zA-Z]*)[-_]?(\d*)/;
            let execArray = pattern.exec(code);
            if (!execArray) {
                return sub_text;
            }
            let [_, g, c] = execArray;
            return c ? `${g}-${c}` : g;
        }

        actors = {
            node: "div.entry-wrapper > div.entry-tags > a[href][rel=tag][data-wpel-link=internal]",
            property: "innerText",
            attribute: "href",
        }

        cover = {
            node: "div.entry-wrapper > div.entry-content > p > img[src]", attribute: "src",
        }

        manages = {
            node: "div.entry-wrapper > div.entry-content > p > a[href][data-wpel-link=external]",
            attribute: "href",
        }

        async* process(doc) {
            const resource = await this.parse(doc);
            const zip = ZipFile.from(resource, null, doc);
            if (zip instanceof ZipFile) {
                const find = zip.entries.find(function (entry) {
                    return entry.type === Entity.COVER
                });
                if (find) {
                    yield new RemoteFile(find.name, find.content, null, {doc})
                }
            }
            yield zip
            await delay(10 ** 3 ** 3);
            window.close();
        }

    }

    // ---------------------- R18hub ----------------------

    class R18hubPhotos extends Site {

        // https://r18hub.com/photo/blowpass-layla-jenner-mick-blue-starri-skinny-examination
        constructor() {
            super({
                host: "r18hub.com",
                path: /^\/photo\//i,
            });
        }

        title = async function (doc) {
            const find = doc.querySelector("head > meta[name='twitter:title']");
            return find.content;
        }

        photos = async function* (doc) {
            const finds = await this.node2values(doc, "ul#photos > li.photo-grid-item  a[src]", "photos")
            let href;
            for await (const find of finds) {
                href = find.getAttribute("src");
                if (href) {
                    yield `${href}?a=1`;
                }
            }
        }

        actors = function* (doc) {
            const elements = doc.querySelectorAll("div.model-items > div.model-item > a.model");
            for (const element of elements) {
                const name = element.target;
                const content = element.href;
                yield {name, content};
            }
        }

        async* process(doc) {
            const generator = super.process(doc);
            for await (const element of generator) {
                if (element instanceof ZipFile) {
                    const entries = element.entries.filter(e => e.type !== Entity.TEXT);
                    yield new ZipFile(element.name, entries);
                } else {
                    yield element;
                }
            }
        }

    }

    // noinspection JSUnusedGlobalSymbols
    class R18hubActor extends Site {

        // https://r18hub.com/model/layla-jenner
        constructor() {
            super({
                host: "r18hub.com",
                path: /^\/model\//i,
            });
        }

        next = async function (doc) {
            const find = await this.node2value(doc, "//li[@class='active']/following-sibling::li[1]/a", "next");
            if (find && (doc.href === find.href || (doc.location && doc.location.href === find.href))) {
                return null;
            } else if (find != null) {
                return find;
            } else {
                return null;
            }
        }

        title = {
            node: "ul.information > li.text-single-ellipsis > h1 > a > span",
            property: "innerText",
        }

        cover = async function (doc) {
            const find = await this.node2value(doc, "div.information > div.avatar.card-image", "cover")
            let href = find.getAttribute("data-src");
            if (href) {
                return `${href}?a=1`;
            } else {
                return null
            }
        }

        async* process(doc) {

            function url2suffix(value) {
                try {
                    let url = parseURL(value);
                    let splits = url.pathname.split("/");
                    let name = splits[splits.length - 1];
                    splits = name.split(".")
                    if (splits.length > 1) {
                        return splits[splits.length - 1];
                    } else {
                        return null;
                    }
                } catch (error) {
                    throw error;
                }
            }

            let a;
            let href;
            let d = doc;
            a = await this.node2value(d, this.next);
            let content = d.querySelector("#photos > ul.row.grid");
            let nav1;
            let nav2;
            let children;

            while (a) {
                btn.text("正在展开分页...");
                href = a.href;
                d = await html(href);
                d.href = href;
                a = await this.node2value(d, this.next);
                nav1 = doc.querySelector("div.footer > ul.pagination");
                nav2 = d.querySelector("div.footer > ul.pagination");
                nav1.parentNode.replaceChild(nav2, nav1);
                children = d.querySelectorAll("div.body > div.card-content > section.photos > ul > li");
                for (const child of children) {
                    content.appendChild(child);
                    log(child);
                }
                await delay(10 ** 2 * 5);
            }

            const resource = await this.parse(doc);
            const cover = resource.cover;
            const title = resource.title;
            if (isValidStr(cover) && isValidStr(title)) {
                try {
                    const url = parseURL(cover);
                    let splits = url.pathname.split("/");
                    let filename = splits[splits.length - 1];
                    splits = filename.split(".");
                    filename = `${title}.${splits[splits.length - 1]}`;
                    yield new RemoteFile(filename, cover, null, {doc});
                } catch (err) {
                    log(err);
                }
            }
            let finds = doc.querySelectorAll("div.body > div.card-content > section.photos > ul > li a");
            let numText;
            if (finds.length > 0) {
                btn.text("Conn.");
                // noinspection JSUnusedAssignment
                numText = button(function (txt) {
                    txt.textContent = "Down";
                    Object.assign(txt.style, {
                        position: 'fixed',
                        right: '15%',
                        bottom: '25%',
                        height: '46px',      // 高度保持固定
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
                    document.body.appendChild(txt);
                });
            }
            const site = new R18hubPhotos()
            let child;
            let generator;
            let res;
            let names;
            finds = Array.from(finds)//.reverse();
            let img;
            let alt;
            let find;
            let url;
            let suffix;

            let count = finds.length;
            let downloaded = 0;
            let skipped = 0;

            for (let index = 0; index < finds.length; index++) {
                find = finds[index];
                url = find.href;
                try {
                    if (numText) {
                        numText.text(`${downloaded}/${skipped}/${count}`);
                    }
                    btn.text(`Con.`);
                    log(url);
                    child = await html(url);
                    res = await site.parse(child);
                    if (numText) {
                        numText.text(`${downloaded}/${skipped}/${count} ${res.title}`);
                    }
                    names = res.actors.map(e => e.name);
                    if (!names.includes(title)) {
                        skipped += 1;
                        log(`${url} ; skiped.`);
                        continue;
                    }
                    img = find.querySelector("img");
                    alt = img.alt ?? res.title;
                    img = img.dataset.src + "?a=2";
                    suffix = url2suffix(img);
                    yield new RemoteFile(`${alt}.${suffix}`, img, null, {doc});
                    if (res.actors.length > 1) {
                        log(`${url} ; skipped.`);
                        skipped += 1;
                        continue;
                    }
                    generator = site.process(child);
                    for await (const element of generator) {
                        yield element;
                    }
                    downloaded += 1;
                    log(`${url} ; downloaded`);
                } catch (error) {
                    log(`${url} ; ${error}`);
                    skipped += 1;
                }
            }
            /*
            try {
                if (numText && numText instanceof HTMLElement) {
                    numText.style.display = 'none';
                }
            } catch (error) {
                log(error);
            }
            */
            if (numText) {
                numText.text(`${downloaded}/${skipped}/${count}  Done.`);
            }
            btn.text(`Done.`);
        }

    }

    // ---------------------- BabePedia ----------------------

    // noinspection JSUnusedGlobalSymbols
    class BabePedia extends Site {

        constructor() {
            super({
                host: "www.babepedia.com",
                path: /^\/babe\/.*/i,
            });
        }

        title = {
            node: "h1#babename",
            property: "innerText",
        }

        photos = function (doc) {
            const finds = doc.querySelectorAll("a.img[rel='gallery']");
            const values = [];
            for (const find of finds) {
                let href = find.href;
                let titles = href.split("/");
                let title = titles[titles.length - 1];
                let suffixes = title.split(".");
                let suffix = suffixes[suffixes.length - 1];
                // noinspection JSUnresolvedReference
                const hash = CryptoJS.MD5(title).toString();
                let name = hash.toUpperCase() + "." + suffix;
                values.push({name, content: href});
            }
            return values;
        }

        async* process(doc) {
            const generator = super.process(doc);
            for await (const element of generator) {
                if (element instanceof ZipFile) {
                    const entries = element.entries.filter(e => e.type !== Entity.TEXT);
                    yield new ZipFile(element.name, entries);
                } else {
                    yield element;
                }
            }
        }

    }

    // ---------------------- R18.clickme ----------------------

    // noinspection JSUnusedGlobalSymbols
    class R18ClickMe extends Site {

        // https://r18.clickme.net/63188
        constructor() {
            super({
                host: "r18.clickme.net",
                path: /^\/\d+/i,
            });
        }

        title = async function (doc) {
            const find = doc.querySelector("head > meta[property='og:title']");
            const title = find.content;
            try {
                return /^(【?.*】)?(.*)(\s*\|\s*點我一下)?$/i.exec(title)[2];
            } catch (error) {
                return title;
            }
        }

        photos = {
            node: "article#article-detail-content img",
            attribute: [
                {
                    key: "src",
                    name: "content",
                },
                {
                    key: "alt",
                    name: "name",
                }
            ],
        }

        async* process(doc) {
            const generator = super.process(doc);
            for await (const element of generator) {
                if (element instanceof ZipFile) {
                    const entries = element.entries.filter(e => e.type !== Entity.TEXT);
                    yield new ZipFile(element.name, entries);
                } else {
                    yield element;
                }
            }
        }

    }

    // ---------------------- Adult.contents.fc2 ----------------------

    // noinspection JSUnusedGlobalSymbols
    class Fc2Content extends Site {

        // https://adult.contents.fc2.com/article/4532140/
        constructor() {
            super({
                host: "adult.contents.fc2.com",
                path: /^\/article\/\d+\/$/i,
            });
        }

        code = async function (doc) {
            const pathname = location.pathname;
            const code = pathname.split("/").findLast(e => e.trim());
            return `FC2-${code}`;
        }

        title = "//div[@class='items_article_headerInfo']/h3/text()[last()]"

        cover = async function (doc) {
            const find = await this.node2value(doc, "div.items_article_MainitemThumb > span > img", "cover");
            return find.src;
        }

        photos = async function* (doc) {
            const finds = await this.node2values(doc, "ul.items_article_SampleImagesArea > li > a", "photos");
            for await (const find of finds) {
                yield find.href;
            }
        }

        videos = async function* (doc) {
            const find = await this.node2value(doc, "div.fc2-video-container > video.main-video", "videos");
            const href = find.src;
            const url = parseURL(href);
            const splits = url.pathname.split("/");
            const name = splits[splits.length - 1];
            yield {name, content: href};
        }

        async* process(doc) {
            const generator = super.process(doc);
            for await (const element of generator) {
                if (element instanceof ZipFile) {
                    const entries = element.entries.filter(e => e.type !== Entity.TEXT);
                    yield new ZipFile(element.name, entries);
                } else {
                    yield element;
                }
            }
        }

    }

    // ---------------------- Fd2ppv ----------------------

    class Fd2ppv extends Site {

        // https://fd2ppv.cc/articles/3080193
        constructor() {
            super({
                host: /fd2ppv\.(cc|net|com)*/i,
                path: /^\/articles\/\d+$/i,
            });
        }

        code = async function (doc) {
            const find = await this.node2value(doc, "nav.breadcrumbs > span.current", "code");
            const code = find.innerText;
            if (code && /^\d+$/.test(code)) {
                return `FC2-${code}`;
            } else {
                return code
            }
        }

        title = {
            node: "div.work-detail-header > div",
            property: "innerText",
        }

        actors = {
            node: "div.artist-info-card> div.artist-details > h3 > a.artistUrl",
            property: [{key: "innerText", name: "name"}, "href"],
        }

        photos = [
            async function (doc) {
                const finds = await this.node2values(doc, "div.work-image-section div.carousel-slide > img", "photos")
                let elements = Array.from(finds);
                if (finds.length > 3) {
                    elements = elements.slice(1, -1);
                }
                // noinspection JSUnresolvedReference
                elements = elements.map(e => e.dataset.src ?? e.src).distinct(e => e);
                elements = elements.filter(e => parseURL(e).pathname !== "/upload/error_cover.png")
                return elements;
            },
            async function (doc) {
                const finds = await this.node2values(doc, "div.work-image-section > div.work-photos > img", "photos")
                let elements = Array.from(finds);
                // noinspection JSUnresolvedReference
                elements = elements.map(e => e.dataset.src ?? e.src).distinct(e => e);
                elements = elements.filter(e => parseURL(e).pathname !== "/upload/error_cover.png")
                return elements;
            }
        ]

        async filename(doc, resource) {
            const code = resource.code;
            if (isValidStr(code)) {
                const actors = resource.actors;
                if (actors.length > 1) {
                    let actor = actors.map(e => e.name).join("、");
                    return [code, actor].join(" - ");
                } else {
                    return code;
                }
            }
            const title = resource.title;
            if (isValidStr(title)) {
                return title;
            }
            return new Date().toString();
        }

        async* process(doc) {
            const resource = await this.parse(doc);
            const {code, cover, photos} = resource;
            log(code);
            const entries = [];
            const values = [];
            cover && values.push(cover);
            photos && values.push(...photos);
            photos && entries.push(...photos);
            let generator = Fc2Search.search(resource.code, this, doc);
            for await (const element of generator) {
                const {cover, photos} = element;
                cover && entries.push(cover);
                photos && entries.push(...photos);
            }
            const filename = await this.filename(doc, resource);
            resource.photos = entries;
            const zip = ZipFile.from(resource, filename, doc);
            if (zip instanceof ZipFile && values.length > 0) {
                for (let entry of values) {
                    try {
                        const [href, _] = ZipFile.destruction(entry);
                        const result = yield new RemoteFile(code ?? filename, href, null, {doc});
                        if (result) {
                            break
                        }
                    } catch (err) {
                        log(err);
                    }
                }
            }
            yield zip;
        }

    }

    class Fd2ppvActor extends PagingSite {

        // https://fd2ppv.cc/actresses/196
        constructor() {
            super({
                host: "fd2ppv.cc",
                path: /^\/actresses\/\d+$/i,
            });
        }

        title = {
            node: "#main h1 > span.cursor-copy[data-text]",
            attribute: "data-text",
        }

        cover = {
            node: "#main div.artist-avatar-large > img",
            property: "src"
        }

        next = {
            node: "//div[@class='other-works-section']/nav[@class='pagination']/span[contains(@class,'active')]/following-sibling::*[1][self::a and @href]",
            property: "href"
        }

        children = "#main div.other-works-grid > div.artist-card"

        navigation = "//div[@class='other-works-section']/nav[@class='pagination']"

        async childCount(doc, resource, index, original) {
            let item_count = await super.childCount(doc, resource, index, original);
            if (index === 0) {
                return item_count * 2 + 1;
            } else {
                return item_count * 2;
            }
        }

        async* processChildren(doc, resource, index, original) {
            if (index === 0 && resource.cover && resource.title) {
                yield new RemoteFile(resource.title, resource.cover, null, {doc});
            }
            const finds = await this.node2values(doc, "div.other-works-grid > div> div.artist-content > a", "children");
            let href;
            let generator;
            let site = singleton(Fd2ppv);
            const convert = async function (value) {
                let tries = 10;
                let h5;
                while (tries > 0) {
                    try {
                        h5 = await html(value);
                        await site.parse(h5);
                        return site.process(h5);
                    } catch (err) {
                        log(err);
                    } finally {
                        tries--;
                    }
                }
                return null;
            }
            for await (let find of finds) {
                href = find.href;
                generator = await convert(href);
                history.replaceState(null, null, original);
                yield* generator;
            }
        }

    }

    // ---------------------- Fc2db ----------------------

    class Fc2db extends Site {

        // https://fc2db.net/work/4922101/
        constructor() {
            super({
                host: /fc2db\.(cc|net|com)/i,
                path: /^\/work\/\d+\/$/i,
            });
        }

        code = async function (doc) {
            const url = parseURL(location.href);
            const splits = url.pathname.split("/").filter(e => e.trim());
            const code = splits[splits.length - 1];
            return `FC2-${code}`;
        }

        cover = {
            node: "#content > div > div.grid.grid-cols-1.gap-6 > div.bg-card.border > a > img",
            property: "src",
        }

        title = {
            node: "#content > div > div.grid.grid-cols-1 div > h2",
            property: "innerText",
        }

        actors = {
            node: "div.flex.items-center > a.inline-flex.items-center ",
            property: [{key: "innerText", name: "name"}, "href"],
        }

        async filename(doc, resource) {
            const code = resource.code;
            if (isValidStr(code)) {
                const actors = resource.actors;
                if (actors.length > 1) {
                    let actor = actors.map(e => e.name).join("、");
                    return [code, actor].join(" - ");
                } else {
                    return code;
                }
            }
            const title = resource.title;
            if (isValidStr(title)) {
                return title;
            }
            return new Date().toString();
        }

        async* process(doc) {
            log(resource.code);
            const resource = await this.parse(doc);
            const {code, cover, photos} = resource;
            const values = [];
            cover && values.push(cover);
            photos && values.push(...photos);
            const filename = await this.filename(doc, resource);
            const zip = ZipFile.from(resource, filename, doc);
            if (zip instanceof ZipFile && values.length > 0) {
                for (let entry of values) {
                    try {
                        const [href, _] = ZipFile.destruction(entry);
                        const result = yield new RemoteFile(code ?? filename, href, null, {doc});
                        if (result) {
                            break
                        }
                    } catch (err) {
                        log(err);
                    }
                }
            }
            yield zip;
        }

    }

    class Fc2dbActor extends PagingSite {

        // https://fd2ppv.cc/actresses/196
        constructor() {
            super({
                host: "fc2db.net",
                path: /^\/actress\/\d+/i,
            });
        }

        title = {
            node: "#content > div > div.grid > div.shadow-sm.bg-card h1",
            property: "innerText",
        }

        cover = {
            node: "#content > div > div.grid > div.shadow-sm.bg-card img",
            property: "src"
        }

        next = {
            node: "#content div.mt-6 > a.next.page-numbers",
            property: "href"
        }

        children = "#content div.grid.gap-4.grid-cols-2 > div"

        navigation = "#content div.mt-6"

        display = false

        /**
         *
         * @param {Document} doc
         * @return {Promise<void>}
         */
        photos = async function* (doc) {
            const finds = doc.querySelectorAll("#content div.grid.grid-cols-2 > div");
            let href;
            let code;
            let title;
            let suffix;
            const placeholder = "https://img.fc2db.net/wp-content/uploads/2025/10/05233012/no_image_profile.webp"
            for (let find of finds) {
                href = find.querySelector("img.wp-post-image")?.src ?? placeholder;
                code = find.querySelector("div.p-3 > div:nth-child(1).text-xs.text-text-sub").innerText;
                title = find.querySelector("div.p-3 > div.text-text-main.h-12").innerText;
                title = title?.replace("/", "_");
                suffix = url2suffix(href);
                yield {
                    name: `FC2-${code} ${title}.${suffix}`,
                    content: href,
                };
            }
        }

        /*
        async* process(doc) {
            const resource = await this.parse(doc);
            const {title, code, cover, photos} = resource;
            const values = [];
            cover && values.push(cover);
            photos && values.push(...photos);
            let find = doc.querySelector("#content  h2.font-serif.text-text-main.mb-3");
            let text = find.innerText;
            let num;
            try {
                let r = /\d+/.exec(text);
                num = r[0];
            } catch (err) {
                num = -1;
            }
            let filename = [num, resource.title].join(" ");
            let zip = ZipFile.from(resource, filename, doc);
            yield zip;
        }
        */
        async* process(doc) {
            // yield* super.process(doc);
            const generator = super.process(doc);
            for await (let element of generator) {
                log(element);
            }
            const resource = await this.parse(doc);
            const {code, cover, photos} = resource;
            const values = [];
            cover && values.push(cover);
            photos && values.push(...photos);
            let find = doc.querySelector("#content  h2.font-serif.text-text-main.mb-3");
            let text = find.innerText;
            let num;
            try {
                let r = /\d+/.exec(text);
                num = r[0];
            } catch (err) {
                num = (photos ?? []).length;
            }
            let filename = [num, resource.title].join(" ");
            const zip = ZipFile.from(resource, filename, doc);
            if (zip instanceof ZipFile && values.length > 0) {
                for (let entry of values) {
                    try {
                        const [href, _] = ZipFile.destruction(entry);
                        const result = yield new RemoteFile(code ?? filename, href, null, {doc});
                        if (result) {
                            break
                        }
                    } catch (err) {
                        log(err);
                    }
                }
            }
            // yield zip;
        }

    }

    class Fc2dbActress extends PagingSite {

        // https://fc2db.net/actress/
        constructor() {
            super({
                host: "fc2db.net",
                path: /^\/(actress|works)\//i,
            });
        }

        next = [
            {
                node: "#content div.mt-8 > a.next.page-numbers",
                property: "href"
            }, {
                node: "#content div.nav-links > a.next.page-numbers",
                property: "href"
            },
        ]

        children = "main#content div.grid.gap-4.grid-cols-2 > *"

        navigation = [
            "#content div.mt-8",
            "#content div.nav-links",
        ]

        /*
        async childCount(doc, resource, index, original) {
            let item_count = await super.childCount(doc, resource, index, original);
            return item_count * 2;
        }
        */

        async* processChild(node, doc, resource, index, original) {
            /*
            let site = singleton(Fc2dbActor);
            const convert = async function (value) {
                let tries = 10;
                let h5;
                while (tries > 0) {
                    try {
                        h5 = await fetch(value);
                        await site.parse(h5);
                        return site.process(h5);
                    } catch (err) {
                        log(err);
                    } finally {
                        tries--;
                    }
                }
                return null;
            }
            /!** @type{HTMLAnchorElement} *!/
            let value = node;
            let title = value.querySelector("div.text-text-main").innerText;
            let href = value.href;
            let generator = await convert(href);
            log(title);
            yield* generator;
            */
        }

        async* process(doc) {
            let generator = super.process(doc);
            for await (let element of generator) {
            }
            let children = await this.node2values(doc, this.children, "children");
            let href;
            let photo;
            let tag;
            let code;
            let title;
            let actor;
            let date;
            let duration;
            const values = []
            const placeholder = "https://img.fc2db.net/wp-content/uploads/2025/10/05233012/no_image_profile.webp";
            for (let child of children) {
                href = child.querySelector("a").href;
                photo = child.querySelector("a > div.relative > img")?.src ?? placeholder;
                tag = child.querySelector("a > div.relative > span")?.innerText;
                code = child.querySelector("a > div > div.text-xs.text-text-sub").innerText;
                title = child.querySelector("a > div > div.text-text-main.h-12").innerText;
                actor = child.querySelector("a > div > div.text-xs.text-text-sub.truncate")?.innerText;
                date = child.querySelector("a > div > div.items-center.text-text-sub > span:nth-child(1)")?.innerText
                duration = child.querySelector("a > div > div.items-center.text-text-sub > span:nth-child(2)")?.innerText;

                href = href?.trim() ?? null;
                photo = photo?.trim() ?? placeholder;
                tag = tag?.trim() ?? null;
                code = code?.trim() ?? null;
                title = title?.trim() ?? null;
                actor = actor?.trim() ?? null;
                date = date?.trim() ?? null;
                duration = duration?.trim() ?? null;
                values.push({href, photo, tag, code, title, actor, date, duration,});
            }
            log(values);
            const photos = values.map(function (e) {
                const suffix = url2suffix(e.photo);
                return Entity.photo(`FC2-${e.code}.${suffix}`, e.photo, doc,);
            });
            const entries = [];
            entries.push(...photos);
            entries.push(Entity.text("作品一览.json", JSON.stringify(values), doc));
            yield new ZipFile("作品一览", entries);
        }

        async interrupt(value, current, origin) {
            let url = parseURL(value);
            let splits = url.pathname.split("/").filter(e => e);
            let num = splits[splits.length - 1];
            return num % 1000 === 0;
        }

    }

    // ---------------------- AvFhd ----------------------

    class AvFhd extends Site {

        // https://avfhd.com/698456/fc2-ppv-4872123/
        constructor() {
            super({
                host: /avfhd\.(cc|net|com)/i,
                path: /^\/\d+\/.*\/$/i,
            });
        }

        photos = {
            node: "div.entry-content > p > img",
            property: "src",
        }

        code = [async function () {
            const pathname = location.pathname;
            let splits = pathname.split("/");
            let value = splits[splits.length - 1];
            let result = /fc2-ppv-(\d+)/i.exec(value);
            if (result && result[1]) {
                return `FC2-${result[1]}`;
            } else {
                return null
            }
        }, async function () {
            const pathname = location.pathname;
            let splits = pathname.split("/");
            let value = splits[splits.length - 1];
            let result = /(\d+)?[a-zA-Z]+[-_]?(\d+)/i.exec(value);
            if (result && result[0]) {
                return result[0].toUpperCase();
            } else {
                return null
            }
        }]

        title = {
            node: "main#main  header > h1.entry-title",
            property: "innerText",
        }

    }

    // ---------------------- JavPopMov ----------------------
    class JavPopMov extends Site {

        // https://javpop.mov/zh-hans/fc2-ppvppv-4595393/
        // https://javpop.mov/zh-hans/fc2-ppv-ppv-4600349/
        // https://javpop.mov/zh-hans/_chinasub_fc2ppv-456/
        constructor() {
            super({
                host: "javpop.mov",
                path: /.*fc2.*/i,
            });
        }

        title = {
            node: "p#breadcrumbs > strong",
            property: "innerText",
        }

        code = async function (doc) {
            // noinspection JSPotentiallyInvalidUsageOfClassThis
            const text = await this.node2value(doc, this.title, "title");
            let result = /fc2[-_a-zA-Z\s]+(\d{6,})/i.exec(text);
            if (result && result[1]) {
                return `FC2-${result[1]}`;
            } else {
                return null;
            }
        }

        photos = [
            {
                node: "div#futured_images a > img",
                property: "src",
            },
            {
                node: "div#thumnail_images a > img",
                property: "src",
            },
        ]

        async* search(value, doc) {
            let h = `https://javpop.mov/zh-hans/search/?s=${value}`;
            log(`搜索 : ${h}`);
            /**
             * @type {Document}
             */
            let h5 = await fetch(h);
            const finds = h5.querySelectorAll("div.post-content > a");
            let title;
            let href;
            let d;
            let r;
            for (const find of finds) {
                title = find.querySelector("h3.post-title").innerText;
                if (title.includes(value)) {
                    href = find.href;
                    try {
                        d = await fetch(href);
                        if (!d) {
                            continue
                        }
                        d.href = href;
                        r = await this.parse(d);
                        if (!r) {
                            continue
                        }
                        yield r;
                    } catch (err) {
                        log(err);
                    }
                }
            }
        }

    }

    // ---------------------- JavIp ----------------------
    class JavIp extends Site {

        // https://javip.net/fc2-ppv-4927999/#more-721708
        constructor() {
            super({
                host: "javip.net",
                path: /.*fc2.*/i,
            });
        }

        title = {
            node: "div#content > div.post > h2.title",
            property: "innerText",
        }

        code = async function (doc) {
            const text = await this.parseTitle(doc);
            let result = /fc2[-_a-zA-Z\s]+(\d{6,})/i.exec(text);
            if (result && result[1]) {
                return `FC2-${result[1]}`;
            } else {
                return null;
            }
        }

        cover = {
            node: "div.post > div.entry > p:nth-child(2) > img",
            property: "src",
        }

        photos = async function* (doc) {
            const finds = doc.querySelectorAll(".post > div.entry > p:nth-child(4) > a > img");
            let photo;
            let name;
            for (const find of finds) {
                try {
                    photo = find.src;
                    name = find.alt;
                    photo = photo.replace(".th.", ".");
                    yield {
                        name: name,
                        content: photo,
                    }
                } catch (err) {
                    log(err);
                }
            }
        }

        async* search(value, doc) {
            let h = `https://javip.net/?s=${value}`
            log(`搜索 : ${h}`);
            /**
             * @type {Document}
             */
            let h5 = await fetch(h);
            const finds = h5.querySelectorAll("div#content > div.post");
            let title;
            let href;
            let d;
            let r;
            for (const find of finds) {
                title = find.querySelector("h2.title").innerText;
                if (title.includes(value)) {
                    href = find.querySelector("h2.title > a").href;
                    try {
                        d = await fetch(href);
                        if (!d) {
                            continue
                        }
                        d.href = href;
                        r = await this.parse(d);
                        if (!r) {
                            continue
                        }
                        yield r;
                    } catch (err) {
                        log(err);
                    }
                }
            }
        }

    }

    // ---------------------- PornAv ----------------------
    class PornAv extends Site {

        // https://pornav.co/jp/article-384948/FC2-PPV-4924836-Full-Face-Revealed-Uncensored-The-once-in-a-thousand-years-genuine-angel-idol-orgasms-a-lot-falls-into-a-dick-and-private-sex
        constructor() {
            super({
                host: "pornav.co",
                path: /.*fc2.*/i,
            });
        }

        title = {
            node: "div.container > h1.pull-left",
            property: "innerText",
        }

        code = async function (doc) {
            const text = await this.parseTitle(doc);
            let result = /fc2[-_a-zA-Z\s]+(\d{6,})/i.exec(text);
            if (result && result[1]) {
                return `FC2-${result[1]}`;
            } else {
                return null;
            }
        }

        cover = {
            node: "div > img.img-responsive[itemprop='image']",
            property: "src",
        }

        photos = {
            node: "div.preview-images img.preview-image",
            attribute: "data-original",
        }

        async* search(value, doc) {
            let h = `https://pornav.co/jp/search?q=${4923443}`
            log(`搜索 : ${h}`);
            /**
             * @type {Document}
             */
            let h5 = await fetch(h);
            const finds = h5.querySelectorAll("#grid-container > ul > li.cbp-item");
            let title;
            let href;
            let d;
            let r;
            for (const find of finds) {
                title = find.querySelector("h3 a[itemprop='url']").innerText;
                if (title.includes(value)) {
                    href = find.querySelector("h3 a[itemprop='url']").href;
                    try {
                        d = await fetch(href);
                        if (!d) {
                            continue
                        }
                        d.href = href;
                        r = await this.parse(d);
                        if (!r) {
                            continue
                        }
                        yield r;
                    } catch (err) {
                        log(err);
                    }
                }
            }
        }

    }

    // ---------------------- AvFhd ----------------------
    // http://javpop.com/2025/01/05/fc2_ppv-4595393.html

    // https://maddawgjav.net/fc2-ppv-4927098-%e3%80%90%e5%80%8b%e4%ba%ba%e6%92%ae%e5%bd%b1%e3%80%91%e5%88%9d%e6%92%ae%e3%82%8a%e4%ba%ba%e5%a6%bb%e3%83%89%e3%82%ad%e3%83%a5%e3%83%a1%e3%83%b3%e3%83%88-vol-23-%e6%91%a9%e8%80%b6/

    // ---------------------- AvFhd ----------------------

    class TkTube8Fc2 extends Site {

        // https://tk-tube8.com/nakadashi/12338/
        constructor() {
            super({
                host: "tk-tube8.com",
                path: /^\/[a-zA-Z]+\/\d+/i,
            });
        }

        async* process(doc) {
            let finds = doc.querySelectorAll("div.post_content > div.product-item img");
            if (finds.length === 0) {
                finds = doc.querySelectorAll("main#main_content div.post_content > p > img");
            }
            let photo;
            let name;
            let suffix;
            let result;
            for (const find of finds) {
                try {
                    photo = find.dataset.src;
                    suffix = url2suffix(photo);
                    name = find.alt;
                    result = /fc2[ _-]?ppv[ _-]?(\d{5,})/i.exec(name);
                    name = result[1];
                    yield new RemoteFile(`FC2-${name}`, photo, null, {doc});
                } catch (err) {
                    log(err);
                }
            }
        }

    }

    // ----------------------------------------------------------------

    const SITES = Object.assign([
        singleton(JavBus),
        singleton(MaDou),
        singleton(R18hubPhotos),
        singleton(R18hubActor),
        singleton(BabePedia),
        singleton(R18ClickMe),
        singleton(Fc2Content),
        singleton(Fd2ppv),
        singleton(Fd2ppvActor),
        singleton(Fc2db),
        singleton(Fc2dbActor),
        singleton(Fc2dbActress),
        singleton(AvFhd),
        singleton(JavPopMov),
        singleton(JavIp),
        singleton(PornAv),
        singleton(TkTube8Fc2),
    ], {
        match: function (href) {
            href = href || location.href;
            for (const site of this) {
                if (site.match(href)) {
                    return site;
                }
            }
            return null;
        },
    })
    let site = SITES.match(location.href);
    if (!site) {
        return;
    }

    async function download(value, configs) {
        if (!(value instanceof Download)) {
            return null;
        }
        let defaultHeaders = {                      // 在这里定义请求头
            "Referer": window.location.href,
            "Origin": window.location.origin,
            "User-Agent": navigator.userAgent,
            "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
        }
        let {on_start, on_progress, on_success, on_failure} = configs || {};
        if (value instanceof RemoteFile) {
            const file = value.name;
            const url = value.href;
            const headers = value.headers ?? defaultHeaders;
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
                    headers = headers ?? defaultHeaders;
                    return stream(content, 10, {responseType: "blob", headers: headers, timeout: 10 ** 3 * 30})
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

// https://hjsv.com/toujyounatsu-fc2-deliveryhealth-matome/
// https://number-searcher.com/4564617/
// https://erokaeru.jp/toujou-natu/
// https://erodouga-beam.com/toujyounatsu-usukeshi-mosaic-matome/
// https://paipancon.com/fc2daily/detail/FC2-PPV-2216118
// https://paipancon.com/fc2daily/detail/FC2-PPV-4742218
// https://paipancon.com/fc2daily/detail/FC2-PPV-4723295
// https://paipancon.com/fc2daily/detail/FC2-PPV-3868412
// https://paipancon.com/fc2daily/detail/FC2-PPV-2763672
// http://javpop.com/2026/06/27/fc2_ppv-4927949.html
// http://javpop.com/2025/01/05/fc2_ppv-4595393.html
// http://javpop.com/2026/06/27/maan-1178.html
// https://javpop.mov/zh-hans/_chinasub_fc2ppv-456/
// https://javpop.mov/zh-hans/fc2-ppv-ppv-4600349/
// https://javpop.mov/zh-hans/fc2-ppvppv-4595393/
// https://glamoroustube.com/archives/1184391
// https://ffjav.com/torrent/fc2ppv4926632-fc2-ppv-4926632-%e3%80%90%e7%b4%a0%e4%ba%ba%e5%87%ba%e6%bc%94%e3%80%91%e6%96%b0%e5%8d%92%e7%be%8e%e4%ba%ba%e5%b7%a8%e4%b9%b3%e4%bf%9d%e8%82%b2%e5%a3%ab-%e6%bf%83
// https://javxspot.com/fc2-ppv-4927068/
// https://netflav5.com/video?id=I88vBEqgd9
// https://hdblog.me/952488/fc2-2995459/
// https://7mmtv.sx/zh/uncensored_content/36857/fc2-ppv-2882940.html
// https://javfree.me/442375/fc2-ppv-4909862
// https://javfree.me/308458/star-362
// https://javarchive.com/1150543-FC2-PPV-4929169-%E3%80%90%E3%83%BB%E5%88%9D%E6%92%AE%E3%82%8A%E2%99%A1%E3%80%91-0424_001-%E3%82%89%E3%82%93%E3%81%A1%E3%82%83%E3%82%9325%E6%AD%B3-G%E3%82%AB%E3%83%83%E3%83%97%E3%81%AE%E3%83%AD%E3%82%B1%E3%83%83%E3%83%88%E3%81%8A%E3%81%A3%E3%81%B1%E3%81%84%EF%BC%8B-pn.html
// https://javarchive.com/1150541-FC2-PPV-4923443-%E3%81%8A%E4%BA%92%E3%81%84%E3%81%AE%E3%82%AB%E3%83%A9%E3%83%80%E3%82%92%E7%9F%A5%E3%82%8A%E5%B0%BD%E3%81%8F%E3%81%97%E3%81%9F%E6%BF%80%E3%82%A8%E3%83%AD%E7%BE%8E%E4%BA%BA%E3%82%BB%E3%83%95%E3%83%AC%E3%81%A8%E7%B5%90%E5%A9%9A%E5%89%8D%E3%81%AE%E3%80%8C%E3%82%84%E3%82%8A%E7%B4%8D%E3%82%81%E3%80%8D-pn.html
// https://javarchive.com/1150540-FC2-PPV-4927999-%E3%80%90%E5%88%9D%E3%83%BB%E9%A1%94%E5%87%BA%E3%81%97%E3%80%91%E6%B9%A7%E3%81%8D%E5%87%BA%E3%81%99%E8%84%87%E6%B1%97%E3%81%AB%E6%81%A5%E3%81%98%E3%82%89%E3%81%8619%E6%AD%B3%E8%BE%B2%E5%A4%A7%E7%94%9F%E3%80%82%E5%8D%8A%E6%B0%97/%E7%B5%B6%E7%8A%B6%E6%85%8B%E3%81%A7%E6%98%87%E5%A4%A9%E3%81%97%E3%81%BE%E3%81%8F-pn.html
// https://3xplanet.net/fc2-ppv-4928069/
// https://3xplanet.com/fc2-ppv-4927068/
// https://javideo.net/fc2ppv-4928077
// https://javideo.net/fc2ppv-2767568
// https://javideo.net/415las-040
// https://javideo.net/415las-040
// chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=8dbebce0-6edf-49e6-baf3-c1763b28ba93+editor
// https://fd2ppv.cc/articles/4927999
// https://fd2ppv.cc/articles/4923443
// https://pornav.co/jp/article-384961/FC2-PPV-4923443-50-OFF-A-super-erotic-beauty-with-a-sex-friend-who-knows-each-others-bodies-inside-and-out-and-the-pre-marriage-final-session-jnynyqqs-SEX-facial-Miki-26-years-old
// https://javip.net/fc2-ppv-4923443/#more-721714
// https://javip.net/fc2-ppv-4927999/#more-721708

// https://fc2db.net/work/4922101/
// https://fc2db.net/works/page/1900/
// https://fc2db.net/works/page/2800/
// https://fc2db.net/work/3104337/
// https://fc2db.net/work/4633957/
// https://avfhd.com/698456/fc2-ppv-4872123/
// https://avfhd.com/599396/fc2-ppv-4742721/
// https://fc2db.net/work/4723295/
// https://fc2db.net/work/4511406/
// https://fc2db.net/work/4595393/
