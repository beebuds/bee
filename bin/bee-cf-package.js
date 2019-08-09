#! /usr/bin/env node
const shell = require('shelljs');
const argv = require('yargs').argv;
const utils = require('./lib/utils');
const constants = require('./lib/constants');

if (!argv.bucket) {
    utils.rlog('Error: Missing s3 bucket name, use --bucket=<bucket name>');
    process.exit(1);
}
if (!argv.bucket_prefix) {
    utils.rlog('Error: Missing s3 bucket prefix, use --bucket_prefix=<bucket prefix>, e.g. --bucket_prefix=stage/1.2.0');
    process.exit(1);
}

const tempDir = constants.INFRASTRUCTURE_CONSTANTS.defaultOutDirectory;
const templateFile = (argv.template_file) ? argv.template_file : `${tempDir}/${constants.INFRASTRUCTURE_CONSTANTS.defaultGeneratedCFFile}`;
const outputTemplateFile = (argv.output_template_file) ? argv.output_template_file : `${tempDir}/${constants.INFRASTRUCTURE_CONSTANTS.defaultPackagedCFFile}`;
const region = (argv.region) ? argv.region : 'eu-west-1';
const profileOption = (argv.profile) ? `--profile ${argv.profile}` : '';
const codeForS3Lookup = shell.exec(`${constants.INFRASTRUCTURE_CONSTANTS.awsCliCommand} s3api head-bucket --bucket ${argv.bucket} ${profileOption}`).code;

console.log("code for s3 lookup ", codeForS3Lookup);

if (codeForS3Lookup !== 0) {
    utils.ylog(`Warn: S3 bucket '${argv.bucket}' not found, will create it...`);
    if (utils.awsShellCommand(`aws s3 mb s3://${argv.bucket} --region=${region} ${profileOption}`)().code !== 0) {
        utils.rlog(`Error: Could not create S3 bucket '${argv.bucket}'.`);
        process.exit(1);
    }
}

if (utils.awsShellCommand(`aws cloudformation package --template-file ${templateFile} --s3-bucket ${argv.bucket} --s3-prefix ${argv.bucket_prefix} --output-template-file ${outputTemplateFile} ${profileOption}`)().code !== 0) {
    utils.rlog(`Error: Could not package artifacts and upload to '${argv.bucket}'.`);
    process.exit(1);
}
