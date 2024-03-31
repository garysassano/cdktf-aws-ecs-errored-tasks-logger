import { TerraformStack } from "cdktf";
import { Construct } from "constructs";
import { CloudwatchEventRule } from "../../.gen/providers/aws/cloudwatch-event-rule";
import { CloudwatchEventTarget } from "../../.gen/providers/aws/cloudwatch-event-target";
import { CloudwatchLogGroup } from "../../.gen/providers/aws/cloudwatch-log-group";
import { CloudwatchLogResourcePolicy } from "../../.gen/providers/aws/cloudwatch-log-resource-policy";
import { DataAwsIamPolicyDocument } from "../../.gen/providers/aws/data-aws-iam-policy-document";
import { DataAwsSubnets } from "../../.gen/providers/aws/data-aws-subnets";
import { DataAwsVpc } from "../../.gen/providers/aws/data-aws-vpc";
import { EcsCluster } from "../../.gen/providers/aws/ecs-cluster";
import { EcsService } from "../../.gen/providers/aws/ecs-service";
import { EcsTaskDefinition } from "../../.gen/providers/aws/ecs-task-definition";
import { IamRole } from "../../.gen/providers/aws/iam-role";
import { AwsProvider } from "../../.gen/providers/aws/provider";

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new AwsProvider(this, "AwsProvider");

    /*
     * DEFAULT VPC & SUBNETS
     */

    // Fetch region's default VPC
    const defaultVpc = new DataAwsVpc(this, "defaultVpc", {
      default: true,
    });

    // Fetch subnets from region's default VPC
    const defaultVpcSubnets = new DataAwsSubnets(this, "defaultVpcSubnets", {
      filter: [
        {
          name: "vpc-id",
          values: [defaultVpc.id],
        },
      ],
    });

    /*
     * EVENTBRIDGE TO CLOUDWATCH
     */

    const ecsErroredTasksLogGroup = new CloudwatchLogGroup(
      this,
      "ECSErroredTasksLogGroup",
      {
        name: `/aws/events/ecs/errored-tasks`,
        retentionInDays: 7,
      },
    );

    new CloudwatchLogResourcePolicy(this, "ECSErroredTasksLogGroupPolicy", {
      policyName: "ecs-errored-tasks",
      policyDocument: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["delivery.logs.amazonaws.com", "events.amazonaws.com"],
            },
            Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
            Resource: `${ecsErroredTasksLogGroup.arn}:*`,
          },
        ],
      }),
    });

    const ecsErroredTasksEventRule = new CloudwatchEventRule(
      this,
      "ECSErroredTasksEventRule",
      {
        name: "ecs-errored-tasks",
        description: "Triggered when an ECS Task stops because of an error",
        eventPattern: JSON.stringify({
          source: ["aws.ecs"],
          "detail-type": ["ECS Task State Change"],
          detail: {
            desiredStatus: ["STOPPED"],
            lastStatus: ["STOPPED"],
            $or: [
              /*
                Matches ECS Tasks with the following conditions:
                  - The stop code is "EssentialContainerExited"
                  - Any container in the task exited with a non-zero exit code
              */
              {
                stopCode: ["EssentialContainerExited"],
                containers: { exitCode: [{ "anything-but": 0 }] },
              },
              /*
                Matches ECS Tasks with the following conditions:
                  - The stop code is "TaskFailedToStart"
              */
              {
                stopCode: ["TaskFailedToStart"],
              },
              /*
                Matches any of the following ECS Task error codes:
                  - CannotCreateVolumeError
                  - CannotInspectContainerError
                  - CannotPullContainerError
                  - CannotStartContainerError
                  - CannotStopContainerError
                  - ContainerRuntimeError
                  - ContainerRuntimeTimeoutError
                  - InternalError
                  - OutOfMemoryError
                  - ResourceInitializationError
              */
              {
                stoppedReason: [{ wildcard: "*Error:*" }],
              },
            ],
          },
        }),
      },
    );

    new CloudwatchEventTarget(this, "ECSErroredTasksEventTarget", {
      rule: ecsErroredTasksEventRule.name,
      arn: ecsErroredTasksLogGroup.arn,
    });

    /*
     * IAM POLICIES
     */

    const ecsTasksAssumeRolePolicy = new DataAwsIamPolicyDocument(
      this,
      "ECSTasksAssumeRolePolicy",
      {
        version: "2012-10-17",
        statement: [
          {
            effect: "Allow",
            principals: [
              {
                type: "Service",
                identifiers: ["ecs-tasks.amazonaws.com"],
              },
            ],
            actions: ["sts:AssumeRole"],
          },
        ],
      },
    );

    const cwLogsPolicy = new DataAwsIamPolicyDocument(this, "CWLogsPolicy", {
      version: "2012-10-17",
      statement: [
        {
          effect: "Allow",
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["*"],
        },
      ],
    });

    /*
     * IAM ROLES
     */

    const ecsTaskExecutionRole = new IamRole(this, "ECSTaskExecutionRole", {
      name: "ecs-task-execution-role",
      assumeRolePolicy: ecsTasksAssumeRolePolicy.json,
      inlinePolicy: [
        {
          name: "cw-logs-policy",
          policy: cwLogsPolicy.json,
        },
      ],
    });

    /*
     * ECS CLUSTER, SERVICE & TASK
     */

    const ecsCluster = new EcsCluster(this, "EcsCluster", {
      name: "ecs-cluster",
    });

    const ecsTask = new EcsTaskDefinition(this, "ECSTask", {
      family: "ecs-task",
      requiresCompatibilities: ["FARGATE"],
      networkMode: "awsvpc",
      cpu: "256",
      memory: "512",
      runtimePlatform: {
        operatingSystemFamily: "LINUX",
        cpuArchitecture: "X86_64",
      },
      executionRoleArn: ecsTaskExecutionRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name: "unexisting-image",
          image: "unexisting-image",
        },
      ]),
    });

    new EcsService(this, "EcsService", {
      name: "ecs-service",
      cluster: ecsCluster.id,
      taskDefinition: ecsTask.arn,
      launchType: "FARGATE",
      networkConfiguration: {
        subnets: defaultVpcSubnets.ids,
        assignPublicIp: true,
      },
      desiredCount: 1,
    });
  }
}
