var async = require('async');

var defaultOpts = {
	dirs: {
		publicDir: 'public',
		sourceDir: 'src',
		outputDir: 'dist',
		remoteDirPrefix: 'dist'
	},
	bundlePrefix: 'application',
}

var Validate = module.exports = {

	opts: function opts(opts){
		if(!opts.s3.accessKey || !opts.s3.secret || !opts.s3.bucket) throw new Error('cargomaster: you must provide authentication details and target bucket for s3');
		if(!opts.bundlePrefix) opts.bundlePrefix = defaultOpts.bundlePrefix;
		for(dir in defaultOpts.dirs){
			if(!opts.dirs[dir]) opts.dirs[dir] = defaultOpts.dirs[dir];
		}
		return opts;
	}

}