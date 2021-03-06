/*!
 * Copyright 2018 Johannes Weil
 * Released under the MIT license
 * https://github.com/DerHannes85/gulp-media-json/blob/master/LICENSE
 */

'use strict';

const _set = require('lodash.set');
const _get = require('lodash.get');
const _camelCase = require('lodash.camelcase');

const PluginError = require('plugin-error');
const Through = require('through2');
const Vinyl = require('vinyl');

const mimeType = require('mime-type/with-db')
const Jimp = require('jimp');

const PLUGIN_NAME = 'gulp-media-json';

const gcd = function(a, b) {
    if (!b) {
        return a;
    }

    return gcd(b, a % b);
};

const namespace = function(obj, path, value) {
    let tempValue;

    if (typeof path === 'undefined') {
        path = obj;
        obj = this;
    }

    tempValue = _get(obj, path, undefined);
    if (typeof tempValue === 'undefined') {
        _set(obj, path, value);
    } else {
        value = tempValue;
    }
    return value;
};

const escapeNamespace = function(s, ext) {
    let temp,
        i;

    s = s.replace(/[^a-z0-9_\-\.]/g, '');

    temp = s.split(/\./);
    s = "";
    for (i = 0; i < temp.length; i++) {
        if (i !== 0) {
            s += '.';
        }
        if (temp[i][0].match(/[0-9]/) !== null) {
            s += '_';
        }
        s += _camelCase(temp[i]);
    }

    return s;
};

module.exports = function(settings) {
    let options = {
            // Defaults
            escapeNamespace: escapeNamespace,
            fileName: 'media.json',
            getImageInfo: true,
            imageProps: {
                "src": true,
                "ext": true,
                "mime": true,
                "type": true,
                "w": true,
                "h": true,
                "ratio": true,
                "ratioValue": false
            },
            imageRatioValueTrim: false,
            emptyImageBase64: true, // only if getImageInfo is true
            emptyImageBase64Namespace: null,
            startObj: {},
            endObj: null,
            exportModule: false,
            jsonReplacer: null,
            jsonSpace: '\t',
            basePath: ''
        },
        lastFile,
        returnData,
        base64Data;


    if (typeof settings === 'object') {
        options = Object.assign(options, settings);
    }

    if (typeof options.startObj === 'object') {
        returnData = options.startObj;
    } else {
        returnData = {};
    }

    if (options.emptyImageBase64) {
        base64Data = {};
    }

    function processFile(file, enc, cb) {
        let dataNamespace,
            currentVinyl,
            currentMimeType,
            currentExtName;

        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported!'));
            cb();
            return;
        }

        lastFile = file;
        currentVinyl = new Vinyl(file);
        currentMimeType = mimeType.lookup(currentVinyl.basename);
        currentExtName = currentVinyl.extname.replace(/^\./, '');

        dataNamespace = currentVinyl.dirname.replace(currentVinyl.cwd + '\\' + options.basePath, '').replace(/[\\\/]/g, '.').replace(/^\./g, '');
        dataNamespace = options.escapeNamespace(dataNamespace + '.' + currentVinyl.stem, currentExtName);

        namespace(returnData, dataNamespace, {});

        if (options.imageProps.src === true) {
            _set(returnData, dataNamespace + '.src', currentVinyl.dirname.replace(currentVinyl.cwd + '\\' + options.basePath, '').replace(/[\\]/g, '/') + '/' + currentVinyl.basename);
        }
        if (options.imageProps.ext === true) {
            _set(returnData, dataNamespace + '.ext', currentExtName);
        }
        if (options.imageProps.mime === true) {
            _set(returnData, dataNamespace + '.mime', currentMimeType);
        }

        switch (true) {
            case (currentMimeType.match(/image/) !== null):
                if (options.imageProps.type === true) {
                    _set(returnData, dataNamespace + '.type', 'image');
                }

                if (options.getImageInfo) {
                    Jimp.read(file.path)
                        .then((image) => {
                            let ratioValue = image.bitmap.width / image.bitmap.height,
                                currentGcd = gcd(image.bitmap.width, image.bitmap.height),
                                ratioName = (image.bitmap.width / currentGcd) + '/' + (image.bitmap.height / currentGcd),
                                base64DataElement = _get(base64Data, ratioName, false);

                            if (options.imageProps.w === true) {
                                _set(returnData, dataNamespace + '.w', image.bitmap.width);
                            }
                            if (options.imageProps.h === true) {
                                _set(returnData, dataNamespace + '.h', image.bitmap.height);
                            }
                            if (options.imageProps.ratio === true) {
                                _set(returnData, dataNamespace + '.ratio', ratioName);
                            }
                            if (options.imageProps.ratioValue === true) {
                                if (Number.isInteger(options.imageRatioValueTrim) && options.imageRatioValueTrim >= 0) {
                                    _set(returnData, dataNamespace + '.ratioValue', parseFloat(ratioValue.toFixed(options.imageRatioValueTrim)));
                                } else {
                                    _set(returnData, dataNamespace + '.ratioValue', ratioValue);
                                }
                            }

                            if (options.emptyImageBase64) {
                                if (base64DataElement !== false) {
                                    if (typeof options.emptyImageBase64Namespace !== 'string') {
                                        _set(returnData, dataNamespace + '.empty', base64DataElement);
                                    }
                                    cb();
                                } else {
                                    new Jimp(image.bitmap.width / currentGcd, image.bitmap.height / currentGcd, (err, emptyImage) => {
                                        if (err === null) {
                                            emptyImage.getBase64Async(Jimp.MIME_PNG)
                                                .then((newBase64DataElement) => {
                                                    // cache base64
                                                    _set(base64Data, ratioName, newBase64DataElement);
                                                    if (typeof options.emptyImageBase64Namespace !== 'string') {
                                                        _set(returnData, dataNamespace + '.empty', newBase64DataElement);
                                                    }
                                                })
                                                .catch((err) => {
                                                    this.emit('warning', new PluginError(PLUGIN_NAME, 'Error while generating base64 for ' + file.path + ': ' + err.message));
                                                })
                                                .then(() => {
                                                    cb();
                                                });
                                        }
                                    });
                                }
                            } else {
                                cb();
                            }
                        })
                        .catch((err) => {
                            _set(returnData, dataNamespace, undefined);
                            this.emit('warning', new PluginError(PLUGIN_NAME, 'Error while processing image ' + file.path + ': ' + err.message));
                        })
                        .then(() => {
                            if (options.emptyImageBase64 !== true) {
                                cb();
                            }
                        });
                } else {
                    cb();
                }

                break;

            case (currentMimeType.match(/video/) !== null):
                _set(returnData, dataNamespace + '.type', 'video');
                cb();
                break;

            case (currentMimeType.match(/audio/) !== null):
                _set(returnData, dataNamespace + '.type', 'audio');
                cb();
                break;

            default:
                _set(returnData, dataNamespace + '.type', 'unknown');
                cb();
                break;
        }
    }

    function endStream(cb) {
        if (!lastFile) {
            cb();
            return;
        }

        if (options.emptyImageBase64 && typeof options.emptyImageBase64Namespace === 'string') {
            namespace(returnData, options.emptyImageBase64Namespace, base64Data);
        }

        if (options.endObj) {
            returnData = _.assign(returnData, options.endObj);
        }

        let contents = JSON.stringify(returnData, options.jsonReplacer, options.jsonSpace);

        if (options.exportModule === true) {
            contents = `module.exports = ${contents};`;
        } else if (options.exportModule) {
            contents = `${options.exportModule} = ${contents};`;
        }

        const output = new Vinyl({
            path: options.fileName,
            contents: Buffer.from(contents)
        });

        this.push(output);

        cb();
    }

    return Through.obj(processFile, endStream);
};