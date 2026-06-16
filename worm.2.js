// ==UserScript==
// @name            蠕虫
// @namespace       http://tampermonkey.net/
// @version         0.1
// @description     特定站点的资源下载器
// @author          Mercer
// @icon            https://raw.githubusercontent.com/luhaibing/common-js-functions/main/worm.webp

// @match           *://*/*

// @require         https://github.com/luhaibing/common-js-functions/raw/main/functions.user.js
// @require         https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
// @require         https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js
// @require         https://unpkg.com/md5@2.3.0/dist/md5.min.js

// @grant           GM_xmlhttpRequest
// @grant           GM_setClipboard
// @grant           GM_download
// @grant           window.close

// ==/UserScript==

(function () {
    'use strict';

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

        /**
         *
         * @param {string} name
         * @param {string} content
         * @param {number} type
         */
        constructor(name, content, type) {
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
        }

        /**
         *
         * @param href
         * @param name
         * @param pattern
         * @param default_suffix
         * @param type
         * @returns {Entity|null}
         */
        static href(href, name, pattern, default_suffix, type = Entity.HREF, {doc}) {
            if (!name) {
                if (!pattern || !default_suffix) {
                    throw "pattern and default_suffix can not be blank.";
                }
                let i1 = href.lastIndexOf("/");
                let base_name = href.substring(i1 + 1);
                let array = pattern.exec(base_name);
                // noinspection JSUnresolvedFunction
                let [_, file_name, suffix] = array || [href, MD5(href), default_suffix];
                name = `${file_name.replace(/\//g, " ")}.${suffix || default_suffix}`;
            }
            if (!href) {
                throw "href can not be blank.";
            }
            if (!/^https?/.test(href)) {
                log("href error.");
                return null;
            }
            return new Entity(name, href, type ?? Entity.HREF);
        }

        /**
         *
         * @param href
         * @param name
         * @returns {Entity}
         */
        static cover(href, name, doc) {
            return Entity.href(href, name, null, null, Entity.COVER, {doc: doc});
        }

        /**
         *
         * @param href
         * @param name
         * @param doc
         * @return {Entity|null}
         */
        static photo(href, name, doc) {
            if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`
            }
            return Entity.href(href, name, Entity.P, "jpg", Entity.PHOTO, {doc: doc});
        }

        /**
         *
         * @param href
         * @param name
         * @param doc
         * @return {Entity|null}
         */
        static video(href, name, doc) {
            if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`;
            }
            return Entity.href(href, name, Entity.V, "mp4", Entity.VIDEO, {doc: doc});
        }

        /**
         *
         * @param href
         * @param name
         * @param doc
         * @return {Entity|null}
         */
        static file(href, name, doc) {
            if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`;
            }
            return Entity.href(href, name, null, null, Entity.FILE, {doc: doc});
        }

        static text(content, name, doc) {
            return undefined;
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

            this.actors = (this.actors || []).distinct(predicate).correct(correction);
            this.categories = (this.categories || []).distinct(predicate).correct(correction);
            this.tags = (this.tags || []).distinct(predicate).correct(correction);

            this.photos = (this.photos || []).distinct().correct(correction);
            this.videos = (this.videos || []).distinct().correct(correction);
            this.manages = (this.manages || []).distinct((value) => value.code).correct(correction);

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

    /**
     * 需要下载的内容
     */
    class Result {
        /** @type {string|Date|null} 文件名 */
        name;
        /** @type {Array<Entity>} 需要下载的内容数组 */
        entries;

        constructor(name, entries) {
            if (entries && !isIterable(entries)) {
                throw "entries must be an iterable.";
            }
            this.name = name.trim();
            entries = (entries && Array.from(entries)) || [];
            entries = entries.filter(function (entry) {
                return entry;
            });
            this.entries = entries;
        }

        /**
         *
         * @param resource
         * @param doc
         * @return {Result}
         */
        static from(resource, doc) {
            const destruction = function (value) {
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
                    cover = Entity.cover(href, name, doc);
                } else if (cover instanceof String && cover.trim().length > 0) {
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
                                name = filename
                            } else {
                                name = filename + "." + suffix
                            }
                        }
                        cover = Entity.cover(cover, name, doc);
                    } catch (e) {
                        log(e)
                        cover = null
                    }
                }
                cover && entries.push(cover);
            }

            for (const value of photos ?? []) {
                const [href, name] = destruction(value);
                const entry = Entity.photo(href, name, doc);
                entries.push(entry);
            }

            for (const value of videos ?? []) {
                const [href, name] = destruction(value);
                const entry = Entity.video(href, name, doc);
                entries.push(entry);
            }

            for (const value of attachments ?? []) {
                const [href, name] = destruction(value);
                const entry = Entity.file(href, name, doc);
                entries.push(entry);
            }

            if (isValidIterable(manages)) {
                // let manages_file_name = Model.correction_name_length(file_names, "txt", "manages_file_name");
                // manages_file_name = manages_file_name.replaceAll("/", " ");
                // noinspection JSUnusedLocalSymbols
                // entries.push(Entity.texts(`${manages_file_name}.txt`, manages, ["name", "code", function (previousValue, currentValue, key) {
                //     return !previousValue ? currentValue : null;
                // }]));
                const names = {};
                for (const manage of manages) {
                    let code = manage["content"];
                    if (Entity.MANAGE_P.test(code)) {
                        code = Entity.MANAGE_P.exec(code)[0];
                    }
                    let name = manage["name"].trim();
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
                    entries.push(Entity.text(content, filename,))
                }
            }

            let actor = actors && actors.length > 1 ? ` - ${actors.map(function (e) {
                return e.name ?? e.innerText ?? e.toString();
            }).join('、')}` : "";

            let filename;
            if (code && isValidStr(code) && title && isValidStr(title)) {
                // if (title.trim().startsWith(code.trim())) {
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
                actor = ` - ${actor}`
            }
            if (filename.length + actor.length <= Entity.MAX_LENGTH) {
                filename = filename + actor;
            } else {
                const diff = filename.length + actor.length - Entity.MAX_LENGTH
                filename = filename.substring(Entity.MAX_LENGTH - diff) + actor;
            }
            filename = `${filename}.zip`
            return new Result(filename, entries);
        }

    }

    class NodeQuery extends Processor {

        /**
         * 执行节点
         * @generator
         * @param {Document} doc 页面文档
         * @param {Function} node 节点的值
         * @param {string|null} name 节点的名
         * @returns {AsyncGenerator<Promise<Awaited<any>>, void, *>}
         */
        async* execute_node(doc, node, name) {
            const result = node(doc, name);
            if (result != null && isIterable(result)) {
                for await (const element of result) {
                    yield element
                }
            } else {
                yield result;
            }
        }

        /**
         *
         * @generator
         * @param {Document} doc 页面文档
         * @param {*} node 节点的值
         * @param {string|null} name 节点的名
         * @param {string|null} attribute 属性
         * @param {string|null} property 属性
         * @param {number|null} start 开始
         * @param {number|null} end   结尾
         * @returns {AsyncGenerator<*, void, void>}
         */
        async* query_node({doc, node, name, attribute, property, start, end}) {
            const convert = function (target, names = null) {
                if (!target) {
                    return null;
                }
                const hasOwn = function (owner, names) {
                    names = names || [];
                    if (!isValidIterable(names) || !owner) {
                        return false;
                    }
                    for (const name of names) {
                        if (!Object.hasOwn(owner, name)) {
                            return false;
                        }
                    }
                    return true;
                }
                const values = [];
                if (isValidStr(target)) {
                    values.push({key: target.trim(), name: null});
                } else if (hasOwn(target, names)) {
                    values.push(target);
                } else if (!isStr(target) && isValidIterable(target)) {
                    for (let element of target) {
                        let vs = convert(element, names);
                        values.push(...vs);
                    }
                } else {
                    // 其他类型则略过
                    log(`${target} can not be process.`);
                }
                return values.distinct(function (v) {
                    return v?.name ?? v;
                });
            }
            const get = function (node, attributes, properties) {
                const noNameWrap = function (value) {
                    return Boolean(value.hasOwnProperty("name") && !Boolean(value["name"]?.trim()));
                }
                const valueFormat = function (value, format) {
                    if (format instanceof RegExp && format.test(value)) {
                        let execArray = format.exec(value);
                        return execArray[1] ?? execArray[0];
                    }
                    if (typeof format === "function") {
                        return format(value)
                    }
                    return value;
                }
                attributes = attributes || [];
                properties = properties || [];
                let count = attributes.length + properties.length;
                if (count === 0) {
                    return node;
                } else if (count === 1 && all([...attributes, ...properties], noNameWrap)) {
                    // noinspection LoopStatementThatDoesntLoopJS
                    for (const {key} of attributes) {
                        return node.getAttribute(key);
                    }
                    // noinspection LoopStatementThatDoesntLoopJS
                    for (const {key} of properties) {
                        return node[key];
                    }
                } else {
                    const obj = {};
                    for (const {key, name, format} of attributes) {
                        const n = name || key;
                        const value = node.getAttribute(key);
                        obj[n] = valueFormat.call(this, value, format);
                    }
                    for (const {key, name, format} of properties) {
                        const n = name || key;
                        const value = node[key];
                        obj[n] = valueFormat.call(this, value, format);
                    }
                    return obj;
                }
            }
            const names = ["key", "name"];
            const attributes = convert(attribute, names);
            const properties = convert(property, names);
            let finds = this.query(node, doc, name)
            let s = 0;
            let e = finds.length;
            start && (s = start)
            end && (e = end)
            finds = finds.slice(s, e);
            for (const find of finds) {
                const value = get(find, attributes, properties)
                yield value;
            }
        }

        /**
         * 生成从 start 到 end 的整数序列
         * @generator 标明这是一个生成器函数
         * @param {Document} doc 页面文档
         * @param {string|null} node 节点的值
         * @param {string|null} name 节点的名
         * @returns {AsyncGenerator<*, void, *>}
         */
        async* process_node(doc, node, name = null) {
            const obj = this;
            name = name ?? Object.keys(this).find(function (k) {
                return node === obj[k];
            });
            if (!name) {
                throw "can not found name";
            }
            let elements;
            if (isStr(node)) {
                elements = [{node: node}];
            } else if (isIterable(node)) {
                elements = node;
            } else {
                elements = [node];
            }
            for (const element of elements) {
                if (typeof element === "function") {
                    yield* this.execute_node(doc, element, name);
                } else {
                    // noinspection JSCheckFunctionSignatures
                    yield* this.query_node({doc: doc, node: element, name: name, ...element});
                }
            }
        }

        /**
         * 解析获取节点的值
         * @param {Document} doc 页面文档
         * @param {*|null} node 节点的值
         * @param {string|null} name 节点的名
         * @returns {Promise<Array<*>>}
         */
        async node2value(doc, node, name = null) {
            if (!node) {
                return null;
            }
            for await (let element of this.process_node(doc, node, name)) {
                if (!element) {
                    continue;
                }
                return element;
            }
            return null;
        }

        /**
         * 解析获取节点的值(列表)
         * @param {Document} doc 页面文档
         * @param {*|null} node 节点的值
         * @param {string|null} name 节点的名
         * @returns {Promise<Array<*>>}
         */
        async node2values(doc, node, name = null) {
            const values = [];
            if (!node) {
                return values;
            }
            for await (const element of this.process_node(doc, node, name)) {
                if (!element) {
                    continue;
                }
                if (isStr(element)) {
                    values.push(element);
                } else if (isIterable(element)) {
                    values.push(...element);
                } else {
                    values.push(element);
                }
            }
            return values;
        }

    }

    /**
     * 站点
     */
    class Site extends NodeQuery {

        constructor({host, path, search}) {
            super(host, path, search);
        }

        /**
         * 执行
         * @param {Document} doc 页面文档
         * @returns {Promise<Result>}
         */
        async process(doc) {
            await super.process(doc);
            let resource = await this.parse(doc);
            return Result.from(resource, doc);
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
            const href = doc.URL;

            const code = await this.parse_code(doc);
            const title = await this.parse_title(doc);
            const subtitle = await this.parse_subtitle(doc);
            const desc = await this.parse_desc(doc);
            const date = await this.parse_date(doc);
            const actors = await this.parse_actors(doc);
            const categories = await this.parse_categories(doc);
            const tags = await this.parse_tags(doc);

            const cover = await this.parse_cover(doc);
            const photos = await this.parse_photos(doc);
            const videos = await this.parse_videos(doc);
            const manages = await this.parse_manages(doc);
            const attachments = await this.parse_attachments(doc);
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
        async parse_title(doc) {
            let {title} = this;
            return await this.node2value(doc, title);
        }

        /**
         * 解析获取番号
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 番号
         */
        async parse_code(doc) {
            let {code} = this;
            return await this.node2value(doc, code);
        }

        /**
         * 解析获取副标题
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 副标题
         */
        async parse_subtitle(doc) {
            let {subtitle} = this;
            return await this.node2value(doc, subtitle);
        }

        /**
         * 解析获取描述
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 描述
         */
        async parse_desc(doc) {
            let {desc} = this;
            return await this.node2value(doc, desc);
        }

        /**
         * 解析获取日期
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 日期
         */
        async parse_date(doc) {
            let {date} = this;
            return await this.node2value(doc, date);
        }

        /**
         * 解析获取作者
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 作者
         */
        async parse_actors(doc) {
            let {actors} = this;
            return await this.node2values(doc, actors);
        }

        /**
         * 解析获取种类
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 种类
         */
        async parse_categories(doc) {
            let {categories} = this;
            return await this.node2values(doc, categories);
        }

        /**
         * 解析获取标签
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 标签
         */
        async parse_tags(doc) {
            let {tags} = this;
            return await this.node2values(doc, tags);
        }

        /**
         * 解析获取封面
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 封面
         */
        async parse_cover(doc) {
            let {cover} = this;
            return await this.node2value(doc, cover);
        }

        /**
         * 解析获取图片
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 图片
         */
        async parse_photos(doc) {
            let {photos} = this;
            return await this.node2values(doc, photos);
        }

        /**
         * 解析获取视频
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 视频
         */
        async parse_videos(doc) {
            let {videos} = this;
            return await this.node2values(doc, videos);
        }

        /**
         * 解析获取磁力链接
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 磁力链接
         */
        async parse_manages(doc) {
            let {manages} = this;
            return await this.node2values(doc, manages);
        }

        /**
         * 解析获取附件
         * @param {Document} doc 页面文档
         * @returns {Promise<*|null>} 附件
         */
        async parse_attachments(doc) {
            let {attachments} = this;
            return await this.node2values(doc, attachments);
        }

    }

    // ----------------------------------------------------------------

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
                select: "div.col-md-3.info > p:nth-child(1) > span:nth-child(2)",
                property: "innerText",
            },
            function (doc) {
                let href = doc.URL;
                return href.split("/").at(-1)
            }]

        cover = {
            select: "a.bigImage[href] > img[src]",
            property: "src",
        }

        date = "//div[contains(@class,'info')]/p/span[@class='header' and (starts-with(text(),'發行日期') or starts-with(text(),'출시일') or starts-with(text(),'発売日') or starts-with(text(),'Release Date'))]/../text()";

        categories = {
            select: "//div[contains(@class,'info')]/p/span[@class='header' and (starts-with(text(),'系列') or starts-with(text(),'시리즈') or starts-with(text(),'シリーズ') or starts-with(text(),'Series'))]/../a[@href]",
            attribute: "href",
            property: {k: "innerText", n: "name"},
        }

        tags = {
            select: "div.info > p > span.genre > label > a[href]",
            attribute: {k: "href", n: "href"},
            property: {k: "innerText", n: "name"},
        }

        photos = {
            select: "#sample-waterfall > a.sample-box[href]",
            attribute: "href",
        }

        manages = {
            select: "#magnet-table > tr > td:first-child > a[href]",
            // attribute: {k: "href", n: "code", format: /magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}/},
            attribute: {k: "href", n: "code", format: Entity.MANAGE_PATTERN},
            property: {k: "innerText", n: "name"},
        }

        actors = {
            select: "div.info > ul > div.star-box > li > div.star-name > a[href]",
            attribute: ["href"],
            property: {k: "innerText", n: "name"},
        }

    }

    // ----------------------------------------------------------------

    const SITES = Object.assign([
        singleton(JavBus),
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
    let glass = `button${Math.round(1000 + Math.random() * 8999)}`;
    let style = `.${glass}{
           position:fixed;
            right:10%;
            bottom:16.5%;
            width: 55px;
            height: 55px;
            border-radius:50%;
            border: none;
            background-color: #f44949;
            border: 1px solid #f44949;
            color:#fff;
            z-index:50;
        }.${glass}:active{
            background-color: #ca8e9f;
        }.${glass}:hover{
            background-color: #ca8e9f;
        }`;

    async function download_resource(resource, configs) {
        if (!(resource instanceof Resource)) {
            return;
        }
        let headers = {                      // 在这里定义请求头
            "Referer": window.location.href,
            "Origin": window.location.origin,
            "User-Agent": navigator.userAgent,
            "X-Custom-Header": Math.round(1000 + Math.random() * 8999).toString(),
        }
        let {on_start, on_progress, on_success, on_failure} = configs || {};
        if (resource.entries.length == 1) {
            let item0 = resource.entries[0];
            let v1 = item0.name;
            let v2 = v1.split(".")[1];
            let file = resource.name + "." + v2;
            let url = item0.content;
            let total = 1;
            let downloaded = 0;
            on_start && on_start(total);
            on_progress && on_progress(downloaded, total);
            // 一行代码，简单直接
            GM_download({url: url, name: file, headers: headers});
            on_success && on_success(total);
        } else {
            let {name, entries} = resource;
            // noinspection JSUnresolvedFunction
            let zip = new JSZip();
            // noinspection JSUnresolvedFunction
            let folder = zip.folder(name);
            let downloaded = 0;
            let total = entries.length;
            on_start && on_start(total);
            let func = function (item) {
                let {type, content, name: file} = item;
                if (type === Entity.TEXT) {
                    const blob = new Blob([content], {type: "text/plain"});
                    downloaded++;
                    on_progress && on_progress(downloaded, total);
                    // 压入zip中
                    folder.file(file, blob, {binary: true});
                } else if ((type & Entity.HREF) === Entity.HREF) {
                    return stream(
                        content,
                        {
                            responseType: "blob",
                            headers: headers,
                        })
                        .response2array()
                        .then(function (data) {
                            // let blob = new Blob([data], {type: 'image/jpeg'}); // 转为Blob类型
                            let blob = new Blob([data]); // 转为Blob类型
                            if (blob.size < 2 ** 10) {
                                return
                            }
                            folder.file(file, blob, {binary: true}); // 压入zip中
                        })
                        .then(function () {
                            downloaded++;
                            on_progress && on_progress(downloaded, total);
                        })
                        .then(function () {
                            return sleep(1000 * 1.5);
                        })
                        .catch(function (reason) {
                            log(content, " ; ", reason)
                        });
                }
            }

            await asyncPool(3, entries, func);

            Promise.resolve()
                .then(function () {
                    // log(`共下载: ${downloaded}/${num}`)
                })
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
                // .then(function () {return sleep(10 ** 3 * 10);}).then(function () {window.close();})
                .finally(function () {
                });
        }
    }

    async function download(doc, site, configs) {
        let res = await site?.run(doc);
        let json = JSON.stringify(res);
        log(json);

        let resources;
        if (isIterable(res)) {
            resources = Array.from(res);
        } else {
            resources = [res];
        }
        for (const resource of resources) {
            // noinspection JSUnusedGlobalSymbols
            await download_resource(resource, configs);
        }
        site && await (site?.close());
    }

    // noinspection JSUnresolvedFunction
    button("Down", async function () {
        let btn = this;
        if (!this.enabled()) {
            alert("下载中,请勿重复点击");
            return;
        }
        // btn.disable();
        btn.text("Conn.");
        await download(document, site, {
            on_start: function (total) {
                btn.text(`0/${total}`);
            }, on_progress: function (progress, total) {
                btn.text(`${progress}/${total}`);
            }, on_success: function () {
                btn.text('Done');
            }, on_failure: function () {
                btn.text("Fail")
            },
        });
        btn.enable();
    }, style, {
        "class": glass,
    });
    // setTimeout(function () {document.querySelector(`button.${glass}`)?.click();}, 10 ** 3 * 3);

})();