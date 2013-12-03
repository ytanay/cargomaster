cargomaster (formerly assetmaster)
===========

Cargomaster is an intelligent, fast, effecient and reliable asset manager for Node.js.

It will **group, concat, minify, optimize, compress and bundle** your static assets. It will version them and store them. It will upload the bundles to [AWS S3]() (or a different service of your choice), and serve them through [CloudFront]() (or a different CDN of your choice). It will automatically bring in libaries ([jQuery](http://jquery.com), [AngularJS](), [Bootstrap](), and so on) from any location you want ([Google's CDN](), yours, you name it) so you don't have to mess with local copies. 

Index
-----

- [What is Cargomaster?](#what-is-cargomaster)
- [What does it do?](#what-does-it-do)
- [Benefits](#benefits)
- [Extra features](#more-features)
- [The Pipeline](#the-pipeline)
- [The Helpers](#the-helpers)
- [Asset Types](#asset-types)
- [CDN deployment](#cdn-deployment)
- [Guide](#guide)
- [About](#about)

Before we start...
------------------

Tell me it isn't... easier on the eyes.

```js
//jade
!!!5
html
  head
    title look at all these assets!
    link(href='/assets/styles/bootstrap/bootstrap-3.0.0.min.css')
    link(href='/assets/styles/application/main_d51181e3f2d7.min.css')
    link(href='/assets/styles/application/login_page_1b8c5020ebe8.min.css')
    link(href='/assets/styles/application/reset_bed5b0d636f4.min.css')
  body
    p Quite a bit messier
    img(src='/assets/images/login_page/photo_of_an_attractive_woman_with_a_headset_representing_our_companys_excellent_customer_service.optimized.jpg')
    ...
    script(src='http://code.jquery.com/jquery-1.10.2.min.js')
    script(src='http://some-other-cdn.another-company/angular/latest/angularjs.min.js')
    script(src='/assets/scripts/bootstrap/bootstrap-3.0.0.min.js')
    script(src='/assets/scripts/application/master_41bb19eb6892.min.js')
    script(src='/assets/scripts/application/login_page_48b054a7dd44.min.js')
```
3... 2.. 1.. **cargomaster**!

```js
//jade with cargomaster
!!!5
html
  head
    title cargomaster is awesome!
    != cargo.styles(['bootstrap@3.0.0', 'bundle'])
  body
    p Look at this fancy page!
    != cargo.image('login/customer_service')
    != cargo.scripts(['jquery@1.9.1', 'bootstrap@3.0.0', 'bundle'])
```

What is Cargomaster?
--------------------
Managing static assets for your website or service is not particularly difficult.

It's just mind blowingly annoying and confusing.

There are a few packages that will minify your assets, and another one which will also bundle them, and yet another one which automatically uploads the processed assets to a CDN.

These packages are excellent in their own right, but they don't provide the bridge necessary to make them into a full asset managment solution. Attempting to patch them together is extremely cumbersome. argomaster attempts to solve this problem by providing a higly customizable, all in one module that is extremely transparent.

What does it do?
----------------

Cargomaster provides 2 linked components; a [pipeline](#the-pipeline) and a [set of helpers](#the-helpers).
### Case in point: ###

This is bad:

```html
  <script src="/assets/scripts/jquery-1.9.1.js" type="text/javascript"></script>
  <script src="/assets/scripts/fss.js" type="text/javascript"></script>
  <script src="/assets/scripts/custom.js" type="text/javascript"></script>
  <script src="/assets/scripts/gmaps.js" type="text/javascript"></script>
  <script src="/assets/scripts/parallax.js" type="text/javascript"></script>
  <script src="/assets/scripts/preloader.js" type="text/javascript"></script>
  <script src="/assets/scripts/timer.js" type="text/javascript"></script>
  <script src="/assets/scripts/tooltip.js" type="text/javascript"></script>
```

This is worse:

```html
  <script src="http://code.jquery.com/jquery-latest.min.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/fss.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/custom.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/gmaps.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/parallax.js" type="text/javascript"></script>
  ...
```

And this is just horrid:

```html
  <script src="http://code.jquery.com/jquery-latest.min.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/fss_5d91820ee16d.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/custom_48b054a7dd44.js" type="text/javascript"></script>
  <script src="http://a784dg49ktp43fg-cdn.provider.com/dist_name/assets/scripts/gmaps_1ba4e36ac124.js" type="text/javascript"></script>
  ...
```

This is just the tip of the iceberg (just javascript, and half of it cut off!). Things get very very messy very very quickly. Besides, all of these HTTP requests aren't doing anyone a favor. 

**Cargomaster can help you.**

How does it solve the problem?
----
Cargomaster is made out of two components; a pipeline, and a group of helpers. Each works independently to let you worry about your code and not about cache busting.

The Pipeline
------------
The pipeline is in charge of sorting through all of your static assets, manipulating them inteliigently. This includes concatenation, minifcation, optimizations, compression and bundling. This section explains exactly how the pipeline functions.
### During development ###
The pipeline remains very passive during development. In fact, it simply generates cache busters for your assets. The helper functions however, step in during this time!!!!!.
### During production ####
In production, the pipeline goes all out. Here is the general flow of things:

1. Scan the *'dist'* directory for exsisting bundles.
2. Scan the *'src'* directory for asset files, and compare timestamps to see if the bundle should be regenrated.
3. If the bundle needs to be recreated, call the appropriate handler for the bundle type. For example, if the javascript bundle needs to be recreated, cargomaster will look for *.js* files in the source directory, concat them, run them through the engine of your choice ([Closure Compiler](https://developers.google.com/closure/compiler/), [UglifyJS](https://github.com/mishoo/UglifyJS2), [YUI Compressor](http://yui.github.io/yuicompressor/), etc.)

More info (along with the working version) real soon!
