#! /usr/bin/env node

const AWS = require('aws-sdk');
const argv = require('yargs').argv;
const utils = require('./lib/utils');

if (!argv.bucket) {
    console.error(`ERROR: Missing deployment bucket name, use --bucket=<s3 bucket name>, e.g. --bucket=my-s3-bucket`);
    process.exit(1);
}

if (!argv['release-version']) {
    console.error(`ERROR: Missing release version number, use --release-version=<version>, e.g. --release-version=1.20.30`);
    process.exit(1);
}

const region = (argv.region) ? argv.region : constants.DEFAULT_REGION;
utils.loadCredentials(AWS, argv.profile, region);

const s3 = new AWS.S3();

let errorCode = 0;
let finalPolicy;
(async () => {
    try {
        finalPolicy = await s3.getBucketPolicy({ Bucket: argv.bucket }).promise();
        let resource = JSON.parse(policy.Policy).Statement[0].Resource;
        const newResource = `arn:aws:s3:::${argv.bucket}/${argv['release-version']}/*`;
        if (typeof (resource) === 'string') {
            resource = [resource, newResource];
        } else {
            resource.push(newResource);
        }
        console.log(`received policy: ${JSON.stringify(resource)}`);
    } catch (err) {
        if (err.statusCode === 404) {
            finalPolicy = require('../templates/bucket-policy.template.json');
            const resource = finalPolicy.Statement[0].Resource[0].replace(/\$DEPLOYMENT_BUCKET/, argv.bucket).replace(/\$VERSION/, argv['release-version']);
            finalPolicy.Statement[0].Resource = [resource];
            console.log(`${JSON.stringify(finalPolicy)}`);
        } else {
            console.error(`ERROR: ${err.message} ${JSON.stringify(err)}`, err.stack);
            errorCode++;
        }

    } finally {
        try {
            await s3.putBucketPolicy({ Bucket: argv.bucket, Policy: JSON.stringify(finalPolicy) }).promise();
        } catch (err) {
            console.error(`ERROR: ${err.message} ${JSON.stringify(err)}`, err.stack);
            errorCode++;
        }
        process.exit(errorCode);
    }
})();