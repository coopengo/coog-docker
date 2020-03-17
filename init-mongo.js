db.createUser(
  {
      user: "coog",
      pwd: "coog",
      roles: [
          {
              role: "readWrite",
              db: "coog"
          }
      ]
  }
);
