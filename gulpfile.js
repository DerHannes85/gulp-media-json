const fs = require('fs');
const gulp = require('gulp');
const gulpMediaJson = require(__dirname + '\\index.js');

gulp.task('default', function () {
    return gulp.src('test/data/**/*.*')
        .pipe(gulpMediaJson({
            basePath: 'test\\',
            escapeNamespace: (s, ext) => {
                return s + '-' + ext;
            },
            fileName: 'media.json',
            emptyImageBase64: true,
            emptyImageBase64Namespace: 'empty',
            ratioValue: true,
            startObj: {},
            endObj: null,
            exportModule: false,
            jsonReplacer: null,
            jsonSpace: '\t',
            basePath: 'test\\data\\'
        }))
        .pipe(gulp.dest('test/output'));
});