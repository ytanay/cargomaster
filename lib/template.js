var Template = module.exports = {

	getTag: function getTag(type, base, name){
		return '<' + type + ' ' + Template.getLinkAttrName(type) + Template.getLink(base, name, type) + '" ' + Template.getTagAttr(type) + '>' + Template.getClosingTag(type);	
	},

	getLink: function getLink(base, name, type){
		if(!name){
			var lib = base.split('@');
			name = lib[0];
			var version = lib[1] || 'latest';
			return Template.getCDNLink(name, version, type);
		}else{
			return '/' + base + '/' + name;
		}
	},

	getCDNLink: function getCDNLink(name, version, type){
		if(name === 'jquery') return Template.CDNLinks.GoogleCDN('jquery', version);
		if(name === 'angular' || name === 'angularjs') return Template.CDNLinks.GoogleCDN('angularjs', version, 'angular');
		if(name === 'bootstrap') return Template.CDNLinks.BootstrapCDN((type === 'script' ? 'js' : 'css'), version);
	},
	
	getTagAttr: function(type){
		if(type === 'script') return 'type="text/javascript"';
		if(type === 'link') return 'rel="stylesheet"';
	},

	getLinkAttrName: function(type){
		if(type === 'script') return 'src="';
		if(type === 'link') return 'href="';
	},

	getClosingTag: function(type){
		if(type === 'script') return '</script';
		if(type === 'link') return '';
		return '</' + type + '>';
	},

	CDNLinks: {
		GoogleCDN: function(name, version, file){
			return '//ajax.googleapis.com/ajax/libs/' + name + '/' + version + '/' + (file || name) + '.min.js'
		},

		BootstrapCDN:function(type, version){
			return '//netdna.bootstrapcdn.com/bootstrap/' + version + '/' + type + '/bootstrap.min.' + type;
		}
	}
}