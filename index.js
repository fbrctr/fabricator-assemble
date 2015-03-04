// modules
var _ = require('lodash');
var changeCase = require('change-case');
var cheerio = require('cheerio');
var fs = require('fs');
var globby = require('globby');
var Handlebars = require('handlebars');
var matter = require('gray-matter');
var md = require('markdown-it')({ linkify: true });
var mkdirp = require('mkdirp');
var path = require('path');
var Q = require('Q');
var yaml = require('js-yaml');


/**
 * Assembly data storage
 * @type {Object}
 */
var assembly = {
	defaults: {
		layout: 'default',
		layouts: 'src/views/layouts/*',
		layoutIncludes: 'src/views/layouts/includes/*',
		materials: 'src/materials/**/*',
		views: ['src/views/**/*', '!src/views/layouts/**/*'],
		data: 'src/data/**/*.{json,yml}',
		docs: 'src/docs/**/*.md',
		dest: 'dist'
	},
	options: {},
	layouts: {},
	data: {},
	materials: {},
	docs: {}
};


/**
 * Get the name of a file (minus extension) from a path
 * @param  {String} filePath
 * @return {String}
 */
var getFileName = function (filePath) {
	return path.basename(filePath).replace(/\.[^\/.]+$/, '');
};


/**
 * Build the template context by merging page gray-matter data with assembly data
 * @param  {Object} matterData
 * @return {Object}
 */
var buildContext = function (matterData) {
	return _.extend({}, matterData, assembly.data, { materials: assembly.materials }, { docs: assembly.docs });
};


/**
 * Insert the page into the layout
 * @param  {String} page   [description]
 * @param  {String} layout [description]
 * @return {String}        [description]
 */
var wrapPage = function (page, layout) {
	return layout.replace(/\{\%\s?body\s?\%\}/, page);
};


/**
 * Parse each material - collect data, create partial
 */
var parseMaterials = function () {

	// get files
	var files = globby.sync(assembly.options.materials, { nodir: true });


	// iterate over each file (material)
	files.forEach(function (file) {

		// get info
		var id = getFileName(file);
		var fileMatter = matter.read(file);
		var collection = path.dirname(file).split(path.sep).pop();


		// create collection (e.g. "components", "structures") if it doesn't already exist
		if (!assembly.materials[collection]) {
			assembly.materials[collection] = {};
			assembly.materials[collection].name = changeCase.titleCase(collection);
			assembly.materials[collection].items = {};
		}


		// create meta data object for the material
		assembly.materials[collection].items[id] = {
			name: changeCase.titleCase(id),
			notes: (fileMatter.data.notes) ? md.render(fileMatter.data.notes) : ''
		};


		// register the partial
		Handlebars.registerPartial(id, fileMatter.content);

	});

	// register 'partial' helper used for more dynamic partial includes
	Handlebars.registerHelper('partial', function (name, context) {

		var template = Handlebars.partials[name];
		var fn;

		// check to see if template is already compiled
		if (!_.isFunction(template)) {
			fn = Handlebars.compile(template);
		} else {
			fn = template;
		}

		var output = fn(buildContext(context)).replace(/^\s+/, '');

		return new Handlebars.SafeString(output);

	});

};


/**
 * Parse markdown files as "docs"
 * @return {[type]} [description]
 */
var parseDocs = function () {

	// get files
	var files = globby.sync(assembly.options.docs, { nodir: true });

	// iterate over each file (material)
	files.forEach(function (file) {

		var id = getFileName(file);

		// save each as unique prop
		assembly.docs[id] = {
			name: changeCase.titleCase(id),
			content: md.render(fs.readFileSync(file, 'utf-8'))
		};

	});

};


/**
 * Get layout files
 */
var getLayouts = function () {

	// get files
	var files = globby.sync(assembly.options.layouts, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = fs.readFileSync(file, 'utf-8');
		assembly.layouts[id] = content;
	});

};


var registerLayoutIncludes = function () {

	// get files
	var files = globby.sync(assembly.options.layoutIncludes, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = fs.readFileSync(file, 'utf-8');
		Handlebars.registerPartial(id, content);
	});

};


/**
 * Get data
 */
var getData = function () {

	// get files
	var files = globby.sync(assembly.options.data, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = yaml.safeLoad(fs.readFileSync(file, 'utf-8'));
		assembly.data[id] = content;
	});

};


/**
 * Setup the assembly
 * @param  {Objet} options  User options
 */
var setup = function (options) {

	// merge user options with defaults
	assembly.options = _.extend({}, assembly.defaults, options);

	getLayouts();
	registerLayoutIncludes();
	getData();
	parseMaterials();
	parseDocs();

};


/**
 * assemble
 */
var assemble = function () {

	// get files
	var files = globby.sync(assembly.options.views, { nodir: true });

	// create output directory if it doesn't already exist
	mkdirp.sync(assembly.options.dest);

	// iterate over each view
	files.forEach(function (file) {

		// get page gray matter and content
		var pageMatter = matter(fs.readFileSync(file, 'utf-8')),
			pageContent = pageMatter.content;

		// template using Handlebars
		var source = wrapPage(pageContent, assembly.layouts[pageMatter.data.layout || assembly.options.layout]),
			context = buildContext(pageMatter.data),
			template = Handlebars.compile(source);

		// get values for new file path
		var dirname = path.dirname(file).split(path.sep).pop(),
			collection = (dirname !== 'views') ? dirname : '',
			filePath = path.join(assembly.options.dest, collection, path.basename(file));

		// write file
		mkdirp.sync(path.dirname(filePath));
		fs.writeFileSync(filePath, template(context));

	});

};

/**
 * Module exports
 * @param  {Object} options User options
 * @return {Object}         Stream
 */
module.exports = function (options, cb) {

	var deferred = Q.defer();

	// setup assembly
	setup(options);

	// assemble
	assemble();

	// resolve deferred
	deferred.resolve();

	return deferred.promise;

};
