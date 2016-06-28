gulp-jasmine-phantom-requirejs
=============

A gulp plugin that runs Jasmine tests with PhantomJS.
Both specs and tested units must be amd modules

Dependencies
------------

This module uses `execSync` which is not available in any version of Node under `0.12.x`.
If you have any specific concerns about upgrading versions of Node or reasons not use
`execSync` feel free to open an issue!

Before you install `gulp-jasmine-phantom-requirejs` please ensure that you have PhantomJS
installed on your machine. The plugin assumes that the `phantomjs` binary is
available in the PATH and executable from the command line.

If not, ensure you at least have `phantomjs` as an npm dependency. The module
checks in `./node_modules/phantomjs` for an executable if you do not have it
installed globally.

**If you do not have `phantomjs` installed please install following
[these directions.](http://phantomjs.org/download.html)

Install
-----

```
$ npm install --save-dev gulp-jasmine-phantom-requirejs
```

Usage
-----
Basic usage:
```javascript
var gulp = require('gulp');
var jasmine = require('gulp-jasmine-phantom-requirejs');

gulp.task('default', function () {
  return gulp.src('spec/test.js')
          .pipe(jasmine({
            vendor: [
              'node_modules/requirejs/require.js'
            ],
            abortOnFail: true
          }));
});
```

Options
-------

#### keepRunner
Type: `boolean | string` <br />
Default: false

Keep the `specRunner.html` file after build. If given a string, it will keep
the runner at the string path.

#### includeStackTrace
Type: `boolean` <br />
Default: false

Prints out a longer stack trace for errors.

#### abortOnFail
Type: `boolean` <br />
Default: false

Exits Gulp with an status of 1 that will halt any further Gulp tasks.

#### specHtml
Type: `string` <br />
Default: null

Allows you to specify the HTML runner that Jasmine uses during tests.

#### vendor
Type: `string | array` <br />
Default: null

Allows to load scripts before testing process.
** require.js must be specified here **

#### runner
Type: `string` <br />
Default: '/lib/jasmine-runner.js'

Allows you to specify the javascript runner that jasmine uses when running tests.

A list of vendor scripts to import into the HTML runner, either as file
globs (e.g. `"**/*.js"`) or fully-qualified URLs (e.g.
`"http://my.cdn.com/jquery.js"`).

This option accepts either a single string or an array of strings (e.g.
`["test/*.js", "http://my.cdn.com/underscore.js"]`).

#### jasmineVersion
Type: `string` <br />
Default: '2.0'

Specifies the version of Jasmine you want to run. Possible options are in the `vendor/` folder. Just specify what `2.x` minor release you want.

Technologies Used
-----------------

* Node
* Gulp
