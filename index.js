'use strict';
var _ = require('lodash'),
    exec = require('child_process').execSync,
    execFile = require('child_process').execFile,
    express = require('express'),
    fs = require('fs'),
    glob = require('glob'),
    gutil = require('gulp-util'),
    handlebar = require('handlebars'),
    mime = require('mime'),
    path = require('path'),
    serialize = require('serialize-javascript'),
    favicon = require('serve-favicon'),
    through = require('through2');

/*
 * Global variables
 *
 * gulpOptions: object of options passed in through Gulp
 * jasmineCSS: string path to the jasmine.css file for the specRunner.html
 * jasmineJS: array of string paths to JS needed for the specRunner.html
 * specHtml: string path to the tmp specRunner.html to be written out to
 * specRunner: string path to the specRunner JS file needed in the specRunner.html
 **/
var phantomExecutable = process.platform === 'win32' ? 'phantomjs.cmd' : 'phantomjs',
    gulpOptions = {},
    jasmineCss, jasmineJs,
    vendorJs = [],
    specHtml = path.join(__dirname, '/lib/specRunner.html'),
    specRunner = path.join(__dirname, '/lib/specRunner.js'),
    serverRoots,
    serverPort;


function configJasmine (version) {
    version = version || '2.0';
    jasmineCss = path.join(__dirname, '/vendor/jasmine-' + version + '/jasmine.css');
    jasmineJs = [
        path.join(__dirname, '/vendor/jasmine-' + version + '/jasmine.js'),
        path.join(__dirname, '/vendor/jasmine-' + version + '/jasmine-html.js'),
        path.join(__dirname, '/vendor/jasmine-' + version + '/console.js'),
        path.join(__dirname, '/vendor/jasmine-' + version + '/boot.js')
    ];
}

/**
 * Removes the specRunner.html file
 **/
function cleanup (path) {
    fs.unlink(path);
}

function hasGlobalPhantom () {
    if (process.platform === 'win32') {
        try {
            exec('where phantomjs');
        } catch (e) {
            return false;
        }
    } else {
        try {
            exec('which phantomjs');
        } catch (e) {
            return false;
        }
    }
    return true;
}

/**
 * execPhantom
 *
 * @param {string} phantom Path to phantom
 * @param {array} childArguments Array of options to pass to Phantom
 * @param {function} onComplete Callback function
 */
function execPhantom (phantom, childArguments, onComplete) {
    execFile(phantom, childArguments, function (error, stdout, stderr) {
        var success = null;

        if (error !== null) {
            success = new gutil.PluginError('gulp-jasmine-phantom-requirejs', error.code + ': Tests contained failures.');
        }

        if (stderr !== '') {
            gutil.log('gulp-jasmine-phantom-requirejs: Failed to open test runner ' + gutil.colors.blue(childArguments[1]));
            gutil.log(gutil.colors.red('error: '), stderr);
            success = new gutil.PluginError('gulp-jasmine-phantom-requirejs', 'Failed to open test runner ' + gutil.colors.blue(childArguments[1]));
        }

        if (gulpOptions.specHtml === undefined && (gulpOptions.keepRunner === undefined || gulpOptions.keepRunner === false)) {
            cleanup(childArguments[1]);
        }

        console.log(stdout);
        onComplete(success);
    });
}

function renderFile (res, relPath) {
    if (!_.some(serverRoots, function (root) {
        var filePath = path.join(root, relPath),
            success,
            data;

        try {
            data = fs.readFileSync(filePath, {encoding: 'utf8'});

            res.status(200)
                .type(mime.lookup(filePath))
                .send(data);

            success = true;
        } catch (ex) {
        }

        return success;
    })) {
        res.status(404).send('Not found');
    }
}

function startServer (options) {
    var app = express(),
        server;

    app.use(favicon(path.join(__dirname, 'vendor', 'jasmine_favicon.png')));

    app.get('/', function (req, res) {
        renderFile(res, options.specRunner);
    });

    app.get('*', function (req, res) {
        renderFile(res, req.path.replace(/^\//, ''));
    });

    server = app.listen(serverPort, function () {
        gutil.log('gulp-jasmine-phantom-requirejs: Jasmine server listening on port ' + serverPort);
    });

    return server;
}

/**
 * Executes Phantom with the specified arguments
 *
 * childArguments: Array of options to pass Phantom
 * [jasmine-runner.js, URL, {abortOnFail}]
 * specRunner: specRunner.html
 **/
function runTesting (childArguments, specRunner, onComplete) {
    var server = startServer({
        specRunner: specRunner
    }),
        onPhantomComplete = function () {
            onComplete.apply(null, arguments);
            server.close();
        };

    if (gulpOptions.justServer) {
        gutil.log('Jasmine server run on http://localhost:' + serverPort);
    } else {
        if (hasGlobalPhantom()) {
            execPhantom(phantomExecutable, childArguments, onPhantomComplete);
        } else {
            gutil.log(gutil.colors.yellow('gulp-jasmine-phantom-requirejs: Global Phantom undefined, trying to execute from node_modules/phantomjs'));
            execPhantom(process.cwd() + '/node_modules/.bin/' + phantomExecutable, childArguments, onPhantomComplete);
        }
    }
}

function fixupPath (p) {
    if (p.match(/^http/)) {
        return p;
    }

    // calculate relative path
    return path.relative(process.cwd(), p)
        // correct Windows separator to URL
        .replace(/\\/g, '/');
}

/*
 * Reads in the handlebar template and creates a data HTML object in memory to create
 *
 * options: list of options that can be passed to the function
 *  files: paths to files being tested
 *  onComplete: callback to call when everything is done
 **/
function compileRunner (options) {
    var filePaths = options.files || [],
        onComplete = options.onComplete || {};

    fs.readFile(path.join(__dirname, '/lib/specRunner.handlebars'), 'utf8', function (error, data) {
        if (error) {
            throw error;
        }

        var vendorScripts = gulpOptions.vendor;

        if (vendorScripts) {
            if (typeof vendorScripts === 'string') {
                vendorScripts = [vendorScripts];
            }

            vendorScripts.forEach(function (fileGlob) {
                if (fileGlob.match(/^http/)) {
                    vendorJs.push(fileGlob);
                } else {
                    glob.sync(fileGlob).forEach(function (newFile) {
                        vendorJs.push(path.join(process.cwd(), newFile));
                    });
                }
            });
        }

        // Create the compile version of the specRunner from Handlebars
        var specData = handlebar.compile(data),
            specCompiled = specData({
                files: filePaths.map(fixupPath),
                jasmineCss: fixupPath(jasmineCss),
                jasmineJs: jasmineJs.map(fixupPath),
                requireJs: fs.readFileSync(require.resolve('requirejs/require'), {encoding: 'utf8'}),
                vendorJs: vendorJs.map(fixupPath),
                specRunner: fixupPath(specRunner),
                requireConfig: serialize(gulpOptions.requireConfig, 4)
            });

        if (gulpOptions.keepRunner !== undefined && typeof gulpOptions.keepRunner === 'string') {
            specHtml = path.join(path.resolve(gulpOptions.keepRunner), 'specRunner.html');
        }

        fs.writeFile(specHtml, specCompiled, function (error) {
            if (error) {
                throw error;
            }

            var childArgs = [
                options.runner,
                'http://localhost:' + serverPort,
                JSON.stringify(_.pick(gulpOptions, ['abortOnFail']))
            ];
            runTesting(childArgs, specHtml, onComplete);
        });
    });
}

module.exports = function (options) {
    var filePaths = [];

    gulpOptions = options || {};

    serverRoots = _.union([''], gulpOptions.serverRoots);
    serverPort = gulpOptions.port || 8888;

    configJasmine(gulpOptions.jasmineVersion);

    return through.obj(
        function (file, encoding, callback) {
            if (file.isNull()) {
                callback(null, file);
                return;
            }
            if (file.isStream()) {
                callback(new gutil.PluginError('gulp-jasmine-phantom-requirejs', 'Streaming not supported'));
                return;
            }
            filePaths.push(file.path);
            callback(null, file);
        }, function (callback) {
        try {
            var runner = gulpOptions.runner || path.join(__dirname, '/lib/jasmine-runner.js');
            if (gulpOptions.specHtml) {
                runTesting(
                    [
                        runner,
                        'http://localhost:' + serverPort,
                        JSON.stringify(gulpOptions)
                    ],
                    path.resolve(gulpOptions.specHtml),
                    function (success) {
                        callback(success);
                    });
            } else {
                compileRunner({
                    files: filePaths,
                    onComplete: function (success) {
                        callback(success);
                    },
                    runner: runner
                });
            }
        } catch (error) {
            callback(new gutil.PluginError('gulp-jasmine-phantom-requirejs', error));
        }
    }
    );
};
