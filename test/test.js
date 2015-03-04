var assert = require('assert');
var assemble = require('../');
var del = require('del');
var fs = require('fs');
var minify = require('html-minifier').minify;

describe('fabricator-assemble', function () {

	// fabricator-assemble task options
	var options = {
		layout: 'default',
		layouts: './test/fixtures/views/layouts/**/*',
		materials: './test/fixtures/materials/**/*',
		views: ['./test/fixtures/views/**/*', '!./test/fixtures/views/{layouts,includes}/*'],
		data: './test/fixtures/data/**/*.{yml,json}',
		docs: './test/fixtures/docs/**/*',
		dest: './test/output'
	};

	beforeEach(function () {
		// start with a clean output directory for each test
		del.sync([options.dest]);
	});


	it('should assemble a template', function (done) {

		assemble(options).done(function (data) {
			var output = minify(fs.readFileSync('./test/output/index.html', 'utf-8'), { collapseWhitespace: true });
			var expected = minify(fs.readFileSync('./test/fixtures/expected/index.html', 'utf-8'), { collapseWhitespace: true });
			assert.equal(output, expected);
			done();
		});

	});


	it('should assemble docs', function (done) {

		assemble(options).done(function (data) {
			var output = minify(fs.readFileSync('./test/output/docs.html', 'utf-8'), { collapseWhitespace: true });
			var expected = minify(fs.readFileSync('./test/fixtures/expected/docs.html', 'utf-8'), { collapseWhitespace: true });
			assert.equal(output, expected);
			done();
		});

	});


	it('should assemble user-created views', function (done) {

		assemble(options).done(function (data) {
			var output = minify(fs.readFileSync('./test/output/pages/home.html', 'utf-8'), { collapseWhitespace: true });
			var expected = minify(fs.readFileSync('./test/fixtures/expected/home.html', 'utf-8'), { collapseWhitespace: true });
			assert.equal(output, expected);
			done();
		});

	});


});


