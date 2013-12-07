var fs    = require('fs'),
	async = require('async'),
	path  = require('path');

var Util = module.exports = {

	parts: {
		cache: {
			extension: {}, encoding: {}, block: {}, id: {}, processed: {}
		},

		create: {
			extension: function(name){
				return name.split('.').pop();
			},
			encoding: function(name){
				return /gz/.test(name) ? 'gzip' : '';
			},
			block: function(name){
				return name.split('/').pop();
			},
			id: function(name){
				return /([0-9]+)/.exec(name)[0];
			},
			processed: function(name){
				return /processed/.test(name);
			}
		},

		fetch: function fetch(type, key){
			if(Util.parts.cache[type][key]){
				return Util.parts.cache[type][key];
			}else{
				Util.parts.cache[type][key] = Util.parts.create[type](key);
				return Util.parts.cache[type][key];
			}
		}
	},

	removeLocalBundles: function removeLocalBundles(bundles, callback){
		if(!bundles || !bundles.paths) return callback();
		async.each(bundles.paths, function(path, next){
			fs.unlink(path, next);
		}, callback);
	},

	getTimestamp: function getTimestamp(){
		return new Date().getTime();
	},

	generateBundleFilename: function generateBundleFilename(prefix, file){
		return prefix + '_' + file.timestamp + '.min.' + (file.encoding === 'gzip' ? 'gz.' : '') + file.type
	},


};