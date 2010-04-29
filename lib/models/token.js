// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see LICENSE)
// ==========================================================================
/*globals Record Token Cs */

"import core-support";
"import models/record";
"export Token";

var URL = require('default:url'),
    User;

// token must have a username and optional expiration
Token = Record.extend({
  
  databaseName: 'tokens',
  
  REQUIRED_KEYS: ['username', 'expiration'],
  
  normalize: function(key, value, writing) {
    switch(key) {
      case 'expires': 
        if ('number' !== typeof value) value = Number(value);
        if (isNaN(value)) value = 0;
        break;
        
      case 'username':
        if (!value) value = 'anonymous';
        break;
    }

    return value;
  },
  
  /**
    Finds the actual user for the token.
  */
  user: function(done) {
    User.find(this.get('username'), done);
    return this;
  },
  
  // ..........................................................
  // Filtered Data
  // 
  
  indexJson: function(currentUser, done) {
    var self = this,
        ret  = {};
        
    // copy in basic properties
    'id username expires'.split(' ').forEach(function(k) {
      ret[k] = this.get(k);
    }, this);
    ret['link-self'] = this.url();

    // also get any tokens for the user
    (function(done) {
      if (currentUser && currentUser.canSeeTokensForUser(self)) {
        //Token.findForUser(self, done);
        return done(null, []);
        
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

/**
  Extracts the tokenId from the request query parameters then discovers the
  user.
*/
Token.validate = function(req, done) {
  var query = URL.parse(req.url, true).query, tokenId, username, password;
  if (query) {
    tokenId = query.token;
    username = query.username;
    if (query.password) {
      password = require('seed:private/md5').b64(query.password);
    } else if (query.digest) {
      password = query.digest;
    }
  }

  // first attempt to lookup the user.  
  (function(done) {
    
    // username/password auth
    if (username) {
      User.find(username, function(err, user) {
        if (err) return done(err);
        if (!user || !(user.get('password')===password)) return done(); 
        else return done(null, user);
      });
    
    // token auth (preferred mode);
    } else if (tokenId) {
      tokenId = tokenId.toLowerCase();
      Cs.debug('finding token '+tokenId);
      Token.find(tokenId, function(err, token) {
        
        if (err) return done(err);
        if (!token) return done();
        else return token.user(done);
      });
      
    // no auth...
    } else return done();
    
  // if no user is found, map to anonymous
  })(function(err, user) {
    // ignore errors - just get the anonymous user
    if (user) return done(null, user);
    else return User.find('anonymous', done); // always use anonymous
  });
};

User = require('models/user').User;
