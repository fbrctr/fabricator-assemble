// modules
var _ = require('lodash');
var beautifyHtml = require('js-beautify').html;
var changeCase = require('change-case');
var fs = require('fs');
var globby = require('globby');
var Handlebars = require('handlebars');
var matter = require('gray-matter');
var md = require('markdown-it')({ linkify: true });
var mkdirp = require('mkdirp');
var path = require('path');
var Q = require('q');
var yaml = require('js-yaml');


/**
 * Default options
 * @type {Object}
 */
var defaults = {
	/**
	 * ID (filename) of default layout
	 * @type {String}
	 */
	layout: 'default',

	/**
	 * Layout templates
	 * @type {(String|Array)}
	 */
	layouts: 'src/views/layouts/*',

	/**
	 * Layout includes (partials)
	 * @type {String}
	 */
	layoutIncludes: 'src/views/layouts/includes/*',

	/**
	 * Pages to be inserted into a layout
	 * @type {(String|Array)}
	 */
	views: ['src/views/**/*', '!src/views/+(layouts)/**'],

	/**
	 * Materials - snippets turned into partials
	 * @type {(String|Array)}
	 */
	materials: 'src/materials/**/*',

	/**
	 * JSON or YAML data models that are piped into views
	 * @type {(String|Array)}
	 */
	data: 'src/data/**/*.{json,yml}',

	/**
	 * Markdown files containing toolkit-wide documentation
	 * @type {(String|Array)}
	 */
	docs: 'src/docs/**/*.md',

	/**
	 * Location to write files
	 * @type {String}
	 */
	dest: 'dist'
};


/**
 * Merged defaults and user options
 * @type {Object}
 */
var options = {};


/**
 * Assembly data storage
 * @type {Object}
 */
var assembly = {
	/**
	 * Contents of each layout file
	 * @type {Object}
	 */
	layouts: {},

	/**
	 * Parsed JSON data from each data file
	 * @type {Object}
	 */
	data: {},

	/**
	 * Meta data for materials, grouped by "collection" (sub-directory); contains name and sub-items
	 * @type {Object}
	 */
	materials: {},

	/**
	 * Meta data for user-created views (views in views/{subdir})
	 * @type {Object}
	 */
	views: {},

	/**
	 * Meta data (name, sub-items) for doc file
	 * @type {Object}
	 */
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
 * Build the template context by merging context-specific data with assembly data
 * @param  {Object} data
 * @return {Object}
 */
var buildContext = function (data) {
	return _.extend({}, data, assembly.data, { materials: assembly.materials }, { views: assembly.views }, { docs: assembly.docs });
};


/**
 * Insert the page into a layout
 * @param  {String} page
 * @param  {String} layout
 * @return {String}
 */
var wrapPage = function (page, layout) {
	return layout.replace(/\{\%\s?body\s?\%\}/, page);
};


/**
 * Parse each material - collect data, create partial
 */
var parseMaterials = function () {

	// reset object
	assembly.materials = {};

	// get files
	var files = globby.sync(options.materials, { nodir: true });

	// iterate over each file (material)
	files.forEach(function (file) {

		// get info
		var id = getFileName(file);
		var fileMatter = matter.read(file);
		var collection = path.dirname(file).split(path.sep).pop();

		// create collection (e.g. "components", "structures") if it doesn't already exist
		assembly.materials[collection] = assembly.materials[collection] || {
			name: changeCase.titleCase(collection),
			items: {}
		};

		// capture meta data for the material
		assembly.materials[collection].items[id] = {
			name: changeCase.titleCase(id),
			notes: (fileMatter.data.notes) ? md.render(fileMatter.data.notes) : ''
		};

		// register the partial, trim whitespace
		Handlebars.registerPartial(id, fileMatter.content.replace(/^(\s*(\r?\n|\r))+|(\s*(\r?\n|\r))+$/g, ''));

	});


	// register the 'material' helper used for more dynamic partial includes
	Handlebars.registerHelper('material', function (name, context) {

		var template = Handlebars.partials[name],
			fn;

		// check to see if template is already compiled
		if (!_.isFunction(template)) {
			fn = Handlebars.compile(template);
		} else {
			fn = template;
		}

		return beautifyHtml(fn(buildContext(context)).replace(/^\s+/, ''), {
			indent_size: 1,
			indent_char: '    ',
			indent_with_tabs: true
		});

	});

};


/**
 * Parse markdown files as "docs"
 */
var parseDocs = function () {

	// get files
	var files = globby.sync(options.docs, { nodir: true });

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
 * Parse layout files
 */
var parseLayouts = function () {

	// get files
	var files = globby.sync(options.layouts, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = fs.readFileSync(file, 'utf-8');
		assembly.layouts[id] = content;
	});

};


/**
 * Register layout includes has Handlebars partials
 */
var parseLayoutIncludes = function () {

	// get files
	var files = globby.sync(options.layoutIncludes, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = fs.readFileSync(file, 'utf-8');
		Handlebars.registerPartial(id, content);
	});

};


/**
 * Parse data files and save JSON
 */
var parseData = function () {

	// get files
	var files = globby.sync(options.data, { nodir: true });

	// save content of each file
	files.forEach(function (file) {
		var id = getFileName(file);
		var content = yaml.safeLoad(fs.readFileSync(file, 'utf-8'));
		assembly.data[id] = content;
	});

};


/**
 * Get meta data for views
 */
var parseViews = function () {

	// reset object
	assembly.views = {};

	// get files
	var files = globby.sync(options.views, { nodir: true });

	files.forEach(function (file) {

		var id = getFileName(file);

		// determine if view is part of a collection (subdir)
		var dirname = path.dirname(file).split(path.sep).pop(),
			collection = (dirname !== 'views') ? dirname : '';

		// if this file is part of a collection
		if (collection) {

			// create collection if it doesn't exist
			assembly.views[collection] = assembly.views[collection] || {
				name: changeCase.titleCase(collection),
				items: {}
			};

			// store view data
			assembly.views[collection].items[id] = {
				name: changeCase.titleCase(id)
			}

		}

	});

};


/**
 * Setup the assembly
 * @param  {Objet} options  User options
 */
var setup = function (userOptions) {

	// merge user options with defaults
	options = _.extend({}, defaults, userOptions);

	// setup steps
	parseLayouts();
	parseLayoutIncludes();
	parseData();
	parseMaterials();
	parseViews();
	parseDocs();

};


/**
 * assemble
 */
var assemble = function () {

	// get files
	var files = globby.sync(options.views, { nodir: true });

	// create output directory if it doesn't already exist
	mkdirp.sync(options.dest);

	// iterate over each view
	files.forEach(function (file) {

		var id = getFileName(file);

		// build filePath
		var dirname = path.dirname(file).split(path.sep).pop(),
			collection = (dirname !== 'views') ? dirname : '',
			filePath = path.join(options.dest, collection, path.basename(file));

		// get page gray matter and content
		var pageMatter = matter(fs.readFileSync(file, 'utf-8')),
			pageContent = pageMatter.content;

		// template using Handlebars
		var source = wrapPage(pageContent, assembly.layouts[pageMatter.data.layout || options.layout]),
			context = buildContext(pageMatter.data),
			template = Handlebars.compile(source);

		// write file
		mkdirp.sync(path.dirname(filePath));
		fs.writeFileSync(filePath, template(context));

	});

};


/**
 * Module exports
 * @return {Object} Promise
 */
module.exports = function (options) {

	var deferred = Q.defer();

	// setup assembly
	setup(options);

	// assemble
	assemble();

	// resolve deferred
	deferred.resolve();

	return deferred.promise;

};
