Server Database Formats

## setup

seed-users :
  anonymous user:
	id: anonymous
	name: Anonymous
	password: null
	groups: [guest]

  ## also generate admin user w/ username, password, groups: ['admin']

seed-tokens:
  admin token:
	id: uuid
	username: [admin-username]
	expires: 0
	


## users

Each file here describes a user.  Contains the following keys:

*	**id**: the user id
*	**name**: human readable name
*	**email**: contact email
*	**website**: contact website
*	**tokens**: array of currently issued tokens [not visible to normal users]
*	**group**: access group.  should be 'admin' or 'user' for now

Users in the admin group can view and modify tokens.  Regular users can only 
view or modify their own tokens
