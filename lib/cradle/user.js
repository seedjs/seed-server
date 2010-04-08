// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================


var Cs = require('core-support');


var User = Cs.extend({

  init: function(db) {
    this.db = db;
  },
  
  id: null,
  
  data: null,

  isDirty: false,
  
  normalize: function(key, value, writing) {
    return value;
  },
  
  get: function(key) {
    var ret = this.data ? this.data : null;
    return this.normalize(key, ret);
  },
  
  set: function(key, value) {
    if (!this.data) this.data = {};
    value = this.normalize(key, value, true);
    this.data[key] = value;
    this.isDirty = true;
  },
  
  // read from the server...
  refresh: function(done) {
    var self = this;
    this.db.get(this.id, function(err, doc) {
      if (err) return done(err);
      if (doc) self.data = doc;
      self.isDirty= false;
      self._rev = doc._rev;
      return done(null, self);
    });
  },
  
  // write 
  update: function(force, done) {
    var self = this;
    if (!done && ('function' === typeof force)) {
      done = force;
      force = false;
    }
    
    if (!this.isDirty && !force) return done(null, false);
    this.db.save(this.id, this._rev, this.data, function(err) {
      if (err) return done(err);
      self.isDirty = false;
      return done(null, true);
    });
  },
  
  // destroy
  destroy: function(done) {
    var self = this;

    if (this.isDestroyed) return done();
    this.isDestroyed = true;
    this.db.remove(this.id, this._rev, function(err) {
      if (err) {
        self.isDestroyed = false;
        return done(err);
      }
      
      return done();
    });
  }
  
});
