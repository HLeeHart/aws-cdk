import ec2 = require('@aws-cdk/aws-ec2');
import ecs = require('@aws-cdk/aws-ecs');
import events = require('@aws-cdk/aws-events');
import cdk = require('@aws-cdk/core');

import { ScheduledEc2Task } from '../../lib';

const app = new cdk.App();

class EventStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', { maxAzs: 1 });

    const cluster = new ecs.Cluster(this, 'EcsCluster', { vpc });
    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new ec2.InstanceType('t2.micro')
    });

    /// !show
    // Create the scheduled task
    new ScheduledEc2Task(this, 'ScheduledEc2Task', {
      cluster,
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      desiredTaskCount: 2,
      memoryLimitMiB: 512,
      cpu: 1,
      environment: { TRIGGER: 'CloudWatch Events' },
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
    });
    /// !hide
  }
}

new EventStack(app, 'aws-ecs-integ-ecs');
app.synth();
