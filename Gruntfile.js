'use strict';

const saveLicense = require('uglify-save-license');

module.exports = function(grunt) {

  require('load-grunt-tasks')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      main: {
        expand: true,
        flatten: true,
        src: [
          'node_modules/jquery/dist/jquery.js',
          'node_modules/sisyphus.js/sisyphus.js',
          'node_modules/markdown-it/dist/markdown-it.min.js',
          'node_modules/markdown-it-container/dist/markdown-it-container.min.js',
          'node_modules/remote-ac/ac.js'
        ],
        dest: 'static/js/'
      },
      editorStyles: {
        expand: true,
        flatten: true,
        src: [
          'node_modules/prosemirror-view/style/prosemirror.css',
          'node_modules/prosemirror-menu/style/menu.css'
        ],
        dest: 'static/css/editor/'
      }
    },
    browserify: {
      main: {
        src: 'frontend/editor.js',
        dest: 'static/js/editor-es6-bundle.js'
      }
    },
    babel: {
      tests: {
        options: {
          sourceMap: true,
          plugins: ['transform-runtime'],
          presets: ['es2015', 'stage-2']
        },
        files: {
          'tests/helpers/model-helpers-es5.js': 'tests/helpers/model-helpers.js',
          'tests/helpers/integration-helpers-es5.js': 'tests/helpers/integration-helpers.js',
          'tests/helpers/content-helpers-es5.js': 'tests/helpers/content-helpers.js',
          'tests/helpers/test-helpers-es5.js': 'tests/helpers/test-helpers.js',
          'tests/fixtures/db-fixture-es5.js': 'tests/fixtures/db-fixture.js'
        }
      },
      mainJS: {
        options: {
          sourceMap: true,
          presets: ['es2015']
        },
        files: {
          'static/js/libreviews.js': 'frontend/libreviews.js',
          'static/js/register.js': 'frontend/register.js',
          'static/js/review.js': 'frontend/review.js',
          'static/js/upload.js': 'frontend/upload.js',
          'static/js/user.js': 'frontend/user.js',
          'static/js/markdown-init.js': 'frontend/markdown-init.js',
          'static/js/editor.js': 'static/js/editor-es6-bundle.js'
        }
      }
    },
    concat: {
      libJS: {
        src: [
          'static/js/jquery.js',
          'static/js/sisyphus.js',
          'static/js/ac.js',
          'static/js/libreviews.js'
        ],
        dest: 'static/js/lib.js'
      },
      markdown: {
        src: [
          'static/js/markdown-it.min.js',
          'static/js/markdown-it-container.min.js',
          'static/js/markdown-init.js'
        ],
        dest: 'static/js/markdown.min.js'
      },
    },
    uglify: {
      options: {
        preserveComments: saveLicense
      },
      mainJS: {
        files: {
          'static/js/lib.min.js': ['static/js/lib.js'],
          'static/js/editor.min.js': ['static/js/editor.js']
        }
      },
    }
  });

  grunt.registerTask('default', ['copy', 'browserify', 'babel', 'concat', 'uglify']);

};
