// ==UserScript==
// @name            蠕虫
// @namespace       http://tampermonkey.net/
// @version         0.1
// @description     特定站点的资源下载器
// @author          Mercer
// @icon            https://raw.githubusercontent.com/luhaibing/common-js-functions/main/worm.webp

// @match           *://*/*

// @require         https://unpkg.com/md5@2.3.0/dist/md5.min.js
// @require         https://github.com/luhaibing/common-js-functions/raw/main/functions.user.js
// @require         https://cdn.bootcss.com/FileSaver.js/1.3.2/FileSaver.min.js
// @require         https://cdn.bootcss.com/jszip/3.1.4/jszip.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/crypto-js.min.js

// @grant           GM_xmlhttpRequest
// @grant           window.close
// @grant           GM_setClipboard
// @grant           GM_download
// ==/UserScript==

// noinspection DuplicatedCode
// noinspection SpellCheckingInspection


(function () {
    'use strict';

    let glass = `button${Math.round(1000 + Math.random() * 8999)}`;

    // 封装一个延时函数，返回 Promise
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    class AvWiki {

        static async queryActor(code) {
            const url = function (value) {
                return `https://av-wiki.net/?s=${value}&post_type=product`;
            }

            const search = async function (href, msg = "页面解析失败.") {
                const times = 10;
                return await retry(async function () {
                    return await html(href);
                }, times, function (d) {
                    let fs = d.querySelectorAll("article.archive-list");
                    if (!isValidIterable(fs)) {
                        throw msg;
                    }
                });
            }

            const retryCatch = function (reason) {
                let num = /^(\d+)[a-z]?/i.exec(code)?.[1];
                if (num === null) {
                    throw reason;
                }
                return search(url(code.replace(num, "")))
            }

            const d = await (search(url(code)).catch(retryCatch));
            const finds = d.querySelectorAll("article.archive-list");
            if (finds.length !== 1) {
                return null;
            }
            const find = finds[0];
            let a = find.querySelector("li.actress-name a[rel='tag']");
            const href = a["href"];
            const name = a.innerText;
            return {href, name};
        }

    }

    // noinspection JSUnusedGlobalSymbols
    class Entity {
        static MANAGE_PATTERN = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{40}/;
        static MANAGE_P = /(magnet:\?xt=urn:btih:?([\da-f]{40}|[\da-z]{32}))(?=[^\da-z])/;
        static P = /(.*).(jpg|png|webp|gif)/i;
        static V = /(.*).(mp4|avi|wmv|mov|rmvb)/i;
        static TEXT = 1;
        static HREF = Entity.TEXT << 1;
        static PHOTO = (Entity.TEXT << 2) + Entity.HREF;
        static COVER = (Entity.TEXT << 3) + Entity.PHOTO;
        static VIDEO = (Entity.TEXT << 4) + Entity.HREF;
        static FILE = (Entity.TEXT << 5) + Entity.HREF;

        static text(name, content) {
            if (!isValidStr(content)) {
                return null;
            }
            return new Entity(name, content, Entity.TEXT);
        }

        static texts(name, iterable, attributes = []) {
            let content = "";
            iterable = iterable ?? [];
            attributes = attributes || [];
            if (!isValidIterable(iterable)) {
                return null;
            }
            for (const element of iterable) {
                let _content = "";
                for (const key of attributes) {
                    let value = undefined;
                    if (isValidStr(key)) {
                        value = element[key];
                    } else if (isFunction(key)) {
                        value = key.call(null, _content, element, key);
                    }
                    value && (_content += `${value} \r\n`);
                }
                _content && (content += `${_content} \r\n`);
            }

            return new Entity(name, content.trimEnd(), Entity.TEXT)
        }

        static href(href, name, pattern, default_suffix, type = Entity.HREF) {
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

        static cover(href, name) {
            return Entity.href(href, name, null, null, Entity.COVER);
        }

        static photo(href, name = null, doc = document, type = Entity.PHOTO) {
            if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`;
            }
            return Entity.href(href, name, Entity.P, "jpg", type);
        }

        static video(href, name = null, doc = document) {
            if (!/^https?/.test(href)) {
                let base_Url = doc.baseURI;
                href = `${base_Url.slice(0, -1)}${href}`;
            }
            return Entity.href(href, name, Entity.V, "mp4", Entity.VIDEO);
        }

        static file(href, name) {
            return Entity.href(href, name, null, null, Entity.FILE);
        }

        type;
        name;
        content;

        constructor(name, content, type) {
            if (!isValidStr(name)) {
                throw "name must be a valid string.";
            }
            if (!isValidStr(content)) {
                throw "content must be a valid string.";
            }
            this.name = name.trim();
            this.content = content.trim();
            this.type = type;
        }

    }

    class Model {
        href;
        title;

        // 对象
        code = null;
        subTitle = null;
        desc = null;
        cover = null;
        date = null;

        // 数组、集合
        actors = null;
        photos = null;
        videos = null;
        manages = null;
        categories = null;
        tags = null;

        attachments = null;

        constructor(href, title, code, subTitle, desc, cover, date,
                    actors, photos, videos, manages, categories, tags, attachments) {
            this.href = href;

            isValidStr(title) && (this.title = title?.trim());
            isValidStr(code) && (this.code = code?.trim());
            isValidStr(subTitle) && (this.subTitle = subTitle?.trim());
            isValidStr(desc) && (this.desc = desc?.trim());
            isValidStr(cover) && (this.cover = cover?.trim());
            isValidStr(date) && (this.date = date?.trim());

            isValidIterable(actors) && (this.actors = []).push(...actors);
            isValidIterable(photos) && (this.photos = []).push(...photos);
            isValidIterable(videos) && (this.videos = []).push(...videos);
            isValidIterable(manages) && (this.manages = []).push(...manages);
            isValidIterable(categories) && (this.categories = []).push(...categories);
            isValidIterable(tags) && (this.tags = []).push(...tags);
            isValidIterable(attachments) && (this.attachments = []).push(...attachments);

            let _predicate = function (value) {
                return value.href;
            }

            let _correction = function (values) {
                return isValidIterable(values) ? values : null;
            }

            this.actors = (this.actors || []).distinct(_predicate).correct(_correction);
            this.photos = (this.photos || []).distinct().correct(_correction);
            this.videos = (this.videos || []).distinct().correct(_correction);
            this.manages = (this.manages || []).distinct((value) => value.code).correct(_correction);
            this.categories = (this.categories || []).distinct(_predicate).correct(_correction);
            this.tags = (this.tags || []).distinct(_predicate).correct(_correction);

        }

        static from({
                        href, title, code, subTitle, desc, cover, date,
                        actors, photos, videos, manages, categories, tags, attachments
                    }) {
            return new Model(
                href, title, code, subTitle, desc, cover, date,
                actors, photos, videos, manages, categories, tags, attachments
            );
        }

        static strSlice(value, start, length) {
            let result = "";
            for (const v of String(value)) {
                if (str2len(result) + str2len(v) > length) {
                    break;
                }
                result += v;
            }
            return result;
        }

        json() {
            return JSON.stringify(this);
        }

        static correction_name_length(values, suffix, name, MAX_LENGTH = 250) {
            if (isStr(values) || !isValidIterable(values)) {
                throw "values must be iterable.";
            }
            let valid_length = MAX_LENGTH;
            valid_length = valid_length - str2len(suffix?.trim() ? `.${suffix}` : "");
            let result;
            for (let value of values) {
                if (isFunction(value)) {
                    value = value.call(this, valid_length);
                }
                let p, v;
                if (isStr(value)) {
                    p = true;
                    v = value;
                } else if (Array.isArray(value)) {
                    [p, v] = value;
                    p = p || false;
                    v = v || null;
                } else {
                    p = false;
                    v = null;
                }
                v = v || String(v);
                if (p && v && str2len(v) <= valid_length) {
                    result = v.trim();
                    break;
                }
            }
            if (!result) {
                throw `${name || 'result'} cannot be blank.`;
            }
            return result;
        }

        convert(doc) {
            let {
                code: code,
                title: title,
                cover: cover,
                photos: photos,
                videos: videos,
                manages: manages,
                actors: actors,
                attachments: attachments,
            } = this;
            let entries = [];
            if (cover) {
                const values = [
                    [code && isValidStr(code), `${code} ${title}`],
                    title,
                    [code && isValidStr(code), code],
                    function (length) {
                        return [code && isValidStr(code), Model.strSlice(`${code} ${title}`, 0, length)];
                    }, function (length) {
                        return Model.strSlice(title, 0, length);
                    }];
                let suffix = Entity.P.exec(cover)?.[2] || "jpg";
                let name = Model.correction_name_length(values, suffix, "cover_name");
                name = name.replaceAll("/", " ");
                const entry = Entity.cover(cover, `${name}.${suffix}`);
                entries.push(entry);
            }
            const _destruction = function (value) {
                let href = null;
                let name = null;
                if (isStr(value)) {
                    href = value;
                } else if (isObject(value)) {
                    href = value.href;
                    name = value.name;
                }
                return [href, name];
            }
            for (const value of photos ?? []) {
                const [href, name] = _destruction(value);
                const entry = Entity.photo(href, name, doc);
                entries.push(entry);
            }
            for (const value of videos ?? []) {
                const [href, name] = _destruction(value);
                const entry = Entity.video(href, name, doc);
                entries.push(entry);
            }
            for (const element of attachments ?? []) {
                const {href, name} = element;
                const entry = Entity.file(href, name);
                entries.push(entry);
            }

            let file_names = [
                [code && isValidStr(code), code],
                title,
                function (length) {
                    if (code && isValidStr(code)) {
                        return Model.strSlice(String(code), 0, length);
                    }
                    return null;
                },
                function (length) {
                    return Model.strSlice(title, 0, length);
                }
            ];
            if (isValidIterable(manages)) {
                // let manages_file_name = Model.correction_name_length(file_names, "txt", "manages_file_name");
                // manages_file_name = manages_file_name.replaceAll("/", " ");
                // noinspection JSUnusedLocalSymbols
                // entries.push(Entity.texts(`${manages_file_name}.txt`, manages, ["name", "code", function (previousValue, currentValue, key) {
                //     return !previousValue ? currentValue : null;
                // }]));

                const names = {};
                for (const manage of manages) {
                    let code = manage["code"];
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
                    let _name;
                    if (name in names) {
                        names[name].push(name);
                        const length = names[name].length;
                        _name = `${name} ${length}.url`;
                    } else {
                        names[name] = [name];
                        _name = name + ".url";
                    }
                    _name = `U/${_name}`;
                    const content = `[InternetShortcut]\r\nURL=${code}\r\nIconIndex=0\r\nIDList=\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]`;
                    entries.push(Entity.text(_name, content))
                }
            }

            let json_file_name = Model.correction_name_length(file_names, "json", "json_file_name");
            json_file_name = json_file_name.replaceAll("/", " ");
            entries.push(Entity.text(`${json_file_name}.json`, this.json()));

            let actor = actors && actors.length > 1 ? ` - ${actors.map(function (e) {
                return e.name ?? e.innerText ?? e.toString();
            }).join('、')}` : "";
            const resource_names = [
                [code && isValidStr(code), `${code} ${title}${actor}`],
                `${title}${actor}`,
                [code && isValidStr(code), String(code) + actor],
                [code && isValidStr(code), code],
                function (length) {
                    return Model.strSlice(title, 0, length);
                }
            ];

            let resource_name = Model.correction_name_length(resource_names, "zip", "resource_name");
            resource_name = resource_name.replaceAll("/", " ");

            return new Resource(resource_name, entries);
        }

    }

    class Resource {

        name;
        entries;

        constructor(name, entries) {
            this.name = name.trim();
            if (entries && !isIterable(entries)) {
                throw "entries must be an iterable.";
            }
            entries = (entries && Array.from(entries)) || [];
            entries = entries.filter(function (entry) {
                return entry;
            });
            this.entries = entries;
        }

        static restore1(resource, model, Model, Entity) {
            const {entries} = resource;
            let {title, code} = model;
            title = title.replaceAll("/", " ");
            code = code.replaceAll("/", " ");
            let title_values = [
                [isValidStr(code) && title.startsWith(code), title],
                code + " " + title,
                code,
                title,
                function (length) {
                    return [title && isValidStr(title), Model.strSlice(title, 0, length)];
                },
                function (length) {
                    return [code && isValidStr(code), Model.strSlice(String(code), 0, length)];
                }];
            for (const entry of entries) {
                if (entry.type !== Entity.COVER) {
                    continue;
                }
                let suffix = Entity.P.exec(entry.content)?.[2] || "jpg";
                let cover_name = Model.correction_name_length(title_values, suffix, "cover_name");
                entry.name = cover_name + "." + suffix;
                entry.name = `${cover_name}.${suffix}`;
            }
            resource.name = Model.correction_name_length(title_values, "zip", "resource_name")
            return resource;
        }

        static restore2(resource, model, Model, Entity) {
            const {entries} = resource;
            let {title, code} = model;
            title = title.replaceAll("/", " ");
            code = code.replaceAll("/", " ");
            let title_values = [
                [isValidStr(code) && title.startsWith(code), title],
                code + " " + title,
                code,
                title,
                function (length) {
                    return [title && isValidStr(title), Model.strSlice(title, 0, length)];
                },
                function (length) {
                    return [code && isValidStr(code), Model.strSlice(String(code), 0, length)];
                }];
            for (const entry of entries) {
                if (entry.type !== Entity.COVER) {
                    continue;
                }
                let suffix = Entity.P.exec(entry.content)?.[2] || "jpg";
                let cover_name = Model.correction_name_length(title_values, suffix, "cover_name");
                entry.name = cover_name + "." + suffix;
                entry.name = `${cover_name}.${suffix}`;
            }
            for (const entry of entries) {
                if (entry.type !== Entity.PHOTO) {
                    continue;
                }
                entry.name = `P/${entry.name}`;
            }
            let actors = model.actors;
            if (actors && actors.length > 1) {
                resource.name = model.code.trim() + " - " + actors.map(e => e.name).join("、");
            } else {
                resource.name = model.code.trim();
            }
            return resource;
        }

    }

    class NodeQuery extends Processor {

        * execute_node(doc, value, name) {
            let result = Promise.resolve(value?.call(this, doc, name));
            yield result;
        }

        * query_node({doc, select, selector, attribute, property, offset, name}) {

            function _convert(target, names = null) {
                function hasOwnProperties(owner, names) {
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

                if (!target) {
                    return null;
                }
                const values = [];
                if (isValidStr(target)) {
                    values.push({k: target.trim(), n: null});
                } else if (hasOwnProperties.call(this, target, names)) {
                    values.push(target);
                } else if (!isStr(target) && isValidIterable(target)) {
                    for (let element of target) {
                        let vs = _convert.call(this, element, names);
                        values.push(...vs);
                    }
                } else {
                    // 其他类型则略过
                    log(`${target} can not be process.`);
                }
                return values.distinct(function (v) {
                    return v?.n ?? v;
                });
            }

            function _get(node, attributes, properties) {
                function noName(value, name) {
                    return Boolean(value.hasOwnProperty(name) && !Boolean(value[name]?.trim()));
                }

                function noNameWrap(value) {
                    return noName(value, "n");
                }

                function valueFormat(value, format) {
                    if (format instanceof RegExp && format.test(value)) {
                        let execArray = format.exec(value);
                        return execArray[1] ?? execArray[0];
                    }
                    if (typeof format === "function") {
                        return format.call(this, value, format)
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
                    for (const {k} of attributes) {
                        return node.getAttribute(k);
                    }
                    // noinspection LoopStatementThatDoesntLoopJS
                    for (const {k} of properties) {
                        return node[k];
                    }
                } else {
                    let obj = {};
                    for (let {k, n, format} of attributes) {
                        n = n || k;
                        const value = node.getAttribute(k);
                        obj[n] = valueFormat.call(this, value, format);
                    }
                    for (let {k, n, format} of properties) {
                        n = n || k;
                        const value = node[k];
                        obj[n] = valueFormat.call(this, value, format);
                    }
                    return obj;
                }
            }

            select = select || selector;
            const names = ["k", "n"];
            const attributes = _convert.call(this, attribute, names);
            const properties = _convert.call(this, property, names);
            let finds = this.query(select, doc, name)
            if (offset && /^\d+$/.test(offset)) {
                finds = finds.slice(offset, offset + 1);
            }
            for (let find of finds) {
                const result = _get.call(this, find, attributes, properties);
                yield result;
            }

        }

        * process_node(doc, node, name = null) {
            let obj = this;
            name = name ?? Object.keys(this).find(function (k) {
                return node === obj[k];
            });
            if (!name) {
                throw "can not found name";
            }
            let elements;
            if (isStr(node)) {
                elements = [{select: node}];
            } else if (isIterable(node)) {
                elements = node;
            } else {
                elements = [node];
            }
            for (const element of elements) {
                if (typeof element === "function") {
                    yield* this.execute_node(doc, element, name);
                } else {
                    yield* this.query_node({doc: doc, name: name, ...element});
                }
            }
        }

        /**
         * 解析需要 字符串 的节点
         * @param doc
         * @param node
         * @param name 节点对应的名称
         * @returns {any|any|null}
         */
        async node2value(doc, node, name = null) {
            if (!node) {
                return null;
            }
            let generator = this.process_node(doc, node, name);
            for (let element of generator) {
                let value = await element;
                if (!value) {
                    continue;
                }
                return value;
            }
            return null;
        }

        /**
         * 解析需要 数组 的节点
         * @param doc
         * @param node
         * @param name
         * @returns {Promise<*[]>}
         */
        async node2values(doc, node, name = null) {
            let values = [];
            if (!node) {
                return values;
            }
            let generator = this.process_node(doc, node, name);
            for (let element of generator) {
                let value = await element;
                if (!value) {
                    continue;
                }
                if (isStr(value)) {
                    values.push(value);
                } else if (isIterable(value)) {
                    values.push(...value);
                } else {
                    values.push(value);
                }
            }
            return values;
        }

    }

    class Site extends NodeQuery {
        title;

        // 对象
        code = null;
        subtitle = null;
        desc = null;
        cover = null;
        date = null;

        // 数组、集合
        actors = null;
        photos = null;
        videos = null;
        manages = null;
        categories = null;
        tags = null;

        attachments = null;

        constructor({host, path, search}, {
            title, code, subtitle, desc, cover, date, actors, photos, videos, manages, categories, tags, attachments,
        }) {
            super(host, path, search);
            if (!title) {
                throw "title can not be null.";
            }
            this.title = title;
            code && (this.code = code);
            subtitle && (this.subtitle = subtitle);
            desc && (this.desc = desc);
            cover && (this.cover = cover);
            date && (this.date = date);

            actors && (this.actors = actors);
            photos && (this.photos = photos);
            videos && (this.videos = videos);
            manages && (this.manages = manages);
            categories && (this.categories = categories);
            tags && (this.tags = tags);
            attachments && (this.attachments = attachments);
        }

        static default_convert(model, doc) {
            return Model.from(model).convert(doc);
        }

        static default_document() {
            let doc = document;
            let href = location.href;
            let node = doc.querySelector("head > base");
            if (!node) {
                let {origin} = parseURL(href);
                node = doc.createElement("base");
                node.setAttribute("href", origin);
                doc.head.appendChild(node);
            }
            return doc;
        }

        static correction_document(doc) {
            if (doc) {
                return doc;
            }
            return Site.default_document();
        }

        async get_title(doc) {
            let {title} = this;
            return await this.node2value(doc, title);
        }

        async get_code(doc) {
            let {code} = this;
            return await this.node2value(doc, code);
        }

        async get_subtitle(doc) {
            let {subtitle} = this;
            return await this.node2value(doc, subtitle);
        }

        async get_desc(doc) {
            let {desc} = this;
            return await this.node2value(doc, desc);
        }

        async get_cover(doc) {
            let {cover} = this;
            return await this.node2value(doc, cover);
        }

        async get_date(doc) {
            let {date} = this;
            return await this.node2value(doc, date);
        }

        async get_actors(doc) {
            let {actors} = this;
            return await this.node2values(doc, actors);
        }

        async get_photos(doc) {
            let {photos} = this;
            return await this.node2values(doc, photos);
        }

        async get_videos(doc) {
            let {videos} = this;
            return await this.node2values(doc, videos);
        }

        async get_manages(doc) {
            let {manages} = this;
            return await this.node2values(doc, manages);
        }

        async get_categories(doc) {
            let {categories} = this;
            return await this.node2values(doc, categories);
        }

        async get_tags(doc) {
            let {tags} = this;
            return await this.node2values(doc, tags);
        }

        // noinspection JSUnusedLocalSymbols
        async get_attachments(doc) {
            // 子类去实现具体细节
            return [];
        }

        // check(doc) {
        //     return this.get_title(doc);
        // }

        async parse_doc(doc) {
            let href = doc.URL;
            let code = await this.get_code(doc);
            let title = await this.get_title(doc);
            let subtitle = await this.get_subtitle(doc);
            let desc = await this.get_desc(doc);
            let cover = await this.get_cover(doc);
            let date = await this.get_date(doc);
            let actors = await this.get_actors(doc);
            let photos = await this.get_photos(doc);
            let videos = await this.get_videos(doc);
            let manages = await this.get_manages(doc);
            let categories = await this.get_categories(doc);
            let tags = await this.get_tags(doc);
            let attachments = await this.get_attachments(doc);
            return {
                href: href,

                code: code,
                title: title,
                subTitle: subtitle,
                desc: desc,
                cover: cover,
                date: date,

                actors: actors,
                photos: photos,
                videos: videos,
                manages: manages,
                categories: categories,
                tags: tags,
                attachments: attachments,
            };
        }

        convert(model, doc) {
            return Site.default_convert(model, doc);
        }

        async process(doc) {
            await super.process(doc);
            doc = Site.correction_document(doc);
            let model = await this.parse_doc(doc);
            return this.convert(model, doc);
        }

        async close() {
            await sleep(10 ** 3 * 10)
        }

    }

    class PagingSite extends Site {

        /**
         * 下一页
         */
        next;

        /**
         * 页面内容、用于验证是否访问成功
         */
        page;

        constructor({host, path, search}, {
            next, page,
            title, code, subTitle, desc, cover, date,
            actors, photos, videos, manages, categories, tags, attachments
        }) {
            super({
                host, path, search
            }, {
                title, code, subTitle, desc, cover, date,
                actors, photos, videos, manages, categories, tags, attachments,
            });
            this.next = next;
            this.page = page;
        }

        async get_next(doc) {
            let {next} = this;
            return await this.node2value(doc, next);
        }

        async get_page(doc) {
            let {page} = this;
            return await this.node2value(doc, page);
        }

        async parse_doc(doc) {
            doc = Site.correction_document(doc);
            let node = doc, next;
            let href, code, title, subTitle, desc, cover, date;
            let actors = [], photos = [], videos = [], manages = [], categories = [], tags = [];

            do {
                let {
                    href: hf,
                    code: ce,
                    title: te,
                    subTitle: st,
                    desc: dc,
                    cover: cr,
                    date: de,
                    actors: as,
                    photos: ps,
                    videos: vs,
                    manages: ms,
                    categories: cs,
                    tags: ts,
                } = await super.parse_doc(node);

                // 只赋值一次
                hf && !href && (href = hf);
                ce && !code && (code = ce);
                te && !title && (title = te);
                st && !subTitle && (subTitle = st);
                dc && !desc && (desc = dc);
                cr && !cover && (cover = cr);
                de && !date && (date = de);

                as && (actors.push(...as));
                ps && (photos.push(...ps));
                vs && (videos.push(...vs));
                ms && (manages.push(...ms));
                cs && (categories.push(...cs));
                ts && (tags.push(...ts));

                next = await this.get_next(node);
                let func = async function () {
                    return await html(next);
                };
                node = next && await retry(func, 10, async (d) => {
                    let p = await this.get_page(d);
                    if (!p) {
                        throw "页面解析失败.";
                    }
                });
            } while (node);

            return {
                href: href,
                code: code,
                title: title,
                subTitle: subTitle,
                desc: desc,
                cover: cover,
                date: date,
                actors: actors,
                photos: photos,
                videos: videos,
                manages: manages,
                categories: categories,
                tags: tags,
            };
        }

    }

    class SegmentSite extends Site {
    }

    // 批量

    // ----------------------------------------------------------------

    class Oiuu extends SegmentSite {
        // https://www.oiuu.fun/
        // https://www.oiuu.vip/
        // http://www.oiuu.fun/
        // http://www.oiuu.vip/
    }

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
            }, {
                title: function (doc) {
                    return this.node2value(doc, "//div[@class='container']/h3[text()]/text()", "title");
                },
            });
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

        convert(model, doc) {
            const resource = super.convert(model, doc);
            return Resource.restore2(resource, model, Model, Entity);
        }

    }

    class JavMenu extends Site {

        constructor() {
            super({
                host: [
                    "kikiav.com",
                    "javmenu.com",
                    "www.kikiav.com",
                    "www.javmenu.com",
                ],
                path: [
                    /^\/[0-9a-z]+-[0-9a-z]+$/i,
                    /^\/zh\/[0-9a-z]+[_-]?[0-9a-z]+$/i
                ]
            }, {
                title: async function (doc) {
                    const title = await this.node2value(doc, {select: "h1 > strong", property: "innerText",}, "title");
                    const execArray = /fc2.*?(\d{2,})/i.exec(title);
                    if (execArray) {
                        let id = execArray[1];
                        let index2 = title.lastIndexOf(id);
                        return `FC2-${title.slice(index2)}`;
                    }
                    return title;
                }
            });
        }

        code = function (doc) {
            let url = doc.URL;
            let splits = url.split("/");
            return splits.reverse()[0];
        }

        cover = [
            {
                select: "video[data-poster]",
                attribute: "data-poster",
            }, {
                select: "div.single-video > img[src]",
                attribute: "src",
            }
        ]

        actors = {
            select: "a[class=actress]",
            property: ["innerText", "href"],
        }

        tags = {
            select: "div.card > div.card-body a.genre",
            property: "innerText",
            attribute: "href",
        }

        photos = {
            select: "a[data-fancybox=gallery][href]",
            attribute: "href",
        }

        manages = {
            select: "table.magnet-table tr.col a[href]",
            attribute: {k: "href", n: "code", format: Entity.MANAGE_PATTERN},
            property: {k: "innerText", n: "name"},
        }

        videos = {
            select: "video#player > source[src][type='video/mp4']",
            attribute: "src",
        }

        convert(model, doc) {
            const resource = super.convert(model, doc);
            return Resource.restore2(resource, model, Model, Entity);
        }

    }

    class MaDou extends Site {

        constructor() {
            super({
                host: [
                    /madouqu\d+\.cc/i,
                    /madouqu\.com/i
                ],
                path: /^\/[0-9a-z]{3,}(-\d+)?\/$/i,
            }, {
                title: async function (doc) {
                    // let text = this.query(`div.entry-wrapper > div.entry-content > p`, doc, doc, "title")
                    let text = (await this.node2values(doc, `div.entry-wrapper > div.entry-content > p`, "title"))
                        .map(function (node) {
                            return node.innerText
                        })
                        .filter(function (node) {
                            return isValidStr(node);
                        })[1];
                    let indexOf = text.indexOf("：");
                    return text.substring(indexOf + 1).split("\n")[0];
                },
            });
        }

        code = async function (doc) {
            // let text = this.query(`div.entry-wrapper > div.entry-content > p`, doc, doc, "code")
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
            select: "div.entry-wrapper > div.entry-tags > a[href][rel][data-wpel-link=internal]",
            property: "innerText",
            attribute: "href",
        }

        photos = {
            select: "div.entry-wrapper > div.entry-content > p > img[src]", attribute: "src",
        }

        manages = {
            select: "div.entry-wrapper > div.entry-content > p > a[href][rel=follow][data-wpel-link=internal]",
            attribute: "href",
        }

    }

    class YcGif extends PagingSite {

        constructor() {
            super({
                host: [
                    /www\.ycgif[a-z0-9]*\.com/i,
                    /www\.gif[ky]\d+\.com/i,
                    /www\.ycsan\d+\.com/i,
                    /www\.sanyc\d+\.com/i,
                    /www\.smgif\d+\.com/i,
                ],
                path: /^\/\d+\.html(\/\d+)?$/i
            }, {
                title: async function (doc) {
                    let title = await this.node2value(doc, {
                        select: "h1.article-title", property: "innerText",
                    }, "title")
                    let title_pattern = /(3秒原创GIF：)?(.*)/;
                    let expExecArray = title_pattern.exec(title);
                    return expExecArray && expExecArray[2] || title;
                },
            });
        }

        desc = {
            select: ".article-content p",
            property: "innerText",
        }

        next = {
            select: "div.article-paging > span.current + a[href]",
            attribute: "href",
        }

        page = {
            select: "body > div.is-full.main-container > div.main-body",
        }

        photos = async function (doc) {
            // return this.query("article.article-content img[src]", doc, doc, "photos").map(function (node) {
            let finds = await this.node2values(doc, "article.article-content img[src]", "photos");
            return finds.map(function (node) {
                let h = node.getAttribute("src");
                if (h.startsWith("http")) {
                    return h;
                }
                h = node.getAttribute("data-lazy-src")
                if (!h.startsWith("http")) {
                    alert("解析错误.")
                    throw `${h} is error.`
                }
                return h;
            });
        }

        videos = async function (doc) {
            // return this.query("video > source[src]", doc, doc, "videos").map(function (node) {
            let finds = await this.node2values(doc, "video > source[src]", "videos");
            return finds.map(function (node) {
                return node.getAttribute("src");
            });
        }

    }

    class SeHuaTang extends Site {
        constructor() {
            super({
                host: [
                    /^www\.sehuatang\./i,
                    /^sehuatang\./i,
                    /^dsadsfgd\./i],
                path: [
                    /^\/thread-\d+(-\d+)?(-\d+)?.html$/i,
                    /^\/forum.php$/i
                ],
            }, {
                title: async function (doc) {
                    let titles = await this.node2values(doc, "//div[@class='pcb']//td[@class='t_f' and starts-with(@id,'postmessage')]/text()", "title");
                    titles = titles.filter(function (element) {
                        return element.includes("影片名称") || element.includes("影片名稱");
                    });

                    let title;
                    if (isValidIterable(titles)) {
                        title = titles.map(function (element) {
                            return /[:：](.*)/.exec(element)?.[1];
                        }).filter(function (element) {
                            return isValidStr(element);
                        }).find(function (element) {
                            return Boolean(element);
                        });
                    } else {
                        title = (await this.node2value(doc, "span#thread_subject", "title")).innerText;
                    }
                    if (!title) {
                        throw "title can not be blank.";
                    }
                    return title.toUpperCase();
                },
            });
        }

        actors = async function (doc) {
            let values = await this.node2values(doc, "//div[@class='pcb']//td[@class='t_f' and starts-with(@id,'postmessage')][contains(text(),'名称')]/text()", "actors");
            if (!isValidIterable(values) || values.length < 2) {
                return null;
            }
            let actor = values[1];
            return actor ? /[:：](.*)/.exec(actor)?.[1] : null;
        };

        photos = [async function (doc) {
            const finds = await this.node2values(doc, {
                select: "id('postlist')//div[@class='pct']/div[@class='pcb']//div[contains(@class,'tip')]/div[@class='xs0']"
            }, "photos");
            // const finds = await this.node2values(doc, {select: "#postlist > div:nth-child(4) td.plc div.pcb img[file]", attribute: "file"}, "photos");
            const values = [];
            for (const find of finds) {
                // const name = find.querySelector("strong").innerText;
                // const href = find.querySelector("a[href]")['href'];
                const name = await this.node2value(find, {select: "strong", property: "innerText"}, "title");
                const href = await this.node2value(find, {select: "a[href]", attribute: "href"}, "title");
                values.push({name, href});
            }
            return values;
        }, {
            select: "id('postlist')//div[@class='pct']/div[@class='pcb']//td[@class='t_f']//img[@file]",
            attribute: "file",
        }, function (doc) {
            const values = [];
            let finds = doc.querySelectorAll("div.mbn.savephotop > img.zoom");
            for (const find of finds) {
                const href = find["src"];
                const name = find.parentNode.parentNode.querySelector("p.mbn > a.xw1").innerText;
                values.push({name, href});
            }
            return values
        }]

        manages = [{
            select: "//div[@class='blockcode']",
            property: "innerText",
        }, async function (doc) {
            let value = (await this.node2value(doc, "td.t_f", "manages")).innerText;
            if (!value?.trim()) {
                return null;
            }
            let execArray = Entity.MANAGE_PATTERN.exec(value.trim());
            if (isValidIterable(execArray)) {
                return execArray[0];
            }
            return null;
        }]

        // 附件
        attachments = [{
            select: "p.attnm>a[href]",
            attribute: "href",
            property: "innerText",
        }, {
            select: "ignore_js_op > span > a[href]",
            attribute: "href",
            property: "innerText",
        }]

        async get_attachments(doc) {
            let {attachments} = this;
            let entries = await this.node2values(doc, attachments);
            let result = [];
            for (const entry of entries) {
                let {href, innerText} = entry;
                result.push({
                    "href": href, "name": innerText,
                })
            }
            return result;
        }

    }

    class Photos18 extends Site {
        // https://www.photos18.com/
        constructor() {
            super({
                host: "www.photos18.com",
                path: /^\/v\/.*/,
            }, {
                title: {
                    select: "div.content h1.title",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.content div.imgHolder > a[href] > img[data-src]",
            attribute: "data-src",
        }

    }

    class Everia extends Site {
        // https://everia.club/
        constructor() {
            super({
                host: "everia.club",
                path: /^\/\d{4}\/\d{1,2}\/\d{1,2}\/.*/,
            }, {
                title: {
                    select: "div.entry-header h1.title",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.nv-content-wrap.entry-content > figure > figure.wp-block-image > img[data-src]",
            attribute: "data-src",
        }

        tags = async function (doc) {
            return (await this.node2values(doc, {
                select: "div.nv-tags-list a[href]",
                property: "innerText",
                attribute: "href"
            }, "tags")).map(function ({href, innerText}) {
                return {
                    href: href,
                    innerText: innerText.substring(1, innerText.length - 1),
                };
            });
        }

    }

    class Buondua extends PagingSite {
        // https://buondua.com/coser-%E8%A0%A2%E6%B2%AB%E6%B2%AB-chunmomo-%E5%8F%AB%E5%85%BD%E7%9A%84%E6%81%B6%E4%BD%9C%E5%89%A7%E2%85%B1-140-photos-28503
        constructor() {
            super({
                host: "buondua.com",
                path: /\/.+/,
                search: /.*/,
            }, {
                title: {
                    select: "div.article-header > h1",
                    property: "innerText",
                }
            });
        }

        photos = {
            selector: "div.main-container > div.main-body > div.article.content >  div.article-fulltext > p > img[src]",
            attribute: "src",
        }

        next = async function (doc) {
            let values = (await this.node2values(doc, "nav.pagination > div.pagination-list a.pagination-link", "next"))
                .distinct(function (a) {
                    return a.href;
                });
            let index = values.findIndex(function (a) {
                return a.className.indexOf('is-current') !== -1;
            });
            return values[index + 1]?.href;
        }

        page = {
            select: "div.content",
        }

        tags = {
            select: "div.article-tags > div.tags > a.tag",
            property: ["href", {k: "innerText", n: "name", format: /#(.*)/}],
        }

    }

    class NsfwPics extends Site {
        // https://nsfwx.pics/
    }

    class Ryuryu extends Site {
        // https://ryuryu.tw/
        // https://ryuryu.tw/coser-chun-mo-mo-chunmomo-hong-ge-zi-red-box/
        constructor() {
            super({
                host: /ryuryu\./,
                path: /^\/[^/]+\/$/i,
            }, {
                title: {
                    select: "main#site-main > article.article.post > header.article-header > h1.article-title",
                    property: "innerText",
                }
            });
        }

        cover = {
            select: "main#site-main > article.article.post > header.article-header > figure.article-image > img[src]",
            property: "src",
        }

        photos = {
            select: "main#site-main > article.article.post > section.gh-content.gh-canvas > figure.kg-card.kg-image-card > img[src]",
            property: "src",
        }

        tags = {
            select: "main#site-main > article.article.post > header.article-header > section.article-tag > a[href]",
            property: ["href", {k: "innerText", n: "name"}],
        }
    }

    class NsfwPub extends Site {
        // https://nsfwpub.com/
        // https://nsfwpub.com/post/1924042

        constructor() {
            super({
                host: "nsfwpub.com",
                path: /\/post\/\d+/,
            }, {
                title: {
                    select: "div.container div.card-body div.pb-2",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.container div.card-body img[src].img-fluid.mx-auto.my-auto.d-block",
            attribute: "src",
        }

        videos = {
            select: "div.container div.card-body video#my-video > source[src]",
            attribute: "src",
        }

    }

    class DopamineGirl extends Site {
        // https://dopaminegirl.com/
        constructor() {
            super({
                host: /^dopaminegirl\./,
                path: /^\/post\/\d+\/view$/
            }, {
                title: {
                    select: "body > div.container-fluid > h1.text-center",
                    property: ["innerText"]
                }
            });
        }

        photos = {
            select: "body > div.container-fluid > div.masonry > div.masonry-item img[src]",
            property: ["src"]
        }

        tags = {
            select: "body > div.container-fluid > div.container > span > a.d-inline-block",
            property: ["href", {k: "innerText", n: "name", format: /#(.*)/}],
        }

    }

    class Cucxinh extends PagingSite {
        // https://cucxinh.com/

        constructor() {
            super({
                host: "cucxinh.com",
                path: /^\/[^/]+\/(\d+\/)?$/,
            }, {
                title: {
                    select: "main#content h1.post-title.entry-title",
                    property: "innerText",
                }
            });
        }

        next = {
            select: "main#content article.post div.post-inner.group nav.pagination.group a.nextpostslink",
            property: "href",
        }

        page = {
            select: "main#content article.post"
        }

        photos = {
            select: "main#content article.post.type-post div.entry.themeform > div.entry-inner > p > img[src]",
            property: "src",
        }

    }

    class Ososedki extends Site {

        constructor() {
            super({
                host: [
                    /^ososedki\./,
                    /^cosplayleaks\./
                ],
                path: [
                    /^\/photos\/-\d+_\d+$/,
                    /^\/photos\/\d+$/
                ],
            }, {
                title: {
                    select: "body > div.container-fluid > h1.text-white.text-center.text-uppercase.mt-2",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div[class^='grid-item'] > a[data-fancybox='gallery'] > img.img-fluid[src]",
            property: "src",
        }

    }

    class SexyAsianGirl extends PagingSite {
        // https://www.sexyasiangirl.xyz/

        constructor() {
            super({
                host: "www.sexyasiangirl.xyz",
                path: /^\/album\//,
            }, {
                // title:{select: "body article > header > h2", property: "innerText"},
                title: "//article/header/h2/text()",
            });
        }

        date = "//time[@datetime]/text()";

        photos = "//article/div/img[contains(@class,'block')]//@src";

        tags = {
            select: "//article/div[@class='text-sm']//i[contains(@class,'fa-tags')]/following-sibling::a[@href]",
            property: ["href", {k: "innerText", n: "name"}],
        }

        next = "//div[contains(@class,'items-center')] //a[text()='Next' and @href]/@href";

        page = "//article";

    }

    class Ezqaq extends Site {
        constructor() {
            super({
                host: "www.ezqaq.com",
                path: /\/\d{3,}\.html/i,
            }, {
                title: {
                    select: "div.jinsom-bbs-single-title.clear h1[title]",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.jinsom-bbs-single-content img[src]",
            property: "src",
        }

    }

    class _4Kup extends Site {
        // https://www.4kup.net/2018/08/bololi-vol069-mi-du-miao.html
        constructor() {
            super({
                host: "www.4kup.net",
                path: /^\/\d{4}\/\d{2}\//i,
            }, {
                title: {
                    select: "h1.post-title",
                    property: "innerText",
                }
            });
        }

        actors = {
            select: "//div[@class='download-box']/p[contains(text(),'- Model: ')]/a",
            attribute: ["href"],
            property: {k: "innerText", n: "name"},
        }

        photos = {
            select: "div#gallery > div.item img[data-src]",
            attribute: "data-src",
        }

    }

    class _4Kep extends PagingSite {
        // https://www.4kep.com/2022/10/20/xiuren-no5298-anrananran.html
        constructor() {
            super({
                host: /^(w{3}\.)?4kep\.com$/,
                path: /^\/\d{4}\/\d{2}\/\d{2}\//i,

            }, {
                title: {
                    select: "h3.wp-block-post-title.has-medium-font-size",
                    property: "innerText",
                }
            });
        }

        next = {
            select: "//ul[@class='page-links']/li[contains(@class,'current')]/following-sibling::li[1]/a[@class='page-numbers']",
            property: "href",
        }

        page = {
            select: "figure.size-large > a.ari-fancybox[href]"
        }

        photos = {
            // document.querySelector(".ari-fancybox[href='https://i0.wp.com/lh3.ggpht.com/-zu2SlLNR_1M/YryS8M46gAI/AAAAAAAADUg/00rngDXaGGcgowBhDS1yVhv8KK13FS6qQCNcBGAsYHQ/s0-rw/4KHD-BeautifulGirls-0001.webp?ssl=1']")
            select: "figure.size-large > a.ari-fancybox[href]",
            property: "href",
        }


    }

    /**
     * 批量、列表
     */
        // class BatchSite extends NodeQuery {
        //
        //     /**
        //      * 下一页
        //      */
        //     next;
        //
        //     /**
        //      * 页面内容、用于验证是否访问成功
        //      */
        //     page;
        //
        //     entry;
        //
        //     proxy;
        //
        //     constructor({host, path, search}, proxy) {
        //         super(host, path, search);
        //         if (!proxy) {
        //             throw "proxy can not be null.";
        //         }
        //         this.proxy = proxy;
        //     }
        //
        //     get_next(doc) {
        //         let {next} = this;
        //         return this.node2value(doc, next);
        //     }
        //
        //     get_page(doc) {
        //         let {page} = this;
        //         return this.node2value(doc, page);
        //     }
        //
        //     get_entry(doc) {
        //         let {entry} = this;
        //         return this.node2values(doc, entry);
        //     }
        //
        //     async process(doc) {
        //         await super.process(doc);
        //         doc = Site.correction_document(doc);
        //         let node = doc, next;
        //         const target = this;
        //         const {proxy} = this;
        //
        //         const func = async function (href, predicate, msg = "页面解析失败.") {
        //             const times = 10;
        //             return await retry(async function () {
        //                 return await html(href);
        //             }, times, function (d) {
        //                 if (!predicate(d)) {
        //                     throw msg;
        //                 }
        //             });
        //         }
        //
        //         const resources = [], values = [], hrefs = [];
        //
        //         const check_page = function (d) {
        //             return target.get_page(d);
        //         }
        //         do {
        //             let finds = target.get_entry(node);
        //             values.push(...finds);
        //             next = target.get_next(node);
        //             node = next && await func(next, check_page);
        //         } while (node);
        //
        //         for (let value of values) {
        //             if (isStr(value)) {
        //                 hrefs.push({"href": value, "title": null});
        //             } else if (isObject(value)) {
        //                 let h, t;
        //                 for (const k in value) {
        //                     const v = value[k];
        //                     if (!isValidStr(v)) {
        //                         continue;
        //                     }
        //                     if (v.startsWith("http")) {
        //                         h = v;
        //                     } else {
        //                         t = v;
        //                     }
        //                     if (isValidStr(h) && isValidStr(t)) {
        //                         hrefs.push({"href": h, "title": t});
        //                         break;
        //                     }
        //                 }
        //             }
        //         }
        //
        //         const check_title = function (d) {
        //             return proxy.check(d);
        //         }
        //
        //         let subject_doc;
        //         for (const {href, title} of hrefs) {
        //             console.log(href, title);
        //             subject_doc = await func(href, check_title);
        //             if (!subject_doc) {
        //                 continue;
        //             }
        //             let resource = await proxy.process(subject_doc);
        //             resource && resources.push(resource);
        //         }
        //
        //         // console.log("");
        //
        //         return resources;
        //     }
        //
        // }
        //
        // class _4Kups extends BatchSite {
        //     constructor() {
        //         super({host: "www.4kup.net", path: /^\/search$/i}, singleton(_4Kup));
        //     }
        //
        //     entry = {
        //         select: "article.post-outer.index-post > div > h2.post-title > a[href^='http']",
        //         // attribute: {k: "href", n: "href", format: /^.+&/},
        //         // attribute: ["href"],
        //         // attribute: [{k: "href", n: "href", format: /^.+&/}],
        //         attribute: "href",
        //         property: {k: "innerText", n: "title"},
        //     }
        //
        // }

    class MgsTage extends Site {
        // https://www.mgstage.com/product/product_detail/200GANA-1746/
        constructor() {
            super({
                host: "www.mgstage.com",
                path: /^\/product\/product_detail\//i,
            }, {
                title: {
                    select: "div.common_detail_cover > h1.tag",
                    property: "innerText",
                }
            });
        }

        cover = {
            select: "p#package > a#EnlargeImage[href]",
            attribute: "href",
        }

        photos = {
            select: "dl#sample-photo li > a.sample_image[href]",
            property: "href",
        }

        code = "//div[@class='detail_data']//tr/th[text()='品番：']/following-sibling::td/text()";

        date = "//div[@class='detail_data']//tr/th[text()='配信開始日：']/following-sibling::td/text()";

        categories = {
            select: "//div[@class='detail_data']//tr/th[text()='シリーズ：']/following-sibling::td/a[@href]",
            property: ["href", {k: "innerText", n: "name"}],
        }

        tags = {
            select: "//div[@class='detail_data']//tr/th[text()='ジャンル：']/following-sibling::td/a[@href]",
            property: ["href", {k: "innerText", n: "name"}],
        }

        actors = async function (doc) {
            let code = await this.get_code(doc);
            return await AvWiki.queryActor(code);
        }

        convert(model, doc) {
            const resource = super.convert(model, doc);
            return Resource.restore1(resource, model, Model, Entity);
        }
    }

    class Dmm extends Site {

        constructor() {
            super({
                host: "www.dmm.co.jp",
                path: /^\/digital\/video[a-z]+\/-\/detail\/=\/cid=[a-z0-9]+/i,
            }, {
                title: async function (doc) {
                    return await this.get_code(doc);
                }
            });
        }

        // cover = {select: "#sample-video > img[src]", attribute: "src",}
        cover = "id('sample-video')/img[@src]/@src"

        // photos = {select: "dl#sample-photo li > a.sample_image[href]", property: "href",}
        // photos = "id('sample-image-block')/a[@name='sample-image']/img/@src"
        photos = async function (doc) {
            const finds = await this.node2values(doc, "id('sample-image-block')/a[@name='sample-image' and @href]/@href", "photos");
            const values = [];
            for (const find of finds) {
                let lastIndexOf = find.lastIndexOf("/");
                let base_name = find.slice(lastIndexOf + 1,);
                let dir_name = find.slice(0, lastIndexOf + 1);
                base_name = base_name.replace("js", "jp");
                values.push(dir_name + base_name);
            }
            return values;
        }

        code = "//div[@class='page-detail']//tr/td[text()='品番：']/following-sibling::td/text()";

        date = "//div[@class='page-detail']//tr/td[text()='配信開始日：']/following-sibling::td/text()";

        tags = {
            select: "//div[@class='page-detail']//tr/td[text()='ジャンル：']/following-sibling::td/a[@href]",
            property: ["href", {k: "innerText", n: "name"}],
        }

        videos = {
            select: "//div[@class='page-detail']//tr/td[text()='ジャンル：']/following-sibling::td/a[@href]",
            property: ["href", {k: "innerText", n: "name"}],
        }

        actors = async function (doc) {
            let code = await this.get_code(doc);
            return await AvWiki.queryActor(code);
        }

        convert(model, doc) {
            let resource = super.convert(model, doc);
            resource.name = model.code;
            return resource;
        }
    }

    class TanHuaZu extends Site {
        // https://tanhuazu.com/threads/9292/
        constructor() {
            super({
                host: [
                    /^tanhuazu\.com/i
                ],
                path: [
                    /^\/threads\/\d+\/$/i
                ],
            }, {
                title: async function (doc) {
                    // let titles = this.node2values(doc, "//div[@class='bbWrapper']/text()", "title")
                    let titles = Array.from((await this.node2value(doc, {
                        select: "div.bbWrapper",
                        property: "innerText",
                    }, "title")).split("\n"));
                    titles = titles.filter(function (element) {
                        return element.includes("影片名称");
                    });
                    let title = titles[0];
                    title = /【影片名称】：(.+)/.exec(title)[1]
                    if (!title) {
                        throw "title can not be blank.";
                    }
                    return title.trim();
                },
            });
        }

        photos = {
            select: "div.bbWrapper img[src^='http']",
            property: "src"
        }

        manages = {
            select: "#code_jze",
            property: "innerText",
        }

        async close() {
            await super.close();
            window.close();
        }

    }

    class SiroutoDouga extends Site {
        // http://sirouto-douga.1000.tv/428SUKE-068.php
        constructor() {
            super({
                host: "sirouto-douga.1000.tv",
                path: /^\/.*/i
            }, {
                title: async function () {
                    return /\/(.*)\.php/.exec(location.pathname)[1];
                },
            });
        }

        // let finds = Array.from(document.querySelectorAll("div.cap_img > ul > li > a.gallery , div.cap_spimg > p > a"));
        // let pics = finds.map(node => node.href);
        // Array.from(new Set(pics)).join("\n")
        photos = [
            {
                select: "div.cap_img > ul > li > a.gallery",
                property: "href",
            },
            {
                select: "div.cap_spimg > p > a[data-lity]",
                property: "href",
            },
        ]

    }

    class Sijishe extends Site {

        constructor() {
            super({
                host: [
                    /sijishe[a-z]+\.com/i,
                    /xsijishe\.(com|net)/i,
                    "sjskk.vip",
                    "sjs47.me",
                ],
                path: [
                    /^\/thread-\d+-\d+-\d+.html$/i,
                    /^\/forum.php$/
                ],
            }, {
                title: {
                    select: "span#thread_subject",
                    property: "innerText",
                },
            });
        }

        photos = function (doc) {
            let pcb = doc.querySelector("div#wp div#postlist > div.viewbox:nth-child(4) div.pct > div.pcb .t_f");
            let finds = Array.from(pcb.querySelectorAll("img[src^='http']"));
            return finds.map(function (node) {
                let h = node['src']
                let n = node.parentNode.querySelector("div.xs0 > p > strong")?.innerText;
                return {
                    name: n,
                    href: h
                };
            });
        }

    }

    class Fc2hub extends Site {

        // https://fc2hub.com/video/1681156/id3188606
        constructor() {
            super({
                host: "fc2hub.com",
                path: /^\/video\/\d+\/id\d+/i,
            }, {
                title: {
                    select: "h1.card-text.fc2-title",
                    property: "innerText",
                },
            });
        }

        code = {
            select: "h1.card-title.fc2-id > savdiv.sav-id[data-av]",
            attribute: "data-av"
        }

        // a[data-fancybox='des'] > img.img-fluid
        // a[data-fancybox='gallery']
        photos = [
            {
                select: "a[data-fancybox='des'] > img.img-fluid[src]",
                property: "src"
            },
            {
                select: "a[data-fancybox='gallery']",
                property: "href"
            },
            {
                select: "video[poster]",
                property: "poster"
            },
        ]

    }

    class Jav24 extends Site {

        // https://www.jav24.com/watch/www.mgstage.com/product/product_detail/300MIUM-871/
        constructor() {
            super({
                host: "www.jav24.com",
                path: [
                    // /watch/www.mgstage.com/product/product_detail/300MIUM-871/
                    /^\/watch\/www\.mgstage\.com\/product\/product_detail/i,
                    // /watch/adult.contents.fc2.com/article/3172642/
                    /^\/watch\/adult\.contents\.fc2\.com\/article/i,
                ],
            }, {
                title: {
                    select: "div.my__product__detail__title.notranslate",
                    property: "innerText",
                },
            });
        }

        code = function (doc) {
            let href = doc.URL;
            return new URL(href).pathname.split("/").at(-2);
        }

        cover = {
            select: "video[poster]",
            attribute: "poster"
        }

        photos = [
            {
                select: "div.my__product__image__slide__list div.my__product__image",
                attribute: "data-bg"
            }
        ]

        videos = {
            select: "video > source[src]",
            property: "src"
        }

        actors = async function (doc) {
            if (location.pathname.startsWith("/watch/adult.contents.fc2.com/article/")) {
                return null;
            }
            let code = await this.get_code(doc);
            return await AvWiki.queryActor(code);
        }

        date = function (doc) {
            return doc.querySelector("span.my__general__icon.my__general__icon__prepending.far.fa-calendar-alt").parentElement.innerText;
        }

        async close() {
            await super.close();
            // alert("下载完成.");
            setTimeout(function () {
                window.close();
            }, 10 ** 3 * 30);
        }

    }

    class JavDB extends Site {

        constructor() {
            super({
                // https://javdb.com/v/r4pRv
                host: [
                    "javdb.com",
                ],
                path: [
                    /^\/v\/[0-9a-z]{4,5}$/i,
                ]
            }, {
                title: {
                    select: "div.video-detail > h2 > strong.current-title",
                    property: "innerText",
                },
            });
        }

        code = {
            select: "a.button.copy-to-clipboard[title='複製番號']",
            attribute: "data-clipboard-text",
        }

        cover = [
            {
                select: "div.column.column-video-cover img.video-cover",
                attribute: "src",
            },
        ]

        actors = async function (doc) {
            // let finds = await this.node2values(doc, "//div[@class='panel-block']/strong[text()='演員:']/../*[@class='value']/a", "actors");
            // let find = finds[0];
            // let name = find.innerText;
            // let href = find.href;
            // let code = await this.get_code(doc);
            // return await AvWiki.queryActor(code);
        }

        tags = async function (doc) {
            let finds = await this.node2values(doc, "//div[@class='panel-block']/strong[text()='類別:']/../*[@class='value']/a", "actors");
            return Array.from(finds).map(e => Object({"name": e.innerText, "href": e.href}));
        }

        photos = {
            select: "div.preview-images > a.tile-item[data-fancybox=gallery][href]",
            attribute: "href",
        }

        manages = async function (doc) {
            let finds = await this.node2values(doc, "#magnets-content > div.item > div.magnet-name > a", "manages");
            return finds.map(e => Object({"code": e.href, "name": e.querySelector("span").innerText.trim()}));
        }

        videos = async function (doc) {
            let find = await this.node2value(doc, "video#preview-video > source[src][type='video/mp4']", "videos");
            if (!Boolean(find)) {
                return null;
            }
            if (find.baseURI === find.src) {
                return null
            }
            return find.src;
        }

        convert(model, doc) {
            const resource = super.convert(model, doc);
            return Resource.restore2(resource, model, Model, Entity);
        }

        async close() {
            await sleep(10 ** 3 * 10)
            window.close()
        }

    }

    class TheMovie extends Site {
        constructor() {
            super({
                host: "www.themoviedb.org",
                path: /^\/movie\/.*/i,
            }, {
                title: {
                    select: "div.title.ott_false > h2 > a",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.image_content > div > img.poster",
            property: "src",
        }

    }

    class Babepedia extends Site {
        constructor() {
            super({
                host: "www.babepedia.com",
                path: /^\/babe\/.*/i,
            }, {
                title: {
                    select: "h1#babename",
                    property: "innerText",
                }
            });
        }

        photos = function (doc) {
            const finds = document.querySelectorAll("a.img[rel='gallery']");
            const values = [];
            for (const find of finds) {
                let href = find.href;
                let titles = href.split("/");
                let title = titles[titles.length - 1];
                let suffixs = title.split(".");
                let suffix = suffixs[suffixs.length - 1];
                const hash = CryptoJS.MD5(title).toString();
                let name = hash.toUpperCase() + "." + suffix;
                values.push({name, href});
            }
            return values;
        }

        convert(model, doc) {
            let resource = super.convert(model, doc);
            let entries = resource.entries.filter(e => e.type != Entity.TEXT);
            return new Resource(resource.name, entries);
        }
    }

    class VideoDmm extends Site {
        constructor() {
            super({
                host: "video.dmm.co.jp",
                path: /^\/(av|amateur)\/content\//i,
            }, {
                title: {
                    select: "body table > tbody > tr:nth-last-child(2) > td > span",
                    property: "innerText",
                }
            });
        }

        photos = {
            select: "div.grid[data-e2eid='sample-image-gallery'] > div.flex.gap-2.flex-wrap > a",
            property: "href",
        }

        cover = async function () {
            if (location.pathname.startsWith("/amateur")) {
                let h = document.querySelector("div.flex.flex-wrap.gap-3 > div.flex.flex-col.relative.grow.w-full > iframe").src;
                let v1 = await html(h);
                let jsonStr = v1.querySelector("body > div > script").textContent.match(/const args = (\{[\s\S]*?\});/)[1];
                let json = JSON.parse(jsonStr);
                let v2 = "https:" + json["poster"];
                return v2;
            } else {
                return null;
            }
        }

        videos = async function () {
            let h = document.querySelector("div.flex.flex-wrap.gap-3 > div.flex.flex-col.relative.grow.w-full > iframe").src;
            let v1 = await html(h);
            let jsonStr = v1.querySelector("body > div > script").textContent.match(/const args = (\{[\s\S]*?\});/)[1];
            let json = JSON.parse(jsonStr);
            let v2 = "https:" + json["src"];
            return v2;
        }

        convert(model, doc) {
            let resource = super.convert(model, doc);
            let entries = resource.entries.filter(e => e.type != Entity.TEXT);
            return new Resource(resource.name, entries);
        }

    }

    class AvWikiDbMovieCover extends Site {

        ignore = false;

        constructor() {
            super({
                host: "avwikidb.com",
                path: /^\/work\//,
            }, {
                title: {
                    select: "#main-content > main > article > h1",
                    property: "innerText",
                }
            });
        }

        code = {
            select: "//dt[normalize-space()='品番']/following-sibling::dd[1]",
            property: "innerText"
        }

        actors = {
            select: "//dt[@id='actress' or @id='actresses'][normalize-space()='出演女優']/following-sibling::dd[1]/div/ul/li/div[contains(@class,'entity-card-body')]/a",
            attribute: ["href"],
            property: {k: "innerText", n: "name"},
        }

        href2photo(element) {
            let url = parseURL(element);
            url.searchParams.delete("w");
            let href = url.href;
            if (url.searchParams == null) {
                return href;
            } else {
                let splits = url.pathname.split("/");
                let file_name = splits[splits.length - 1];
                let name = file_name.split("/")[0];
                if (url.searchParams.get("f") != "webp") {
                    return {"name": name, "href": href};
                } else {
                    let v7 = name.split(".");
                    let v8 = v7[0] + ".webp";
                    return {"name": v8, "href": href};
                    // v2.search = null;
                    // return { "name": v6, "href": v2.href };
                }
            }
        }

        cover = [{
            select: "#main-content article div.relative > div > img",
            attribute: "src",
        },
            {
                select: "#main-content article a.relative > img",
                attribute: "src",
            }]

        convert(model, doc) {
            function rename(entry) {
                if (entry.type == Entity.PHOTO) {
                    let name = entry.name;
                    entry.name = name.split("/")[1];
                }
                return entry
            }

            let resource = super.convert(model, doc);
            resource = Resource.restore2(resource, model, Model, Entity)
            let entries = resource.entries;
            if (!(this instanceof AvWikiDbMovie)) {
                entries = entries.filter(e => e.type != Entity.TEXT);
            }
            entries = entries.filter(e => e.type != Entity.COVER);
            if (!this.ignore && model.cover != null) {
                let cover = this.href2photo(model.cover);
                let entry = Entity.cover(cover.href, cover.name);
                entries.push(entry);
            }
            entries = entries.map(rename);
            return new Resource(resource.name, entries);
        }

    }

    class AvWikiDbMovie extends AvWikiDbMovieCover {

        // photos = {
        //     select: "#main-content > main > article > ul img[src]",
        //     attribute: "src",
        // }

        photos = function (doc) {
            let hrefs = [];
            let values = [];
            let finds = doc.querySelectorAll("#main-content > main > article > ul img");
            finds.forEach(item => hrefs.push(item.src));
            for (let element of hrefs) {
                values.push(this.href2photo(element))
            }
            return values;
        }

        videos = function (doc) {
            let finds = doc.querySelectorAll("#main-content > main > article div.relative > div > video > source");
            let values = [];
            let hrefs = Array.from(finds).map(e => e.src);
            let index = Math.max(0, Math.min(Math.round(hrefs.length / 2) - 1, hrefs.length - 1));
            values.push(hrefs[index]);
            return values;
        }

    }

    class AvWikiDbActor extends PagingSite {

        constructor() {
            super({
                host: "avwikidb.com",
                path: /^\/(actor|work)\//,
            }, {
                title: {
                    select: "#main-content > main > nav > div > nav > ol > li:nth-child(5) > a > span",
                    property: "innerText",
                }
            });
        }

        async process(doc) {
            await super.process(doc);

            async function downloads(btn, element, coverSite, site, configs) {
                await download(element, coverSite, configs);
                await download(element, site, configs);
                btn.enable();
            }

            let site = new AvWikiDbMovie();
            // site.ignore = true;
            let coverSite = singleton(AvWikiDbMovieCover);
            let btn = document.querySelector("body > button." + glass);

            let position = 0;
            let total = 0;
            let num = 0;
            let configs = {
                on_start: function (t) {
                    total += t;
                    position += 1;
                    btn.text(`${position}/${num}/${total}`);
                }, on_progress: function (_, __) {
                    num += 1;
                    btn.text(`${position}/${num}/${total}`);
                }, on_success: function () {
                }, on_failure: function () {
                },
            }

            if (location.pathname.startsWith("/work/")) {
                log("start download : " + location.href);
                await downloads(btn, doc, coverSite, site, configs)
                btn.text('Done');
                return null;
            } else {
                function insert(url) {
                    return new Promise((resolve, reject) => {
                        let iframe = document.createElement('iframe');
                        iframe.style.display = 'none'; // 隐藏，或设置为可见用于调试
                        iframe.sandbox = 'allow-same-origin allow-scripts allow-popups allow-forms'; // 根据需要放宽权限
                        iframe.style.width = '100%';
                        iframe.src = url;
                        document.body.appendChild(iframe);
                        iframe.onload = function () {
                            resolve(iframe.contentDocument);
                            document.body.removeChild(iframe);
                        }
                    })
                }

                let actor = false;
                let finds = document.querySelectorAll("#main-content > main > ul > li > article > div.movie-card-body > a");
                movies: for (let i = 0; i < finds.length; i++) {
                    let find = finds[i];
                    let tries = 0;
                    let href = find.href;
                    log("start download : " + href);
                    let element = null;
                    fetch: while (tries <= 10) {
                        try {
                            element = await insert(href);
                            let obj = await site.parse_doc(element);
                            if (obj.title == null) {
                                alert("页面加载失败, 刷新后重试");
                                throw "页面加载失败, 刷新后重试";
                            }
                            if (element != null) {
                                break fetch;
                            } else {
                                throw "页面获取失败";
                            }
                        } catch (err) {
                            log(href + ", " + err);
                            tries += 1;
                            await delay(10 ** 3 * 1);
                            alert("稍后重试");
                        }
                    }
                    if (element == null) {
                        continue;
                    }
                    if (!actor) {
                        let imgs = query("//dt[@id='actress'][normalize-space()='出演女優']/following-sibling::dd[1]//div[contains(@class,'entity-card-thumb')]/img", element);
                        let hs = query("#main-content > main > nav > div > nav > ol > li:nth-child(5) > a > span", doc)
                        if (imgs != null && imgs.length === 1 && hs != null && hs.length === 1) {
                            let href = imgs[0].src;
                            let name = hs[0].innerText;
                            let url = parseURL(href);
                            let splits = url.pathname.split("/");
                            let file_name = splits[splits.length - 1];
                            let resource = new Resource(name, [Entity.cover(href, file_name)]);
                            log(resource);
                            try {
                                actor = true;
                                await download_resource(resource, configs);
                            } catch (err) {
                                log(err);
                            }
                        }
                    }
                    download: for (let j = 0; j < 5; j++) {
                        try {
                            await downloads(btn, element, coverSite, site, configs);
                            break download;
                        } catch (error) {
                            delay(10 ** 3 * 1);
                        }
                    }
                }
                btn.text('Done');
                return null;
            }
        }

    }

    // ----------------------------------------------------------------

    class Xchina extends Site {

        constructor() {
            super({
                host: "xchina.co",
                path: /^\/videos\//i,
            }, {
                title: {
                    select: "div.main-container > h1.hero-title-item",
                    property: "innerText",
                }
            });
        }

    }

    const SITES = Object.assign([
        singleton(JavBus),
        singleton(JavMenu),
        singleton(MaDou),
        singleton(YcGif),
        singleton(SeHuaTang),
        singleton(Photos18),
        singleton(Everia),
        singleton(Buondua),
        singleton(NsfwPub),
        singleton(Ryuryu),
        singleton(DopamineGirl),
        singleton(Cucxinh),
        singleton(Ososedki),
        singleton(SexyAsianGirl),
        singleton(Ezqaq),
        singleton(_4Kup),
        singleton(_4Kep),
        // singleton(_4Kups),
        singleton(TanHuaZu),

        singleton(Dmm),
        singleton(MgsTage),
        singleton(SiroutoDouga),
        singleton(Sijishe),
        singleton(Fc2hub),
        singleton(Jav24),
        singleton(JavDB),
        singleton(TheMovie),

        singleton(Babepedia),
        singleton(VideoDmm),

        // singleton(AvWikiDbMovie),
        singleton(AvWikiDbActor),
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