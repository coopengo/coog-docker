<!-- TOC ignore:true -->
# Coog Docker

Configuration and tooling for a `docker-compose`-based Coog deployment

## Requirements

### Hardware

For a complete test installation (front + back + BDD), the following is a
minimum:

- 4 CPUs
- 8 GB RAM
- 100 GB Storage

Actual requirements will heavily depend on the number of users / API calls,
database size, and business lines.

### Software

- Docker: 20.10+ (<https://docs.docker.com/>)
- Docker compose: 1.29+ (<https://docs.docker.com/compose>)

### Permissions

Various components will need access to the filesystem for reading / writing.
The location on the host where this will happen can be configured (see
Configuration), the default value being `/coog`.

- For a development environment, the "simplest" way to manage permissions is to
allow everything:

```shell
sudo chmod -R 1777 /path/to/root
```

- In a "real" environment, the folders that we actually need to have access are
those that can be used when sharing files between the application and other
systems (or users). Those are the `coog_tmp` / `coog_data` folder (see
configuration for details on how to configure their path).
Since the application is run as user 1003, the access rights will usually be
set like so:

```shell
sudo chown 1003:1003 /path/to/coog_data
sudo chown 1003:1003 /path/to/coog_tmp
```

### Generate certificates for localhost

- Install mkcert

```shell
(cd /tmp && wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64)
sudo mv /tmp/mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
sudo chmod +x /usr/local/bin/mkcert
mkcert -install
```

- Create a certificat for "coog.localhost" (change the prefix based on the
project name). The docker-compose project expects "certs" in its root folder

```shell
mkdir certs && mkcert -cert-file certs/cert.pem -key-file certs/key.pem "coog.localhost"
```

## Configuration

This project's main configuration is generated from two files:

- `env.base`, which should not be modified, but is the actual template
- `env.custom`, which can be used to provide mandatory values (versions, etc),
as well as overriding some parts of the configuration. Documentation for what
must / can be modified can be found in `env.custom.sample`

When using any of the commands in the `bin` folder (or manually calling
`bin/configure`), the values from those files will be combined to generate a
`.env` file at the root of the repository.

**DO NOT MANUALLY MODIFY THIS FILE**, as it will be overwritten everytime a
command is called.

If you need to manually launch `docker-compose` commands after modifying the
`env.custom` file, make sure to call `bin/configure` first.

### Disabling services

By default, starting the project will start all services defined in the
`compose` folder. Services that you do not need can be disabled by adding them
in a `disabled_services` file at the root of the project.

For instance, to disable the "front/app-b2c" service, run the following command
at the project's root:

```shell
echo "front/app-b2c" >> disabled_services
```

### Specific services configuration

There are specific environment files in the `env` folder to customize the
behaviour of specific services.

Documentation for what can be done and how is in the `defaults/env` folder.

## Commands

**docker-compose commands will usually work**, however when modifying
`env.custom` (or updating the project), you must call `bin/configure` first.
Using the provided commands below will take care of this for you.

### Refresh configuration

```shell
./bin/configure
```

### Starting up

```shell
./bin/up
```

or (run in background)

```shell
./bin/up -d
```

Note thate `bin/up` is juste a wrapper around `docker-compose up` that first
calls `bin/configure`. Any parameters passed to it will be forwarded to
`docker-compose`

### Shutting down

```shell
./bin/down
```

### Initialize the database

The following command will drop an existing database (if needed), then init a
new empty database. It will ask for the admin password:

```shell
./bin/manage_db init
```

The name of the database will be the name of the main database of the project
(defaults to "coog").

An additional database can be managed by passing the `--database` parameter:

```shell
./bin/manage_db init --database another_database
```

### Upgrade the database

The following command will update the database.

```shell
./bin/manage_db update
```

Additional parameters will be modules to install on the database:

```shell
./bin/manage_db update contract claim loan
```

As is the case for the `reset` command, this command can be run on another
database by using the `--database` parameter.

### Create a backup

The following command will create a backup of the database in `/tmp/backup_file`

```shell
./bin/manage_db dump /tmp/backup_file
```

Default format is a flat "sql" file, however this can be controlled using the
`--format` option, to use a binary format, or zip the sql output

```shell
./bin/manage_db dump --format bin /tmp/backup_file
```

If the backup file name is not provided, it will be generated with the database
name, the current date, and the format extension. It will then be moved to `/tmp`

As is the case for the `reset` command, this command can be run on another
database by using the `--database` parameter.

**Note: This command can be used while the application is running without
interrupting the services**

### Load from a backup

The following command will load the `/tmp/backup_file` backup in the database

```shell
./bin/manage_db load /tmp/backup_file
```

Default behavior assumes a flat "sql" file, however this will crash if the
input file is actually a binary file (or a zipped sql file). Same as above,
this can be controlled using the `--format` parameter

```shell
./bin/manage_db load --format sip /tmp/backup_file.zip
```

As is the case for the `reset` command, this command can be run on another
database by using the `--database` parameter.

### Modify admin password

The admin password for the database can be modifid using the following command:

```shell
./bin/manage_db change_admin_password
```

As is the case for the `reset` command, this command can be run on another
database by using the `--database` parameter.

### Anonymize a database

The following command can be used to anonymize the database. **This is not
reversible**.

The anonymization levels are as follow:

- "2": The database will still be usable. Configuration will still be there,
and "extra data" fields will be kept so contracts & co are still consistent
- "1": Same as level 2, but parts of the configuration will also be
anonymized, as well as extra data fields, making it difficult to test on
existing entities. Tests on newly created entities should work though
- "0": Same as level 1, but fields that could be used to cross-reference
information from another database (ex: party codes, contract numbers) will also
be anonymized

```shell
./bin/manage_db anonymize [level]
```

As is the case for the `reset` command, this command can be run on another
database by using the `--database` parameter.

### Run daily chain

The daily chain can be run using the following command:

```shell
./bin/daily 5 french_work_days
```

There will usually be two arguments, to indicate how business days should be
considered. The previous example runs with "5" business days ahead, using the
"french_work_days" configuration.

This command can be set in the crontab of the host to run every day.

**Note: This command uses the mechanisms introduced in Coog 2.12 for daily chain
configuration in side the application**

## Creating custom services

The `./bin/configure` command, which is used to generate the configuration,
adds services by looking in the `compose` directory.

That makes adding custom services straightforward, just add a new `yml` file in
the appropriate sub-directory, re-run `./bin/configure`, and they should be
detected.
