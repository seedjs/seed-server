// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see LICENSE)
// ==========================================================================

"import cradle as cradle";

var _conn, _dbs = {};

exports.DB_PREFIX = 'seed';

exports.db = function(keyName) {
  if (_dbs[keyName]) return _dbs[keyName];
  if (!_conn) _conn = new cradle.Connection();
  _dbs[keyName] = _conn.database(exports.DB_PREFIX+'-'+keyName);
  return _dbs[keyName];
};
