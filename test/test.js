var assert = require('assert');
var assemble = require('../');
var del = require('del');
var fs = require('fs');
var minify = require('html-minifier').minify;

describe('fabricator-assemble', function () {

	// fabricator-assemble task options
	var options = {
		layout: 'default',
		layouts: './test/fixtures/views/layouts/*',
		layoutIncludes: './test/fixtures/views/layouts/includes/*',
		materials: './test/fixtures/materials/**/*',
		views: ['./test/fixtures/views/**/*', '!./test/fixtures/views/+(layouts)/**'],
		data: './test/fixtures/data/**/*.{yml,json}',
		docs: './test/fixtures/docs/**/*',
		dest: './test/output'
	};

	beforeEach(function () {
		// start with a clean output directory for each test
		del.sync([options.dest]);
	});


	it('should assemble a template', function (done) {

		assemble(options);

		var output = minify(fs.readFileSync('./test/output/index.html', 'utf-8'), { collapseWhitespace: true });
		var expected = minify(fs.readFileSync('./test/expected/index.html', 'utf-8'), { collapseWhitespace: true });

		assert.equal(output, expected);
		done();

	});


	it('should assemble docs', function (done) {

		assemble(options);

		var output = minify(fs.readFileSync('./test/output/docs.html', 'utf-8'), { collapseWhitespace: true });
		var expected = minify(fs.readFileSync('./test/expected/docs.html', 'utf-8'), { collapseWhitespace: true });

		assert.equal(output, expected);
		done();

	});


	it('should assemble user-created views', function (done) {

		assemble(options);

		var output = minify(fs.readFileSync('./test/output/pages/home.html', 'utf-8'), { collapseWhitespace: true });
		var expected = minify(fs.readFileSync('./test/expected/home.html', 'utf-8'), { collapseWhitespace: true });

		assert.equal(output, expected);
		done();

	});


	it('should assemble with layout includes', function (done) {

		assemble(options);

		var output = minify(fs.readFileSync('./test/output/includes.html', 'utf-8'), { collapseWhitespace: true });
		var expected = minify(fs.readFileSync('./test/expected/includes.html', 'utf-8'), { collapseWhitespace: true });

		assert.equal(output, expected);
		done();

	});

});
