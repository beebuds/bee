#! /usr/bin/env node

const shell = require('shelljs');
const argv = require('yargs').argv;
const fs = require('fs');
const yaml = require('js-yaml');
const utils = require('./lib/utils');

if (!argv.parameters_file) {
    utils.rlog('Error: Missing configuration file, use --parameters_file=<realtive path to YAML configuration file>, e.g. --parameters_file=./some-path/test-config.yml');
    process.exit(1);
}

if (!argv.template_file) {
    utils.rlog('Error: Missing CloudFormation template file, use --template_file=<CloudFormation template file>, e.g. --template_file=my-deployable-template.yml');
    process.exit(1);
}
if (!argv.stack_name) {
    utils.rlog('Error: Missing stack name to be deployed to, use --stack_name=<a stack name>, e.g. --stack_name=my-stack');
    process.exit(1);
}

let parameters = '';
if (!fs.existsSync(argv.parameters_file)) {
    utils.rlog('Error: Could not find file ' + argv.parameters_file);
    process.exit(1);
}
const params = yaml.safeLoad(fs.readFileSync(argv.parameters_file, 'utf8'));
const releaseVersion = argv['release-version'];
if (releaseVersion && typeof (releaseVersion) === 'string') {
    params.Version = releaseVersion;
}
const paramKeys = Object.keys(params);
parameters = paramKeys.reduce((out, paramKey) => {
    return (out) ? out + ' ' + paramKey + '=' + params[paramKey] : paramKey + '=' + params[paramKey];
}, parameters);
utils.wlog('got config parameters: ' + parameters);

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

if (utils.awsShellCommand(`aws cloudformation deploy --template-file ${argv.template_file} --stack-name ${argv.stack_name} --capabilities "CAPABILITY_IAM" "CAPABILITY_AUTO_EXPAND" "CAPABILITY_NAMED_IAM" --parameter-overrides ${parameters} ${profileAndRegionArgs}`)().code !== 0) {
    utils.rlog(`Error: Could not deploy stack '${argv.stack_name}' to region '${argv.region}' using template '${argv.template_file}'`)
    process.exit(1);
};

