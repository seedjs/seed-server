// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Cs     = require('core_support'),
    server = require('server'),
    cache  = require('cache');

/**
  Describes a single JSON model on disk
*/
var Record = Cs.extend({

  kind: 'records',
  
  isOpen: false,
  
  init: function(id) {
    this.id   = id;
    this.path = this.pathForId(id);
    this.open = Cs.once(this.open);
  },
  
  url: function() {
    return '/seed/'+this.kind+'/'+this.id;
  },
  
  indexPath: function() {
    return Cs.path.join(server.root, this.kind);
  },
  
  pathForId: function(id) {
    return Cs.path.join(this.indexPath(), id+'.json');
  },
  
  idForPath: function(path) {
    return Cs.path.filename(path).slice(0,-5);
  },
  
  cacheKeyForId: function(id, sub) {
    var keyCache, kindCache, idCache, ret,
        kind = this.kind;

    keyCache = Record._keyCache;
    if (!keyCache) keyCache = Record._keyCache = {};

    kindCache = keyCache[kind];
    if (!kindCache) kindCache = keyCache[kind] = {};

    idCache = kindCache[id];
    if (!idCache) idCache = kindCache[id] = {};

    ret = idCache[sub];
    if (!ret) ret = idCache = ('::record:' + kind + ':' + id + ':' + sub);
    return ret;
  },
  
  revision: function(done) {
    Cs.fs.stats(this.pathForId(this.id), function(err, stats) {
      if (err) return done(err);
      return done(null, stats ? stats.mtime : 1);
    });
  },

  // called when a new record is created.  populates with data.  return 
  // and error to done if data is invalid
  prepare: function(data, done) { 
    this.data = Cs.mixin({}, data); 
    this.data.id = this.id;
    this.isOpen = true;
    return done();
  },
  
  // reads the JSON from disk and invokes callback once read
  open: function(done) {
    var rec = this;
    if (this.isOpen) return done(null, this);
    server.readJson(rec.path, function(err, data) {
      if (err) return done(err);
      rec.data = data;
      rec.isOpen = true;
      return done(null, rec);
    });
  },
  
  // writes the JSON back to disk and invokes callback once complete
  write: function(done) {
    var rec = this;
    this.open(function(err) {
      if (err) return done(err);
      server.writeJson(rec.path, rec.data, function(err) {
        cache.remove(rec.cacheKeyForId(rec.id, 'revision'));
        cache.remove(rec.cacheKeyForId('$ALL$', 'revision'));
        
        if (err) return done(err);
        else return done(null, rec);
      });
    });
  },
  
  // destroys the record if it exists on disk
  destroy: function(done) {
    var path = this.path;
    Cs.fs.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) Cs.fs.rm_r(path, function(err) { return done(err, this); });
      else return done(null, this);
    });
  },
  
  // ..........................................................
  // STANDARD FORMATTING
  // 
  
  indexJson: function(currentUser) {
    if (!this.isOpen) throw "record must be open before getting index";
    var ret = Cs.mixin({}, this.data);
    ret['link-self'] = this.url();
    return ret;
  },
  
  showJson: function(currentUser) {
    return this.indexJson(currentUser);
  }
  
  
}); 

/**
  Finds the latest revision for the named record id
*/
Record.revision = function(id, done) {
  var key = this.prototype.cacheKeyForId(id, 'revision');
  cache.read(key, function(done) {
    Record.find(id, function(err, rec) {
      if (err) return done(err);
      if (!rec) return done(null, 1);
      return rec.revision(done);
    });
  }, done);
};

/**
  Finds the latest revision for all records of this type
*/
Record.latestRevision = function(done) {
  var key = this.prototype.cacheKeyForId('$ALL$', 'revision');
  cache.read(key, function(done) {
    Record.findAll(function(err, recs) {
      if (err) return done(err);
      var max = 0;
      Cs.each(recs, function(rec, done) {
        rec.revision(function(err, rev) {
          if (err) return done(err);
          if (rev>max) max = rev;
        });
      })(function(err) {
        if (err) return done(err);
        return done(null, max);
      });
    });
  }, done);
};

/**
  Finds an individual record.  Copy to subclasses
*/
Record.find = function(id, done) {
  var RecordType = this;
  var path = RecordType.prototype.pathForId(id);
  Cs.fs.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) return (new RecordType(id)).open(done);
    else return done(null, null);
  });
};

/**
  Finds all records in the database
*/
Record.findAll = function(done) {
  var RecordType =this;
  var path = RecordType.prototype.indexPath();
  Cs.fs.glob(path, function(err, ids) {
    if (err) return done(err);
    if (!ids) ids = [];
    Cs.collect(ids, function(id, done) { 
      id = id.slice(0,-5); // strip .json
      RecordType.find(id, done); 
    })(done);
  });
};

Record.create = function(id, data, done) {
  var RecordType = this;
  var path = RecordType.prototype.pathForId(id);
  Cs.fs.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) return done(409); // Conflict
    else return RecordType.replace(id, data, done);
  });
};

Record.replace = function(id, data, done) {
  var RecordType = this;
  var ret = new RecordType(id);
  ret.prepare(data, function(err) { 
    Cs.debug('prepared ' + ret.id);
    return done(err, ret); 
  });
};

var KEYS = 'find findAll create replace extend latestRevision revision'.split(' ');

Record.extend = function(ext) {
  var Rec = Cs.extend(this, ext);
  KEYS.forEach(function(key) { Rec[key] = this[key]; }, this);
  return Rec;
};

exports = module.exports = Record;