# conni

CLI for Confluence API interaction

[![Version](https://img.shields.io/npm/v/@hesed/conni.svg)](https://npmjs.org/package/@hesed/conni)
[![Downloads/week](https://img.shields.io/npm/dw/@hesed/conni.svg)](https://npmjs.org/package/@hesed/conni)

# Install

```bash
sdkck plugins install @hesed/conni
```

<!-- toc -->
* [conni](#conni)
* [Install](#install)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @hesed/conni
$ conni COMMAND
running command...
$ conni (--version)
@hesed/conni/0.9.1 linux-x64 node-v22.22.3
$ conni --help [COMMAND]
USAGE
  $ conni COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`conni conni auth add`](#conni-conni-auth-add)
* [`conni conni auth delete`](#conni-conni-auth-delete)
* [`conni conni auth list`](#conni-conni-auth-list)
* [`conni conni auth profile`](#conni-conni-auth-profile)
* [`conni conni auth test`](#conni-conni-auth-test)
* [`conni conni auth update`](#conni-conni-auth-update)
* [`conni conni content attachment PAGEID FILE`](#conni-conni-content-attachment-pageid-file)
* [`conni conni content attachment-download ATTACHMENTID [OUTPUTPATH]`](#conni-conni-content-attachment-download-attachmentid-outputpath)
* [`conni conni content comment PAGEID BODY`](#conni-conni-content-comment-pageid-body)
* [`conni conni content comment-delete ID`](#conni-conni-content-comment-delete-id)
* [`conni conni content comment-update ID BODY`](#conni-conni-content-comment-update-id-body)
* [`conni conni content create`](#conni-conni-content-create)
* [`conni conni content delete PAGEID`](#conni-conni-content-delete-pageid)
* [`conni conni content get PAGEID`](#conni-conni-content-get-pageid)
* [`conni conni content search CQL`](#conni-conni-content-search-cql)
* [`conni conni content update PAGEID`](#conni-conni-content-update-pageid)
* [`conni conni space get SPACEKEY`](#conni-conni-space-get-spacekey)
* [`conni conni space list`](#conni-conni-space-list)

## `conni conni auth add`

Add Confluence authentication

```
USAGE
  $ conni conni auth add -p <value> -t <value> -e <value> -u <value> [--json]

FLAGS
  -e, --email=<value>     (required) Account email
  -p, --profile=<value>   (required) Profile name
  -t, --apiToken=<value>  (required) API Token
  -u, --host=<value>      (required) Confluence instance URL

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Add Confluence authentication

EXAMPLES
  $ conni conni auth add

  $ conni conni auth add -p prod
```

_See code: [src/commands/conni/auth/add.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/add.ts)_

## `conni conni auth delete`

Delete an authentication profile

```
USAGE
  $ conni conni auth delete [--json] [-p <value>]

FLAGS
  -p, --profile=<value>  Profile to delete

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Delete an authentication profile

EXAMPLES
  $ conni conni auth delete

  $ conni conni auth delete -p prod
```

_See code: [src/commands/conni/auth/delete.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/delete.ts)_

## `conni conni auth list`

List authentication profiles

```
USAGE
  $ conni conni auth list [--json]

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List authentication profiles

EXAMPLES
  $ conni conni auth list
```

_See code: [src/commands/conni/auth/list.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/list.ts)_

## `conni conni auth profile`

Set or show the default authentication profile

```
USAGE
  $ conni conni auth profile [--json] [--default <value>]

FLAGS
  --default=<value>  Profile to set as default

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Set or show the default authentication profile

EXAMPLES
  $ conni conni auth profile

  $ conni conni auth profile --default test
```

_See code: [src/commands/conni/auth/profile.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/profile.ts)_

## `conni conni auth test`

Test authentication and connection

```
USAGE
  $ conni conni auth test [--json] [-p <value>]

FLAGS
  -p, --profile=<value>  Authentication profile name

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Test authentication and connection

EXAMPLES
  $ conni conni auth test

  $ conni conni auth test -p prod
```

_See code: [src/commands/conni/auth/test.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/test.ts)_

## `conni conni auth update`

Update Confluence authentication

```
USAGE
  $ conni conni auth update -p <value> -t <value> -e <value> -u <value> [--json]

FLAGS
  -e, --email=<value>     (required) Account email
  -p, --profile=<value>   (required) Profile name
  -t, --apiToken=<value>  (required) API Token
  -u, --host=<value>      (required) Confluence instance URL

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Update Confluence authentication

EXAMPLES
  $ conni conni auth update

  $ conni conni auth update -p test
```

_See code: [src/commands/conni/auth/update.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/auth/update.ts)_

## `conni conni content attachment PAGEID FILE`

Add attachment to Confluence content

```
USAGE
  $ conni conni content attachment PAGEID FILE [-p <value>] [--toon]

ARGUMENTS
  PAGEID  Page ID
  FILE    Path to the file to upload

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Add attachment to Confluence content

EXAMPLES
  $ conni conni content attachment 123456 ./document.pdf
```

_See code: [src/commands/conni/content/attachment.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/attachment.ts)_

## `conni conni content attachment-download ATTACHMENTID [OUTPUTPATH]`

Download attachment from Confluence content

```
USAGE
  $ conni conni content attachment-download ATTACHMENTID [OUTPUTPATH] [-p <value>] [--toon]

ARGUMENTS
  ATTACHMENTID  Attachment ID
  [OUTPUTPATH]  Output file path

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Download attachment from Confluence content

EXAMPLES
  $ conni conni content attachment-download att12345

  $ conni conni content attachment-download att12345 ./document.pdf
```

_See code: [src/commands/conni/content/attachment-download.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/attachment-download.ts)_

## `conni conni content comment PAGEID BODY`

Add comment to Confluence content

```
USAGE
  $ conni conni content comment PAGEID BODY [-p <value>] [--toon]

ARGUMENTS
  PAGEID  Page ID
  BODY    Comment in Markdown format

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Add comment to Confluence content

EXAMPLES
  $ conni conni content comment 123456 "
  # Header
  ## Sub-header
  - Item 1
  - Item 2
  ```bash
  ls -a
  ```"

  $ conni conni content comment 123456 "$(cat content.md)"
```

_See code: [src/commands/conni/content/comment.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/comment.ts)_

## `conni conni content comment-delete ID`

Delete comment from Confluence content

```
USAGE
  $ conni conni content comment-delete ID [-p <value>] [--toon]

ARGUMENTS
  ID  Comment ID to delete

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Delete comment from Confluence content

EXAMPLES
  $ conni conni content comment-delete 1544224770
```

_See code: [src/commands/conni/content/comment-delete.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/comment-delete.ts)_

## `conni conni content comment-update ID BODY`

Update a comment in Confluence content

```
USAGE
  $ conni conni content comment-update ID BODY [-p <value>] [--toon]

ARGUMENTS
  ID    Comment ID to update
  BODY  Comment in Markdown format

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Update a comment in Confluence content

EXAMPLES
  $ conni conni content comment-update 1544224770 "
  # Header
  ## Sub-header
  - Item 1
  - Item 2
  ```bash
  ls -a
  ```"

  $ conni conni content comment-update 1544224770 "$(cat content.md)"
```

_See code: [src/commands/conni/content/comment-update.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/comment-update.ts)_

## `conni conni content create`

Create a new Confluence page

```
USAGE
  $ conni conni content create --fields <value>... [--attach <value>...] [--full-width] [-p <value>] [--toon]

FLAGS
  -p, --profile=<value>    Authentication profile name
      --attach=<value>...  Path to a file to upload and embed inline (can be used multiple times)
      --fields=<value>...  (required) Minimum fields required: spaceKey, title & body
      --full-width         Set page appearance to full-width
      --toon               Format output as toon

DESCRIPTION
  Create a new Confluence page

EXAMPLES
  $ conni conni content create --fields spaceKey="DEV" title="New title" body="New description" status="draft"

  $ conni conni content create --fields spaceKey="DEV" title="New title" body='
  # Header
  ## Sub-header
  - Item 1
  - Item 2
  ```bash
  ls -a
  ```'

  $ conni conni content create --fields spaceKey="DEV" title="Child page" body="Content" parentId="123456"

  $ conni conni content create --fields spaceKey="DEV" title="Page with image" body="See the diagram:
  ![diagram](./diagram.png)" --attach ./diagram.png

  $ conni conni content create --fields spaceKey="DEV" title="Page with files" body="Content" --attach ./image.png --attach ./report.pdf

  $ conni conni content create --fields spaceKey="DEV" title="Storage page" body=@storage.xml representation=storage --full-width

FLAG DESCRIPTIONS
  --fields=<value>...  Minimum fields required: spaceKey, title & body

    Content fields in key=value format. Use @file to read value from a file (e.g. body=@content.xml)
```

_See code: [src/commands/conni/content/create.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/create.ts)_

## `conni conni content delete PAGEID`

Delete a Confluence page

```
USAGE
  $ conni conni content delete PAGEID [-p <value>] [--toon]

ARGUMENTS
  PAGEID  Page ID to delete

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Delete a Confluence page

EXAMPLES
  $ conni conni content delete 1543634992
```

_See code: [src/commands/conni/content/delete.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/delete.ts)_

## `conni conni content get PAGEID`

Get details of a Confluence content

```
USAGE
  $ conni conni content get PAGEID [-p <value>] [--toon]

ARGUMENTS
  PAGEID  Page ID

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a Confluence content

EXAMPLES
  $ conni conni content get 1544060948
```

_See code: [src/commands/conni/content/get.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/get.ts)_

## `conni conni content search CQL`

Search for Confluence contents using CQL

```
USAGE
  $ conni conni content search CQL [--expand <value>] [--limit <value>] [-p <value>] [--toon]

ARGUMENTS
  CQL  CQL expression

FLAGS
  -p, --profile=<value>  Authentication profile name
      --expand=<value>   Properties of the content to expand
      --limit=<value>    Maximum number of contents per page
      --toon             Format output as toon

DESCRIPTION
  Search for Confluence contents using CQL

EXAMPLES
  $ conni conni content search 'space=DEV AND title ~ "Implement email OTP login" AND creator=currentUser()'

  $ conni conni content search 'created > startOfMonth()' --limit=5 --expand=body,version
```

_See code: [src/commands/conni/content/search.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/search.ts)_

## `conni conni content update PAGEID`

Update an existing Confluence content

```
USAGE
  $ conni conni content update PAGEID --fields <value>... [--full-width] [-p <value>] [--toon]

ARGUMENTS
  PAGEID  Page ID

FLAGS
  -p, --profile=<value>    Authentication profile name
      --fields=<value>...  (required) Content fields to update in key=value format. Use @file to read value from a file
                           (e.g. body=@content.xml)
      --full-width         Set page appearance to full-width
      --toon               Format output as toon

DESCRIPTION
  Update an existing Confluence content

EXAMPLES
  $ conni conni content update 1076199489 --fields title='New summary' body='New description'

  $ conni conni content update 1076199489 --fields body='
  # Header
  ## Sub-header
  - Item 1
  - Item 2
  ```bash
  ls -a
  ```'

  $ conni conni content update 1076199489 --fields body="$(cat content.md)"

  $ conni conni content update 1076199489 --fields body=@storage.xml representation=storage --full-width
```

_See code: [src/commands/conni/content/update.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/content/update.ts)_

## `conni conni space get SPACEKEY`

Get details of a Confluence space

```
USAGE
  $ conni conni space get SPACEKEY [-p <value>] [--toon]

ARGUMENTS
  SPACEKEY  Space key

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  Get details of a Confluence space

EXAMPLES
  $ conni conni space get DEV
```

_See code: [src/commands/conni/space/get.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/space/get.ts)_

## `conni conni space list`

List all Confluence spaces

```
USAGE
  $ conni conni space list [-p <value>] [--toon]

FLAGS
  -p, --profile=<value>  Authentication profile name
      --toon             Format output as toon

DESCRIPTION
  List all Confluence spaces

EXAMPLES
  $ conni conni space list
```

_See code: [src/commands/conni/space/list.ts](https://github.com/hesedcasa/conni/blob/v0.9.1/src/commands/conni/space/list.ts)_
<!-- commandsstop -->
