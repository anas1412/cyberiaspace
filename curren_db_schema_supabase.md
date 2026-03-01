| table_name       | column_name           | data_type                   |
| ---------------- | --------------------- | --------------------------- |
| stacks           | id                    | uuid                        |
| stacks           | transform_scale       | real                        |
| stacks           | transform_x           | real                        |
| stacks           | transform_y           | real                        |
| spaces           | id                    | uuid                        |
| spaces           | physics               | boolean                     |
| spaces           | order                 | integer                     |
| spaces           | transform             | jsonb                       |
| spaces           | created_at            | timestamp without time zone |
| spaces           | updated_at            | timestamp without time zone |
| spaces           | transform_scale       | real                        |
| spaces           | transform_x           | real                        |
| spaces           | transform_y           | real                        |
| thoughts         | id                    | uuid                        |
| thoughts         | local_id              | bigint                      |
| thoughts         | x                     | real                        |
| thoughts         | y                     | real                        |
| thoughts         | vx                    | real                        |
| thoughts         | vy                    | real                        |
| thoughts         | table_data            | jsonb                       |
| thoughts         | date                  | timestamp without time zone |
| thoughts         | size                  | real                        |
| thoughts         | order                 | integer                     |
| thoughts         | layer                 | integer                     |
| thoughts         | meta                  | jsonb                       |
| thoughts         | created_at            | timestamp without time zone |
| thoughts         | updated_at            | timestamp without time zone |
| thoughts         | tasks                 | jsonb                       |
| thoughts         | table                 | jsonb                       |
| published_spaces | id                    | uuid                        |
| published_spaces | space_id              | uuid                        |
| published_spaces | snapshot              | jsonb                       |
| published_spaces | created_at            | timestamp without time zone |
| published_spaces | expires_at            | timestamp without time zone |
| published_spaces | last_published        | timestamp without time zone |
| payments         | id                    | uuid                        |
| payments         | amount                | integer                     |
| payments         | metadata              | jsonb                       |
| payments         | created_at            | timestamp without time zone |
| payments         | updated_at            | timestamp without time zone |
| users            | settings              | jsonb                       |
| users            | created_at            | timestamp without time zone |
| users            | updated_at            | timestamp without time zone |
| users            | auto_sync             | boolean                     |
| feedback         | id                    | uuid                        |
| feedback         | metadata              | jsonb                       |
| feedback         | created_at            | timestamp without time zone |
| feedback         | admin_reply_at        | timestamp without time zone |
| stacks           | created_at            | timestamp without time zone |
| stacks           | local_id              | text                        |
| stacks           | user_id               | text                        |
| stacks           | space_id              | text                        |
| stacks           | name                  | text                        |
| stacks           | color                 | text                        |
| users            | polar_customer_id     | text                        |
| thoughts         | sync_status           | text                        |
| users            | polar_subscription_id | text                        |
| feedback         | admin_reply           | text                        |
| thoughts         | storage_path          | text                        |
| spaces           | local_id              | text                        |
| spaces           | user_id               | text                        |
| spaces           | name                  | text                        |
| spaces           | mode                  | text                        |
| thoughts         | storage_url           | text                        |
| thoughts         | image                 | text                        |
| thoughts         | drawing               | text                        |
| spaces           | theme                 | text                        |
| spaces           | custom_bg             | text                        |
| users            | id                    | text                        |
| users            | email                 | text                        |
| users            | name                  | text                        |
| users            | avatar                | text                        |
| published_spaces | user_id               | text                        |
| spaces           | published_id          | text                        |
| users            | plan                  | text                        |
| users            | subscription_status   | text                        |
| users            | payment_provider     | text                        |
| thoughts         | user_id               | text                        |
| thoughts         | space_id              | text                        |
| thoughts         | stack_id              | text                        |
| feedback         | user_id               | text                        |
| feedback         | type                  | text                        |
| published_spaces | published_id          | text                        |
| feedback         | content               | text                        |
| thoughts         | text                  | text                        |
| thoughts         | placeholder           | text                        |
| thoughts         | description           | text                        |
| thoughts         | type                  | text                        |
| thoughts         | content               | text                        |
| thoughts         | status                | text                        |
| payments         | user_id               | text                        |
| payments         | payment_ref           | text                        |
| thoughts         | priority              | text                        |
| feedback         | status                | text                        |
| payments         | currency              | text                        |
| payments         | status                | text                        |
| thoughts         | author                | text                        |