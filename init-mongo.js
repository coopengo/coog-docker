db.createUser({
  user: 'admin',
  pwd: 'coog',
  roles: [
    {
      role: 'readWrite',
      db: 'coogdb'
    }
  ]
})
