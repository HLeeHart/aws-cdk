import { FakeBuildAction } from './fake-build-action';
import { FakeSourceAction } from './fake-source-action';
import { Template } from '../../assertions';
import * as cdk from '../../core';
import * as codepipeline from '../lib';
import { Result } from '../lib';
import { Stage } from '../lib/private/stage';

/* eslint-disable quote-props */

describe('stages', () => {
  describe('Pipeline Stages', () => {
    test('can be inserted before another Stage', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');

      const secondStage = pipeline.addStage({ stageName: 'SecondStage' });
      const firstStage = pipeline.addStage({
        stageName: 'FirstStage',
        placement: {
          rightBefore: secondStage,
        },
      });

      // -- dummy actions here are needed to satisfy validation rules
      const sourceArtifact = new codepipeline.Artifact();
      firstStage.addAction(new FakeSourceAction({
        actionName: 'dummyAction',
        output: sourceArtifact,
      }));
      secondStage.addAction(new FakeBuildAction({
        actionName: 'dummyAction',
        input: sourceArtifact,
      }));
      // --

      Template.fromStack(stack).hasResourceProperties('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'FirstStage' },
          { 'Name': 'SecondStage' },
        ],
      });
    });

    test('can be inserted after another Stage', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');

      const firstStage = pipeline.addStage({ stageName: 'FirstStage' });
      const thirdStage = pipeline.addStage({ stageName: 'ThirdStage' });
      const secondStage = pipeline.addStage({
        stageName: 'SecondStage',
        placement: {
          justAfter: firstStage,
        },
      });

      // -- dummy actions here are needed to satisfy validation rules
      const sourceArtifact = new codepipeline.Artifact();
      firstStage.addAction(new FakeSourceAction({
        actionName: 'dummyAction',
        output: sourceArtifact,
      }));
      secondStage.addAction(new FakeBuildAction({
        actionName: 'dummyAction',
        input: sourceArtifact,
      }));
      thirdStage.addAction(new FakeBuildAction({
        actionName: 'dummyAction',
        input: sourceArtifact,
      }));
      // --

      Template.fromStack(stack).hasResourceProperties('AWS::CodePipeline::Pipeline', {
        'Stages': [
          { 'Name': 'FirstStage' },
          { 'Name': 'SecondStage' },
          { 'Name': 'ThirdStage' },
        ],
      });
    });

    test("attempting to insert a Stage before a Stage that doesn't exist results in an error", () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');
      const stage = pipeline.addStage({ stageName: 'Stage' });

      const anotherPipeline = new codepipeline.Pipeline(stack, 'AnotherPipeline');
      expect(() => {
        anotherPipeline.addStage({
          stageName: 'AnotherStage',
          placement: {
            rightBefore: stage,
          },
        });
      }).toThrow(/before/i);
    });

    test("attempting to insert a Stage after a Stage that doesn't exist results in an error", () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');
      const stage = pipeline.addStage({ stageName: 'Stage' });

      const anotherPipeline = new codepipeline.Pipeline(stack, 'AnotherPipeline');
      expect(() => {
        anotherPipeline.addStage({
          stageName: 'AnotherStage',
          placement: {
            justAfter: stage,
          },
        });
      }).toThrow(/after/i);
    });

    test('providing more than one placement value results in an error', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');
      const stage = pipeline.addStage({ stageName: 'Stage' });

      expect(() => {
        pipeline.addStage({
          stageName: 'SecondStage',
          placement: {
            rightBefore: stage,
            justAfter: stage,
          },
        });
      // incredibly, an arrow function below causes nodeunit to crap out with:
      // "TypeError: Function has non-object prototype 'undefined' in instanceof check"
      }).toThrow(/(rightBefore.*justAfter)|(justAfter.*rightBefore)/);
    });

    test('can be retrieved from a pipeline after it has been created', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline', {
        stages: [
          {
            stageName: 'FirstStage',
          },
        ],
      });

      pipeline.addStage({ stageName: 'SecondStage' });

      expect(pipeline.stages.length).toEqual(2);
      expect(pipeline.stages[0].stageName).toEqual('FirstStage');
      expect(pipeline.stages[1].stageName).toEqual('SecondStage');

      // adding stages to the returned array should have no effect
      pipeline.stages.push(new Stage({
        stageName: 'ThirdStage',
      }, pipeline));
      expect(pipeline.stageCount).toEqual(2);
    });

    test('can disable transitions to a stage', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');

      const firstStage = pipeline.addStage({ stageName: 'FirstStage' });
      const secondStage = pipeline.addStage({ stageName: 'SecondStage', transitionToEnabled: false });

      // -- dummy actions here are needed to satisfy validation rules
      const sourceArtifact = new codepipeline.Artifact();
      firstStage.addAction(new FakeSourceAction({
        actionName: 'dummyAction',
        output: sourceArtifact,
      }));
      secondStage.addAction(new FakeBuildAction({
        actionName: 'dummyAction',
        input: sourceArtifact,
      }));
      // --

      Template.fromStack(stack).hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          { Name: 'FirstStage' },
          { Name: 'SecondStage' },
        ],
        DisableInboundStageTransitions: [
          {
            Reason: 'Transition disabled',
            StageName: 'SecondStage',
          },
        ],
      });
    });

    test('can set up stage level conditions to a stage', () => {
      const stack = new cdk.Stack();
      const pipeline = new codepipeline.Pipeline(stack, 'Pipeline');
      const beforeEntry = {
        conditions: [{
          rules: [new codepipeline.Rule({
            name: 'LambdaCheck',
            provider: 'LambdaInvoke',
            version: '1',
            configuration: {
              FunctionName: 'functionName1',
            },
          })],
          result: codepipeline.Result.FAIL,
        }],
      };
      const onSuccess = {
        conditions: [{
          result: Result.FAIL,
          rules: [new codepipeline.Rule({
            name: 'CloudWatchCheck',
            provider: 'LambdaInvoke',
            version: '1',
            configuration: {
              AlarmName: 'AlarmName1',
              WaitTime: '300', // 5 minutes
              FunctionName: 'funcName2',
            },
          })],
        }],
      };
      const onFailure = {
        conditions: [{
          result: Result.ROLLBACK,
          rules: [new codepipeline.Rule({
            name: 'RollBackOnFailure',
            provider: 'LambdaInvoke',
            version: '1',
            configuration: {
              AlarmName: 'AlarmName2',
              WaitTime: '300', // 5 minutes
              FunctionName: 'funcName1',
            },
          })],
        }],
      };
      const firstStage = pipeline.addStage({ stageName: 'FirstStage' });
      const secondStage = pipeline.addStage({ stageName: 'SecondStage', onFailure, onSuccess, beforeEntry });

      // -- dummy actions here are needed to satisfy validation rules
      const sourceArtifact = new codepipeline.Artifact();
      firstStage.addAction(new FakeSourceAction({
        actionName: 'dummyAction',
        output: sourceArtifact,
      }));
      secondStage.addAction(new FakeBuildAction({
        actionName: 'dummyAction',
        input: sourceArtifact,
      }));

      Template.fromStack(stack).hasResourceProperties('AWS::CodePipeline::Pipeline', {
        Stages: [
          { Name: 'FirstStage' },
          {
            Name: 'SecondStage',
            BeforeEntry: {
              Conditions: [
                {
                  Rules: [
                    {
                      Name: 'LambdaCheck',
                      RuleTypeId: {
                        Provider: 'LambdaInvoke',
                        Version: '1',
                        Category: 'Rule',
                        Owner: 'AWS',
                      },
                    },
                  ],
                  Result: 'FAIL',
                },
              ],
            },
            OnSuccess: {
              Conditions: [
                {
                  Rules: [
                    {
                      Name: 'CloudWatchCheck',
                      RuleTypeId: {
                        Provider: 'LambdaInvoke',
                        Version: '1',
                        Category: 'Rule',
                        Owner: 'AWS',
                      },
                    },
                  ],
                  Result: 'FAIL',
                },
              ],
            },
            OnFailure: {
              Conditions: [
                {
                  Rules: [
                    {
                      Name: 'RollBackOnFailure',
                      RuleTypeId: {
                        Provider: 'LambdaInvoke',
                        Version: '1',
                        Category: 'Rule',
                        Owner: 'AWS',
                      },
                    },
                  ],
                  Result: 'ROLLBACK',
                },
              ],
            },
          },
        ],
      });
    });
  });
});
