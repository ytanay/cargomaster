var async     = require('async'),
	handler   = require('./handler'),
	zlib      = require('zlib'),
	walk      = require('walk'),
	fs        = require('fs'),
	util      = require('./util'),
	path      = require('path');

var top;
var transport, log;
var types = ['js', 'css'], encodings = ['plain', 'gzipped'];

var consoleOpts = {
	level: 'debug', colorize: true, timestamp: true
};

function Cargomaster(opts){
	if(opts.log) log = opts.log;

	log.silly('cargomaster object created');

	top = this;

	this.opts = require('./validate').opts(opts);

	var transportHandler = require('./transport');
	transport = new transportHandler(this.opts);

	this.opts.localOutputPath = path.join(this.opts.dirs.publicDir, this.opts.dirs.outputDir);
	this.opts.localSourcePath = path.join(this.opts.dirs.publicDir, this.opts.dirs.sourceDir);

	if(this.opts.dirs.remoteDirPrefix.slice(-1) !== '/') this.opts.dirs.remoteDirPrefix += '/';

	this.pipeline(function(err){
		log.info('pipeline finished!');
		if(err) log.warn(err);
		log.info('all done!');
	});
}

Cargomaster.prototype.pipeline = function(finish) {
	log.info('starting cargomaster pipeline');
	async.waterfall([
		async.apply(top.initLocalDirectories),

		async.apply(top.treader), //Get all the asset sources we recognize

		function shouldRegenrateAssets(sources, done){
			log.info('checking which asset bundles to regenerate');
			var workflow = {sources: sources, create: []};
			
			util.getLocalBundles(top.opts.localOutputPath, function(bundles){ //Get the generated bundle timestamps
				workflow.existingBundles = bundles;
				async.each(types, function(type, nextType){ //For each asset type we know of
					async.some(sources[type], function(asset, nextAsset){ //Now, for each of the sources we have
						//console.log('\t\t\tchecking if ' + asset.name + ' is more recent than the bundle. ' + (time === -1 || asset.timestamp > time));
						nextAsset(!bundles.types[type] || asset.timestamp > bundles.types[type].time); //Is one of them more recent than our asset bundle?
					}, function(shouldRecreate){ //Should we regenerate the bundle?
						log.debug((shouldRecreate ? 'WILL' : 'WON\'T') + ' recreate asset bundle for ' + type);
						if(shouldRecreate){
							workflow.create.push(type); //If so, we'll add it to the workflow
							util.removeLocalBundles(bundles.types[type], nextType) //Clear any remants and move on to the next type
						}
						else nextType(); //Not sure I need to comment about this.
					});
				}, function(){ //Now we are finished checking what we need to regenerate.
					done(null, workflow); //Pass on the workflow.
				}); 
			});
		},

		function shouldReuploadBundles(workflow, done){
			log.info('about to sync with S3');
			if(workflow.create.length === types.length) {
				log.warn('we need to recreate everything, dumping bucket and skipping sync');
				transport.removeAllBundles(function(err){
					if(err) throw err;
					return done(err, workflow);
				});
			}
			else transport.listRemoteBundles(true, function(remoteBundles){
				var localKeys = Object.keys(workflow.existingBundles.keys);
				if(localKeys.length < Object.keys(remoteBundles).length){
					log.error('Uh oh! serious mismatch detected. Removing all bundles on remote and reuploading.');
					transport.removeAllBundles(function(err){
						if(err) throw err;
						return done(err, workflow);
					});
				}
				else {
					async.each(localKeys, function(localBundleKey, next){
						if(workflow.create.indexOf(util.getExtension(localBundleKey)) !== -1){
							log.warn('recreating ' + util.getExtension(localBundleKey) + ' so going to remove stale version');
							transport.removeBundle(localBundleKey, next);
						}else{
							var localBundle = workflow.existingBundles.keys[localBundleKey];
							var remoteBundle = remoteBundles[localBundleKey];
							log.silly('about ' + localBundleKey + ' on remote: ' + remoteBundle + ' on local: ' + localBundle);
							if(!remoteBundle) {
								log.warn('file does not exist on remote, uploading');
								transport.uploadLocalFile(localBundleKey, path.join(top.opts.localOutputPath, localBundleKey), next);
							}else if(remoteBundle < localBundle){
								log.warn('remote is behind local, reuploading.')
								transport.removeAndReupload(remoteBundle, localBundleKey, next);
							}else if(remoteBundle > localBundle){
								throw 'NOT GOOD! remote is ahead of local';
							}else{
								log.debug('remote and local SYNCED for ' + localBundleKey);
								next();
							}
						}
					}, function(err){
						if(workflow.create.length === 0) return done('nothing to process');
						done(err, workflow);
					});
				}
			})
		},
		
		function doHandleAssetGroups(workflow, done){
			log.info('about to handle asset groups');
			workflow.compiled = {plain: {}, gzipped: {}}; //intialize 2 groups for assets
			async.each(workflow.create, function eachAssetGroup(type, next){ //For each of the stale assets
				top.handleAssetGroup(type, workflow.sources[type], function finishHandleAssetGroup(err, result){ //Handle this asset group
					if(err) return next(err);
					workflow.compiled.plain[type] = {code: result, type: type, encoding: '', timestamp: util.getTimestamp()}; //add the compiled asset to the object
					next();
				});
			}, function finishDoHandleAssetGroup(err){
				done(err, workflow);
			});
		},
		function doGzip(workflow, done){
			log.info('zipping a copy of every asset');
			async.each(workflow.create, function zipEachAsset(type, next){
				zlib.gzip(workflow.compiled.plain[type].code, function(err, result){
					if(err) return done(err);
					workflow.compiled.gzipped[type] = {code: result, type: type, encoding: 'gzip', timestamp: util.getTimestamp()};
					next();
				});
			}, function(err){
				done(err, workflow);
			});
		},

		function doWriteAndUpload(workflow, done){
			log.info('writing finialized assets to local storage and S3');
			top.output = {};
			async.each(encodings, function groupEncodingTypes(encoding, nextGroup){
				top.output[encoding] = {};
				async.each(workflow.create, function writeAssetFile(key, nextAsset){
					var thisFile = workflow.compiled[encoding][key];
					log.debug('writing ' + thisFile.type + ' compound (encoding ' + (thisFile.encoding || 'none') + ')');
					var remoteFileKey = top.getRemoteFileKey(thisFile);
					var localFilename = top.getLocalFilename(thisFile);
					top.output[encoding][key] = {remote: remoteFileKey, local: localFilename};
					async.waterfall([
						async.apply(transport.uploadBundleObject, remoteFileKey, thisFile),
						async.apply(fs.writeFile, localFilename, thisFile.code)
					], nextAsset);
				}, nextGroup);
			}, function(err){
				done(err, workflow);
			})	
		},

		function stowResults(workflow, done){
			delete workflow;
			done();
		}

	], finish)
};

Cargomaster.prototype.treader = function treader(callback){
	var assets = {js: [], css: []};
	var walker = walk.walk(top.opts.localSourcePath, {});

	walker.on('file', function handleWalkedFile(container, info, next){
		var file = {path: path.join(container, info.name), name: info.name, type: util.getExtension(info.name), timestamp: info.mtime};
		if(/js|css/.test(file.type)) assets[file.type].push(file);
		next();
	});

	walker.on('end', function(){
		callback(null, assets);
	});
};

Cargomaster.prototype.initLocalDirectories = function initLocalDirectories(callback) {
	var localOutputPath = top.opts.localOutputPath, localSourcePath = top.opts.localSourcePath;
	fs.mkdir(localOutputPath, function(err){
		//if(err) console.dir(err);
		fs.mkdir(localSourcePath, function(err){
			//if(err) console.dir(err);
			callback();
		})
	});
};

Cargomaster.prototype.handleAssetGroup = function handleAssetGroup(type, assets, callback){
	if(type === 'js') return handler.scripts(assets, callback);
	if(type === 'css') return handler.styles(assets, callback);
	
	throw new Error('unrecognized asset type ' + type);		
};

Cargomaster.prototype.getLocalFilename = function getLocalFilename(file){
	return path.join(top.opts.localOutputPath, (top.opts.bundlePrefix + '_' + file.timestamp + '.min.' + (file.encoding === 'gzip' ? 'gz.' : '') + file.type));
};

Cargomaster.prototype.getRemoteFileKey = function getRemoteFileKey(file){
	return top.opts.dirs.remoteDirPrefix + top.opts.bundlePrefix + '_' + file.timestamp + '.min.' + (file.encoding === 'gzip' ? 'gz.' : '') + file.type;
}

Cargomaster.prototype.render = function(bundle) {
	var url = 'https://s3.amazonaws.com/' + top.opts.s3.bucket + '/';
	if(bundle === 'js'){
		return '<script src="' + url + top.output.gzipped.js.remote + '"></script>';
	}
};

module.exports = Cargomaster;