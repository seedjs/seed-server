// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals Cs CORE Record */

"import core-support";
"import core as CORE";
"export Record";

Record = Cs.extend({
  
  init: function(id, doc, _rev) {
    this.id = id;
    this._normalized = {};

    if (doc) {
      this.doc = doc || {};
      this.rev = _rev;
      this.state = Record.READY;
    } else {
      this.state = Record.NEW;
    }
    
  },
  
  // must be defined
  databaseName: null,
  
  REQUIRED_KEYS: [],
  
  // attribute normalization
  normalize: function(key, value, currentUser, writing) {
    return value;
  },
  
  // used to initialize a new record.  Assigns any passed keys as well as any
  // required keys
  setup: function(doc) {
    var self = this;
    
    if (this.state !== Record.NEW) throw new Error('Must be new record'); 
    this.doc = {};
    this._normalized = {};
    
    var keys = Object.keys(doc);
    this.REQUIRED_KEYS.forEach(function(k) {
      if (keys.indexOf(k)<0) keys.push(k);
    });
    
    keys.forEach(function(k) {
      self.doc[k] = self._normalized[k] = self.normalize(k, doc[k], true);
    });

    return this;
  },
  
  get: function(key, currentUser) {
    if (key === 'id') return this.id;
    if (key in this._normalized) return this._normalized[key];
    this._normalized[key] = this.normalize(key, this.doc[key], currentUser, false);
    return this._normalized[key];
  },
  
  set: function(key, value, currentUser) {
    if (key === 'id') {
      this.id = value;
      return this;
    }
    
    if (this.state === Record.DESTROYED) {
      throw new Error("Cannot modify destroyed record");
    }
    
    value = this.normalize(key, value, currentUser, true);
    this._normalized[key] = this.doc[key] = value;
    this.isDirty = true;
    return this;
  },

  // updates the record for the current user.  Pass through normalization
  modify: function(currentUser, attrs) {
    Object.keys(attrs).forEach(function(key) {
      this.set(key, attrs[key], currentUser);
    }, this); 
    return this;
  },
  
  refresh: function(done) {
    if (!done) done = function() {};

    var self = this;
    CORE.db(this.databaseName).get(this.id, function(err, doc) {
      if (err) return done(err);
      self.doc = doc;
      self._normalized = {};
      self.isDirty = false;
      self.state = Record.READY;
      return done(null, this);
    });
  },
  
  url: function() {
    return '/seed/'+this.databaseName+'/'+this.id;  
  },
  
  // ..........................................................
  // DESTROY AND CALLBACKS
  // 

  destroy: function(done) {
    if (!done) done = function() {};

    var self = this;
    if (this.state === Record.DESTROYED) return done(null, false); // done
    
    self.willDestroy(function(err) {
      if (err) return done(err);
      if (self.state === Record.READY) {
        CORE.db(self.databaseName).remove(self.id, self.rev, function(err) {
          if (err) return done(err);
          self._cleanupAfterDestroy(done);
        });

      // new state...
      } else if (self.state === Record) {
        self._cleanupAfterDestroy(done);
      }
    });
  },
  
  _cleanupAfterDestroy: function(done) {
    this.doc = this._normalized = {};
    this.state = Record.DESTROYED;
    this.didDestroy(function(err) {
      if (err) return done(err);
      return done(null, true);
    });
  },
  
  willDestroy: function(done) { return done(); },
  didDestroy: function(done)  { return done(); },

  // ..........................................................
  // COMMITTING
  // 

  commit: function(done) {
    if (!done) done = function() {};
    
    if (this.state === Record.DESTROYED) {
      return done(new Error('Cannot commit destroyed record'));
    }
     
    var self = this;
    self.willCommit(function(err) {
      if (err) return done(err);
      
      var next = function(err) {
        if (err) return done(err);
        self.didCommit(done);
      };
      
      if (self.state === Record.NEW) self.create(next);
      else if (self.state === Record.READY) self.update(next);
      else return done(new Error('cannot commit in state '+self.state));
      
    });
    
    return this;
  },
  
  create: function(done) {
    if (!done) done = function() {};

    var db = CORE.db(this.databaseName),
        self = this;

    self.willCreate(function(err) {
      if (err) return done(err);
      db.insert(self.id, self.doc, function(err, res) {
        if (err) return done(err);
        self.rev = res.rev;
        self.id  = res.id;
        Cs.debug('Create: '+Cs.inspect(res));
        self.state = Record.READY;
        self.isDirty = false;
        self.didCreate(done);
      });
    });

    return this;
  },

  update: function(done) {
    if (!done) done = function() {};

    var db = CORE.db(this.databaseName),
        self = this;

    self.willUpdate(function(err) {
      db.save(self.id, self.rev, self.doc, function(err, res) {
        if (err) return done(err);
        Cs.debug('update: '+Cs.inspect(res));
        self.rev = res.rev;
        self.id  = res.id;
        self.isDirty = false;
        self.didUpdate(done);
      });
    });
    
  },
  
  willCommit: function(done) { return done(); },
  didCommit: function(done)  { return done(); }, 

  willCreate: function(done) { return done(); },
  didCreate: function(done)  { return done(); }, 
  
  willUpdate: function(done) { return done(); },
  didUpdate: function(done)  { return done(); }
  
});

Record.create = function(id, doc) {
  var Rec = this,
      ret = new Rec(id);
      
  ret.setup(doc);
  return ret ;
};

Record.extend = function(attrs) {
  var Ret = Cs.extend(this, attrs);
  Ret.create = this.create;
  Ret.extend = this.extend;
  Ret.find   = this.find;
  Ret.findAll = this.findAll;
  return Ret ;
};

Record.find = function(id, done) {
  var db = CORE.db(this.prototype.databaseName),
      Rec = this;
      
  db.get(id, function(err, doc) {
    if (!err && !doc) err = new Error(id+' not found');
    if (err) return done(err);
    return done(null, new Rec(id, Cs.mixin({}, doc), doc._rev));
  });
  
};

Record.findAll = function(done) {
  var db = CORE.db(this.prototype.databaseName),
      Rec = this;
  db.all({ include_docs: true }, function(err, res) {    
    if (!err && !res) {
      err = new Error(Rec.prototype.databaseName+' not found');
    }
    if (err) return done(err);
    res = res.rows.map(function(row) { 
      row = row.doc;
      return new Rec(row._id, Cs.mixin({}, row), row._rev);
    });
    return done(null, res);
  });
};


Record.NEW = 'new';
Record.READY = 'ready';
Record.DESTROYED = 'destroyed';
Record.COMMITTING = 'committing';

// 
// var Cs     = require('core-support'),
//     server = require('server'),
//     cache  = require('cache');
// 
// /**
//   Describes a single JSON model on disk
// */
// var Record = Cs.extend({
// 
//   kind: 'records',
//   
//   isOpen: false,
//   
//   init: function(id) {
//     this.id   = id;
//     this.path = this.pathForId(id);
//     this.open = Cs.once(this.open);
//   },
//   
//   url: function() {
//     return '/seed/'+this.kind+'/'+this.id;
//   },
//   
//   indexPath: function() {
//     return Cs.path.join(server.root, this.kind);
//   },
//   
//   pathForId: function(id) {
//     return Cs.path.join(this.indexPath(), id+'.json');
//   },
//   
//   idForPath: function(path) {
//     return Cs.path.filename(path).slice(0,-5);
//   },
//   
//   cacheKeyForId: function(id, sub) {
//     var keyCache, kindCache, idCache, ret,
//         kind = this.kind;
// 
//     keyCache = Record._keyCache;
//     if (!keyCache) keyCache = Record._keyCache = {};
// 
//     kindCache = keyCache[kind];
//     if (!kindCache) kindCache = keyCache[kind] = {};
// 
//     idCache = kindCache[id];
//     if (!idCache) idCache = kindCache[id] = {};
// 
//     ret = idCache[sub];
//     if (!ret) ret = idCache = ('::record:' + kind + ':' + id + ':' + sub);
//     return ret;
//   },
//   
//   revision: function(done) {
//     Cs.fs.stats(this.pathForId(this.id), function(err, stats) {
//       if (err) return done(err);
//       return done(null, stats ? stats.mtime : 1);
//     });
//   },
// 
//   // called when a new record is created.  populates with data.  return 
//   // and error to done if data is invalid
//   prepare: function(data, done) { 
//     this.data = Cs.mixin({}, data); 
//     this.data.id = this.id;
//     this.isOpen = true;
//     return done();
//   },
//   
//   // reads the JSON from disk and invokes callback once read
//   open: function(done) {
//     var rec = this;
//     if (this.isOpen) return done(null, this);
//     server.readJson(rec.path, function(err, data) {
//       if (err) return done(err);
//       rec.data = data;
//       rec.isOpen = true;
//       return done(null, rec);
//     });
//   },
//   
//   // writes the JSON back to disk and invokes callback once complete
//   write: function(done) {
//     var rec = this;
//     this.open(function(err) {
//       if (err) return done(err);
//       server.writeJson(rec.path, rec.data, function(err) {
//         cache.remove(rec.cacheKeyForId(rec.id, 'revision'));
//         cache.remove(rec.cacheKeyForId('$ALL$', 'revision'));
//         
//         if (err) return done(err);
//         else return done(null, rec);
//       });
//     });
//   },
//   
//   // destroys the record if it exists on disk
//   destroy: function(done) {
//     var path = this.path;
//     Cs.fs.exists(path, function(err, exists) {
//       if (err) return done(err);
//       if (exists) Cs.fs.rm_r(path, function(err) { return done(err, this); });
//       else return done(null, this);
//     });
//   },
//   
//   // ..........................................................
//   // STANDARD FORMATTING
//   // 
//   
//   indexJson: function(currentUser) {
//     if (!this.isOpen) throw "record must be open before getting index";
//     var ret = Cs.mixin({}, this.data);
//     ret['link-self'] = this.url();
//     return ret;
//   },
//   
//   showJson: function(currentUser) {
//     return this.indexJson(currentUser);
//   }
//   
//   
// }); 
// 
// /**
//   Finds the latest revision for the named record id
// */
// Record.revision = function(id, done) {
//   var key = this.prototype.cacheKeyForId(id, 'revision');
//   cache.read(key, function(done) {
//     Record.find(id, function(err, rec) {
//       if (err) return done(err);
//       if (!rec) return done(null, 1);
//       return rec.revision(done);
//     });
//   }, done);
// };
// 
// /**
//   Finds the latest revision for all records of this type
// */
// Record.latestRevision = function(done) {
//   var key = this.prototype.cacheKeyForId('$ALL$', 'revision');
//   cache.read(key, function(done) {
//     Record.findAll(function(err, recs) {
//       if (err) return done(err);
//       var max = 0;
//       Cs.each(recs, function(rec, done) {
//         rec.revision(function(err, rev) {
//           if (err) return done(err);
//           if (rev>max) max = rev;
//         });
//       })(function(err) {
//         if (err) return done(err);
//         return done(null, max);
//       });
//     });
//   }, done);
// };
// 
// /**
//   Finds an individual record.  Copy to subclasses
// */
// Record.find = function(id, done) {
//   var RecordType = this;
//   var path = RecordType.prototype.pathForId(id);
//   Cs.fs.exists(path, function(err, exists) {
//     if (err) return done(err);
//     if (exists) return (new RecordType(id)).open(done);
//     else return done(null, null);
//   });
// };
// 
// /**
//   Finds all records in the database
// */
// Record.findAll = function(done) {
//   var RecordType =this;
//   var path = RecordType.prototype.indexPath();
//   Cs.fs.glob(path, function(err, ids) {
//     if (err) return done(err);
//     if (!ids) ids = [];
//     Cs.collect(ids, function(id, done) { 
//       id = id.slice(0,-5); // strip .json
//       RecordType.find(id, done); 
//     })(done);
//   });
// };
// 
// Record.create = function(id, data, done) {
//   var RecordType = this;
//   var path = RecordType.prototype.pathForId(id);
//   Cs.fs.exists(path, function(err, exists) {
//     if (err) return done(err);
//     if (exists) return done(409); // Conflict
//     else return RecordType.replace(id, data, done);
//   });
// };
// 
// Record.replace = function(id, data, done) {
//   var RecordType = this;
//   var ret = new RecordType(id);
//   ret.prepare(data, function(err) { 
//     Cs.debug('prepared ' + ret.id);
//     return done(err, ret); 
//   });
// };
// 
// var KEYS = 'find findAll create replace extend latestRevision revision'.split(' ');
// 
// Record.extend = function(ext) {
//   var Rec = Cs.extend(this, ext);
//   KEYS.forEach(function(key) { Rec[key] = this[key]; }, this);
//   return Rec;
// };
// 
// exports = module.exports = Record;