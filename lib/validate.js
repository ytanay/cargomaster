var async = require('async'),
	path  = require('path');

var defaultOpts = {
	dirs: {
		publicDir: 'public',
		sourceDir: 'src',
		outputDir: 'dist',
		remoteDirPrefix: 'dist'
	},
	bundlePrefix: 'application',
	env: 'development'
}

var Validate = module.exports = {

	opts: function opts(opts){
		if(!opts.s3.accessKey || !opts.s3.secret || !opts.s3.bucket) throw new Error('cargomaster: you must provide authentication details and target bucket for s3');
		if(!opts.bundlePrefix) opts.bundlePrefix = defaultOpts.bundlePrefix;
		if(!opts.env) opts.env = defaultOpts.env;

		for(dir in defaultOpts.dirs){
			if(!opts.dirs[dir]) opts.dirs[dir] = defaultOpts.dirs[dir];
		}

		opts.localOutputPath = path.join(opts.dirs.publicDir, opts.dirs.outputDir);
		opts.localSourcePath = path.join(opts.dirs.publicDir, opts.dirs.sourceDir);
		opts.localBundlePath = path.join(opts.localOutputPath, 'bundles');
		opts.localProccesedPath = path.join(opts.localOutputPath, 'processed');

		if(!opts.basePath) opts.basePath = (opts.env === 'production') ? opts.cdn.uri : path.join((opts.staticPrefix || ''), opts.dirs.outputDir);

		return opts;
	}

}