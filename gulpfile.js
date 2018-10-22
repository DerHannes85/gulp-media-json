const fs = require('fs');
const gulp = require('gulp');
const gulpMediaJson = require(__dirname+'\\index.js');
const gulpDebug = require('gulp-debug');

gulp.task('default', function() {
    return gulp.src('test/data/**/*.jpg')
        .pipe(gulpDebug())
        .pipe(gulpMediaJson({
            basePath: __dirname + '\\test\\'
        }))
        .pipe(gulp.dest('test/out'));
});