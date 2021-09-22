<!-- TOC ignore:true -->
# Coog Docker

Configuration and tooling for a `docker-compose`-based Coog deployment

<!-- TOC -->

- [Coog Docker](#coog-docker)
  - [Requirements](#requirements)
    - [Hardware](#hardware)
    - [Software](#software)
    - [Permissions](#permissions)
    - [Generate certificates for localhost](#generate-certificates-for-localhost)
  - [Configuration](#configuration)
    - [Minimum configuration](#minimum-configuration)
    - [Disabling services](#disabling-services)
    - [Specific services configuration](#specific-services-configuration)
    - [Overriding services](#overriding-services)
  - [Tracking configuration changes](#tracking-configuration-changes)
  - [Commands](#commands)
    - [Refresh configuration](#refresh-configuration)
    - [Starting up](#starting-up)
    - [Shutting down](#shutting-down)
    - [Initialize the database](#initialize-the-database)
    - [Upgrade the database](#upgrade-the-database)
    - [Create a backup](#create-a-backup)
    - [Load from a backup](#load-from-a-backup)
    - [Modify admin password](#modify-admin-password)
    - [Anonymize a database](#anonymize-a-database)
    - [Run daily chain](#run-daily-chain)
  - [Creating custom services](#creating-custom-services)
  - [FAQ](#faq)
    - [Using services deployed on localhost](#using-services-deployed-on-localhost)
    - [Network error on configuration](#network-error-on-configuration)
    - [Configuration error](#configuration-error)
    - [PORTAL Error: Not allowed by CORS](#portal-error-not-allowed-by-cors)

<!-- /TOC -->

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

### Minimum configuration

This is a minimal `env.custom` file, containing the few environment variables
that **must** be available.

```shell
# The version to load. Will be the default for all components, but each can be
# set separately if required
IMAGE_VERSION_COOG=coog-2.13.2134

# Where the data will be stored
FILESYSTEM_ROOT=/coog

# Encryption key used for generating jwt token for API communication
JWT_ENCRYPTION=change_me

# Token used for communication between API services and the backoffice
COOG_GATEWAY_TOKEN=api_token_for_api_user

# Not necessary to modify (defaults to "coog"), but usually will be
COMPOSE_PROJECT_NAME=demo
```

*Note for developers: when using multiple environments, `FILESYSTEM_ROOT` can
be set directly in a `.bashrc` or a `.envrc` file so it is not necessary to
re-define it in every environment*

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

For each service, there are sample files in the `defaults/env` folder, where
a few recommended values can be found (mostly for `back.env`, which is the
configuration for the backoffice component)

### Overriding existing services

If a `override.yml` file is found at the root of the repository, it will be
appended to the list of configurations that will be load by the compose
project. This can be useful to add custom configurations to services without
modifying the repository contents.

## Tracking configuration changes

For non-develop environments, tracking the history of modifications can be
useful (in order to better understand the changes, and keep a possibility to
rollback some configurations).

To do so, you must create a `custom` folder at the root of the repository.

This folder can contain:

- a `env.custom` file
- a `disabled_services` file
- a `override.yml` file
- a `compose/custom` folder, in which you can add custom services to load

**WARNING: The custom configuration from the `custom` folder will be loaded
before the configuration defined directly in the root folder.** This means, for
instance, that the `env.custom` file may overwrite variables which were defined
in the `custom/env.custom` file.

This is intentional, the general idea being that the `custom` folder will be
managed using a source-control management tool (git...), and will maybe be
shared by multiple users, or just track various environments using branches.

So, for a particular compose project, the configuration files at the root of
the repository are more specific than the `custom` folder, so they must take
precedence.

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
./bin/manage_db reset
```

The name of the database will be the name of the main database of the project
(defaults to "coog").

An additional database can be managed by passing the `--database` parameter:

```shell
./bin/manage_db reset --database another_database
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

The script can be customized by changing the values of the variables
declared in the anon_db function.

```shell
./bin/manage_db anonymize
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

## FAQ

### Using services deployed on localhost

In some cases (development / debugging), it may be useful to run the API /
front part of the application with the compose project, using a locally running
Coog backoffice service.

To do so, you must:

- Ensure your local Coog server listen on all addresses (0.0.0.0)
- Use the special "host.docker.internal" hostname for your
CUSTOM_COOG_INTERNAL_URL
- Enable host integration for the project, by setting the
"ENABLE_HOST_NETWORK_INTEGRATION" variable to "1" in your `env.custom` file

*Note: This can be done for other services, however the typical use case will
be for backend developers, hence this particular example*

### Network error on configuration

The following error may happen if you work with multiple projects on the same
machine (with different `COMPOSE_PROJECT_NAME`):

```
Starting up
Creating network "<PROJECT_NAME>-coog-backend" with the default driver
ERROR: Pool overlaps with other one on this address space
```

This happens because the internal networks of the projects are overlapping.

To solve this, you should set the following variables to different values for
each projects (usually, increasing the third number should be enough):

```
CUSTOM_NETWORK_BACKEND_SUBNET=                # Backend subnet mask, defaults to 10.0.1.0/24
CUSTOM_NETWORK_FRONTEND_SUBNET=               # Frontend subnet mask, defaults to 10.0.2.0/24
```

### Configuration error

When running `./bin/configure` (or any other command that triggers it), you may
encounter the following error (or a similar one, with a different parameter
name). This is because the minimal configuration was not provided in the
`env.custom` file, and you should double-check if all required values from the
`env.custom.sample` file are provided.

```
Updating .env contents
/home/jwhatever/docker/env.base: line 38: IMAGE_VERSION_COOG: parameter null or not set
```

### [PORTAL][B2B] Error: Not allowed by CORS

By default, you should not be able to use the protocol https:// because it is not configured. You must therefore use the protocol http://.
