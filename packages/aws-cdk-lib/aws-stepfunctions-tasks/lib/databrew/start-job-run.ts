import { Construct } from 'constructs';
import * as iam from '../../../aws-iam';
import * as sfn from '../../../aws-stepfunctions';
import * as cdk from '../../../core';
import { integrationResourceArn, isJsonPathOrJsonataExpression, validatePatternSupported } from '../private/task-utils';

interface GlueDataBrewStartJobRunOptions {
  /**
   * Glue DataBrew Job to run
   */
  readonly name: string;
}

/**
 * Properties for starting a job run with StartJobRun using JSONPath
 */
export interface GlueDataBrewStartJobRunJsonPathProps extends sfn.TaskStateJsonPathBaseProps, GlueDataBrewStartJobRunOptions { }

/**
 * Properties for starting a job run with StartJobRun using JSONata
 */
export interface GlueDataBrewStartJobRunJsonataProps extends sfn.TaskStateJsonataBaseProps, GlueDataBrewStartJobRunOptions { }

/**
 * Properties for starting a job run with StartJobRun
 */
export interface GlueDataBrewStartJobRunProps extends sfn.TaskStateBaseProps, GlueDataBrewStartJobRunOptions { }

/**
 * Start a Job run as a Task
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-databrew.html
 */
export class GlueDataBrewStartJobRun extends sfn.TaskStateBase {
  /**
   * Start a Job run as a Task using JSONPath
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-databrew.html
   */
  public static jsonPath(scope: Construct, id: string, props: GlueDataBrewStartJobRunJsonPathProps) {
    return new GlueDataBrewStartJobRun(scope, id, props);
  }

  /**
   * Start a Job run as a Task using JSONata
   *
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-databrew.html
   */
  public static jsonata(scope: Construct, id: string, props: GlueDataBrewStartJobRunJsonataProps) {
    return new GlueDataBrewStartJobRun(scope, id, { ...props, queryLanguage: sfn.QueryLanguage.JSONATA });
  }

  private static readonly SUPPORTED_INTEGRATION_PATTERNS: sfn.IntegrationPattern[] = [
    sfn.IntegrationPattern.REQUEST_RESPONSE,
    sfn.IntegrationPattern.RUN_JOB,
  ];

  protected readonly taskMetrics?: sfn.TaskMetricsConfig;
  protected readonly taskPolicies?: iam.PolicyStatement[];

  private readonly integrationPattern: sfn.IntegrationPattern;

  /**
   */
  constructor(scope: Construct, id: string, private readonly props: GlueDataBrewStartJobRunProps) {
    super(scope, id, props);
    this.integrationPattern = props.integrationPattern ?? sfn.IntegrationPattern.REQUEST_RESPONSE;

    validatePatternSupported(this.integrationPattern, GlueDataBrewStartJobRun.SUPPORTED_INTEGRATION_PATTERNS);

    const actions = ['databrew:startJobRun'];

    if (this.integrationPattern === sfn.IntegrationPattern.RUN_JOB) {
      actions.push('databrew:stopJobRun', 'databrew:listJobRuns');
    }

    this.taskPolicies = [
      new iam.PolicyStatement({
        resources: [
          cdk.Stack.of(this).formatArn({
            service: 'databrew',
            resource: 'job',
            // If the name comes from input, we cannot target the policy to a particular ARN prefix reliably.
            resourceName: isJsonPathOrJsonataExpression(this.props.name) ? '*' : this.props.name,
          }),
        ],
        actions: actions,
      }),
    ];
  }

  /**
   * Provides the Glue DataBrew Start Job Run task configuration
   * @internal
   */
  protected _renderTask(topLevelQueryLanguage?: sfn.QueryLanguage): any {
    const queryLanguage = sfn._getActualQueryLanguage(topLevelQueryLanguage, this.props.queryLanguage);
    return {
      Resource: integrationResourceArn('databrew', 'startJobRun', this.integrationPattern),
      ...this._renderParametersOrArguments({
        Name: this.props.name,
      }, queryLanguage),
    };
  }
}

