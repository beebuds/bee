#! /usr/bin/env node

const utils = require('./lib/utils');
const argv = require('yargs').argv;
const initCfVariables = require('./lib/init');
const AWS = require('aws-sdk');
const systemInfoInjector = require('./lib/system-info-injector');
const fs = require('fs-extra');
const constants = require('./lib/constants');
const apiDocHandling = require('./lib/api-doc-handling');
const lbHandling = require('./lib/load-balancing-handling');

console.log(`argv ${JSON.stringify(argv)}`);
const cfVariables = initCfVariables(argv);
console.log(cfVariables);
let profileAndRegionArgs = ``;
if (argv.profile) {
    if (argv.region) {
        profileAndRegionArgs = `--region=${argv.region}  --profile=${argv.profile}`;
    } else {
        profileAndRegionArgs = `--profile=${argv.profile}`;
    }

} else {
    if (argv.region) {
        profileAndRegionArgs = `--region=${argv.region}`;
    }
}

const region = (argv.region) ? argv.region : constants.DEFAULT_REGION;
utils.loadCredentials(AWS, argv.profile, region);

const isOptionSet = (opt) => opt && typeof (opt) == 'string';
const releaseArg = (isOptionSet(argv.release_version)) ? `--release-version ${argv.release_version}` : '';

function generateAndUploadSystemInfo(params) {
    utils.verifyParams(params, ['serviceName', 'version', 'bucket', 'systemInfoFile'])
    console.log(`generateAndUploadSystemInfo: ${JSON.stringify(params)}`);
    const systemInfo = {
        api_version: `v1`,
        component_name: params.serviceName,
        component_version: params.version
    };
    fs.writeFileSync(params.systemInfoFile, JSON.stringify(systemInfo), 'utf-8');
    const args = (params.profile) ? `--profile=${params.profile}` : '';
    return utils.uploadToS3(params.systemInfoFile, params.bucket, params.version, args);
}

const generateAndUploadSystemInfoCmd = async (_previousShellResults) => {
    return generateAndUploadSystemInfo({
        serviceName: cfVariables.serviceName,
        version: cfVariables.bucketPrefix,
        bucket: cfVariables.deploymentBucket,
        systemInfoFile: `${constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory}/${constants.INFRASTRUCTURE_CONSTANTS.defaultSystemInfoFileName}`,
        profile: argv.profile
    });
}

async function createSystemInfoEndpointCmd(restApiId) {
    return systemInfoInjector.injectSystemInfo({
        iam: new AWS.IAM(),
        apiGateway: new AWS.APIGateway(),
        restApiId: restApiId,
        stage: cfVariables.stage,
        serviceName: cfVariables.serviceName,
        region: argv.region,
        bucket: cfVariables.deploymentBucket,
        bucketPrefix: cfVariables.bucketPrefix
    });
}
let restApiId;
const credentialsParams = { profile: argv.profile, region: argv.region };
const commandsDefault = [
    utils.shellCommand(`cf-merge --infrastructure_file ${cfVariables.infrastructureFile} ${profileAndRegionArgs}`, 'Merging...'),
    utils.shellCommand(`cf-package --bucket ${cfVariables.deploymentBucket} --bucket_prefix ${cfVariables.bucketPrefix} ${profileAndRegionArgs}`, `Packaging...
    using bucket: ${cfVariables.deploymentBucket} bucket_prefix: ${cfVariables.bucketPrefix}`),
    utils.shellCommand(`cf-just-deploy --parameters_file ${cfVariables.parameterFile} --template_file ${cfVariables.templateFile} --stack_name ${cfVariables.stackName} ${profileAndRegionArgs} ${releaseArg}`, `Deploying...`),
    utils.awsShellCommand(`aws cloudformation describe-stacks --stack-name ${cfVariables.stackName} ${profileAndRegionArgs}`, `Get deployed stack status...`),
    async (_prevResult) => {
        try {
            restApiId = await utils.getApiId({
                AWSCloudFormation: new AWS.CloudFormation(),
                stackName: cfVariables.stackName,
                profile: argv.profile,
                region: argv.region
            });
        }
        catch (err) {
            utils.ylog(`No REST API found`);
        }
    }
];
const commandsForRestAPIService = [
    generateAndUploadSystemInfoCmd,
    async (_prevResult) => {
        if (cfVariables.createSystemInfoEndpoint) {
            await createSystemInfoEndpointCmd(restApiId)
        }
    },
    (_prevResult) => {
        lbHandling.createLBEntry({
            hostedZoneName: constants.ROUTE53_CONSTANTS.get(cfVariables.stage).hostedZoneName,
            customDomainName: constants.ROUTE53_CONSTANTS.getCustomDomainName(cfVariables.serviceName, cfVariables.stage),
            certificateArn: constants.ROUTE53_CONSTANTS.get(cfVariables.stage).certificateArn,
            basePath: constants.ROUTE53_CONSTANTS.get(cfVariables.stage).basePath,
            stage: cfVariables.stage,
            serviceName: cfVariables.serviceName,
            restApiId: restApiId
        }, credentialsParams);
    },
    (_prevResult) => {
        apiDocHandling.publishApiDoc({
            stage: cfVariables.stage,
            serviceName: cfVariables.serviceName,
            restApiId: restApiId,
            apiDocBucket: cfVariables.apiDocBucket,
            version: cfVariables.version
        }, credentialsParams);
    }
];

utils.ylog("Performing all the operations together.");
(async () => {
    await utils.runCommands(commandsDefault);
    if (restApiId) {
        await utils.runCommands(commandsForRestAPIService);
    }
})();
