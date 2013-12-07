var async         = require('async'),
	UglifyJS      = require("uglify-js"),
	YUICompressor = require('yuicompressor');

var Handler = module.exports = {

	handle: function handle(type, assets, callback){
		if(type === 'js') return Handler.scripts(assets, callback);
		if(type === 'css') return Handler.styles(assets, callback);
	
		throw new Error('unrecognized asset type ' + type); //This REALLY should never happen...
	},

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

	