#! /usr/bin/env node

const AWS = require('aws-sdk');
const argv = require('yargs').argv;
const utils = require('./lib/utils');

if (!argv.stack_name) {
    console.error(`ERROR: Missing CloudFormation stack name, use --stack_name=<stack name>, e.g. --stack_name=myMasterDataStack`);
    process.exit(1);
}

const region = (argv.region) ? argv.region : constants.DEFAULT_REGION;
utils.loadCredentials(AWS, argv.profile, region);

const cf = new AWS.CloudFormation();

const params = {
    StackName: argv.stack_name
};

cf.describeStackResources(params).promise()
    .then(res => {
        const apiRes = res.StackResources.filter(r => {
            return r.ResourceType === 'AWS::ApiGateway::RestApi'
        });
        if (apiRes.length > 0) {
            console.log(apiRes[0].PhysicalResourceId);
        }
    })
    .catch(err => {
        console.error(`ERROR: ${err.message}`, err.stack);
        process.exit(1);
    });