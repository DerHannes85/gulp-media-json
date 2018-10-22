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

const escapeNamespace = function(s) {
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
            emptyBase64: true,
            emptyBase64Namespace: null,
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

    if (options.emptyBase64) {
        base64Data = {};
    }

    function processFile(file, enc, cb) {
        let dataNamespace,
            currentVinyl;

        if (file.isNull()) {
            cb();
            return;
        }

        if (file.isStream()) {
            this.emit('error', new PluginError(PLUGIN_NAME, 'Streaming not supported!'));
            cb();
            return;
        }

        lastFile = file;
        currentVinyl = new Vinyl(file);

        dataNamespace = currentVinyl.dirname.replace(currentVinyl.cwd + '\\' + options.basePath, '').replace(/[\\\/]/g, '.').replace(/^\./g, '');
        dataNamespace = options.escapeNamespace(dataNamespace + '.' + currentVinyl.stem);

        namespace(returnData, dataNamespace, {
            src: currentVinyl.dirname.replace(options.basePath, '').replace(/[\\]/g, '/') + '/' + currentVinyl.basename
        });

        Jimp.read(file.path)
            .then((image) => {
                let currentGcd = gcd(image.bitmap.width, image.bitmap.height),
                    ratioName = (image.bitmap.width / currentGcd) + '/' + (image.bitmap.height / currentGcd),
                    base64DataElement = _get(base64Data, ratioName, false);

                _set(returnData, dataNamespace + '.width', image.bitmap.width);
                _set(returnData, dataNamespace + '.height', image.bitmap.height);
                _set(returnData, dataNamespace + '.ratioName', ratioName);
                _set(returnData, dataNamespace + '.ratioValue', image.bitmap.width / image.bitmap.height);

                if (options.emptyBase64) {
                    if (base64DataElement !== false) {
                        if (typeof options.emptyBase64Namespace !== 'string') {
                            _set(returnData, dataNamespace + '.empty', base64DataElement);
                        }
                    } else {
                        new Jimp(image.bitmap.width / currentGcd, image.bitmap.height / currentGcd, (err, emptyImage) => {
                            if (err === null) {
                                emptyImage.getBase64Async(Jimp.MIME_PNG)
                                    .then((newBase64DataElement) => {
                                        // cache base64
                                        _set(base64Data, ratioName, newBase64DataElement);
                                        if (typeof options.emptyBase64Namespace !== 'string') {
                                            _set(returnData, dataNamespace + '.empty', newBase64DataElement);
                                        }
                                        cb();
                                    });
                            } else {
                                cb();
                            }
                        });
                    }
                } else {
                    cb();
                }
            })
            .catch((err) => {
                this.emit('error', new PluginError(PLUGIN_NAME, 'Error while processing image ' + file.pathname));
                cb();
            });
    }

    function endStream(cb) {
        if (!lastFile) {
            cb();
            return;
        }

        if (options.emptyBase64 && typeof options.emptyBase64Namespace !== 'string') {
            namespace(returnData, options.emptyBase64Namespace, base64Data);
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