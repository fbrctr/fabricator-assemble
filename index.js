// modules
var _ = require('lodash');
var beautifyHtml = require('js-beautify').html;
var changeCase = require('change-case');
var fs = require('fs');
var globby = require('globby');
var Handlebars = require('handlebars');
var matter = require('gray-matter');
var md = require('markdown-it')({ html: true, linkify: true });
var mkdirp = require('mkdirp');
var path = require('path');
var sortObj = require('sort-object');
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
	dest: 'dist',
	/**
	 * beautifier options
	 * @type {Object}
	 */
	beautifier: {
		indent_size: 1,
		indent_char: '	',
		indent_with_tabs: true
	}
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
	 * Each material's front-matter data
	 * @type {Object}
	 */
	materialData: {},

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
	return _.assign({}, data, assembly.data, assembly.materialData, { materials: assembly.materials }, { views: assembly.views }, { docs: assembly.docs });
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

	// get files and dirs
	var files = globby.sync(options.materials, { nodir: true, nosort: true });

	// get all directories
	var dirs = files.map(function (file) {
		return path.dirname(file).split(path.sep).pop();
	});


	// stub out an object for each collection and subCollection
	files.forEach(function (file) {

		var parent = path.dirname(file).split(path.sep).slice(-2, -1)[0];
		var collection = path.dirname(file).split(path.sep).pop();
		var isSubCollection = (dirs.indexOf(parent) > -1);

		if (!isSubCollection) {
			assembly.materials[collection] = assembly.materials[collection] || {
				name: changeCase.titleCase(collection),
				items: {}
			};
		} else {
			assembly.materials[parent].items[collection] = assembly.materials[parent].items[collection] || {
				name: changeCase.titleCase(collection),
				items: {}
			};
		}

	});


	// iterate over each file (material)
	files.forEach(function (file) {

		// get info
		var fileMatter = matter.read(file);
		var collection = path.dirname(file).split(path.sep).pop();
		var parent = path.dirname(file).split(path.sep).slice(-2, -1)[0];
		var isSubCollection = (dirs.indexOf(parent) > -1);
		var id = (isSubCollection) ? collection + '.' + getFileName(file) : getFileName(file);

		// get material front-matter, omit `notes`
		var localData = _.omit(fileMatter.data, 'notes');

		// trim whitespace from material content
		var content = fileMatter.content.replace(/^(\s*(\r?\n|\r))+|(\s*(\r?\n|\r))+$/g, '');


		// capture meta data for the material
		if (!isSubCollection) {
			assembly.materials[collection].items[id] = {
				name: changeCase.titleCase(id),
				notes: (fileMatter.data.notes) ? md.render(fileMatter.data.notes) : ''
			};
		} else {
			assembly.materials[parent].items[collection].items[id] = {
				name: changeCase.titleCase(id.split('.')[1]),
				notes: (fileMatter.data.notes) ? md.render(fileMatter.data.notes) : ''
			};
		}


		// store material-name-spaced local data in template context
		assembly.materialData[id.replace(/\./g, '-')] = localData;


		// replace local fields on the fly with name-spaced keys
		// this allows partials to use local front-matter data
		// only affects the compilation environment
		if (!_.isEmpty(localData)) {
			_.forEach(localData, function (val, key) {
				// {{field}} => {{material-name.field}}
				var regex = new RegExp('(\\{\\{[#\/]?)(\\s?' + key + '+?\\s?)(\\}\\})', 'g');
				content = content.replace(regex, function (match, p1, p2, p3) {
					return p1 + id.replace(/\./g, '-') + '.' + p2.replace(/\s/g, '') + p3;
				});
			});
		}


		// register the partial
		Handlebars.registerPartial(id, content);

	});


	// sort materials object alphabetically
	assembly.materials = sortObj(assembly.materials);

	for (var collection in assembly.materials) {
		assembly.materials[collection].items = sortObj(assembly.materials[collection].items);
	}

};


/**
 * Parse markdown files as "docs"
 */
var parseDocs = function () {

	// reset
	assembly.docs = {};

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

	// reset
	assembly.layouts = {};

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

	// reset
	assembly.data = {};

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

	// reset
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
			};

		}

	});

};


/**
 * Register new Handlebars helpers
 */
var registerHelpers = function () {

	// get helper files
	var resolveHelper = path.join.bind(null, __dirname, 'helpers');
	var localHelpers = fs.readdirSync(resolveHelper());
	var userHelpers = options.helpers;

	// register local helpers
	localHelpers.map(function (helper) {
		var key = helper.match(/(^\w+?-)(.+)(\.\w+)/)[2];
		var path = resolveHelper(helper);
		Handlebars.registerHelper(key, require(path));
	});


	// register user helpers
	for (var helper in userHelpers) {
		if (userHelpers.hasOwnProperty(helper)) {
			Handlebars.registerHelper(helper, userHelpers[helper]);
		}
	}


	/**
	 * Helpers that require local functions like `buildContext()`
	 */

	/**
	 * `material`
	 * @description Like a normal partial include (`{{> partialName }}`),
	 * but with some additional templating logic to help with nested block iterations
	 * @example
	 * {{material name context}}
	 */
	Handlebars.registerHelper('material', function (name, context) {

		var template = Handlebars.partials[name],
			fn;

		// check to see if template is already compiled
		if (!_.isFunction(template)) {
			fn = Handlebars.compile(template);
		} else {
			fn = template;
		}

		return beautifyHtml(fn(buildContext(context)).replace(/^\s+/, ''), options.beautifier);

	});

};


/**
 * Setup the assembly
 * @param  {Objet} options  User options
 */
var setup = function (userOptions) {

	// merge user options with defaults
	options = _.assign({}, defaults, userOptions);

	// setup steps
	registerHelpers();
	parseLayouts();
	parseLayoutIncludes();
	parseData();
	parseMaterials();
	parseViews();
	parseDocs();

};


/**
 * Assemble views using materials, data, and docs
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
		var dirname = path.normalize(path.dirname(file)).split(path.sep).pop(),
			collection = (dirname !== 'views') ? dirname : '',
			filePath = path.normalize(path.join(options.dest, collection, path.basename(file)));

		// get page gray matter and content
		var pageMatter = matter(fs.readFileSync(file, 'utf-8')),
			pageContent = pageMatter.content;

		if (collection) {
			pageMatter.data.baseurl = '..';
		}

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

	// setup assembly
	setup(options);

	// assemble
	assemble();

};
