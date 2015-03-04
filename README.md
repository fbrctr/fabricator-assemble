# gulp-fabricate

> A gulp plugin for fabricating pages using Handlebars, JSON, and front matter.

Turn this:

```html
---
title: Document Name
name: World
---

<h1>{{home.greeting}}, {{name}}!</h1>

{{> button}}
```

into this:

```html
<!doctype html>
<html lang="en">
<head>
    <title>Document Name</title>
</head>
<body>

    <h1>Hello, World!</h1>

    <a href="#" class="button">Click me!</a>

</body>
</html>
```

## Usage

Install:

```
$ npm install --save-dev gulp-fabricate
```

Example:

```js
var fabricate = require('gulp-fabricate');
var gulp = require('gulp');

gulp.task('templates', function () {
	return gulp.src('src/views/pages/**/*')
		.pipe(fabricate())
		.pipe(gulp.dest('dist/'));
});
```

Assuming this directory structure:

```
└── src
	├── data
	│   └── *.{json,yml}
	├── docs
	│   └── *.md
	├── materials
	│   └── components
	│       └── *.html
	└── views
	    ├── *.html
	    └── layouts
	        └── default.html
```

## Options

Default options:

```
{
	layout: 'default',
	layouts: 'src/views/layouts/**/*',
	materials: 'src/materials/**/*',
	data: 'src/data/**/*.{json,yml}',
	docs: 'src/docs/**/*.md'
}
```

### options.layout

Type: `String`  
Default: `default`

Name of the default layout template. 

### options.layouts

Type: `String` or `Array`  
Default: `src/views/layouts/**/*`

Files to use as layout templates.

### options.materials

Type: `String` or `Array`  
Default: `src/materials/**/*`

Files to use a partials/helpers.

### options.data

Type: `String` or `Array`  
Default: `src/data/**/*.json`

JSON or YAML files to use as data for views.

### options.docs

Type: `String` or `Array`  
Default: `src/docs/**/*.md`

Markdown files containing toolkit-wide documentation

## API

### Definitions

- **Layouts**: wrapper templates
- **Pages**: individual pages
- **Materials**: partial views; registered as "partials" and "helpers" in Handlebars
- **Data**: Data piped in as template context
- **Docs**: Markdown files containing documentation.

#### Layouts

Layouts are wrappers for pages. You can define as many layouts as you want by creating `.html` files in your layouts folder.

Example layout:

```html
<!doctype html>
<html lang="en">
<head>
    <title>{{title}}</title>
</head>
<body>

    {% body %}

</body>
</html>
```

Page content is inserted in the `{% body %}` placeholder.

Context can be passed from a page to the layout via front matter.

The layout a page uses is also defined in front matter:

```html
---
layout: custom-layout
title: My Custom Layout
---
```

This would use `custom-layout.html`.

When no `layout` property is defined, the page uses the `default` layout.

#### Pages

Pages can be templated using Handlebars.

Example page:

```html
---
title: Document Name
name: World
---

<h1>{{home.greeting}}, {{name}}!</h1>

{{> button}}

```

This outputs a page that uses the default layout (since no layout was defined).

The front matter block at the top provides context to both the layout and the page itself.

Context is also piped in from data files (see below). In this example, `{{home.greeting}}` refers to the `greeting` property in `home.json`.

#### Materials

Materials are partial templates; think of them as the materials used to build pages. 

They are accessible as a "partial":

```html
{{> material-name}}
```

Any file in the glob defined in `options.materials` is turned into a partial/helper and can be accessed as such. For example, assume the `components` contains materials:

```
└── components
    ├── button.html
    └── form-toggle.html
```

The content within these files can be accessed as such:

```html
{{> button}}
{{> form-toggle}}
```

#### Data

Data is defined as JSON or YAML.

The `data` folder can contain several `.json` or `.yml` files:

```
└── data
    ├── home.json
    └── contact.yml
```

`home.json`:

```json
{
  "greeting": "Hello"
}
```

The data within each file can be accessed using dot notation:

```html
{{home.greeting}}
{{contact.propName}}
```
