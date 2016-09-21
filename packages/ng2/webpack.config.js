// <package>/../../src/ is copied to <package>/src
// This config is then copied to <package>/src/webpack.config.js

var pkg = require('../package.json');
var banner = pkg.description + '\n' +
    '@version v' + pkg.version + '\n' +
    '@link ' + pkg.homepage + '\n' +
    '@license MIT License, http://www.opensource.org/licenses/MIT';

var webpack = require('webpack');
module.exports = {
  entry: {
    "ui-router-ng2": "./ng2.ts",
    "ui-router-ng2.min": "./ng2.ts"
  },

  output: {
    path: __dirname + "/../_bundles",
    filename: "[name].js",
    libraryTarget: "umd",
    library: "ui-router-ng2",
    umdNamedDefine: true
  },

  devtool: 'source-map',

  resolve: {
    modulesDirectories: ['../../node_modules'],
    extensions: ['', '.js', '.ts']
  },

  plugins: [
    new webpack.optimize.UglifyJsPlugin({
      include: /\.min\.js$/, minimize: true
    }),
    new webpack.BannerPlugin(banner)
  ],

  module: {
    loaders: [
      { test: /\.ts$/, loader: "awesome-typescript-loader" }
    ]
  },

  ts: {
    compilerOptions: {
      declaration: false
    }
  },
 
  externals: {
    "rxjs/Rx": { root: 'rxjs/Rx', amd: 'rxjs/Rx', commonjs2: 'rxjs/Rx', commonjs: 'rxjs/Rx' },
    "@angular/core": { root: '@angular/core', amd: '@angular/core', commonjs2: '@angular/core', commonjs: '@angular/core' },
    "@angular/common": { root: '@angular/common', amd: '@angular/common', commonjs2: '@angular/common', commonjs: '@angular/common' }
  }
};
