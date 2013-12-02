var fs = require('fs');
var async = require('async');
var path = require('path');

var extensions = {}, encodings = {};

var Util = module.exports = {

	getLocalBundles: function getLocalBundles(dir, callback) {
		var assets = {keys: {}, types: {}};
		fs.readdir(dir, function(err, files){
			if(err) throw err;
			async.each(files, function(file, next){
				var filePath = path.join(dir, file);
				fs.stat(filePath, function(err, info){
					if(err) throw err;
					var type = Util.getExtension(file)
					var id = /([0-9]+)/.exec(file)[0];
					assets.keys[file] = id;
					if(typeof assets.types[type] === 'undefined') assets.types[type] = {paths: []};
					if(/gz/.test(file)) assets.types[type].paths.push(filePath);
					else {
						assets.types[type].time = info.mtime;
						assets.types[type].id = id;
						assets.types[type].paths.push(filePath);
					}
					next();
				});
			}, function(err){
				if(err) throw err;
				callback(assets);
			})
		})
	},

	removeLocalBundles: function removeLocalBundles(bundles, callback){
		if(!bundles || !bundles.paths) return callback();
		async.each(bundles.paths, function(path, next){
			fs.unlink(path, next);
		}, callback);
	},

	getExtension: function getExtension(filename){
		if(extensions[filename]){
			//console.log('extension CACHED ' + filename);
			return extensions[filename];
		}else{
			//console.log('extension NOT cached!' + filename);
			extensions[filename] = filename.split('.').pop(); //Well, assuming there --is-- an extension. Then again, we regex it before pushing it, so we should be fine.
			return extensions[filename];
		}
		 
	},

	getEncodingByFilename: function getEncodingByFilename(filename){
		if(encodings[filename])
			return encodings[filename];
		else{
			encodings[filename] = /gz/.test(filename) ? 'gzip' : ''
			return encodings[filename];
		}
	},

	getTimestamp: function getTimestamp(){
		return new Date().getTime();
	}

};