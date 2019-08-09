#! /usr/bin/env node

const AWS = require('aws-sdk');
const argv = require('yargs').argv;
const yaml = require('js-yaml');
const fs = require('fs-extra');
const shell = require('shelljs');
const utils = require('./lib/utils');
const systemInfoInjector = require('./lib/system-info-injector');

const serviceName = argv['service-name'];
if (!serviceName) {
    console.error(`ERROR: Missing service name, use --service-name=<service name>, e.g. --service-name=jwt-authoriser`);
    process.exit(1);
}

const version = argv['release-version'];
if (!version) {
    console.error(`ERROR: Missing release version number, use --release-version=<version>, e.g. --release-version=1.20.30`);
    process.exit(1);
}

if (!argv.stage) {
    console.error(`ERROR: Missing stage name, use --stage=<stage>, e.g. --stage=mystage`);
    process.exit(1);
}

if (!argv.region) {
    console.error(`ERROR: Missing region, use --region=<region>, e.g. --region=eu-west-1`);
    process.exit(1);
}

let optionalParams = '';
if (!argv.region || typeof (argv.region) !== 'string') {
    console.error(`ERROR: Missing region, use --region <region>, e.g. --region eu-west-1 `);
    process.exit(1);
}
optionalParams = optionalParams.concat(`--region ${argv.region}`);
if (argv.profile && typeof (argv.profile) === 'string') {
    optionalParams = optionalParams.concat(` --profile ${argv.profile}`);
}

const region = (argv.region) ? argv.region : constants.DEFAULT_REGION;
AWS.config.region = region;
utils.loadCredentials(AWS, argv.profile, region);

let params = {};
const parametersFile = argv['parameters-file'];
if (argv.parameters && typeof (argv.parameters) === 'string') {
    params = argv.parameters.split(',').reduce((o, a) => {
        const keyValue = a.split('=');
        if (keyValue.length <= 1) {
            console.error(`ERROR: Invalid value for --parameters option, use --parameters key1=value1,key2=value2,...`);
            process.exit(1);
        }

        const val = keyValue[1];
        o[keyValue[0]] = val.includes(';') ? val.replace(/;/g, ',') : val;
        return o;
    }, {});
} else if (parametersFile && typeof (parametersFile) === 'string') {
    params = yaml.safeLoad(fs.readFileSync(parametersFile, 'utf8'));
}

params.Stage = argv.stage;
params.ServiceName = serviceName;

let optionalArgs = '';
let parameters = '';
if (params) {
    let parametersValues = '';
    for (const k in params) {
        const paramVal = (params[k].includes(',')) ? `\\"${params[k]}\\"` : params[k];
        const val = `ParameterKey=${k},ParameterValue=${paramVal}`;
        parametersValues = parametersValues.concat((parametersValues === '') ? val : ` ${val}`);
    }
    parameters = `--parameters ${parametersValues}`;
}
console.log(parameters);
const deploymentBucket = `${serviceName}-deployment`;
const templateUrl = `https://s3.amazonaws.com/${serviceName}-deployment/${version}/infrastructure/cloudformation.yml`;
const stackName = `${serviceName}-${argv.stage}`;
const options = `--template-url=${templateUrl} --stack-name=${stackName} ${parameters} ${optionalArgs} --capabilities "CAPABILITY_AUTO_EXPAND" "CAPABILITY_IAM"`;
const command = `aws cloudformation`;
const createStackScript = `${command} create-stack ${options}`;
const updateStackScript = `${command} update-stack ${options}`;

console.log(`Deploying '${serviceName} ${version}' to stage '${argv.stage}' in region '${argv.region}' ...`);
console.log(`Try to update existing stack '${stackName}' ...`);


let shellResult = utils.awsShellCommand(`${updateStackScript} ${optionalParams}`)();
const consoleOutputs = `${shellResult.stdout} ${shellResult.stderr}`;
let exitCode = shellResult.code;
const stackInRollbackCompleteState = consoleOutputs.match(/ROLLBACK_COMPLETE/g);
if (stackInRollbackCompleteState && stackInRollbackCompleteState.length > 0) {
    utils.rlog(`
    The stack '${stackName}' is in ROLLBACK_COMPLETE.
    In order to be able to re-deploy.
    The stack needs to be MANUALLY deleted!!!
    `)
    process.exit(1);
}
if (exitCode !== 0) {
    console.log(`Create stack '${stackName}' ...`);
    exitCode = utils.awsShellCommand(`${createStackScript} ${optionalParams}`)().code;
    exitCode = utils.awsShellCommand(`aws cloudformation wait stack-create-complete --stack-name ${stackName} ${optionalParams}`)().code;
} else {
    console.log(`Update stack '${stackName}' ...`);
    exitCode = utils.awsShellCommand(`aws cloudformation wait stack-update-complete --stack-name ${stackName} ${optionalParams}`)().code;
}

(async () => {
    shellResult = shell.exec(`get-api-id --stack_name ${stackName} ${optionalParams}`);
    exitCode = shellResult.code;
    if (exitCode === 0) {
        console.log(`inject /system/info endpoint...`);

        try {
            await systemInfoInjector.injectSystemInfo({
                iam: new AWS.IAM(),
                apiGateway: new AWS.APIGateway(),
                restApiId: shellResult.stdout.trim(),
                stage: params.Stage,
                serviceName: params.ServiceName,
                region: argv.region,
                bucket: deploymentBucket,
                bucketPrefix: version
            });
        } catch (err) {
            exitCode++;
            console.error(`ERROR: ${err.message}`, err.stack);
        }
    }

    console.log(`Done.`);
    process.exit(exitCode);
})();
