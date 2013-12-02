var async = require('async');
var UglifyJS = require("uglify-js");
var YUICompressor = require('yuicompressor');

var Handler = module.exports = {

	scripts: function handleScriptFiles(files, callback){
		async.map(files, function(file, next){
			//console.log('UglifyJS: about to minify ' + file.name);
			return next(null, file.path);
		}, function(err, paths){
			if(err) return callback(err);
			var result = UglifyJS.minify(paths, {warning: true});
			return callback(null, result.code)
		})
	},

	styles: function handleStyleFiles(files, callback){
		var css = '';
		async.each(files, function(file, next){
			//console.log('YUICompressor: about to minify ' + file.name)
			YUICompressor.compress(file.path, {charset: 'utf8', type: 'css'}, function(err, data){
				if(err) return next(err);
				css += data;
				next();
			});
		}, function(err){
			callback(err, css);
		});
	}

}