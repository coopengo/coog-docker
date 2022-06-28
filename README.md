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
    - [Logging configuration](#logging-configuration)
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
  - [Creating custom services](#creating-custom-services)
  - [Debug tools](#debug-tools)
  - [FAQ](#faq)
    - [Using services deployed on localhost](#using-services-deployed-on-localhost)
    - [Network error on configuration](#network-error-on-configuration)
    - [Configuration error](#configuration-error)
    - [PORTAL Error: Not allowed by CORS](#portal-error-not-allowed-by-cors)
    - [Celery error: PreconditionFailed](#celery-error-preconditionfailed)
    - [Purge logs](#purge-logs)
    - [B2C docker-compose files](#b2c-docker-compose-files)

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

*Note : The project works with docker-compose versions >=2.6, but it has not
been extensively tested. There should not be many problems, however there may
still be some bugs lying around in this version

The tests that were done were on versions 22.14+*

**yq** (https://github.com/mikefarah/yq/#install) is required for some features
(host integration / logging configuration), with version >= 4.18

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

### Overriding services

If a `override.yml` file is found at the root of the repository, it will be
appended to the list of configurations that will be load by the compose
project. This can be useful to add custom configurations to services without
modifying the repository contents.

### Logging configuration

Docker has some configuration options for logging management. The goal is
usually to avoid creating GBs of logging data on production servers. The
reference documentation is [here](https://docs.docker.com/config/containers/logging/configure/)

This project allows to easily configure a common configuration for all
services, by setting the `LOGGING_CONFIGURATION_TEMPLATE` environment variable.
It accepts three possible values:

-   "none": No default configuration will be injected
-   "default": The configuration in `default_logging_configuration.yml` will be
used. This is the default value
-   /path/to/template: A path to a template file, with the same structure than
the default above

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
- a `env` filder which will be used to store the environment variable values
for the various services

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

## Creating custom services

The `./bin/configure` command, which is used to generate the configuration,
adds services by looking in the `compose` directory.

That makes adding custom services straightforward, just add a new `yml` file in
the appropriate sub-directory, re-run `./bin/configure`, and they should be
detected.

## Debug tools

The backoffice application includes some useful tools for improving the
performance analysis / debugging experience.

Most notably:

- Setting `COOG_UWSGI_STATS=1` in `env.custom` will enable statistics
collection for the Uwsgi server on top of which the backoffice application
runs. Those statistics can be accessed using the `bin/tools/uwsgi_stats`
command, and are printed as json data
- Setting `COOG_UWSGI_TRACEBACKER=1` in `env.custom` will enable the
`bin/tools/uwsgi_tracebacks` command, that can be used to dump the current
traceback of the Python processes / threads of the Uwsgi server. Useful when a
process seems "stuck", or for detecting slow downs using a sampling approach

Those two options have no sensible overhead, but are still disabled by default.

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

### Celery error: PreconditionFailed

In some cases (long jobs or batch panifications), recent (> 3.8.16) versions of
rabbitmq may raise a "PreconditionFailed" error, which triggers a celery node
restart. Sample log:

```
# Node is up
2022-01-25T17:09:44.540530415Z [2022-01-25 17:09:44,540: INFO/MainProcess] celery@9268f28e1bd4 ready.
...
# Some job exceeds the timeout
2022-01-25T17:43:46.900229245Z amqp.exceptions.PreconditionFailed: (0, 0): (406) PRECONDITION_FAILED - delivery acknowledgement on channel 1 timed out. Timeout value used: 1800000 ms. This timeout value can be configured, see consumers doc guide to learn more
# Celery node restarts
2022-01-25T17:43:49.370191389Z Welcome on board, Coog Celery is preparing to start
...
```

Default timeout is increased to 48 hours (up from 30 minutes), and can be
further increased by copying the `defaults/rabbitmq` folder somewhere,
modifying the value in `timeout.conf`, and setting the path to the folder in
the `CUSTOM_RABBITMQ_FOLDER` environment variable.

### Purge logs

If no log rotation is configured (it should on production servers), you can use
the following command to purge a container logs:

```bash
truncate -s 0 $(docker inspect --format='{{.LogPath}}' <container_name_or_id>)
```

*Note: if you are unlucky (the command was executed at the same time that a log
was written), you may end up in a state where the log file is unusable. In that
case, you can try truncating again*

Reference [here](https://stackoverflow.com/questions/42510002/docker-how-to-clear-the-logs-properly-for-a-docker-container)

### B2C docker-compose files

B2C has multiples .yml files (`_common`, `_init` and `back/front.yml`) because frontend and backend are built on separated containers.

- `_common.yml` has shared data between init and run container.
- `_init.yml` build the app.
- `back/front.yml` run the app after init container has ended successfully (on `service_completed_successfully` condition)

Build data are saved on persistent volumes:

```
CUSTOM_B2C_BACKEND_BUILD_VOLUME=
CUSTOM_B2C_FRONTEND_BUILD_VOLUME=
```

It only needs to be persistent when containers are running, as it will rebuild at each start.
