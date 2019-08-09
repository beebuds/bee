# bee-tools
<div width="200">
<img src="./bee.opt.svg" width="16%" height="16%">
</div>

Bee tools repository contains CLI tools helping you to deal with AWS CloudFormation template files, deployments and integration tests.
Currently the following commands are supported:
````bash
Commands:
  bee deploy           Merge, package and deploy CloudFormation template to AWS,
                       e.g.

                       bee deploy
                       --region <region>
                       [
                       --release <'true', 'false'>, defaults to 'false'
                       --stage <stage name, default: development>,
                       --profile <AWS profile>
                       ]

  bee itest            Run specified integration tests, e.g.

                       bee itest
                       --test_spec <path patterns like */**/*.itest.yml>
                       --stack_name <deployed CloudFormation stack> or --api_id
                       <API Gateway id>
                       [--timeout <duration in ms before timeout>
                       --region <region>
                       --profile <AWS profile>]
                       --test_result_file <output file to store test results as
                       junit xml>

  bee merge            Merge separated CloudFormation template into single
                       template, e.g.

                       bee merge
                       [--infrastructure_file path/to/infrastructure.yml
                       --template_file path/to/output-cf-template.yml]

  bee package          Package CloudFormation template, e.g.

                       bee package
                       --bucket my-s3-bucket
                       --bucket_prefix stage/some-prefix
                       [--template_file my-cf-template.yml
                       --output_template_file my-packaged-output-template.yml]

  bee just-deploy      Deploy given CloudFormation template to AWS, e.g.

                       bee just-deploy
                       --stack_name my-stack
                       --parameters_file path/to/parameters.yml
                       --template_file path/to/my-cf-template.yml
                       [--profile <aws profile> --region <region>]

  bee publish          Publish versioned CloudFormation template, e.g.

                       bee publish
                       [--profile <AWS profile>]
  bee prepare-release  Determine the next release version according to the
                       current commit statements , e.g.

                       bee prepare-release
                       [
                       --output_file, file to store the release versions
                       (defaults to .bee/release.json)
                       ]
  bee release          Create a new release version, tag it in the git repo.,
                       generate relevant resources (e.g. CHANGELOG.MD, git hub
                       release notes, etc.), e.g.

                       bee release
                       [
                       --check-release-json, check .bee/release.json whether a
                       release is needed
                       ]
                       ]

  bee deploy-service   Deploy a released service of given version to the
                       specified stage, region and account,

                       bee deploy-service
                       --service-name <name of the service>, e.g. --service-name
                       spec-provider
                       --release-version <version>, e.g. --release-version 0.0.1
                       --stage <stage name>, e.g. --stage
                       --region <region>, e.g. --region eu-west-1
                       [
                       --parameters key1=value1,key2=value2,..., e.g.
                       --parameters SINGLE_PARAM=myvalue,LIST_PARAM=https://url1
                       .com;https://url2.com
                       or --parameters-file <path parameters file (yml format)>,
                       e.g. --paramters-file /path/to/my/parameters.yml
                       ]

  bee run              Execute deploy script file, e.g.

                       bee run
                       --script <js deploy script>, e.g --script myscript.js
                       [
                       --region <region>, e.g. --region eu-west-1,
                       --profile <aws profile>, e.g. --profile myprofile
                       ]

  bee setup            Setup bee-tools, e.g.

                       bee setup
  bee gradle           Run gradle

                       bee gradle <options>
  bee oft              Run openfasttrace,
                       bee oft
                       --swad-version <version>, the version of the SWAD, e.g.
                       --swad-version 1.8.0,
                       <oft options>, see https://github.com/itsallcode/openfast
                       trace/raw/develop/doc/usage.txt


Options:
  --version   Show version number                                      [boolean]
  -h, --help  Show help                                                [boolean]
````
# Installation
## AWS CLI
This tools requires AWS CLI >= 1.16.x in order to function. Please, following this guide https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html.

## bee-tools
````bash
$ npm i -g https://github.com/lingnoi/bee-tools
````

To uninstall, run:
````bash
$ npm uninstall -g bee-tools
````

# infrastructure.yml
In order to use the 
````bash
$ bee deploy
````
or 
````bash
$ bee merge
````
you need to specify a file __infrastructure/infrastructure.yml__ in your project. All path and artifact references within all of your CloudFormation templates needs to be defined __relative__ to __infrastructure/infrastructure.yml__.

Format:
````text
#infrastructure.yml

Service:
    PathToParameters: <directory relative to infrastructure.yml>
    [Resources:
        - <YAML file path>
        - ...] # OPTIONAL, but must be defined if MainTemplate is not defined
    [Parameters:
        - <YAML file path>
        - ...] #OPTIONAL
    [Outputs:
        - <YAML file path>
        - ...] # OPTIONAL
    [MainTemplate: <YAML file path>] # OPTIONAL, but must be defined if Resources is not defined
````

* __Service.PathToParameters__: Defines the directory relative to the infrastruture.yml where the config parameters can be found. Config Paramters will be applied when during the deploy step only.
* __Service.Resources__: A List of YAML files describing CloudFormation Resources. Must be specified if __Service.MainTemplate__ is not specified.
* __Service.Parameters__: A List of YAML files describing CloudFormation input parameters.
* __Service.Outputs__: A List of YAML files describing CloudFormation outputs which can be used by other CloudForamtion stacks.
* __Service.MainTemplate__: A Cloudformation template file in YAML format used as basis when merging the files specified in __Service.Resources__, __Service.Parameters__ and __Service.Outputs__ sections. If not specified a default main CloudFormation template will be used for merging. Must be specified if __Service.Resources__ is not specified.


# Usage
Note: Currently the CloudFormation template shortage notation for the intrinsic functions like __!Ref__, __!Sub__, __!GetAtt__ or similar are not supported, instead use:
````test
Ref:
  Stage
````
or
````test
Fn::Sub: ${Stage}-my-dynamodb-table
````
...

Example: Assume the following project structure and the build artifacts are stored in __build/artifacts/__.
Important: Please, notice that all references specified within the templates must be __relative__ to the __infrastruture.yml__:

````text
my-super-service
      |- build/artifacts/my-lambda-handler.zip
      |- deployment
      |       |- development.yml
      |       |- integration.yml
      |- infrastructure
      |       |- parameters/standard.yml
      |       |- resources/my-lambda-handler.yml
      |       |- templates/main-cf.yml
      |       |- infrastructure.yml
````

````text
#deployment/development.yml

ServiceName: my-super-service
Stage: myDeveloperStage
    
````
````text
#deployment/integration.yml

ServiceName: my-super-service
Stage: integration
    
````

````text
#infrastructure.yml

Service:
    PathToParameters: ../deployment/ # Path defined relative to infrastructure.yml
    Parameters:
      - ./parameters/standard.yml # File path defined relative to infrastructure.yml
    Resources:
      - ./resources/my-lambda-handler.yml # File path defined relative to infrastructure.yml
    MainTemplate: ./templates/main-cf.yml # File path defined relative to infrastructure.yml
````
````text
#infrastructure/parameters/standard.yml

Parameters:
    ServiceName:
        Type: String
    Stage:
        Type: String
````
````text
#main-cf.yml

AWSTemplateFormatVersion: '2010-09-09'
Transform: 'AWS::Serverless-2016-10-31'

Resources:
  MyFavouriteBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName:
        Fn::Sub:
          - ${ServiceName}-${Stage}-my-favs
          - ServiceName: 
              Ref: ServiceName
            Stage:
              Ref: Stage
````
````text
#my-lambda-handler.yml

Resources:
  myLambdaHandler:
    Type: "AWS::Serverless::Function"
    Properties:
      FunctionName:
        Fn::Sub: ${Stage}-my-lambda-handler
      Runtime: nodejs8.10
      MemorySize: 128
      Timeout: 3
      Handler: my-lambda-handler.handler
      CodeUri: ../build/artifacts/my-lambda-handler.zip # artifact reference defined relative to infrastructure.yml
````

To deploy to __eu-west-1__ region with AWS account profile __myprofile__ using the __service name__ and __stage__ defined in __deployment/development.yml__ in our case the stage name is __myDeveloperStage__. __development.yml__ is used as default if the --stage is not specified:
````bash
$ bee deploy --profile=myprofile --region-eu-west-1
````

To deploy to __integration__ stage use the following command, the values specified in __deployment/integration.yml__ will be used for deployment:
````bash
$ bee deploy --stage integration --profile=myprofile --region-eu-west-1
````

