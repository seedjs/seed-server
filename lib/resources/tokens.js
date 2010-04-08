// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals Cs Token User */

"import core-support models/user models/token";

var Cs     = require('core-support'),
    router = require('node-router'),
    server = require('server'),
    users  = require('resources/users'),
    tokens = exports;

// ..........................................................
// SERVER ACTIONS
// 

// you can only list all tokens if the token you pass is for an admin user
exports.index = function(req, res) {
  Token.validate(req, function(err, currentUser) {
    Cs.debug(currentUser);
    if (currentUser.canSeeAllTokens()) {
      Token.findAll(function(err, tokens) {
        if (err) return server.error(res, err);

        Cs.collect(tokens, function(token, done) {
          return token.indexJson(currentUser, done);
        })(function(err, json) {
          return res.simpleJson(200, { count: json.length, records: json });
        });

      });
      
    } else if (currentUser.canSeeTokensForUser(currentUser)) {
      currentUser.tokens(function(err, tokens) {
          if (err) return server.error(res, err);
          Cs.map(tokens, function(token, done) {
            token.indexJson(currentUser, done);

          })(function(err, json) {
            return res.simpleJson(200, { count: json.length, records: json });
          });
      });
      
    } else return server.forbidden(res);
  });
};

// if you know the id of a token, we will return the info for the token since
// knowing the token implicitly gives you permission to see it
exports.show = function(req, res, id) {
  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    Token.find(id, function(err, token) {
      if (err) return server.error(res, err);

      if (!token) return res.notFound();
      token.showJson(currentUser, function(err, json) {
        if (err) return server.error(res, err);
        else res.simpleJson(200, json);
      });
    });
  });
};


// an admin user can create a token for anyone.  everyone else can create 
// tokens for themselves
exports.create = function(req, res, body) {
  if (!body) return server.error(res, 400);
  
  Token.validate(req, function(err, currentUser) {
    
    // lookup the user first
    var userId = body ? body.username : null;
    (function(done) {
      Cs.debug(userId);
      if (!userId) return done(); // no user
      User.find(userId, done);
      
    // if a user if found, make sure the caller has authority to create a
    // token for it
    })(function(err, user) {
      if (err || !user) return server.error(res, err || 400);
      if (!currentUser.canCreateTokenForUser(user)) {
        return server.forbidden(res);
      }

      // create the token - write both token and update user
      var token = Token.create(Cs.uuid(), body);
      token.commit(function(err) {
        if (err) return server.error(res, err);
        token.showJson(currentUser, function(err, json) {
          if (err) return server.error(res, err);
          return res.simpleJson(201, json, [['Location', token.url()]]);
        });
      });
      
    });
  });
};

// likewise, if you know a token id you can delete it since knowing gives you
// power to delete
exports.destroy = function(req, res, id) {
  Token.find(id, function(err, token) {
    if (err) return server.error(res, err);
    (function(done) {
      if (token) token.destroy(done);
      else done();
    })(function(err) {
      if (err) return server.error(res, err);
      return res.simpleText(200, 'OK');
    });
  });
};


