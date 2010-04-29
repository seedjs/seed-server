// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see LICENSE)
// ==========================================================================
/*globals Record User Token */

"import models/record";
"export User";

var Token;

User = Record.extend({  
  databaseName: 'users',
  REQUIRED_KEYS: ['name', 'email', 'password', 'groups'],
  
  normalize: function(key, value, currentUser, writing) {
    
    switch(key) {
      case 'groups':
        if (!value) value = ['guest'];
        if (!Array.isArray(value)) {
          if ('string' === typeof value) value = [value];
          else value = [];
        }
        break;
    }
    return value;
  },
  
  tokens: function(done) {
    var username = this.get('id');
    Token.findAll(function(err, tokens) {
      if (err) return done(err);
      tokens = tokens.filter(function(t) {
        return t.get('username') === username;
      });
      return done(null, tokens);
    });
  },
  
  modify: function(currentUser, attrs) {
    
  },
  
  // ..........................................................
  // PERMISSIONS
  // 

  inGroup: function(groupName) {
    return this.get('groups').indexOf(groupName)>=0;
  },
  
  hasUsername: function(id) {
    return this.get('id') === id;  
  },
  
  isEqual: function(user) {
    return this.hasUsername(user.get('id'));
  },
  

  canSeeAllTokens: function() {
    return this.inGroup('admin');
  },
  
  canSeeTokensForUser: function(user) {
    return (!this.hasUsername('anonymous') && 
            (this.isEqual(user) || this.inGroup('admin')));
  },
  
  canCreateTokenForUser: function(user) {
    //return true;
    return this.isEqual(user) || this.inGroup('admin');
  },
  
  canGetUserIndex: function() {
    return !this.hasUsername('anonymous') && !this.inGroup('guest');
  },
  
  canShowUser: function(user) {
    return !this.hasUsername('anonyomous') && !this.inGroup('guest');
  },
  
  canEditUser: function(user) {
    return this.inGroup('admin') || this.isEqual(user);
  },
  
  // anyone can create a user - this is how you signup.  we might want to
  // change this eventually for private seed servers though
  canCreateUser: function(newUser) {
    return true;
  },
  
  // a user or admin can destroy himself
  canDestroyUser: function(user) {
    return this.inGroup('admin') || this.isEqual(user);
  },
  
  canEditUser: function(user) {
    return this.inGroup('admin') || this.isEqual(user);
  },
  
  canSeeAcls: function() {
    return this.inGroup('admin');
  },
  
  canShowAcl: function(acl) {
    if (this.inGroup('admin')) return true;
    var ops = acl.operationsForUser(this.get('id'), this.get('groups'));
    return ops.length>0;
  },
  
  // must be admin or owner
  canEditAcl: function(acl) {
    if (this.inGroup('admin')) return true;
    var ops = acl.operationsForUser(this.get('id'), this.get('groups'));
    return ops.indexOf('owners')>=0;
  },
  
  // user or group must be a reader, owner or an admin
  canShowPackageInfo: function(packageInfo, acl) {
    if (this.inGroup('admin')) return true;
    var ops = acl.operationsForUser(this.get('id'), this.get('groups'));
    return (ops.indexOf('owners')>=0) || (ops.indexOf('readers')>=0); 
  },

  // user or group must be owner or writer to modify
  canEditPackageInfo: function(packageInfo, acl) {
    if (this.inGroup('admin')) return true;
    var ops = acl.operationsForUser(this.get('id'), this.get('groups'));
    return (ops.indexOf('owners')>=0) || (ops.indexOf('writers')>=0);  
  },
  
  canUploadPackage: function(acl) {
    if (!acl) return !this.hasUsername('anonymous');
    if (this.inGroup('admin')) return true;
    var ops = acl.operationsForUser(this.get('id'), this.get('groups'));
    return (ops.indexOf('writers')>=0) || (ops.indexOf('owners')>=0);  
  },
  
  // ..........................................................
  // Filtered Data
  // 
  
  indexJson: function(currentUser, done) {
    var self = this,
        ret  = {};
        
    // copy in basic properties
    'id name email groups'.split(' ').forEach(function(k) {
      ret[k] = this.get(k);
    }, this);
    ret['link-self'] = this.url();

    // also get any tokens for the user
    (function(done) {
      if (currentUser && currentUser.canSeeTokensForUser(self)) {
        self.tokens(done);
        
      } else return done(null, []);
      
    })(function(err, tokens) {
      if (err) return done(err);
      if (tokens.length>0) {
        tokens = tokens.map(function(t) { return t.get('id'); });
        ret['tokens'] = tokens;  
      }
      
      return done(null, ret);
    });
    
  },
  
  showJson: function(currentUser, done) {
    return this.indexJson(currentUser, done);
  }
  
  
});

exports.User = User;
Token = require('models/token').Token;


// 
// var Cs     = require('core-support'),
//     server = require('server'),
//     Record = require('models/record'),
//     Token; // fill in later to avoid cycles
//     
// User = Record.extend({
// 
//   kind: 'users',
//   
//   tokenIds: function() {
//     return this.data.tokens || [];
//   },
//   
//   group: function() {
//     return (this.data || this.data.group) ? this.data.group : 'guest';
//   },
//   
//   tokens: function(done) {
//     Cs.map(this.tokenIds(), function(tokenId, done) {
//       Token.find(tokenId, done);
//     })(done); 
//   },
//   
//   password: function() {
//     return this.data.password || null;
//   },
//   
//   // tokens are dependent properties of users.  
//   destroy: function(done) {
//     var user = this;
//     this.tokens(function(err, tokens) {
//       if (err) return done(err);
// 
//       // destroy all tokens...
//       if (!tokens) tokens = [];
//       Cs.parallel(tokens, function(token, done) {
//         token.destroy(done);
//         
//       // then destroy this user
//       })(function(err) {
//         if (err) return done(err);
//         Record.prototype.destroy.call(user, done);
//       });
//     });
//   },
// 
//   prepare: function(data, done) {
//     var r = {};
//     r.id = this.id;
//     r.email = data.email;
//     r.name  = data.name;
// 
//     if (data.digest) {
//       r.password = data.digest;
//     } else if (data.password) {
//       r.password = require('seed:private/md5').b64(data.password);
//     }
// 
//     r.group = 'member';
// 
//     if (!r.email || !r.id) return done(401);
//     this.data = r;
//     this.isOpen = true;
// 
//     // we need a new token for this user
//     var tokenData = { user: this.id, creator: this.id, expires: 0 };
//     
//     Token.create(Cs.uuid(), tokenData, function(err, token) {
//       if (err) return done(err);
//       token.write(function(err) {
//         if (err) return done(err);
//         r.tokens = [token.id];
//         return done();   
//       });
//     });
//     
//   },
//   
//   update: function(data, done) {
//     var r = Cs.mixin({}, this.data);
//     ['email', 'name'].forEach(function(key) {
//       if (data[key]) r[key] = data[key];  
//     });
// 
//     if (data.digest) {
//       r.password = data.digest;
//     } else if (data.password) {
//       r.password = require('seed:private/md5').b64(data.password);
//     }
//     
//     if (!r.email) return done(401); // you can't delete the email
//     if (!r.email || !r.id) return done(401);
//     this.data = r;
//     return this.write(done);
//   },
//   
//   
// });
// 
// User._find = Record.find;
// User.find = function(id, done) {
//   if (id === 'anonymous') return done(null, User.anonymous);
//   else return User._find(id, done);
// };
// 
// // Special anonymous record does not exist on disk
// User.anonymous = new User('anonymous');
// User.anonymous.open = function(done) { 
//   return done(null, this); 
// };
// 
// User.anonymous.write = function(done) { 
//   return done('cannot modify anonymous');
// };
// 
// User.anonymous.data = { 
//   "id": "anonymous", 
//   "group": "guest", 
//   "name": "anonymous"
// };
// 
// exports = module.exports = User;
// 
// 
// Token = require('models/token');