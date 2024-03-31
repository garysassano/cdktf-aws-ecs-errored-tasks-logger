# cdktf-aws-ecs-task-events-logger

CDKTF app that captures all [ECS lifecycle events](https://aws.amazon.com/blogs/containers/effective-use-amazon-ecs-lifecycle-events-with-amazon-cloudwatch-logs-insights/) that contain errored tasks and stores them in CloudWatch Logs.

## Prerequisites

- **_AWS:_**
  - Must have authenticated with [Default Credentials](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration) in your local environment.
- **_Node.js + npm:_**
  - Must be [installed](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) in your system.

## Installation

```sh
npx projen install
```

## Deployment

```sh
npx projen deploy
```

## Cleanup

```sh
npx projen destroy
```

## Architecture Diagram

![Architecture Diagram](./src/assets/arch.svg)
