// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals Cs User Token */

"import core-support";
"import models/user models/token";

var server = require('server');
    
// ..........................................................
// SERVER ACTIONS
// 

// index action - returns all users in system
// you must be a user to get this information - not anonymous or guest
exports.index = function(req, res) {
  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    if (!currentUser.canGetUserIndex()) return server.forbidden(res);
    
    // find all users and generate index JSON
    User.findAll(function(err, users) {
      if (err) return server.error(res, err);
      Cs.map(users, function(user, done) {
        user.indexJson(currentUser, done);
      })(function(err, json) {
        return res.simpleJson(200, { count: json.length, records: json });
      });
    });
    
  });
};

// you must be a current user to retrieve information about another user
exports.show = function(req, res, id) {
  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    
    User.find(id, function(err, user) {
      if (err) return server.error(res, err);
      if (!user) return res.notFound();
      if (!currentUser.canShowUser(user)) return server.forbidden(res);
      user.showJson(currentUser, function(err, json) {
        if (err) return server.error(res, err);
        return res.simpleJson(200, json);
      });
    });

  });
};

// only the owner or admin can update
exports.update = function(req, res, id, body) {
  if (!body) return server.error(res, 401);
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    User.find(id, function(err, user) {
      if (err || !user) return server.err(res, err || 404, 'User not found');
      if (!currentUser.canEditUser(user)) return server.forbidden(res);
      user.modify(body);
      user.commit(function(err) {
        if (err) return server.error(res, err);
        return res.simpleText(200, '');
      });
    });
  });
};

// anyone can create a new user.  This is how you signup.  We will also give
// you a default token.  Returns 409 Conflict if username already exists
exports.create = function(req, res, body) {
  if (!body || !body.id) return server.error(res, 401);

  Token.validate(req, function(err, currentUser) {
    var user = User.create(body.id, body);

    if (!currentUser.canCreateUser(user)) return server.forbidden(res);
    user.commit(function(err) {
      if (err) return server.error(res, err);
      user.showJson(user, function(err, json) {
        if (err) return server.error(res, err);
        return res.simpleJson(201, json, [
          ['X-Seed-Token', user.tokenIds()[0]], // note: must come first
          ['Location', user.url()]
        ]);
      });
    });
  });
};

// must be user or admin
exports.destroy = function(req, res, id) {

  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    User.find(id, function(err, user) {
      if (err) return server.error(res, err);
      if (!user) return res.simpleText(200,''); // idempotent
      if (!currentUser.canDestroyUser(user)) return server.forbidden(res);
      user.destroy(function(err) {
        if (err) return server.error(res, err);
        return res.simpleText(200, '');
      });
    });

  });
};

