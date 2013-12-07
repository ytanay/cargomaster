var async     = require('async'),
	handler   = require('./handler'),
	zlib      = require('zlib'),
	walk      = require('walk'),
	fs        = require('fs'),
	util      = require('./util'),
	template  = require('./template'),
	transport,
	path      = require('path');

var top;

function Cargomaster(opts){
	top = this;

	this.opts = require('./validate').opts(opts);
	this.log = opts.log;

	this.types = {
		bundles: ['js', 'css'],
		files: ['jpg', 'png'],
		encodings: ['plain', 'gzip']
	};

	var transportHandler = require('./transport');
	transport = new transportHandler(this.opts);

	if(this.opts.dirs.remoteDirPrefix.slice(-1) !== '/') this.opts.dirs.remoteDirPrefix += '/';

	this.pipeline(function(err){
		top.log.info('pipeline finished!');
		if(err) top.log.warn(err);
		dump(top.output);
		top.log.info('all done!');
	});

	top.log.silly('cargomaster object created');
}

Cargomaster.prototype.pipeline = function(finish) {
	top.log.info('starting cargomaster pipeline');
	async.waterfall([
		function initLocalDirs(done){
			fs.mkdir(top.opts.localOutputPath, function(err){ //We have to do this ugly mess because async complains when it gets errors.
				fs.mkdir(top.opts.localSourcePath, function(err){ //Cana"l
					fs.mkdir(top.opts.localBundlePath, function(err){
						fs.mkdir(top.opts.localProccesedPath, function(err){
							done(); //Yuck.
						});
					})
				})
			});
		},

		function doTreader(done){ //Get all the asset sources we recognize
			var walker = walk.walk(top.opts.dirs.publicDir, {});

			var files = {
				src: {
					js: {plugins: [], vendor: [], code: []}, 
					css: {plugins: [], vendor: [], code: []}, 
					jpg: [], 
					png: []
				},
				out: {
					bundles: {
						js: null,
						css: null
					},
					assets: {
						jpg: {},
						png: {}
					}
				}
			};

			walker.on('file', function handleWalkedFile(container, info, next){
				var block = util.parts.fetch('block', container);
				var file = {
					path: path.join(container, info.name), 
					name: info.name, 
					type: util.parts.fetch('extension', info.name), 
					timestamp: info.mtime.getTime()
				};

				if(file.type === 'js' || file.type === 'css') {
					if(block === 'bundles') { 
						if(/gz/.test(file.name)){
							file.id = util.parts.fetch('id', file.name);
							files.out.bundles[file.type] = file; 
						}
					} else if(block === 'plugins' || block === 'vendor') {
						files.src[file.type][block].push(file);
					} else {
						files.src[file.type].code.push(file);
					}
				}else if(file.type === 'png' || file.type === 'jpg') {
					if(util.parts.fetch('processed', container)){
						file.id = util.parts.fetch('id', file.name);
						files.out.asset[file.type][file.path] = file;
					}
					else
						files.src[file.type].push(file);
				}
				top.log.debug('added %s, of block %s', file.name, block);
				next();
			});

			walker.on('end', function(){
				files.src.js = files.src.js.plugins.concat(files.src.js.vendor, files.src.js.code),
				files.src.css =  files.src.css.plugins.concat(files.src.css.vendor, files.src.css.code),
				dump(files);
				done(null, files);
			});
		},

		function initWorkflow(files, done){
			done(null, {
				files: files,
				recreate: {
					bundles: [],
					assets: []
				}
			});
		},

		function getBundlesToRegenerate(workflow, done){
			async.each(top.types.bundles, function(bundleKey, nextBundle){
				var bundle = workflow.files.out.bundles[bundleKey];
				if(!bundle || !bundle.id){
					top.log.info('no bundle for %s, recreating', bundleKey);
					workflow.recreate.bundles.push(bundleKey);
					return nextBundle();
				}
				async.some(workflow.files[bundleKey], function(asset, nextAsset){
					top.log.silly('asset %s is %s than bundle of %s', asset.name, (asset.timestamp > bundle.id) ? 'NEWER' : 'OLDER', bundleKey);
					nextAsset(asset.timestamp > bundle.id);
				}, function(regenerate){
					if(regenerate){
						top.log.info('recreating bundle for %s', bundleKey);
						workflow.recreate.bundles.push(bundleKey);
					}else{
						top.log.info('NOT recreating bundle for %s', bundleKey);
					}
					nextBundle();
				});
			}, function(){
				//console.dir(workflow);
				done(null, workflow);
			})
		},

		function getAssetsToReprocess(workflow, done){
			async.each(top.types.files, function(type, nextType){
				var assets = workflow.files.src[type];
				async.each(assets, function(asset, nextAsset){
					var processed = workflow.files.out.assets[type][assets.path];
					/** TODO: merge this two once testing id done */
					if(!processed || processed.id){
						top.log.info('no processed file of %s, recreating', asset.name);
						workflow.recreate.assets.push(asset);
						return nextAsset();
					}
					if(asset.timestamp > processed.id){
						top.log.info('processed file of %s is OLDER than processed file, recreating', asset.name);
						workflow.recreate.assets.push(asset);
						return nextAsset();
					}
					top.log.inf('processed file of %s is UP TO DATE', asset.name);
					return nextAsset();
				}, nextType);
			}, function(){
				dump(workflow);
			})
		},
/*
		function getBundlesToRegenerate(workflow, done){
			top.log.info('checking which assets to regenerate');
			util.getLocalBundles(top.opts.localBundlePath, function(bundles){ //Get the generated bundle timestamps
				workflow.currentBundles = bundles;
				top.output = bundles.output;
				async.each(bundleTypes, function(type, nextType){ //For each bundle type we know of
					async.some(sources[type], function(asset, nextAsset){ //For each of the sources we have
						nextAsset(!bundles.types[type] || asset.timestamp > bundles.types[type].time || bundles.types[type].paths.length < 2); //Is one of them more recent than our asset bundle?
					}, function(shouldRecreate){ //Should we regenerate the bundle?
						top.log.debug((shouldRecreate ? 'WILL' : 'WON\'T') + ' recreate asset bundle for ' + type);
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
		},*

		function shouldReprocessAssets(workflow, done){
			top.log.info('checking which assets to reporcess');
			util.getProcessedAssets(top.opts.localProccesedPath, function(assets){ //Get the generated bundle timestamps
				workflow.currentAssets = assets;
				top.output.plain.jpg = assets.output.plain.jpg;
				top.output.plain.png = assets.output.plain.png;
				top.output.gzip.jpg = assets.output.gzip.jpg;
				top.output.gzip.png = assets.output.gzip.png;
				async.each(assetTypes, function(type, nextType){ //For each asset type we know of
					
					}, function(shouldRecreate){ //Should we reprocess the asset?
						top.log.debug((shouldRecreate ? 'WILL' : 'WON\'T') + ' recreate asset bundle for ' + type);
						if(shouldRecreate){
							workflow.create.push(type); //If so, we'll add it to the workflow
							util.removeLocalBundles(bundles.types[type], nextType) //Clear any remants and move on to the next type
						}
						else nextType(); //Not sure I need to comment about this.
					});
				/*}, function(){ //Now we are finished checking what we need to regenerate.
					done(null, workflow); //Pass on the workflow.
				});*
			});
		},*/

		function shouldReuploadBundles(workflow, done){
			top.log.info('about to sync with S3');
			if(workflow.create.length === types.length) {
				top.log.warn('we need to recreate everything, dumping bucket and skipping sync');
				transport.removeAllBundles(function(err){
					if(err) throw err;
					return done(err, workflow);
				});
			}
			else transport.listRemoteBundles(true, function(remoteBundles){
				var localKeys = Object.keys(workflow.existingBundles.keys);
				if(localKeys.length < Object.keys(remoteBundles).length){
					top.log.error('Uh oh! serious mismatch detected. Removing all bundles on remote and reuploading.');
				//	transport.removeAllBundles(function(err){
				//		if(err) throw err;
				//		return done(err, workflow);
				//	});
				}
				//else {
					async.each(localKeys, function(localBundleKey, next){
						if(workflow.create.indexOf(util.getExtension(localBundleKey)) !== -1){
							top.log.warn('recreating ' + util.getExtension(localBundleKey) + ' so going to remove stale version');
							transport.removeBundle(localBundleKey, next);
						}else{
							var localBundle = workflow.existingBundles.keys[localBundleKey];
							var remoteBundle = remoteBundles[localBundleKey];
							top.log.silly('about ' + localBundleKey + ' on remote: ' + remoteBundle + ' on local: ' + localBundle);
							if(!remoteBundle) {
								top.log.warn('file does not exist on remote, uploading');
								transport.uploadLocalFile(top.getRemoteFileKey(localBundleKey), path.join(top.opts.localOutputPath, localBundleKey), next);
							}else if(remoteBundle < localBundle){
								top.log.warn('remote is behind local, reuploading.')
								transport.removeAndReupload(remoteBundle, localBundleKey, next);
							}else if(remoteBundle > localBundle){
								throw 'NOT GOOD! remote is ahead of local';
							}else{
								top.log.debug('remote and local SYNCED for ' + localBundleKey);
								next();
							}
						}
					}, function(err){
						if(workflow.create.length === 0) {
							done('nothing to process')
						}
						done(err, workflow);
					});
				//}
			})
		},
		
		function doHandleAssetGroups(workflow, done){
			top.log.info('about to handle asset groups');
			workflow.compiled = {plain: {}, gzip: {}}; //intialize 2 groups for assets
			async.each(workflow.create, function eachAssetGroup(type, next){ //For each of the stale assets
				handler.handle(type, workflow.sources[type], function finishHandleAssetGroup(err, result){ //Handle this asset group
					if(err) return done(err);
					workflow.compiled.plain[type] = {code: result, type: type, encoding: '', timestamp: util.getTimestamp()}; //add the compiled asset to the object
					next();
				});
			}, function finishDoHandleAssetGroup(err){
				done(err, workflow);
			});
		},
		function doGzip(workflow, done){
			top.log.info('zipping a copy of every asset');
			async.each(workflow.create, function zipEachAsset(type, next){
				zlib.gzip(workflow.compiled.plain[type].code, function(err, result){
					if(err) return done(err);
					workflow.compiled.gzip[type] = {code: result, type: type, encoding: 'gzip', timestamp: util.getTimestamp()};
					next();
				});
			}, function(err){
				done(err, workflow);
			});
		},

		function doWriteAndUpload(workflow, done){
			top.log.info('writing finialized assets to local storage and S3');
			async.each(encodings, function groupEncodingTypes(encoding, nextGroup){
				async.each(workflow.create, function writeAssetFile(key, nextAsset){
					var thisFile = workflow.compiled[encoding][key];		
					var bundleFilename = util.generateBundleFilename(top.opts.bundlePrefix, thisFile);
					top.output[encoding][key] = bundleFilename;
					top.log.debug('writing ' + thisFile.type + ' compound (encoding ' + (thisFile.encoding || 'none') + ')');
					async.waterfall([
						async.apply(transport.uploadBundleObject, top.getRemoteFileKey(bundleFilename), thisFile),
						async.apply(fs.writeFile, top.getLocalFilename(bundleFilename), thisFile.code)
					], nextAsset);
				}, nextGroup);
			}, function(err){
				done(err, workflow);
			})	
		},

		function cleanup(workflow, done){
			delete workflow;
			done();
		}
	], finish)
};

Cargomaster.prototype.getLocalFilename = function getLocalFilename(id){
	return path.join(top.opts.localOutputPath, id);
};

Cargomaster.prototype.getRemoteFileKey = function getRemoteFileKey(id){
	return top.opts.dirs.remoteDirPrefix + id;
}

Cargomaster.prototype.getHandler = function() {
	return {
		scripts: function(list){
			var results = '';
			for (var i = 0; i < list.length; i++) {
				var script = list[i];
				if(script === 'bundle')
					results += template.getTag('script', top.opts.basePath, top.output.plain.js);
				else
					results += template.getTag('script', script);
			};
			return results;
		},
		styles: function(list){
			var results = '';
			for (var i = 0; i < list.length; i++) {
				var style = list[i];
				if(style === 'bundle')
					results += template.getTag('link', top.opts.basePath, top.output.plain.css);
				else
					results += template.getTag('link', style);
			};
			return results;
		},
		image: function(image){
			return template.getTag('img', top.opts.basePath, image);
		}
	};
};

function dump(obj){
	console.log(require('util').inspect(obj, false, 10));
}

module.exports = Cargomaster;