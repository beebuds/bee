#! /usr/bin/env node
const utils = require('./lib/utils');
const shell = require('shelljs');
const argv = require('yargs').argv;
const fs = require('fs');
const constants = require('./lib/constants');

const cfVarFileName = 'cf-variables.json';
function verifyCfVaiables(cfVariables) {
    if (!cfVariables.templateFile) {
        utils.rlog(`Error: Missing CloudFormation template file in ${cfVarFileName}`);
        process.exit(1);
    }

    if (!cfVariables.deploymentBucket) {
        utils.rlog(`Error: Missing s3 bucket name for upload in ${cfVarFileName}`);
        process.exit(1);
    }

    if (!cfVariables.bucketPrefix) {
        utils.rlog(`Error: Missing s3 bucket prefix for upload ${cfVarFileName}`);
        process.exit(1);
    }
}

const cfVariablesPath = `${constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory}/${cfVarFileName}`;
if (!fs.existsSync(cfVariablesPath)) {
    utils.rlog(`Error: ${cfVariablesPath} not found, execute 'bee deploy' first!`);
    process.exit(1);
}

const cfVariables = JSON.parse(fs.readFileSync(cfVariablesPath, 'utf8'));
verifyCfVaiables(cfVariables);

const templateFile = cfVariables.templateFileName;
const infrastructureS3Uri = `s3://${cfVariables.deploymentBucket}/${cfVariables.bucketPrefix}/infrastructure`;
const s3Uri = `${infrastructureS3Uri}/${utils.removeStartingDotSlash(templateFile)}`;
const args = (argv.profile) ? `--profile=${argv.profile}` : '';

function generateScriptFileNameByStage(stage) {
    return `deploy-${cfVariables.serviceName}-${cfVariables.bucketPrefix}-to-${stage}.js`;
}
function generateDeployScript(stage) {
    if (shell.exec(`generate-deploy-script --service-name ${cfVariables.serviceName} --release-version ${cfVariables.bucketPrefix} --stage ${stage} --parameters-file ${cfVariables.parameterDirectory}`).code !== 0) {
        utils.rlog(`Error: Could not generate deploy script for stage '${stage}'`);
        process.exit(1);
    };
}
function uploadDeployScript(script) {
    utils.uploadToS3(script, cfVariables.deploymentBucket, `${cfVariables.bucketPrefix}/infrastructure`);
}

function generateAndUploadScriptForStage(stage) {
    generateDeployScript(stage);
    uploadDeployScript(generateScriptFileNameByStage(stage));
}

if (shell.exec(`set-bucket-policy --bucket=${cfVariables.deploymentBucket} --release-version=${cfVariables.bucketPrefix} ${args}`).code !== 0) {
    utils.rlog(`Error: Could not set bucket policy for '${cfVariables.deploymentBucket}'`);
    process.exit(1);
}

if (shell.exec(`cd ${constants.INFRASTRUCTURE_CONSTANTS.infrastrutureDirectory} && aws s3 cp ${cfVariables.templateFile} ${s3Uri} ${args}`).code !== 0) {
    utils.rlog(`Error: Could not publish '${cfVariables.templateFile}' to ${s3Uri}`);
    process.exit(1);
};

generateAndUploadScriptForStage('contiprelive');
generateAndUploadScriptForStage('contilive');
