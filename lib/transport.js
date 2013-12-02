var aws = require('aws-sdk'),
	fs = require('fs'),
	async = require('async'),
	util = require('./util');

var top;

function Transport(opts){
	aws.config.update({
		"accessKeyId": opts.s3.accessKey,
		"secretAccessKey": opts.s3.secret
	});

	top = this;

	this.opts = opts;
	this.S3 = new aws.S3();
	this.types = {
		'jpg': 'image/jpeg',
		'png': 'image/png',
		'css': 'text/css',
		'js': 'text/javascript'
	}
}

Transport.prototype.uploadBundleObject = function uploadBundleObject(name, contents, done){
	top.S3.putObject({
		Bucket: top.opts.s3.bucket,
		Body: contents.code,
		Key: name,
		ContentType: top.types[contents.type],
		ACL: 'public-read',
		ContentEncoding: contents.encoding
	}, done);
};

Transport.prototype.uploadLocalFile = function uploadLocalFile(key, path, done){
	async.waterfall([
		async.apply(fs.readFile, path),
		function(file, callback){
			top.S3.putObject({
				Bucket: top.opts.s3.bucket,
				Body: file,
				Key: key,
				ContentType: top.types[util.getExtension(key)],
				ACL: 'public-read',
				ContentEncoding: util.getEncodingByFilename(key)
			}, callback);
		}
	], done)
};

Transport.prototype.listRemoteBundles = function listRemoteBundles(transform, done){
	if(typeof done !== 'function'){
		done = transform;
		transform = false;

	}
	top.S3.listObjects({
		Bucket: top.opts.s3.bucket,
		Prefix: top.opts.dirs.remoteDirPrefix + top.opts.bundlePrefix
	}, function(err, bundles){
		if(err) throw err;
		var results = {};
		if(transform){
			for (var i = 0; i < bundles.Contents.length; i++) {
				results[bundles.Contents[i].Key.replace(top.opts.dirs.remoteDirPrefix, '')] = /([0-9]+)/.exec(bundles.Contents[i].Key)[0];
			}
		}else results = bundles;
		done(results);
	});
};

Transport.prototype.listObjects = function listObjects(prefix, done){
	if(typeof done !== 'function'){
		done = prefix;
		prefix = '';
	}
	top.S3.listObjects({
		Bucket: top.opts.s3.bucket,
		Prefix: prefix
	}, done);

};

Transport.prototype.removeBundle = function removeBundle(key, done){
	top.S3.deleteObject({
		Bucket: top.opts.s3.bucket,
		Key: key
	}, done);
};

Transport.prototype.removeAllBundles = function removeAllBundles(done){
	async.waterfall([
		async.apply(top.listObjects, top.opts.dirs.remoteDirPrefix),
		function(objects, callback){
			if(objects.Contents.length === 0) return done();
			var deletionList = [];
			for (var i = 0; i < objects.Contents.length; i++)
				deletionList[i] = {Key: objects.Contents[i].Key};
			top.S3.deleteObjects({
				Bucket: top.opts.s3.bucket,
				Delete: {
					Objects: deletionList
				}
			}, callback);
		}
	], done);
};

module.exports = Transport;