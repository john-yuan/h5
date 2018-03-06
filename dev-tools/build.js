const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const colors = require('colors');
const less = require("less");
const CleanCSS = require("clean-css");
const crypto = require("crypto");
const postcss = require("postcss");
const autoprefixer = require("autoprefixer");
const uglifyJS = require("uglify-js");
const htmlMinify = require("html-minifier").minify;
const JSDOM = require("jsdom").JSDOM;
const PROJECT_NAME = path.basename(path.resolve(__dirname, '..'));
const SRC_DIR = path.resolve(__dirname, '../app');
const DIST_DIR = path.resolve(__dirname, '../dist', PROJECT_NAME);
const mBundles = [];

/**
 * 获取 md5 哈希值
 *
 * @param {String} text
 */
const getHash = function(text) {
    let hash = crypto.createHash("md5");
    hash.update(text || "");
    return hash.digest("hex").substr(0, 7);
};

/**
 * 检查文件内容是否为指定内容
 *
 * @param {String} filepath
 * @param {String} content
 * @returns {Boolean}
 */
const fileContentIs = function(filepath, content) {
    try {
        return fs.readFileSync(filepath).toString() === content;
    } catch(e) {
        return false;
    }
};

/**
 * 判断文本是否为链接
 *
 * @param {String} text
 * @returns {Boolean}
 */
const isLink = function(text) {
    text = text || '';
    return (text || '').indexOf(':') > -1 || /^\/\//.test(text);
};

/**
 * 打印提示信息
 *
 * @param {String} message 提示信息
 */
const logInfo = function(message) {
    console.log(colors.gray('[提示] ' + message));
};

/**
 * 打印开始信息
 *
 * @param {String} message 开始信息
 */
const logStart = function(message) {
    console.log(colors.green('[提示] ' + message));
};

/**
 * 打印结束信息
 *
 * @param {String} message 结束信息
 */
const logEnd = function(message) {
    console.log(colors.green('[提示] ' + message));
};

/**
 * 打印警告信息
 *
 * @param {String} message 警告信息
 */
const logWarn = function(message) {
    console.log(colors.yellow('[警告] ' + message));
};

/**
 * 打印错误信息
 *
 * @param {String} message 错误信息
 * @param {Error} [err] 错误对象
 */
const logError = function(message, err) {
    console.error(colors.red('[错误] ' + message + (err ? ('\n' + err.stack) : '')));
    process.exit(1);
};

/**
 * 复制源代码
 */
const copySourceCode = function() {
    try {
        logStart('复制源代码...');

        logInfo('清空临时工作空间...');
        fse.removeSync(DIST_DIR);
        logInfo('清空临时工作空间完成!');

        logInfo('复制文件...');
        fse.copySync(SRC_DIR, DIST_DIR);
        logInfo('复制文件完成!');

        logEnd('复制源代码完成!');
    } catch(e) {
        logError('复制源代码失败!', e);
    }
};

/**
 * 扫描根目录下的 HTML 并进行处理
 */
const startParseHtml = function() {
    try {
        let files = fs.readdirSync(DIST_DIR);
        let htmlFiles = [];
        let parseNextHtml = function() {
            let filepath = htmlFiles.shift();
            if (filepath) {
                logStart(`处理 ${filepath}`);
                parseHtml(filepath).then(function() {
                    logEnd(`处理完成 ${filepath}`);
                    parseNextHtml();
                });
            }
        };
        files.forEach(filename => {
            let filepath = path.resolve(DIST_DIR, filename);
            let stat = fs.statSync(filepath);
            if (stat.isFile()) {
                if (/\.html?$/i.test(filepath)) {
                    htmlFiles.push(filepath);
                }
            }
        });
        parseNextHtml();
    } catch(e) {
        logError('扫描 HTML 文件失败!', e);
    }
};

/**
 * 处理 HTML 文件
 *
 * @param {String} filepath 文件路径
 * @returns {Promise}
 */
const parseHtml = function(filepath) {
    let htmlText = fs.readFileSync(filepath).toString();
    let dom = new JSDOM(htmlText);
    let window = dom.window;
    let document = window.document;
    let basePath = path.dirname(filepath);
    let filename = path.basename(filepath);

    return new Promise(function(resolve, reject) {
        logStart('处理样式表...');
        parseStyleSheet(window, document, basePath, filename).then(() => {
            logEnd('处理样式表完成!');
            resolve();
        }).catch(reject);
    }).then(function() {
        return new Promise(function(resolve, reject) {
            logStart('处理脚本...');
            parseJavaScript(window, document, basePath, filename).then(() => {
                resolve();
            }).catch(reject);
        });
    }).then(function() {
        let newHtmlText = dom.serialize();

        newHtmlText = htmlMinify(newHtmlText, {
            removeComments: true,
            collapseWhitespace: true,
            // conservativeCollapse: true
        });

        fs.writeFileSync(filepath, newHtmlText);
    }).catch(function(err) {
        logError(`处理 ${filepath} 失败!`, err);
    });
};

/**
 * 处理样式表
 *
 * @param {JSDOM.Window} window
 * @param {JSDOM.Document} document
 * @param {String} basePath
 * @param {String} filename
 * @returns {Promise}
 */
const parseStyleSheet = function(window, document, basePath, filename) {
    return new Promise(function(resolve, reject) {
        let links = [].slice.call(document.querySelectorAll('link') || []);
        let styles = [].slice.call(document.querySelectorAll('style') || []);
        let cleanCss = new CleanCSS();
        let prefixer = postcss([autoprefixer({ browsers: ['iOS >= 7', 'Android >= 4'] })]);
        let minifyCss = function(cssText) {
            cssText = prefixer.process(cssText).css;
            cssText = cleanCss.minify(cssText).styles;
            return cssText;
        };
        let processNextLink = function() {
            let link = links.shift();
            if (link) {
                let rel = link.getAttribute('rel') || '';
                let href = link.getAttribute('href') || '';

                logInfo('处理 ' + href);

                if (href && !isLink(href)) {
                    let filepath = path.resolve(basePath, href);
                    let cssText = fs.readFileSync(filepath).toString();
                    let comporessCss = function(cssText) {
                        cssText = minifyCss(cssText);

                        let hash = getHash(cssText);
                        let uuid = 0;

                        let newHref = href.replace(/(\.less)?$/i, `-${hash}.css`);
                        let newPath = path.resolve(basePath, newHref);
                        let fileExisted = false;

                        while (fs.existsSync(newPath)) {
                            if (fileContentIs(newPath, cssText)) {
                                fileExisted = true;
                                break;
                            } else {
                                uuid += 1;
                                newHref = href.replace(/(\.less)?$/i, `-${hash}-${uuid}.css`);
                                newPath = path.resolve(basePath, newHref);
                            }
                        }

                        if (!fileExisted) {
                            fs.writeFileSync(newPath, cssText);
                        }

                        if (link.hasAttribute('rel')) {
                            link.setAttribute('rel', 'stylesheet');
                        }

                        if (link.hasAttribute('type')) {
                            link.setAttribute('type', 'text/css');
                        }

                        link.setAttribute('href', newHref);

                        logInfo('处理完成 => ' + newHref);

                        processNextLink();
                    };

                    if (rel.trim().toLowerCase() === 'stylesheet/less') {
                        parseLess(cssText, path.dirname(filepath), path.basename(filepath), comporessCss);
                    } else {
                        comporessCss(cssText);
                    }
                } else {
                    processNextLink();
                }
            } else {
                processNextStyle();
            }
        };
        let processNextStyle = function() {
            let style = styles.shift();
            if (style) {
                logInfo('处理 style 标签...');
                style.innerHTML = minifyCss(style.innerHTML || '');
                logInfo('处理 style 标签完成!');
                processNextStyle();
            } else {
                resolve();
            }
        };
        processNextLink();
    });
};

/**
 * 处理 Less 文本
 *
 * @param {String} cssText
 * @param {String} basePath
 * @param {String} filename
 * @param {Function} callback
 */
const parseLess = function(cssText, basePath, filename, callback) {
    less.render(cssText, {
        paths: [ basePath ],
        filename: filename
    }, function(err, res) {
        if (err) {
            throw err;
        } else {
            callback(res.css);
        }
    });
};

/**
 * 处理脚本
 *
 * @param {JSDOM.Window} window
 * @param {JSDOM.Document} document
 * @param {String} basePath
 * @param {String} filename
 * @returns {Promise}
 */
const parseJavaScript = function(window, document, basePath, filename) {
    return new Promise(function(resolve, reject) {
        let removeScripts = document.querySelectorAll('script[\\@remove]');
        let minifyJs = function(code) {
            return uglifyJS.minify(code, {
                compress: {
                    drop_console: true,
                    dead_code: true,
                    drop_debugger: true,
                    evaluate: true,
                    global_defs: {
                        DEBUG: false
                    }
                }
            }).code;
        };

        // 移除 script@remove
        [].slice.call(removeScripts || []).forEach(script => {
            script.parentNode.removeChild(script);
        });

        let scripts = document.querySelectorAll('script');
        let processScript = function(script) {
            let minifiedCode = '';
            if (script.hasAttribute('src')) {
                let src = script.getAttribute('src');
                if (src && !isLink(src)) {
                    logInfo(`处理 ${src}`);

                    let filepath = path.resolve(basePath, src);
                    let code = fs.readFileSync(filepath).toString();

                    code = minifyJs(code);

                    let hash = getHash(code);
                    let uuid = 0;

                    let newSrc = src.replace(/(\.js)?$/i, `-${hash}.js`);
                    let newPath = path.resolve(basePath, newSrc);
                    let fileExisted = false;

                    while (fs.existsSync(newPath)) {
                        if (fileContentIs(newPath, code)) {
                            fileExisted = true;
                            break;
                        } else {
                            uuid += 1;
                            newSrc = src.replace(/(\.js)?$/i, `-${hash}-${uuid}.js`);
                            newPath = path.resolve(basePath, newSrc);
                        }
                    }

                    if (!fileExisted) {
                        fs.writeFileSync(newPath, code);
                    }

                    script.setAttribute('src', newSrc);

                    logInfo(`处理完成 => ${newSrc}`);

                    minifiedCode = code;
                } else {
                    logWarn('The src of script is empty!');
                }
            } else {
                logInfo(`处理 script 标签...`);
                minifiedCode = minifyJs(script.innerHTML || '');
                logInfo(`处理 script 完成!`);
                script.innerHTML = minifiedCode;
            }
            return minifiedCode;
        };

        let bundles = {};

        [].slice.call(scripts || []).forEach(script => {
            if (script.hasAttribute('@bundle')) {
                let bundleName = script.getAttribute('@bundle');
                if (bundleName) {
                    let bundle = bundles[bundleName] || [];
                    bundle.push(script);
                    bundles[bundleName] = bundle;
                } else {
                    throw new Error('Using @bundle with no name!');
                }
            } else {
                processScript(script);
            }
        });

        let bundlePath = null;

        for (let prop in bundles) {
            if (bundles.hasOwnProperty(prop) && Array.isArray(bundles[prop])) {
                let bundleName = prop;
                let firstScript = bundles[bundleName][0];

                if (firstScript) {
                    let codes = [];
                    let bundleScript = document.createElement('script');

                    firstScript.parentNode.insertBefore(bundleScript, firstScript);

                    logInfo(`开始合并 bundle(${bundleName})`);

                    bundles[bundleName].forEach(script => {
                        let code = processScript(script);
                        codes.push(code);
                        script.parentNode.removeChild(script);
                    });

                    let bundleCode = codes.join('\n');
                    let bundleSrc, bundleReusing = false;

                    mBundles.forEach(bundle => {
                        if (bundle.code === bundleCode) {
                            bundleReusing = true;
                            bundleSrc = bundle.src;
                            return false;
                        }
                    });

                    if (!bundleReusing) {
                        let hash = getHash(bundleCode);
                        let uuid = 0;
                        let fileExisted = false;

                        bundleSrc = `${bundleName}-${hash}.js`;
                        bundlePath = path.resolve(DIST_DIR, bundleSrc);

                        if (fs.existsSync(bundlePath)) {
                            if (fileContentIs(bundlePath, bundleCode)) {
                                fileExisted = true;
                                break;
                            } else {
                                uuid += 1;
                                bundleSrc = `${bundleName}-${hash}-${uuid}.js`;
                                bundlePath = path.resolve(DIST_DIR, bundleSrc);
                            }
                        }

                        if (!fileExisted) {
                            fse.outputFileSync(bundlePath, bundleCode);
                        }

                        mBundles.push({
                            code: bundleCode,
                            src: bundleSrc
                        });
                    }

                    bundleScript.setAttribute('src', bundleSrc);

                    if (bundleReusing) {
                        logInfo(`合并 bundle(${prop}) 完成, 复用 => ${bundleSrc}`);
                    } else {
                        logInfo(`合并 bundle(${prop}) 完成 => ${bundleSrc}`);
                    }
                }
            }
        }

        resolve();
    });
};

copySourceCode();
startParseHtml();