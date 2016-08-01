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
          'node_modules/markdown-it/dist/markdown-it.min.js'
        ],
        dest: 'static/js/'
      },
    },
    babel: {
      options: {
        sourceMap: true,
        presets: ['babel-preset-es2015']
      },
      mainJS: {
        files: {
          'static/js/libreviews.js': 'frontend/libreviews.js',
          'static/js/register.js': 'frontend/register.js',
          'static/js/review.js': 'frontend/review.js',
          'static/js/user.js': 'frontend/user.js'
        }
      }
    },
    concat: {
      libJS: {
        src: [
          'static/js/jquery.js',
          'static/js/sisyphus.js',
          'static/js/libreviews.js'
        ],
        dest: 'static/js/lib.js'
      },
    },
    uglify: {
      options: {
        preserveComments: saveLicense
      },
      mainJS: {
        files: {
          'static/js/lib.min.js': ['static/js/lib.js']
        }
      },
    }
  });

  grunt.registerTask('default', ['copy', 'babel', 'concat', 'uglify']);

};
